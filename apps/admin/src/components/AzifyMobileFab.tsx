import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb, type ShopifyConnection, type Team } from "@ecomcod/shared";
import {
  Store,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  X,
  PlusCircle,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import AzifyConnectionSheet from "./AzifyConnectionSheet";

interface AzifyMobileFabProps {
  workspaceId: string;
  activeTeam?: Team | null;
  onNavigateToAzifySettings?: () => void;
}

const AZIFY_ADMIN_URL = "https://azishop-pwa-studio.vercel.app";

export default function AzifyMobileFab({
  workspaceId,
  activeTeam,
  onNavigateToAzifySettings,
}: AzifyMobileFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConnectSheet, setShowConnectSheet] = useState(false);
  const [azifyConns, setAzifyConns] = useState<ShopifyConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // Écoute temps réel des connexions Azify du workspace
  useEffect(() => {
    if (!workspaceId) return;
    const colRef = collection(getDb(), "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list: ShopifyConnection[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const isAzify =
            d.sourcePlatform === "azify" ||
            Boolean(d.azifyStoreId) ||
            Boolean(d.azifyStoreSlug) ||
            (d.domains || []).some((dom: string) => dom.toLowerCase().includes("azishop")) ||
            (d.shopDomain || "").toLowerCase().includes("azishop");
          if (isAzify) {
            list.push({ id: docSnap.id, ...d });
          }
        });
        setAzifyConns(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [workspaceId]);

  const activeCount = azifyConns.filter((c) => c.status === "active").length;

  const handleOpenAzifyAdmin = () => {
    window.open(AZIFY_ADMIN_URL, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  const handleRegisterAzify = () => {
    // Redirige vers la création de compte / enregistrement de boutique Azify
    window.open(`${AZIFY_ADMIN_URL}`, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <>
      {/* 
        Bouton Flottant Mobile en Bas à Droite :
        - Contraste solide Anti-Slop :
          - Mode sombre : Fond blanc pur solide, icône et bordure noire
          - Mode clair : Fond noir solide, icône et bordure blanche
        - Zone tactile minimale : 48px
      */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Ouvrir le panneau Azify"
        className={`
          md:hidden fixed bottom-5 right-4 z-40
          flex h-12 w-12 items-center justify-center rounded-2xl shadow-2xl transition-transform active:scale-90
          /* Mode clair : Noir solide avec bordure nette */
          bg-slate-900 text-white border border-slate-800
          /* Mode sombre : Blanc solide avec bordure nette */
          dark:bg-white dark:text-slate-950 dark:border-white
        `}
      >
        <div className="relative flex h-6 w-6 items-center justify-center">
          <img
            src="/icons/azify-logo-192.png"
            alt="Azify"
            className="h-full w-full object-contain"
          />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 dark:ring-white animate-pulse" />
          )}
        </div>
      </button>

      {/* Modal / Tiroir Mobile Azify Hub */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
            {/* En-tête */}
            <div className="flex items-center justify-between border-b border-surface-border pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 dark:bg-white p-1">
                  <img
                    src="/icons/azify-logo-192.png"
                    alt="Azify"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Azify Admin Studio</span>
                    {activeCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {activeCount} active{activeCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400">Écosystème e-commerce & Studio COD</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-surface transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actions principales */}
            <div className="space-y-2 mb-3">
              {/* 1. Ouvrir l'Admin Azify */}
              <button
                type="button"
                onClick={handleOpenAzifyAdmin}
                className="flex w-full items-center justify-between rounded-xl bg-brand px-3.5 py-3 text-left font-semibold text-white shadow-sm hover:opacity-95 transition-opacity min-h-[48px]"
              >
                <div className="flex items-center gap-2.5">
                  <Store className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold leading-tight">Ouvrir l'Admin Azify Studio</p>
                    <p className="text-[10px] text-white/80 font-normal">Gérer le catalogue, paniers et vitrines</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-white/90" />
              </button>

              {/* 2. Invitation à créer un compte si besoin */}
              <div className="rounded-xl border border-surface-border bg-surface p-3 text-left">
                <p className="text-[11px] font-bold text-slate-200">Pas encore de compte Azify ?</p>
                <p className="text-[10px] text-slate-400 mt-0.5 mb-2">
                  Créez votre boutique COD en quelques secondes avec l'éditeur visuel ultra-rapide Azify.
                </p>
                <button
                  type="button"
                  onClick={handleRegisterAzify}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-[11px] font-semibold text-brand-light hover:bg-brand/20 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Créer mon compte Azify</span>
                </button>
              </div>

              {/* 3. Connecter & Assigner une équipe WariTrack */}
              <button
                type="button"
                onClick={() => {
                  setShowConnectSheet(true);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-left text-xs font-medium text-slate-200 hover:bg-surface-subtle transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Associer une boutique & choisir une équipe</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400">1-clic</span>
              </button>
            </div>

            {/* Boutiques actives rattachées */}
            {azifyConns.length > 0 && (
              <div className="border-t border-surface-border pt-2 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Boutiques associées ({azifyConns.length})
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {azifyConns.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg bg-surface/70 px-2.5 py-1.5 text-xs text-slate-300"
                    >
                      <span className="flex items-center gap-2 truncate font-medium">
                        <span className={`h-2 w-2 rounded-full ${c.status === "active" ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {c.shopName || c.shopDomain}
                      </span>
                      <span className="text-[10px] text-slate-400">{(c as any).defaultCountry || "TG"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lien Réglages complets */}
            {onNavigateToAzifySettings && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToAzifySettings();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface py-2 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                <span>Gérer les flux & passerelles Azify</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feuille de connexion & sélection d'équipe */}
      {showConnectSheet && (
        <AzifyConnectionSheet
          workspaceId={workspaceId}
          userEmail={null}
          onCompleted={() => setShowConnectSheet(false)}
          onCancel={() => setShowConnectSheet(false)}
        />
      )}
    </>
  );
}
