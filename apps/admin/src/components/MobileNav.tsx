const ITEMS = [
  { key: "overview", label: "Vue d'ensemble", icon: OverviewIcon },
  { key: "orders", label: "Commandes", icon: OrdersIcon },
  { key: "deliveries", label: "Livraisons", icon: DeliveriesIcon },
  { key: "teams", label: "Équipes", icon: TeamsIcon },
  { key: "more", label: "Plus", icon: MoreIcon },
];

export default function MobileNav({ active, onNavigate }: { active: string; onNavigate: (key: string) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-surface-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        // "Plus" fait office d'accès temporaire à Performance en attendant
        // un vrai menu "plus" avec tous les modules — section mobile nav.
        const isEnabled = item.key === "overview" || item.key === "more";
        return (
          <button
            key={item.key}
            disabled={!isEnabled}
            onClick={() => {
              if (item.key === "overview") onNavigate("overview");
              if (item.key === "more") onNavigate("performance");
            }}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] disabled:opacity-40 ${
              isActive || (item.key === "more" && active === "performance") ? "text-brand" : "text-slate-500"
            }`}
          >
            <Icon />
            <span>{item.key === "more" && active === "performance" ? "Performance" : item.label}</span>
          </button>
        );
      })}
    </nav>
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
function MoreIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
