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
import { TrendingUp, PackageCheck, PhoneCall, PhoneOff, AlertTriangle, ArrowUpRight, Radio } from "lucide-react";
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

type ActiveMetric = "ca" | "orders" | "deliveries" | "injoignables";

interface DayPoint {
  date: string;
  label: string;
  ca: number;
  recues: number;
  confirmees: number;
  livrees: number;
  injoignables: number;
  rejetees: number;
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
        injoignables: row.injoignables || 0,
        rejetees: row.rejetees || 0,
      });
    }

    const orderBuckets = new Map<
      string,
      { ca: number; recues: number; confirmees: number; livrees: number; injoignables: number; rejetees: number }
    >();

    for (const o of orders) {
      const key = getOrderDayKey(o);
      const cur = orderBuckets.get(key) ?? {
        ca: 0,
        recues: 0,
        confirmees: 0,
        livrees: 0,
        injoignables: 0,
        rejetees: 0,
      };
      cur.recues += 1;

      const isDelivered = o.statutLivreur === "livre" || o.statutCloseuse === "livre";
      const isConfirmed =
        o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || o.statutCloseuse === "livre";
      const isInjoignable = o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable";
      const isRejected = o.statutCloseuse === "rejete";

      if (isConfirmed) cur.confirmees += 1;
      if (isDelivered) {
        cur.livrees += 1;
        cur.ca += o.amount || 0;
      }
      if (isInjoignable) cur.injoignables += 1;
      if (isRejected) cur.rejetees += 1;
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
          injoignables: b.injoignables,
          rejetees: b.rejetees,
        });
      } else {
        existing.ca = Math.max(existing.ca, b.ca);
        existing.recues = Math.max(existing.recues, b.recues);
        existing.confirmees = Math.max(existing.confirmees, b.confirmees);
        existing.livrees = Math.max(existing.livrees, b.livrees);
        existing.injoignables = Math.max(existing.injoignables, b.injoignables);
        existing.rejetees = Math.max(existing.rejetees, b.rejetees);
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
          injoignables: displayTotals.injoignables,
          rejetees: displayTotals.rejetees,
        },
      ];
    }

    if (list.length === 1) {
      const d = new Date(Date.parse(`${list[0].date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      list = [
        {
          date: d,
          label: formatShortDay(d),
          ca: 0,
          recues: 0,
          confirmees: 0,
          livrees: 0,
          injoignables: 0,
          rejetees: 0,
        },
        list[0],
      ];
    }

    return list;
  }, [dailyStats, orders, displayTotals]);

  const urgentCount = useMemo(
    () => orders.filter((o) => o.statutCloseuse === "nouveau").length,
    [orders]
  );

  // Commandes confirmées en attente d'expédition ou sur le terrain (Prise de conscience livraisons)
  const pendingDeliveryCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          (o.statutCloseuse === "en_cours" ||
            o.statutCloseuse === "programme" ||
            o.statutLivreur === "recu" ||
            o.statutLivreur === "en_route") &&
          o.statutLivreur !== "livre" &&
          o.statutLivreur !== "injoignable"
      ).length,
    [orders]
  );

  return (
    <div className="space-y-3.5">
      {/* VIGIE OPÉRATIONNELLE : PRISE DE CONSCIENCE DES LIVRAISONS & APPELS */}
      {(pendingDeliveryCount > 0 || urgentCount > 0) && (
        <div
          className={`grid gap-3.5 ${
            pendingDeliveryCount > 0 && urgentCount > 0
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {/* Volet 1 : Prise de conscience Commandes à Livrer (Livreur en Moto) */}
          {pendingDeliveryCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-sky-900/15 to-surface-raised p-4 shadow-md transition-all hover:border-sky-500/50">
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0">
                  <img
                    src="/icons/app-livreur-native.png"
                    alt="Livreur en moto"
                    className="h-12 w-12 rounded-2xl object-cover border border-sky-400/40 bg-slate-900 shadow-md ring-2 ring-sky-500/20"
                  />
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-black text-slate-950 ring-2 ring-slate-950 animate-pulse">
                    {pendingDeliveryCount}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 text-[9.5px] font-bold text-sky-300 uppercase tracking-wider">
                      Tournées &amp; Livraisons
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100 mt-1 truncate">
                    {pendingDeliveryCount} commande{pendingDeliveryCount > 1 ? "s" : ""} confirmée{pendingDeliveryCount > 1 ? "s" : ""} à livrer
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    Chaque heure de retard réduit le taux de succès client · Activez vos livreurs.
                  </p>
                </div>
              </div>
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:bg-sky-400 shrink-0 self-end sm:self-auto"
                >
                  <span>Livrer</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Volet 2 : Prise de conscience Appels Closeuses (Sac avec Appel) */}
          {urgentCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-amber-900/15 to-surface-raised p-4 shadow-md transition-all hover:border-amber-500/50">
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0">
                  <img
                    src="/icons/app-closeuse-native.png"
                    alt="Sac avec appel closeuse"
                    className="h-12 w-12 rounded-2xl object-cover border border-amber-400/40 bg-slate-900 shadow-md ring-2 ring-amber-500/20"
                  />
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-slate-950 ring-2 ring-slate-950 animate-pulse">
                    {urgentCount}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[9.5px] font-bold text-amber-300 uppercase tracking-wider">
                      Appels WhatsApp
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100 mt-1 truncate">
                    {urgentCount} commande{urgentCount > 1 ? "s" : ""} à confirmer
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    Le taux de closing est divisé par 2 après 15 min · Intervenez à chaud.
                  </p>
                </div>
              </div>
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:bg-amber-400 shrink-0 self-end sm:self-auto"
                >
                  <span>Appeler</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Carte principale Live Analytics style Shopify */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised shadow-xs">
        {/* 4 Onglets de métriques cliquables (sans duplication ailleurs) */}
        <div className="grid grid-cols-2 border-b border-surface-border lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setMetric("ca")}
            className={`flex flex-col justify-between border-b-2 p-4 text-left transition-all ${
              metric === "ca"
                ? "border-brand bg-brand-light/20"
                : "border-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Chiffre d'Affaires Encaissé</span>
              <TrendingUp className="h-3.5 w-3.5 text-brand" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.ca.toLocaleString("fr-FR")}{" "}
              <span className="text-xs font-semibold text-slate-400">{currency}</span>
            </p>
            <span className="mt-1 text-[11px] text-slate-500">Période : {periodLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetric("orders")}
            className={`flex flex-col justify-between border-b-2 border-l border-surface-border p-4 text-left transition-all ${
              metric === "orders"
                ? "border-b-brand bg-brand-light/20"
                : "border-b-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Flux des Commandes</span>
              <PhoneCall className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.commandes.toLocaleString("fr-FR")}
            </p>
            <div className="mt-1">
              <span className="inline-block rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
                Confirmation : {tauxConfirmation}%
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMetric("deliveries")}
            className={`flex flex-col justify-between border-b-2 border-t border-surface-border p-4 text-left transition-all lg:border-l lg:border-t-0 ${
              metric === "deliveries"
                ? "border-b-brand bg-brand-light/20"
                : "border-b-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Livraisons Réussies</span>
              <PackageCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.livraisons.toLocaleString("fr-FR")}
            </p>
            <div className="mt-1">
              <span className="inline-block rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                Succès terrain : {tauxLivraisonReelle}%
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMetric("injoignables")}
            className={`flex flex-col justify-between border-b-2 border-l border-t border-surface-border p-4 text-left transition-all lg:border-t-0 ${
              metric === "injoignables"
                ? "border-b-brand bg-brand-light/20"
                : "border-b-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Clients Injoignables</span>
              <PhoneOff className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
              {displayTotals.injoignables.toLocaleString("fr-FR")}
            </p>
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                <Radio className="h-2.5 w-2.5 text-rose-400 animate-pulse" />
                À relancer en priorité
              </span>
            </div>
          </button>
        </div>

        {/* Zone graphique principale compacte (pour voir aussi les 3 cartes du dessous sans scroller) */}
        <div className="p-3.5 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {metric === "ca" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-sm bg-brand" />
                  Chiffre d'affaires ({currency})
                </span>
              ) : metric === "injoignables" ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                  Clients injoignables par jour
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
                </>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Flux synchronisé en direct
            </span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metric === "ca" ? (
                <ComposedChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
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
                          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-100">
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
              ) : metric === "injoignables" ? (
                <ComposedChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
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
                          <p className="text-rose-400">Injoignables : {pt.injoignables}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="injoignables" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </ComposedChart>
              ) : (
                <ComposedChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
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
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="recues" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="livrees" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
