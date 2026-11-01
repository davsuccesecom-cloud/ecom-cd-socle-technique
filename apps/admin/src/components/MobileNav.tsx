import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  FileBarChart2,
  BarChart3,
  Layers,
  Users,
  Wallet,
  Settings,
  Menu,
} from "lucide-react";
import { NAV_ITEMS, ENABLED_KEYS } from "../navConfig";

interface MobileNavProps {
  active: string;
  pendingOrdersCount?: number;
  onNavigate: (key: string) => void;
}

const PRIMARY_KEYS = ["overview", "orders", "ai_assistant", "settings"];

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  orders: ShoppingBag,
  ai_assistant: FileBarChart2,
  performance: BarChart3,
  teams: Layers,
  users: Users,
  remuneration: Wallet,
  settings: Settings,
};

export default function MobileNav({ active, pendingOrdersCount = 0, onNavigate }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = NAV_ITEMS.filter((i) => PRIMARY_KEYS.includes(i.key));
  const moreItems = NAV_ITEMS.filter((i) => !PRIMARY_KEYS.includes(i.key) && ENABLED_KEYS.includes(i.key));
  const isMoreActive = moreItems.some((i) => i.key === active);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-surface-border bg-surface-raised/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {primaryItems.map((item) => {
          const Icon = ICONS[item.key] ?? LayoutDashboard;
          const isActive = item.key === active;
          const showBadge = item.key === "orders" && pendingOrdersCount > 0;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? "text-brand" : "text-slate-400"
              }`}
            >
              <Icon className="h-4 w-4" />
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
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
            isMoreActive ? "text-brand" : "text-slate-400"
          }`}
        >
          <Menu className="h-4 w-4" />
          <span>Plus</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full rounded-t-2xl border-t border-surface-border bg-surface-raised p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-border" />
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Toutes les sections
            </p>
            <div className="grid grid-cols-2 gap-1.5">
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
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium ${
                      isActive
                        ? "border-brand/40 bg-brand-light text-brand"
                        : "border-surface-border bg-surface text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
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
