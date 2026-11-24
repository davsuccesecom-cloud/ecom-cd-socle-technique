import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  ShieldCheck,
  CheckCircle2,
  X,
  Store,
  Globe2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { getDb, type ShopifyConnection, type Team } from "@ecomcod/shared";
import WariTrackLogo from "./WariTrackLogo";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface PendingStoreConnectionModalProps {
  workspaceId: string;
  teams?: Team[];
  onConnectionApproved?: (connection: ShopifyConnection) => void;
}

export default function PendingStoreConnectionModal({
  workspaceId,
  teams = [],
  onConnectionApproved,
}: PendingStoreConnectionModalProps) {
  const [pendingList, setPendingList] = useState<ShopifyConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedStoreName, setApprovedStoreName] = useState<string | null>(null);

  // Écoute en temps réel de toutes les connexions avec status "pending_approval" ou "pending"
  useEffect(() => {
    if (!workspaceId) return;

    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");

    const unsubscribe = onSnapshot(
      connCol,
      (snapshot) => {
        const list: ShopifyConnection[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ShopifyConnection;
          if (data.status === "pending_approval" || data.status === "pending") {
            list.push({ ...data, id: docSnap.id });
          }
        });
        setPendingList(list);
      },
      (err) => {
        console.warn("Erreur écoute des connexions boutiques en attente :", err);
      }
    );

    return () => unsubscribe();
  }, [workspaceId]);

  if (pendingList.length === 0 && !approvedStoreName) {
    return null;
  }

  const currentConn = pendingList[0];

  const handleApprove = async () => {
    if (!currentConn) return;

    setBusy(true);
    setError(null);

    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", currentConn.id);
      const now = Date.now();

      // Résolution de l'équipe assignée
      const targetTeamId = currentConn.requestedTeamId || currentConn.ownerTeamId;
      const targetTeamName = currentConn.requestedTeamName || currentConn.ownerTeamName;
      const matchingTeam = teams.find((t) => t.id === targetTeamId);
      const countryCode = (matchingTeam?.defaultCountry || "TG").toUpperCase();

      const routes = {
        ...(currentConn.countryRoutes || {}),
        [countryCode]: {
          countryCode,
          assignedTeamId: targetTeamId,
          assignedTeamName: targetTeamName,
          assignedAt: now,
          status: "active" as const,
        },
      };

      // 1. Validation dans Firestore WariTrack
      await updateDoc(connRef, {
        status: "active",
        ownerTeamId: targetTeamId,
        ownerTeamName: targetTeamName,
        activatedAt: now,
        countryRoutes: routes,
      });

      // 2. Notification Webhook directe vers la boutique Azify (multi-domaines avec secours automatique)
      const targetOrigins = [
        currentConn.callbackUrl,
        "https://azishop-pwa-studio.vercel.app",
        "https://azify.shop",
        currentConn.shopDomain ? `https://${currentConn.shopDomain}` : null,
      ].filter(Boolean) as string[];

      for (const origin of targetOrigins) {
        try {
          const cleanUrl = `${origin.replace(/\/$/, "")}/api/integrations/waritrack/webhook`;
          await fetch(cleanUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "connection.approved",
              storeId: (currentConn as any).azifyStoreId || (currentConn as any).storeId || "",
              shopDomain: currentConn.shopDomain,
              status: "connected",
              teamId: targetTeamId,
              teamName: targetTeamName,
              verifyToken: currentConn.verifyToken,
              approvedAt: now,
            }),
          });
          break; // Distribué avec succès
        } catch (_) {}
      }

      // Signal postMessage si onglet parent Azify ouvert
      if (typeof window !== "undefined" && window.opener) {
        try {
          window.opener.postMessage(
            {
              type: "WARITRACK_CONNECTED",
              status: "connected",
              teamId: targetTeamId,
              teamName: targetTeamName,
              shopDomain: currentConn.shopDomain,
            },
            "*"
          );
        } catch (_) {}
      }

      setApprovedStoreName(currentConn.shopName || currentConn.shopDomain);
      if (onConnectionApproved) {
        onConnectionApproved(currentConn);
      }

      // Fermeture automatique du message de succès après 2.2s
      setTimeout(() => {
        setApprovedStoreName(null);
      }, 2200);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!currentConn) return;

    setBusy(true);
    setError(null);

    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", currentConn.id);

      // On passe en statut "rejected"
      await updateDoc(connRef, {
        status: "rejected",
        rejectedAt: Date.now(),
      });
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200">
        {approvedStoreName ? (
          /* Écran bref de confirmation */
          <div className="text-center py-6 animate-in fade-in duration-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Connexion autorisée !</h3>
            <p className="mt-1 text-sm text-slate-300">
              La boutique <span className="font-semibold text-white">« {approvedStoreName} »</span> est désormais connectée et active sur WariTrack.
            </p>
          </div>
        ) : currentConn ? (
          /* Fiche d'Approbation de la Boutique */
          <div className="space-y-5">
            {/* Header Dialog */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <WariTrackLogo size="sm" variant="icon" />
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Demande de Connexion Boutique</span>
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      En attente
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Une boutique externe demande à router ses commandes COD vers WariTrack.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReject}
                disabled={busy}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition-colors cursor-pointer"
                title="Ignorer ou refuser"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Carte Identité Boutique avec Logo */}
            <div className="rounded-xl border border-surface-border bg-surface p-4">
              <div className="flex items-center gap-3.5">
                {currentConn.logoUrl ? (
                  <img
                    src={currentConn.logoUrl}
                    alt={currentConn.shopName || "Logo Boutique"}
                    className="h-14 w-14 rounded-xl object-contain bg-white/5 border border-surface-border p-1 shadow-xs shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand/10 border border-brand/30 text-brand font-black text-xl shrink-0 uppercase">
                    {(currentConn.shopName || currentConn.shopDomain || "B").charAt(0)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-base font-bold text-slate-100">
                      {currentConn.shopName || currentConn.shopDomain}
                    </h4>
                    <span className="shrink-0 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                      Azify Studio
                    </span>
                  </div>
                  <p className="truncate font-mono text-xs text-slate-400 mt-0.5">
                    {currentConn.shopDomain}
                  </p>
                  {currentConn.azifyAccountEmail && (
                    <p className="truncate text-[11px] text-slate-500 mt-0.5">
                      Demandé par : {currentConn.azifyAccountEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Équipe WariTrack Demandée */}
            <div className="rounded-xl border border-brand/30 bg-brand/5 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe2 className="h-3.5 w-3.5 text-brand" />
                  <span>Équipe de destination assignée :</span>
                </span>
                <span className="font-mono text-[11px] text-brand-light font-bold">
                  {currentConn.azifyDefaultCurrency || "XOF"}
                </span>
              </div>
              <p className="text-sm font-bold text-white pl-5">
                {currentConn.requestedTeamName || currentConn.ownerTeamName || "Équipe Principale"}
              </p>
            </div>

            {/* Message de confirmation */}
            <div className="rounded-xl border border-surface-border bg-surface p-3.5 space-y-2 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <p>
                  <strong className="text-slate-200">Transmission synchrone :</strong> Toutes les commandes COD et sessions publicitaires passées sur cette boutique seront instantanément dirigées vers cette équipe.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <p>
                  <strong className="text-slate-200">Confirmation immédiate :</strong> Le statut de la boutique sur Azify passera automatiquement à « Connecté & Actif ».
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Boutons d'Action COD Larges (>= 48px) */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleReject}
                className="w-full sm:w-1/3 min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface px-4 py-3 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-surface-raised transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" />
                <span>Refuser</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleApprove}
                className="w-full sm:w-2/3 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {busy ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Validation de la boutique…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirmer la connexion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
