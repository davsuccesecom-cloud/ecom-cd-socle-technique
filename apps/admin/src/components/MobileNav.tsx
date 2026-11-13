import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  FileBarChart2,
  BarChart3,
  Layers,
  Users,
  Wallet,
  Landmark,
  Settings,
  Globe,
  Menu,
  Keyboard,
  Search,
  X,
} from "lucide-react";
import { NAV_ITEMS, ENABLED_KEYS } from "../navConfig";

interface MobileNavProps {
  active: string;
  pendingOrdersCount?: number;
  onNavigate: (key: string) => void;
  onOpenShortcuts?: () => void;
  onOpenCommandPalette?: () => void;
}

const PRIMARY_KEYS = ["overview", "orders", "caisse", "settings"];

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  orders: ShoppingBag,
  ai_assistant: FileBarChart2,
  performance: BarChart3,
  teams: Layers,
  users: Users,
  caisse: Landmark,
  remuneration: Wallet,
  settings: Settings,
  landing: Globe,
};

export default function MobileNav({
  active,
  pendingOrdersCount = 0,
  onNavigate,
  onOpenShortcuts,
  onOpenCommandPalette,
}: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = NAV_ITEMS.filter((i) => PRIMARY_KEYS.includes(i.key));
  const moreItems = NAV_ITEMS.filter((i) => !PRIMARY_KEYS.includes(i.key) && ENABLED_KEYS.includes(i.key));
  const isMoreActive = moreItems.some((i) => i.key === active);

  return (
    <>
      {/* Barre de navigation mobile inférieure fixe (ergonomie au pouce, min 48px) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-surface-border bg-surface-raised px-1 pb-[max(env(safe-area-inset-bottom),8px)] md:hidden">
        {primaryItems.map((item) => {
          const Icon = ICONS[item.key] ?? LayoutDashboard;
          const isActive = item.key === active;
          const showBadge = item.key === "orders" && pendingOrdersCount > 0;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors active:scale-95 ${
                isActive ? "text-brand" : "text-slate-400"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="truncate px-1">{item.shortLabel ?? item.label}</span>
              {showBadge && (
                <span className="absolute right-4 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[9px] font-bold text-slate-950">
                  {pendingOrdersCount}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium active:scale-95 ${
            isMoreActive ? "text-brand" : "text-slate-400"
          }`}
        >
          <Menu className="h-4.5 w-4.5" />
          <span>Plus</span>
        </button>
      </nav>

      {/* Tiroir "Plus" pour les sections secondaires et actions rapides */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full rounded-t-3xl border-t border-surface-border bg-surface-raised p-4 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl animate-in slide-in-from-bottom-6 duration-200"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-surface-border" />

            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Menu &amp; Modules
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Raccourcis d'accès direct */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenCommandPalette();
                  }}
                  className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-medium text-slate-200 active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-brand" />
                    <span>Recherche</span>
                  </div>
                  <kbd className="rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    ⌘K
                  </kbd>
                </button>
              )}

              {onOpenShortcuts && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenShortcuts();
                  }}
                  className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-medium text-slate-200 active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <Keyboard className="h-4 w-4 text-brand" />
                    <span>Raccourcis</span>
                  </div>
                  <kbd className="rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    ?
                  </kbd>
                </button>
              )}
            </div>

            {/* Grille des modules avec cibles tactiles >= 48px */}
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.filter((i) => ENABLED_KEYS.includes(i.key)).map((item) => {
                const Icon = ICONS[item.key] ?? LayoutDashboard;
                const isActive = item.key === active;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onNavigate(item.key);
                      setMoreOpen(false);
                    }}
                    className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium active:scale-98 ${
                      isActive
                        ? "border-brand/40 bg-brand-light text-brand"
                        : "border-surface-border bg-surface text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
