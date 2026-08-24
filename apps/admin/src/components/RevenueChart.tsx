import { useMemo } from "react";
import type { Order } from "@ecomcod/shared";

interface RevenueChartProps {
  orders: Order[];
  periodLabel: string;
  onClose: () => void;
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export default function RevenueChart({ orders, periodLabel, onClose }: RevenueChartProps) {
  const buckets = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .filter((o) => o.statutLivreur === "livre" && o.timestamps.delivered)
      .forEach((o) => {
        const key = dayKey(o.timestamps.delivered!);
        map.set(key, (map.get(key) ?? 0) + o.amount);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, total]) => ({ key, total }));
  }, [orders]);

  const max = Math.max(...buckets.map((b) => b.total), 1);
  const total = buckets.reduce((sum, b) => sum + b.total, 0);

  const chartW = 100; // % — dimensionné en viewBox relatif, s'adapte au conteneur
  const chartH = 220;
  const barGap = buckets.length > 0 ? chartW / buckets.length : chartW;
  const barWidth = Math.max(barGap * 0.55, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-100">Évolution du chiffre d'affaires</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-surface hover:text-slate-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Période : {periodLabel} — {buckets.length} jour{buckets.length > 1 ? "s" : ""} avec livraisons, total{" "}
          {total.toLocaleString("fr-FR")} F
        </p>

        {buckets.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune livraison confirmée sur cette période pour tracer une courbe.
          </p>
        ) : (
          <div className="rounded-xl border border-surface-border bg-surface p-4">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: chartH }} preserveAspectRatio="none">
              {/* Lignes de repère horizontales */}
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1="0"
                  x2={chartW}
                  y1={chartH - f * (chartH - 24)}
                  y2={chartH - f * (chartH - 24)}
                  stroke="currentColor"
                  className="text-surface-border"
                  strokeWidth="0.3"
                />
              ))}

              {buckets.map((b, i) => {
                const x = i * barGap + (barGap - barWidth) / 2;
                const h = (b.total / max) * (chartH - 24);
                const y = chartH - 24 - h;
                return (
                  <g key={b.key}>
                    <rect x={x} y={y} width={barWidth} height={h} rx="1" fill="url(#barGradient)" />
                    <text
                      x={x + barWidth / 2}
                      y={chartH - 8}
                      textAnchor="middle"
                      fontSize="3.2"
                      className="fill-slate-500"
                    >
                      {dayLabel(b.key)}
                    </text>
                  </g>
                );
              })}

              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}

        {buckets.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat label="Meilleur jour" value={`${Math.max(...buckets.map((b) => b.total)).toLocaleString("fr-FR")} F`} />
            <MiniStat label="Moyenne / jour" value={`${Math.round(total / buckets.length).toLocaleString("fr-FR")} F`} />
            <MiniStat label="Total période" value={`${total.toLocaleString("fr-FR")} F`} />
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-3 text-center">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
