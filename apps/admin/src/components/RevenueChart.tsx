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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4 py-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-surface-border bg-surface-raised p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold">
              📈
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Performance & Dynamique des Ventes</h2>
              <p className="text-xs text-slate-400">
                Période active : <span className="font-semibold text-slate-200">{periodLabel}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-surface-border p-2 text-slate-400 hover:bg-surface hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-surface-border bg-surface p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Chiffre d'Affaires Total</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">
              {total.toLocaleString("fr-FR")} {currency}
            </div>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Meilleure Journée</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {buckets.length > 0 ? Math.max(...buckets.map((b) => b.ca)).toLocaleString("fr-FR") : 0} {currency}
            </div>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Moyenne Journalière</span>
            <div className="text-2xl font-black text-cyan-400 mt-1">
              {buckets.length > 0 ? Math.round(total / buckets.length).toLocaleString("fr-FR") : 0} {currency}
            </div>
          </div>
        </div>

        {buckets.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            Aucune commande livrée sur cette période pour tracer une courbe.
          </p>
        ) : (
          <div className="rounded-2xl border border-surface-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Évolution du chiffre d'affaires</span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Shopify Style
              </span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
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
                  width={42}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ stroke: "#4F46E5", strokeWidth: 1.5 }} />
                <Area
                  type="monotone"
                  dataKey="ca"
                  stroke="#4F46E5"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#4F46E5" }}
                  activeDot={{ r: 6, fill: "#818CF8" }}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
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
