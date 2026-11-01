import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Layers,
  Users,
  Wallet,
  Settings,
  FileBarChart2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface SidebarProps {
  active: string;
  userEmail: string | null;
  pendingOrdersCount?: number;
  onLogout: () => void;
  onNavigate: (key: string) => void;
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
      { key: "remuneration", label: "Rémunération", icon: Wallet },
    ],
  },
  {
    title: "Système",
    items: [{ key: "settings", label: "Paramètres & Flux", icon: Settings }],
  },
];

export default function Sidebar({
  active,
  userEmail,
  pendingOrdersCount = 0,
  onLogout,
  onNavigate,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-surface-border bg-surface-raised/60 py-5 transition-all duration-150 md:flex ${
        collapsed ? "w-16 px-2" : "w-60 px-3.5"
      }`}
    >
      {/* En-tête marque + bouton réduction */}
      <div className="mb-6 flex items-center justify-between px-1.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-surface">
            <img src="/icons/icon-192.png" alt="Ecom COD" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-slate-100">
                Ecom COD
              </span>
              <span className="block truncate text-[10px] font-medium text-slate-500">
                Pilotage Opérationnel
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Déplier le menu" : "Réduire le menu"}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-surface hover:text-slate-200"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation structurée par pôles */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
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

      {/* Pied de barre : compte & déconnexion directe */}
      <div className="mt-4 border-t border-surface-border pt-3">
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
            onClick={onLogout}
            title="Se déconnecter"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
