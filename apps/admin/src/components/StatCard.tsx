interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "blue" | "green" | "red" | "orange" | "purple" | "cyan";
  trendPoints?: number[]; // valeurs relatives pour dessiner la sparkline
}

const ACCENT_BG: Record<StatCardProps["accent"], string> = {
  blue: "bg-accent-blue/15 text-accent-blue",
  green: "bg-accent-green/15 text-accent-green",
  red: "bg-accent-red/15 text-accent-red",
  orange: "bg-accent-orange/15 text-accent-orange",
  purple: "bg-accent-purple/15 text-accent-purple",
  cyan: "bg-accent-cyan/15 text-accent-cyan",
};

const ACCENT_STROKE: Record<StatCardProps["accent"], string> = {
  blue: "#3B82F6",
  green: "#22C55E",
  red: "#EF4444",
  orange: "#F97316",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
};

export default function StatCard({ label, value, icon, accent, trendPoints }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between sm:mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${ACCENT_BG[accent]}`}>
            {icon}
          </div>
          <span className="truncate text-xs text-slate-400 sm:text-sm">{label}</span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-xl font-semibold text-slate-100 sm:text-2xl">{value}</span>
        {trendPoints && trendPoints.length > 1 && (
          <div className="hidden shrink-0 sm:block">
            <Sparkline points={trendPoints} color={ACCENT_STROKE[accent]} />
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 72;
  const h = 28;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={path} stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
