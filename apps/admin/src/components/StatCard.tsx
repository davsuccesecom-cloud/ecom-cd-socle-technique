interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent: "blue" | "green" | "red" | "orange" | "purple" | "cyan";
  trendPoints?: number[];
  onClick?: () => void;
}

const ACCENT_STYLES: Record<StatCardProps["accent"], { badge: string; stroke: string }> = {
  blue: { badge: "bg-sky-500/10 text-sky-400 border-sky-500/20", stroke: "#0EA5E9" },
  green: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", stroke: "#10B981" },
  red: { badge: "bg-rose-500/10 text-rose-400 border-rose-500/20", stroke: "#F43F5E" },
  orange: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", stroke: "#F59E0B" },
  purple: { badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", stroke: "#6366F1" },
  cyan: { badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", stroke: "#06B6D4" },
};

export default function StatCard({
  label,
  value,
  subtitle,
  icon,
  accent,
  trendPoints,
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  const style = ACCENT_STYLES[accent];

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group relative w-full rounded-xl border border-surface-border bg-surface-raised p-4 text-left transition-all ${
        onClick ? "cursor-pointer hover:border-slate-600" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-400">{label}</span>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${style.badge}`}>
          {icon}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
          {value}
        </span>
        {trendPoints && trendPoints.length > 1 && (
          <div className="hidden shrink-0 sm:block">
            <Sparkline points={trendPoints} color={style.stroke} />
          </div>
        )}
      </div>

      {subtitle && <p className="mt-1 truncate text-[11px] text-slate-500">{subtitle}</p>}
    </Wrapper>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 68;
  const h = 24;
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
