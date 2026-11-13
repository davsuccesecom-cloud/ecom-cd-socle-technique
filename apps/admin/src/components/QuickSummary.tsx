interface QuickSummaryCounts {
  total: number;
  enAttente: number;
  enCours: number;
  livrees: number;
  rejetees: number;
}

interface QuickSummaryProps {
  counts: QuickSummaryCounts;
}

type Accent = "blue" | "orange" | "cyan" | "green" | "red";

const ITEMS: Array<{ key: keyof QuickSummaryCounts; label: string; accent: Accent }> = [
  { key: "total", label: "Commandes totales", accent: "blue" },
  { key: "enAttente", label: "En attente", accent: "orange" },
  { key: "enCours", label: "En cours", accent: "cyan" },
  { key: "livrees", label: "Livrées", accent: "green" },
  { key: "rejetees", label: "Rejetées / Injoignables", accent: "red" },
];

const ACCENT_CLASSES: Record<Accent, string> = {
  blue: "bg-blue-500/15 text-blue-400",
  orange: "bg-orange-500/15 text-orange-400",
  cyan: "bg-cyan-500/15 text-cyan-400",
  green: "bg-green-500/15 text-green-400",
  red: "bg-red-500/15 text-red-400",
};

export default function QuickSummary({ counts }: QuickSummaryProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
        <BoltIcon />
        Résumé rapide
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface px-3 py-2.5"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASSES[item.accent]}`}
            >
              <DotIcon />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">{item.label}</p>
              <p className="text-base font-semibold text-slate-100">{counts[item.key]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}
function DotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}

export { ITEMS, ACCENT_CLASSES };
export type { QuickSummaryCounts, Accent };
