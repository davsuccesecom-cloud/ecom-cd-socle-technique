import { useState } from "react";
import { NAV_ITEMS, ENABLED_KEYS } from "../navConfig";

interface MobileNavProps {
  active: string;
  onNavigate: (key: string) => void;
}

// 4 raccourcis directs en barre basse — les plus utilisés au quotidien.
// Tout le reste (Performance, Rémunération, Paramètres, Livraisons quand
// elle sera prête) passe par "Plus", pour ne pas surcharger la barre.
const PRIMARY_KEYS = ["overview", "orders", "teams", "users"];

const ICONS: Record<string, () => JSX.Element> = {
  overview: OverviewIcon,
  orders: OrdersIcon,
  deliveries: DeliveriesIcon,
  performance: PerformanceIcon,
  teams: TeamsIcon,
  users: UsersIcon,
  remuneration: RemunerationIcon,
  settings: SettingsIcon,
};

export default function MobileNav({ active, onNavigate }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = NAV_ITEMS.filter((i) => PRIMARY_KEYS.includes(i.key));
  const moreItems = NAV_ITEMS.filter((i) => !PRIMARY_KEYS.includes(i.key));
  const isMoreActive = moreItems.some((i) => i.key === active);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-surface-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {primaryItems.map((item) => {
          const Icon = ICONS[item.key];
          const isEnabled = ENABLED_KEYS.includes(item.key);
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              disabled={!isEnabled}
              onClick={() => isEnabled && onNavigate(item.key)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] disabled:opacity-40 ${
                isActive ? "text-brand" : "text-slate-500"
              }`}
            >
              <Icon />
              <span className="truncate px-1">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
            isMoreActive ? "text-brand" : "text-slate-500"
          }`}
        >
          <MoreIcon />
          <span>Plus</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full rounded-t-3xl border-t border-surface-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border" />
            <div className="space-y-1">
              {moreItems.map((item) => {
                const Icon = ICONS[item.key];
                const isEnabled = ENABLED_KEYS.includes(item.key);
                const isActive = item.key === active;
                return (
                  <button
                    key={item.key}
                    disabled={!isEnabled}
                    onClick={() => {
                      if (!isEnabled) return;
                      onNavigate(item.key);
                      setMoreOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm disabled:opacity-40 ${
                      isActive ? "bg-brand-light text-brand" : "text-slate-300"
                    }`}
                  >
                    <Icon />
                    <span className="flex-1">{item.label}</span>
                    {!isEnabled && (
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-slate-500">
                        bientôt
                      </span>
                    )}
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

function iconProps() {
  return { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}
function OverviewIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function OrdersIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function DeliveriesIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M1 3h13v13H1z" />
      <path d="M14 8h4l3 3v5h-7V8Z" />
      <circle cx="5.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  );
}
function TeamsIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2" y="4" width="14" height="10" rx="1.5" />
      <path d="M6 9h6M6 12h4" />
      <path d="M20 8v8" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M17 4.5a3.2 3.2 0 0 1 0 6.3" />
      <path d="M20 20c0-2.8-1.7-5-4-5.7" />
    </svg>
  );
}
function RemunerationIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 6v0M18 18v0" />
    </svg>
  );
}
function PerformanceIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
