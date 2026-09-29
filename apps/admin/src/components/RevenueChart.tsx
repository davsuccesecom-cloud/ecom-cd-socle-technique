import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyStatRow, Order } from "@ecomcod/shared";

interface RevenueChartProps {
  dailyStats: DailyStatRow[];
  orders?: Order[];
  currency?: string;
  periodLabel: string;
  onClose: () => void;
}

function dayLabel(key: string) {
  if (!key) return "";
  const parts = key.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return key;
}

function CustomTooltip({ active, payload, currency = "XOF" }: any) {
  if (!active || !payload || !payload.length) return null;
  const { date, ca } = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400">{dayLabel(date)}</p>
      <p className="text-sm font-semibold text-slate-100">{Number(ca || 0).toLocaleString("fr-FR")} {currency}</p>
    </div>
  );
}

export default function RevenueChart({ dailyStats, orders = [], currency = "XOF", periodLabel, onClose }: RevenueChartProps) {
  const buckets = useMemo(() => {
    const map = new Map<string, number>();

    const hasDailyStats = dailyStats.some((r) => (r.ca || 0) > 0);
    if (hasDailyStats) {
      for (const row of dailyStats) {
        if (row.ca > 0) {
          map.set(row.date, row.ca);
        }
      }
    } else {
      // Fallback sur les commandes en mémoire si dailyStats est vide
      for (const o of orders) {
        if (o.statutLivreur === "livre" || o.statutCloseuse === "livre") {
          const ts = o.timestamps?.delivered || o.timestamps?.received;
          if (ts) {
            const dateKey = new Date(ts).toISOString().slice(0, 10);
            const current = map.get(dateKey) ?? 0;
            map.set(dateKey, current + (o.amount || 0));
          }
        }
      }
    }

    let list = Array.from(map.entries())
      .map(([date, ca]) => ({ date, ca }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    // Si on a un seul point (ex: aujourd'hui), ajouter la veille à 0 pour tracer une vraie courbe
    if (list.length === 1) {
      const prevDate = new Date(Date.parse(`${list[0].date}T00:00:00.000Z`) - 86400000).toISOString().slice(0, 10);
      list = [{ date: prevDate, ca: 0 }, list[0]];
    }

    return list;
  }, [dailyStats, orders]);

  const total = buckets.reduce((sum, b) => sum + b.ca, 0);

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
          Période : {periodLabel} — {buckets.length} jour{buckets.length > 1 ? "s" : ""} avec des données, total{" "}
          {total.toLocaleString("fr-FR")} {currency}
        </p>

        {buckets.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune donnée sur cette période pour tracer une courbe.
          </p>
        ) : (
          <div className="rounded-xl border border-surface-border bg-surface p-4">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={dayLabel}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={{ stroke: "var(--surface-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ stroke: "#6366F1", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="ca" stroke="#6366F1" strokeWidth={2.5} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {buckets.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat label="Meilleur jour" value={`${Math.max(...buckets.map((b) => b.ca)).toLocaleString("fr-FR")} ${currency}`} />
            <MiniStat label="Moyenne / jour" value={`${Math.round(total / buckets.length).toLocaleString("fr-FR")} ${currency}`} />
            <MiniStat label="Total période" value={`${total.toLocaleString("fr-FR")} ${currency}`} />
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
