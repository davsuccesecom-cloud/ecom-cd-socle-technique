import { useState } from "react";
import ThemeQuickPicker from "./ThemeQuickPicker";
import WariTrackLogo from "./WariTrackLogo";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Layers,
  Users,
  Wallet,
  Landmark,
  Settings,
  Globe,
  FileBarChart2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  active: string;
  userEmail: string | null;
  pendingOrdersCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onLogout: () => void;
  onNavigate: (key: string) => void;
  onOpenWhatsNew?: () => void;
}

interface NavGroup {
  title: string;
  items: {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const GROUPS: NavGroup[] = [
  {
    title: "Pilotage",
    items: [
      { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
      { key: "ai_assistant", label: "Analyste Direction", icon: FileBarChart2 },
    ],
  },
  {
    title: "Opérations",
    items: [
      { key: "orders", label: "Commandes", icon: ShoppingBag },
      { key: "performance", label: "Performance", icon: BarChart3 },
    ],
  },
  {
    title: "Équipes & Paie",
    items: [
      { key: "teams", label: "Équipes & Marchés", icon: Layers },
      { key: "users", label: "Utilisateurs & Accès", icon: Users },
      { key: "caisse", label: "Caisse & Versements", icon: Landmark },
      { key: "remuneration", label: "Rémunération", icon: Wallet },
    ],
  },
  {
    title: "Système",
    items: [
      { key: "settings", label: "Paramètres & Flux", icon: Settings },
    ],
  },
];

export default function Sidebar({
  active,
  userEmail,
  pendingOrdersCount = 0,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  onLogout,
  onNavigate,
  onOpenWhatsNew,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isControlled = typeof controlledCollapsed === "boolean";
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const toggleCollapsed = () => {
    if (isControlled && onToggleCollapse) {
      onToggleCollapse(!controlledCollapsed);
    } else {
      setInternalCollapsed((v) => !v);
    }
  };

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } catch (err) {
      console.error("Erreur déconnexion :", err);
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <aside
      className={`sidebar-surface sticky top-0 hidden h-screen shrink-0 flex-col border-r border-surface-border py-4 transition-all duration-150 md:flex ${
        collapsed ? "w-16 px-2" : "w-60 px-3.5"
      }`}
    >
      {/* En-tête marque + bouton réduction */}
      <div className="mb-6 flex items-center justify-between px-1.5">
        <WariTrackLogo variant={collapsed ? "icon" : "full"} subtitle="LOGISTICS OS" />
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Déplier le menu" : "Réduire le menu"}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-surface hover:text-slate-200 shrink-0"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation structurée par pôles (scrollbar invisible & propre) */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              const showBadge = item.key === "orders" && pendingOrdersCount > 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  title={collapsed ? item.label : undefined}
                  onClick={() => onNavigate(item.key)}
                  className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-brand-light text-brand font-semibold"
                      : "text-slate-400 hover:bg-surface hover:text-slate-100"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-brand" />
                  )}
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-brand" : "text-slate-400 group-hover:text-slate-200"}`} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {showBadge && !collapsed && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400">
                      {pendingOrdersCount}
                    </span>
                  )}
                  {showBadge && collapsed && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Mode Mise à jour (v3.2) */}
      {onOpenWhatsNew && (
        <div className="pt-2">
          {!collapsed ? (
            <button
              type="button"
              onClick={onOpenWhatsNew}
              className="flex w-full items-center justify-between rounded-xl border border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-purple-500/10 to-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition group shadow-sm"
              title="Consulter les nouveautés de la mise à jour v3.2"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-sky-400 group-hover:rotate-12 transition-transform" />
                <span>Mode Mise à Jour</span>
              </div>
              <span className="rounded-md bg-sky-500/25 px-1.5 py-0.2 text-[9.5px] text-sky-200 font-mono font-bold">
                v3.2
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenWhatsNew}
              className="flex w-full justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 p-2 text-sky-400 hover:bg-sky-500/20 transition"
              title="Mode Mise à Jour (v3.2)"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Pied de barre : contrôleur de couleur & compte administrateur */}
      <div className="mt-3 space-y-2.5 border-t border-surface-border pt-3">
        <ThemeQuickPicker variant="sidebar" collapsed={collapsed} />

        <div className={`flex items-center gap-2.5 px-1.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface text-xs font-bold text-brand">
            {(userEmail ?? "A").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-200">Direction Admin</p>
              <p className="truncate text-[11px] text-slate-500">{userEmail}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title="Se déconnecter"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            <LogOut className={`h-4 w-4 ${loggingOut ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </aside>
  );
}
