import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb, type ShopifyConnection, type Team } from "@ecomcod/shared";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Layers,
  PlusCircle,
  Sparkles,
  Store,
  UserPlus,
  Users,
  Mail,
  ShieldCheck,
  Zap,
} from "lucide-react";
import AzifyConnectionSheet from "./AzifyConnectionSheet";

interface AzifyQuickSwitcherProps {
  workspaceId: string;
  onNavigateToAzifySettings?: () => void;
  className?: string;
  compact?: boolean;
}

const AZIFY_ADMIN_URL = "https://azishop-pwa-studio.vercel.app/admin";
const AZIFY_REGISTER_URL = "https://azishop-pwa-studio.vercel.app/admin/login";

export default function AzifyQuickSwitcher({
  workspaceId,
  onNavigateToAzifySettings,
  className = "",
  compact = false,
}: AzifyQuickSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConnectSheet, setShowConnectSheet] = useState(false);
  const [azifyConns, setAzifyConns] = useState<ShopifyConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAccount, setActiveAccount] = useState<string>(() => {
    return localStorage.getItem("waritrack_azify_active_account") || "principal";
  });
  const [multiAccounts, setMultiAccounts] = useState<Array<{ id: string; name: string; email: string; provider: "google" | "email"; active: boolean }>>(() => {
    try {
      const saved = localStorage.getItem("waritrack_azify_multi_accounts");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "principal", name: "Compte Principal", email: "admin@azify.com", provider: "google", active: true }
    ];
  });
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountProvider, setNewAccountProvider] = useState<"google" | "email">("google");

  const handleSwitchAccount = (accountId: string) => {
    setActiveAccount(accountId);
    localStorage.setItem("waritrack_azify_active_account", accountId);
    setMultiAccounts((prev) => {
      const updated = prev.map((a) => ({ ...a, active: a.id === accountId }));
      localStorage.setItem("waritrack_azify_multi_accounts", JSON.stringify(updated));
      return updated;
    });
  };

  const handleAddAccount = (provider: "google" | "email", customEmail?: string) => {
    const id = `acc_${Date.now()}`;
    const email = customEmail || (provider === "google" ? "google-auth@azify.com" : "email-auth@azify.com");
    const name = `Boutique ${provider === "google" ? "Google" : "Email"} #${multiAccounts.length + 1}`;
    const newAcc = { id, name, email, provider, active: true };
    const updated = multiAccounts.map((a) => ({ ...a, active: false })).concat(newAcc);
    setMultiAccounts(updated);
    setActiveAccount(id);
    localStorage.setItem("waritrack_azify_active_account", id);
    localStorage.setItem("waritrack_azify_multi_accounts", JSON.stringify(updated));
    setShowAddAccountModal(false);
    setNewAccountEmail("");
  };
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

  const activeCount = azifyConns.filter((c) => c.status === "active").length;

  const handleOpenAdminStudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Ouvre TOUJOURS l'admin Azify Studio (/admin), jamais la vitrine client
    window.open(AZIFY_ADMIN_URL, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  const handleRegisterAccount = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Ouvre la page d'inscription / connexion de l'admin Azify
    window.open(AZIFY_REGISTER_URL, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <>
      <div ref={dropdownRef} className={`relative inline-block ${className}`}>
        {/* 
          Le rectangle de basculement Azify :
          - En mode sombre WariTrack (dark:) : Fond BLANC solide, texte NOIR très contrasté
          - En mode clair WariTrack (light) : Fond NOIR solide, texte BLANC très contrasté
          Style Anti-Slop : pas de dégradé violet, bordures nettes et typographie franche.
        */}
        <div className="flex items-center rounded-lg shadow-sm">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            title="Basculer vers Azify Studio Admin"
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
                  <span className="hidden xl:inline text-[10px] font-semibold opacity-70">Admin</span>
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
                <span className="text-xs font-bold text-slate-100">Azify Studio Admin</span>
              </div>
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {activeCount} active{activeCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Action principale : Basculer vers Azify Admin */}
            <button
              type="button"
              onClick={handleOpenAdminStudio}
              className="flex w-full items-center justify-between rounded-lg bg-brand/10 hover:bg-brand/20 border border-brand/30 px-3 py-2 text-left text-xs font-semibold text-brand-light transition-colors mb-2"
            >
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-brand" />
                <div>
                  <p className="font-bold text-slate-100">Ouvrir l'Admin Azify</p>
                  <p className="text-[10px] text-slate-400">Gérer produits, boutiques & flux</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-brand" />
            </button>

            {/* Sélecteur Multi-Comptes Azify (Google & Email) */}
            <div className="rounded-lg bg-surface p-2 text-left mb-2 border border-surface-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Users className="h-3 w-3 text-brand" />
                  Multi-Comptes Azify
                </span>
                <span className="text-[10px] font-mono text-emerald-400">{multiAccounts.length} compte(s)</span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto mb-2">
                {multiAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSwitchAccount(acc.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors ${
                      acc.id === activeAccount
                        ? "bg-brand/20 text-white font-bold border border-brand/40"
                        : "text-slate-300 hover:bg-surface-raised"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {acc.provider === "google" ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-[9px] font-bold text-red-300">G</span>
                      ) : (
                        <Mail className="h-3 w-3 shrink-0 text-sky-400" />
                      )}
                      <span className="truncate text-[11px]">{acc.name}</span>
                    </div>
                    {acc.id === activeAccount && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 pt-1 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => handleAddAccount("google")}
                  className="flex-1 flex items-center justify-center gap-1 rounded bg-surface-raised hover:bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-slate-200 border border-surface-border transition-colors"
                >
                  <span className="text-red-400 font-bold">G</span>
                  <span>+ Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddAccount("email")}
                  className="flex-1 flex items-center justify-center gap-1 rounded bg-surface-raised hover:bg-surface-subtle px-2 py-1 text-[10px] font-semibold text-slate-200 border border-surface-border transition-colors"
                >
                  <Mail className="h-3 w-3 text-sky-400" />
                  <span>+ Email</span>
                </button>
              </div>
            </div>

            {/* Action d'appairage & sélection d'équipe */}
            <button
              type="button"
              onClick={() => {
                setShowConnectSheet(true);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-subtle transition-colors mb-2"
            >
              <div className="flex items-center gap-1.5">
                <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px]">Connecter & choisir une équipe</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400">Pairing</span>
            </button>

            {/* Liste des boutiques connectées */}
            {azifyConns.length > 0 && (
              <div className="space-y-1 mb-2 max-h-36 overflow-y-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 pt-1">
                  Boutiques associées ({azifyConns.length})
                </p>
                {azifyConns.map((conn) => {
                  const isOnline = conn.status === "active";
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between rounded-md p-1.5 text-xs text-slate-300 hover:bg-surface transition-colors"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isOnline ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        <span className="truncate font-medium">{conn.shopName || conn.shopDomain}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{(conn as any).defaultCountry || "TG"}</span>
                    </div>
                  );
                })}
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

      {/* Sheet d'appairage & sélection d'équipe WariTrack */}
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
