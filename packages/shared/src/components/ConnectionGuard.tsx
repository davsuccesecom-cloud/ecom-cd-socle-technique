import React, { useEffect, useState, useCallback } from "react";
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
 * dès le retour du réseau, et les mises à jour s'appliquent avec rétroaction
 * tactile immédiate et rechargement garanti.
 */
export function ConnectionGuard({ children, appName }: ConnectionGuardProps) {
  const status = useConnectionGuard();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [swUpdateHandler, setSwUpdateHandler] = useState<(() => void) | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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
      setDismissed(false);
    };
    window.addEventListener("waritrack-sw-update", handleSwUpdate);
    return () => window.removeEventListener("waritrack-sw-update", handleSwUpdate);
  }, []);

  const handleApplyUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      // 1. Exécuter le handler enregistré par Vite PWA
      if (swUpdateHandler) {
        try {
          swUpdateHandler();
        } catch (e) {
          console.warn("[PWA] Erreur swUpdateHandler :", e);
        }
      }

      // 2. Déclencher activement SKIP_WAITING sur tous les Service Workers enregistrés
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: "SKIP_WAITING" });
            }
          }

          // Écouter le changement de contrôleur pour recharger dès que le nouveau SW est actif
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              window.location.reload();
            },
            { once: true }
          );
        } catch (e) {
          console.warn("[PWA] Erreur broadcast SKIP_WAITING :", e);
        }
      }
    } catch (err) {
      console.warn("[PWA] Erreur durant la mise à jour :", err);
    }

    // 3. Filet de sécurité 1 : Forcer le rechargement après 350ms si controllerchange n'a pas tiré
    setTimeout(() => {
      window.location.reload();
    }, 350);

    // 4. Filet de sécurité 2 : Forcer par URL après 1200ms au cas où reload() soit mis en pause
    setTimeout(() => {
      window.location.href = window.location.href.split("#")[0];
    }, 1200);
  }, [isUpdating, swUpdateHandler]);

  return (
    <>
      {children}

      {/* Toast Mise à Jour PWA */}
      {swUpdateHandler && !dismissed && (
        <div
          role="status"
          aria-live="polite"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[9999] flex justify-center px-3"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-sky-500/40 bg-surface-raised px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-2xl backdrop-blur-md transition-all">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>

            <span className="font-bold">Nouvelle version WariTrack prête</span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-brand hover:bg-brand/90 active:scale-95 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition-all cursor-pointer select-none disabled:opacity-60"
              >
                {isUpdating ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Actualisation…</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                    <span>Actualiser</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                title="Ignorer pour l'instant"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface transition-colors cursor-pointer"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Hors-Ligne */}
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

      {/* Connexion Rétablie */}
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
