interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "blue" | "green" | "red" | "orange" | "purple" | "cyan";
  trendPoints?: number[];
  onClick?: () => void;
}

const ACCENT_GRADIENT: Record<StatCardProps["accent"], [string, string]> = {
  blue: ["#3B82F6", "#1D4ED8"],
  green: ["#10B981", "#047857"],
  red: ["#EF4444", "#B91C1C"],
  orange: ["#F59E0B", "#B45309"],
  purple: ["#8B5CF6", "#6D28D9"],
  cyan: ["#06B6D4", "#0E7490"],
};

const ACCENT_STROKE: Record<StatCardProps["accent"], string> = {
  blue: "#3B82F6",
  green: "#10B981",
  red: "#EF4444",
  orange: "#F59E0B",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
};

export default function StatCard({ label, value, icon, accent, trendPoints, onClick }: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={`relative w-full rounded-2xl border border-surface-border bg-surface-raised p-3 text-left sm:p-4 ${
        onClick ? "cursor-pointer transition-transform hover:-translate-y-0.5 hover:border-brand/40" : ""
      }`}
    >
      {onClick && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-surface text-slate-500 sm:right-4 sm:top-4">
          <span className="absolute -inset-1.5 animate-ping rounded-full bg-brand/60" />
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="relative">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        </span>
      )}

      <div className="mb-2 flex items-center gap-2 sm:mb-3">
        <GradientIcon accent={accent}>{icon}</GradientIcon>
        <span className="truncate text-xs text-slate-400 sm:text-sm">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-xl font-semibold text-slate-100 sm:text-2xl">{value}</span>
        {trendPoints && trendPoints.length > 1 && (
          <div className="hidden shrink-0 sm:block">
            <Sparkline points={trendPoints} color={ACCENT_STROKE[accent]} />
          </div>
        )}
      </div>
    </Wrapper>
  );
}

/**
 * Icône avec fond en dégradé + reflet léger — approximation "glossy" en
 * SVG pur, léger et net à toute taille (contrairement à une image générée
 * en rendu 3D, qui pixelise vite à petite taille pour une icône d'UI).
 */
function GradientIcon({ accent, children }: { accent: StatCardProps["accent"]; children: React.ReactNode }) {
  const [from, to] = ACCENT_GRADIENT[accent];
  const gradientId = `grad-${accent}`;
  return (
    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9">
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
      </svg>
      <div
        className="absolute inset-0 rounded-xl shadow-inner"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      />
      {/* Reflet diagonal subtil pour l'effet "glossy" */}
      <div
        className="absolute inset-0 rounded-xl opacity-30"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)" }}
      />
      <div className="relative text-white">{children}</div>
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
