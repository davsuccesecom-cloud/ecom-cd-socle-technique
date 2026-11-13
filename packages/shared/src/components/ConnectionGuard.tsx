import React, { useEffect, useState } from "react";
import { useConnectionGuard } from "../hooks/useConnectionGuard";

interface ConnectionGuardProps {
  children: React.ReactNode;
  appName?: string;
}

interface SwUpdateEventDetail {
  applyUpdate?: () => void;
}

/**
 * Indicateur réseau et mise à jour PWA non bloquants : grâce au cache local
 * persistant Firestore (`persistentLocalCache`), l'utilisateur continue de
 * consulter et modifier ses commandes hors-ligne. Les actions sont synchronisées
 * dès le retour du réseau, et les mises à jour s'appliquent sur demande.
 */
export function ConnectionGuard({ children, appName }: ConnectionGuardProps) {
  const status = useConnectionGuard();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [swUpdateHandler, setSwUpdateHandler] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (status === "offline") {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      setWasOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [status, wasOffline]);

  useEffect(() => {
    const handleSwUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<SwUpdateEventDetail>;
      const applyUpdate = customEvent.detail?.applyUpdate;
      setSwUpdateHandler(() => (applyUpdate ? applyUpdate : () => window.location.reload()));
    };
    window.addEventListener("waritrack-sw-update", handleSwUpdate);
    return () => window.removeEventListener("waritrack-sw-update", handleSwUpdate);
  }, []);

  return (
    <>
      {children}
      {swUpdateHandler && (
        <div
          role="status"
          aria-live="polite"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[9992] flex justify-center px-3 pt-2"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-brand/40 bg-surface-raised px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-xl">
            <span>Nouvelle version WariTrack prête</span>
            <button
              type="button"
              onClick={() => swUpdateHandler()}
              className="min-h-[36px] rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
            >
              Actualiser
            </button>
          </div>
        </div>
      )}
      {status === "offline" && (
        <div
          role="status"
          aria-live="polite"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[9990] flex justify-center px-3 pt-2"
        >
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950 px-4 py-2.5 text-xs font-medium text-amber-100 shadow-lg">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <span>
              Mode hors-ligne {appName ? `(${appName})` : ""} · Actions sauvegardées et synchronisées au retour du réseau
            </span>
          </div>
        </div>
      )}
      {status === "online" && showReconnected && (
        <div
          role="status"
          aria-live="polite"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[9990] flex justify-center px-3 pt-2"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950 px-4 py-2 text-xs font-medium text-emerald-100 shadow-lg">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <span>Connexion rétablie · Données synchronisées</span>
          </div>
        </div>
      )}
    </>
  );
}
