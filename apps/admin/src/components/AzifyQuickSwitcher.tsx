import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb, type ShopifyConnection } from "@ecomcod/shared";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Layers,
  RefreshCw,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";

interface AzifyQuickSwitcherProps {
  workspaceId: string;
  onNavigateToAzifySettings?: () => void;
  className?: string;
  compact?: boolean;
}

const AZIFY_STUDIO_URL = "https://azishop-pwa-studio.vercel.app";

export default function AzifyQuickSwitcher({
  workspaceId,
  onNavigateToAzifySettings,
  className = "",
  compact = false,
}: AzifyQuickSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [azifyConns, setAzifyConns] = useState<ShopifyConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Écoute en temps réel des boutiques Azify connectées au workspace
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
            d.azifyStoreId ||
            d.azifyStoreSlug ||
            (d.domains || []).some((dom: string) => dom.toLowerCase().includes("azishop-pwa-studio")) ||
            (d.shopDomain || "").toLowerCase().includes("azishop-pwa-studio");
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

  // Fermeture au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const activeConn = azifyConns.find((c) => c.status === "active") || azifyConns[0];
  const activeCount = azifyConns.filter((c) => c.status === "active").length;
  const storeName = activeConn?.shopName || activeConn?.shopDomain || "Azify Studio";

  const handleOpenStudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetUrl = activeConn?.customDomain
      ? `https://${activeConn.customDomain}`
      : activeConn?.shopDomain && !activeConn.shopDomain.includes("dummy")
        ? `https://${activeConn.shopDomain}`
        : AZIFY_STUDIO_URL;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* 
        Le rectangle de basculement Azify :
        - En mode sombre WariTrack (dark:) : Fond BLANC solide, texte NOIR très contrasté
        - En mode clair WariTrack (light) : Fond NOIR solide, texte BLANC très contrasté
        Style Anti-Slop : pas de dégradé violet, pas de flou néon, bordures nettes et typographie franche.
      */}
      <div className="flex items-center rounded-lg shadow-sm">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title="Basculer vers Azify (Studio & Boutiques e-commerce)"
          className={`
            group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all select-none
            min-h-[40px] md:min-h-[36px]
            /* Mode clair : Noir solide avec texte blanc */
            bg-slate-900 text-white border border-slate-900 hover:bg-slate-800
            /* Mode sombre : Blanc solide avec texte noir */
            dark:bg-white dark:text-slate-950 dark:border-white dark:hover:bg-slate-100
          `}
        >
          {/* Logo officiel d'Azify */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-transparent">
            <img
              src="/icons/azify-logo-192.png"
              alt="Logo Azify"
              className="h-full w-full object-contain"
              onError={(e) => {
                // Fallback icône Store si l'image png mettait du temps à charger
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>

          {!compact && (
            <div className="flex items-center gap-1.5 leading-none">
              <span className="tracking-tight font-extrabold">Azify</span>
              {activeCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="hidden xl:inline">{activeCount} boutique{activeCount > 1 ? "s" : ""}</span>
                </span>
              ) : (
                <span className="hidden xl:inline text-[10px] font-semibold opacity-70">Studio</span>
              )}
            </div>
          )}

          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            } opacity-70 group-hover:opacity-100`}
          />
        </button>
      </div>

      {/* Menu déroulant de basculement rapide Azify */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-surface-border bg-surface-raised p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* En-tête du menu */}
          <div className="flex items-center justify-between border-b border-surface-border pb-2 px-1 mb-2">
            <div className="flex items-center gap-2">
              <img
                src="/icons/azify-logo-192.png"
                alt="Azify"
                className="h-4 w-4 object-contain"
              />
              <span className="text-xs font-bold text-slate-100">Écosystème Azify</span>
            </div>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Passerelle active
              </span>
            )}
          </div>

          {/* Action principale : Basculer vers Azify Studio */}
          <button
            type="button"
            onClick={handleOpenStudio}
            className="flex w-full items-center justify-between rounded-lg bg-brand/10 hover:bg-brand/20 border border-brand/30 px-3 py-2 text-left text-xs font-semibold text-brand-light transition-colors mb-2"
          >
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-brand" />
              <div>
                <p className="font-bold text-slate-100">Ouvrir Azify Studio</p>
                <p className="text-[10px] text-slate-400">Vitrine & constructeur de boutiques</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-brand" />
          </button>

          {/* Liste des boutiques connectées ou message d'invitation */}
          {azifyConns.length > 0 ? (
            <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 pt-1">
                Boutiques connectées ({azifyConns.length})
              </p>
              {azifyConns.map((conn) => {
                const isOnline = conn.status === "active";
                return (
                  <a
                    key={conn.id}
                    href={
                      conn.customDomain
                        ? `https://${conn.customDomain}`
                        : conn.shopDomain
                          ? `https://${conn.shopDomain}`
                          : AZIFY_STUDIO_URL
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-md p-1.5 text-xs text-slate-300 hover:bg-surface hover:text-white transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isOnline ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="truncate font-medium">{conn.shopName || conn.shopDomain}</span>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-surface p-2.5 text-center mb-2">
              <Sparkles className="mx-auto h-4 w-4 text-amber-400 mb-1" />
              <p className="text-xs font-semibold text-slate-200">Connectez vos boutiques Azify</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Synchronisez commandes COD, stocks et flux en 1 clic.
              </p>
            </div>
          )}

          {/* Lien vers la configuration des flux dans Paramètres */}
          {onNavigateToAzifySettings && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateToAzifySettings();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-surface-subtle transition-colors"
            >
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              <span>Gérer les flux & passerelles Azify</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
