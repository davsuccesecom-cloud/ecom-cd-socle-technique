import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, PackageCheck, PhoneCall, AlertTriangle, ArrowUpRight, Radio } from "lucide-react";
import type { DailyStatRow, Order } from "@ecomcod/shared";

interface LiveShopifyAnalyticsProps {
  dailyStats: DailyStatRow[];
  orders: Order[];
  currency: string;
  periodLabel: string;
  displayTotals: {
    ca: number;
    livraisons: number;
    injoignables: number;
    rejetees: number;
    commandes: number;
  };
  tauxConfirmation: number;
  tauxLivraisonReelle: number;
  onNavigateToOrders?: () => void;
}

type ActiveMetric = "ca" | "orders" | "deliveries";

interface DayPoint {
  date: string;
  label: string;
  ca: number;
  recues: number;
  confirmees: number;
  livrees: number;
  echecs: number;
}

function formatShortDay(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return isoDate;
}

function getOrderDayKey(o: Order): string {
  const r: any = o.timestamps?.received ?? (o as any).received ?? (o as any).createdAt;
  let ms = 0;
  if (typeof r === "number") ms = r;
  else if (r && typeof r.toMillis === "function") ms = r.toMillis();
  else if (r && typeof r.seconds === "number") ms = r.seconds * 1000;
  if (!ms) return new Date().toISOString().slice(0, 10);
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function LiveShopifyAnalytics({
  dailyStats,
  orders,
  currency,
  periodLabel,
  displayTotals,
  tauxConfirmation,
  tauxLivraisonReelle,
  onNavigateToOrders,
}: LiveShopifyAnalyticsProps) {
  const [metric, setMetric] = useState<ActiveMetric>("ca");

  const series = useMemo<DayPoint[]>(() => {
    const map = new Map<string, DayPoint>();

    for (const row of dailyStats) {
      if (!row.date) continue;
      map.set(row.date, {
        date: row.date,
        label: formatShortDay(row.date),
        ca: row.ca || 0,
        recues: (row as any).commandes || 0,
        confirmees: 0,
        livrees: row.livraisons || 0,
        echecs: (row.rejetees || 0) + (row.injoignables || 0),
      });
    }

    // Agrégation directe des commandes en mémoire pour enrichir la courbe en temps réel
    const orderBuckets = new Map<
      string,
      { ca: number; recues: number; confirmees: number; livrees: number; echecs: number }
    >();

    for (const o of orders) {
      const key = getOrderDayKey(o);
      const cur = orderBuckets.get(key) ?? { ca: 0, recues: 0, confirmees: 0, livrees: 0, echecs: 0 };
      cur.recues += 1;

      const isDelivered = o.statutLivreur === "livre" || o.statutCloseuse === "livre";
      const isConfirmed =
        o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || o.statutCloseuse === "livre";
      const isFailed =
        o.statutCloseuse === "rejete" ||
        o.statutCloseuse === "injoignable" ||
        o.statutLivreur === "injoignable";

      if (isConfirmed) cur.confirmees += 1;
      if (isDelivered) {
        cur.livrees += 1;
        cur.ca += o.amount || 0;
      }
      if (isFailed) cur.echecs += 1;
      orderBuckets.set(key, cur);
    }

    for (const [date, b] of orderBuckets.entries()) {
      const existing = map.get(date);
      if (!existing) {
        map.set(date, {
          date,
          label: formatShortDay(date),
          ca: b.ca,
          recues: b.recues,
          confirmees: b.confirmees,
          livrees: b.livrees,
          echecs: b.echecs,
        });
      } else {
        existing.ca = Math.max(existing.ca, b.ca);
        existing.recues = Math.max(existing.recues, b.recues);
        existing.confirmees = Math.max(existing.confirmees, b.confirmees);
        existing.livrees = Math.max(existing.livrees, b.livrees);
        existing.echecs = Math.max(existing.echecs, b.echecs);
      }
    }

    let list = Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

    if (list.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      list = [
        {
          date: today,
          label: formatShortDay(today),
          ca: displayTotals.ca,
          recues: displayTotals.commandes,
          confirmees: 0,
          livrees: displayTotals.livraisons,
          echecs: displayTotals.rejetees + displayTotals.injoignables,
        },
      ];
    }

    if (list.length === 1) {
      const d = new Date(Date.parse(`${list[0].date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      list = [
        { date: d, label: formatShortDay(d), ca: 0, recues: 0, confirmees: 0, livrees: 0, echecs: 0 },
        list[0],
      ];
    }

    return list;
  }, [dailyStats, orders, displayTotals]);

  const urgentCount = useMemo(
    () => orders.filter((o) => o.statutCloseuse === "nouveau").length,
    [orders]
  );

  return (
    <div className="space-y-4">
      {/* Bandeau d'alerte opérationnelle — psychologie d'action immédiate */}
      {urgentCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-medium text-slate-200">
              <span className="font-bold text-amber-400">{urgentCount} commande{urgentCount > 1 ? "s" : ""}</span> en attente d'appel de confirmation (le taux de conversion chute après 15 min).
            </p>
          </div>
          {onNavigateToOrders && (
            <button
              type="button"
              onClick={onNavigateToOrders}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90"
            >
              Traiter maintenant
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Carte principale Live Analytics style Shopify */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised">
        {/* Onglets de métriques cliquables */}
        <div className="grid grid-cols-2 border-b border-surface-border lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setMetric("ca")}
            className={`flex flex-col justify-between border-b-2 p-4 text-left transition-colors ${
              metric === "ca"
                ? "border-brand bg-surface/40"
                : "border-transparent hover:bg-surface/25"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Chiffre d'affaires encaissé</span>
              <TrendingUp className="h-3.5 w-3.5 text-brand" />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.ca.toLocaleString("fr-FR")}{" "}
              <span className="text-xs font-semibold text-slate-400">{currency}</span>
            </p>
            <span className="mt-1 text-[11px] text-slate-500">Période : {periodLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetric("orders")}
            className={`flex flex-col justify-between border-b-2 border-l border-surface-border p-4 text-left transition-colors ${
              metric === "orders"
                ? "border-b-brand bg-surface/40"
                : "border-b-transparent hover:bg-surface/25"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Flux de commandes</span>
              <PhoneCall className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.commandes}
            </p>
            <span className="mt-1 text-[11px] text-emerald-400">
              {tauxConfirmation}% confirmées au téléphone
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMetric("deliveries")}
            className={`flex flex-col justify-between border-b-2 border-t lg:border-t-0 lg:border-l border-surface-border p-4 text-left transition-colors ${
              metric === "deliveries"
                ? "border-b-brand bg-surface/40"
                : "border-b-transparent hover:bg-surface/25"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Livraisons réussies</span>
              <PackageCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.livraisons}
            </p>
            <span className="mt-1 text-[11px] text-slate-400">
              {tauxLivraisonReelle}% des confirmées livrées
            </span>
          </button>

          <div className="flex flex-col justify-between border-t border-l border-surface-border p-4 lg:border-t-0">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Rejets & Injoignables</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <Radio className="h-3 w-3 animate-pulse" />
                Direct
              </span>
            </div>
            <p className="mt-2 font-mono text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.rejetees + displayTotals.injoignables}
            </p>
            <span className="mt-1 text-[11px] text-slate-500">
              {displayTotals.rejetees} rejetées · {displayTotals.injoignables} injoignables
            </span>
          </div>
        </div>

        {/* Zone graphique principale */}
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {metric === "ca" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-sm bg-brand" />
                  Chiffre d'affaires ({currency})
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
                    Reçues
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Livrées
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                    Rejets / Injoignables
                  </span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              Synchronisé en temps réel avec Firestore & Shopify
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metric === "ca" ? (
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="shopifyCaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={{ stroke: "var(--surface-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    width={44}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload as DayPoint;
                      return (
                        <div className="surface-popover rounded-xl px-3.5 py-2.5 text-xs">
                          <p className="font-semibold text-slate-300">{pt.label}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-100">
                            {pt.ca.toLocaleString("fr-FR")} {currency}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {pt.livrees} livrée{pt.livrees > 1 ? "s" : ""} sur {pt.recues} reçue{pt.recues > 1 ? "s" : ""}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ca"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    fill="url(#shopifyCaFill)"
                    dot={{ r: 3, fill: "var(--brand)" }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={{ stroke: "var(--surface-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload as DayPoint;
                      return (
                        <div className="surface-popover rounded-xl px-3.5 py-2.5 text-xs space-y-1">
                          <p className="font-semibold text-slate-200">{pt.label}</p>
                          <p className="text-sky-400">Reçues : {pt.recues}</p>
                          <p className="text-emerald-400">Livrées : {pt.livrees}</p>
                          <p className="text-rose-400">Rejets / Injoignables : {pt.echecs}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="recues" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="livrees" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="echecs" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
