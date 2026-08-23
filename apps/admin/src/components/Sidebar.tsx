import { useState } from "react";
import { NAV_ITEMS, ENABLED_KEYS } from "../navConfig";

interface SidebarProps {
  active: string;
  userEmail: string | null;
  onLogout: () => void;
  onNavigate: (key: string) => void;
}

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

export default function Sidebar({ active, userEmail, onLogout, onNavigate }: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-surface-border bg-surface px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
          <LogoIcon />
        </div>
        <span className="text-lg font-semibold text-slate-100">Ecom COD</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = item.key === active;
          const isEnabled = ENABLED_KEYS.includes(item.key);
          return (
            <button
              key={item.key}
              disabled={!isEnabled}
              onClick={() => isEnabled && onNavigate(item.key)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? "bg-brand-light text-brand"
                  : "text-slate-400 hover:bg-surface-raised hover:text-slate-200 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
              }`}
            >
              <Icon />
              <span>{item.label}</span>
              {!isEnabled && (
                <span className="ml-auto rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-slate-500">
                  bientôt
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="relative mt-4 border-t border-surface-border pt-4">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-raised"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-medium text-brand">
            {(userEmail ?? "A").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">Admin</p>
            <p className="truncate text-xs text-slate-500">{userEmail}</p>
          </div>
        </button>

        {menuOpen && (
          <button
            onClick={onLogout}
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-red-400 hover:bg-surface-raised"
          >
            Se déconnecter
          </button>
        )}
      </div>
    </aside>
  );
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2a10 10 0 1 0 7.07 17.07" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function iconProps() {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
