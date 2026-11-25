import { useMemo, useState, useEffect } from "react";
import {
  Area,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  PackageCheck,
  PhoneCall,
  PhoneOff,
  Radio,
  Zap,
  Calendar,
  Layers,
  Activity,
  Eye,
  EyeOff,
} from "lucide-react";
import type { DailyStatRow, Order } from "@ecomcod/shared";
import type { Period } from "./PeriodSelector";

interface LiveShopifyAnalyticsProps {
  dailyStats: DailyStatRow[];
  orders: Order[];
  allOrders?: Order[];
  currency: string;
  periodLabel: string;
  period?: Period;
  displayTotals: {
    ca: number;
    livraisons: number;
    injoignables: number;
    rejetees: number;
    commandes: number;
  };
  tauxConfirmation: number;
  tauxLivraisonReelle: number;
  onNavigateToOrders?: (filter?: string) => void;
  onNavigateToAi?: (prompt?: string) => void;
}

type ActiveMetric = "ca" | "orders" | "deliveries" | "injoignables";
type ChartViewType = "live24h" | "daily";
type LiveCurveMode = "bounce" | "cumul";

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

interface HourlyPoint {
  hour: number;
  label: string;
  timeStr: string;
  isPastOrCurrent: boolean;
  isCurrentHour: boolean;

  // Aujourd'hui (Rebonds instantanés - null pour heures futures -> arrêt net du tracé)
  ca: number | null;
  caVentes: number | null;
  recues: number | null;
  livrees: number | null;
  injoignables: number | null;

  // Aujourd'hui (Progression cumulée - null pour heures futures)
  caCumul: number | null;
  caVentesCumul: number | null;
  recuesCumul: number | null;
  livreesCumul: number | null;
  injoignablesCumul: number | null;

  // Hier (Référence complète 24h pour benchmark)
  caHier: number;
  caHierVentes: number;
  recuesHier: number;
  livreesHier: number;
  caHierCumul: number;
  recuesHierCumul: number;
}

function formatShortDay(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return isoDate;
}

function getOrderTimestamp(o: Order): number {
  const r: any = o.timestamps?.received ?? (o as any).received ?? (o as any).createdAt;
  if (typeof r === "number") return r;
  if (r && typeof r.toMillis === "function") return r.toMillis();
  if (r && typeof r.seconds === "number") return r.seconds * 1000;
  if (typeof r === "string") {
    const parsed = Date.parse(r);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function getOrderDeliveredTimestamp(o: Order): number {
  const d: any =
    o.timestamps?.delivered ??
    (o as any).deliveredAt ??
    (o as any).updatedAt ??
    o.timestamps?.received ??
    (o as any).received ??
    (o as any).createdAt;
  if (typeof d === "number") return d;
  if (d && typeof d.toMillis === "function") return d.toMillis();
  if (d && typeof d.seconds === "number") return d.seconds * 1000;
  if (typeof d === "string") {
    const parsed = Date.parse(d);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return getOrderTimestamp(o);
}

function getOrderDayKey(o: Order): string {
  const ms = getOrderTimestamp(o);
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
  allOrders,
  currency,
  periodLabel,
  period,
  displayTotals,
  tauxConfirmation,
  tauxLivraisonReelle,
  onNavigateToOrders,
  onNavigateToAi,
}: LiveShopifyAnalyticsProps) {
  const [metric, setMetric] = useState<ActiveMetric>("ca");

  const isDayPreset =
    periodLabel === "Jour" ||
    periodLabel === "Aujourd'hui" ||
    (period?.type === "preset" && period.value === "jour");

  const [viewType, setViewType] = useState<ChartViewType>(isDayPreset ? "live24h" : "daily");
  const [curveMode, setCurveMode] = useState<LiveCurveMode>("bounce");
  const [showYesterday, setShowYesterday] = useState<boolean>(true);

  // Synchronise le mode par défaut selon la période sélectionnée
  useEffect(() => {
    if (isDayPreset) {
      setViewType("live24h");
    } else {
      setViewType("daily");
    }
  }, [isDayPreset]);

  // Horloge en direct : rafraîchissement automatique chaque minute pour avancer le tracé
  const [nowTime, setNowTime] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = nowTime.getHours();
  const currentMinute = String(nowTime.getMinutes()).padStart(2, "0");
  const currentTimeFormatted = `${String(currentHour).padStart(2, "0")}:${currentMinute}`;
  const currentHourLabel = `${String(currentHour).padStart(2, "0")}h`;

  const baseLiveOrders = useMemo(() => {
    return allOrders && allOrders.length > 0 ? allOrders : orders;
  }, [allOrders, orders]);

  // 1. GÉNÉRATION DE LA SÉRIE EN DIRECT 24H STYLE SHOPIFY (ARRÊT PRÉCIS À L'INSTANT T)
  const hourlySeries = useMemo<HourlyPoint[]>(() => {
    const startOfToday = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate(), 23, 59, 59, 999).getTime();

    const startOfYesterday = startOfToday - 86400000;
    const endOfYesterday = startOfToday - 1;

    interface HourBucket {
      recues: number;
      livrees: number;
      ca: number;
      caVentes: number;
      injoignables: number;
    }

    const todayBuckets: HourBucket[] = Array.from({ length: 24 }, () => ({
      recues: 0,
      livrees: 0,
      ca: 0,
      caVentes: 0,
      injoignables: 0,
    }));

    const yesterdayBuckets: HourBucket[] = Array.from({ length: 24 }, () => ({
      recues: 0,
      livrees: 0,
      ca: 0,
      caVentes: 0,
      injoignables: 0,
    }));

    for (const o of baseLiveOrders) {
      const recvTs = getOrderTimestamp(o);
      const delivTs = getOrderDeliveredTimestamp(o);
      const isDelivered = o.statutLivreur === "livre" || o.statutCloseuse === "livre";
      const isInjoignable = o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable";
      const amount = o.amount || 0;

      // Commandes d'Aujourd'hui
      if (recvTs >= startOfToday && recvTs <= endOfToday) {
        const h = new Date(recvTs).getHours();
        if (h >= 0 && h < 24) {
          todayBuckets[h].recues += 1;
          todayBuckets[h].caVentes += amount;
          if (isInjoignable) todayBuckets[h].injoignables += 1;
        }
      }

      // Livraisons d'Aujourd'hui (Cash Encaissé)
      if (isDelivered) {
        const effectiveDelivTs = delivTs >= startOfToday && delivTs <= endOfToday ? delivTs : recvTs;
        if (effectiveDelivTs >= startOfToday && effectiveDelivTs <= endOfToday) {
          const h = new Date(effectiveDelivTs).getHours();
          if (h >= 0 && h < 24) {
            todayBuckets[h].livrees += 1;
            todayBuckets[h].ca += amount;
          }
        }
      }

      // Commandes d'Hier (Référence)
      if (recvTs >= startOfYesterday && recvTs <= endOfYesterday) {
        const h = new Date(recvTs).getHours();
        if (h >= 0 && h < 24) {
          yesterdayBuckets[h].recues += 1;
          yesterdayBuckets[h].caVentes += amount;
        }
      }

      // Livraisons d'Hier
      if (isDelivered) {
        const effectiveDelivTs = delivTs >= startOfYesterday && delivTs <= endOfYesterday ? delivTs : recvTs;
        if (effectiveDelivTs >= startOfYesterday && effectiveDelivTs <= endOfYesterday) {
          const h = new Date(effectiveDelivTs).getHours();
          if (h >= 0 && h < 24) {
            yesterdayBuckets[h].livrees += 1;
            yesterdayBuckets[h].ca += amount;
          }
        }
      }
    }

    let cumTodayCa = 0;
    let cumTodayCaVentes = 0;
    let cumTodayRecues = 0;
    let cumTodayLivrees = 0;
    let cumTodayInjoignables = 0;

    let cumYestCa = 0;
    let cumYestRecues = 0;
    let cumYestLivrees = 0;

    const list: HourlyPoint[] = [];

    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, "0")}h`;
      const timeStr = `${String(h).padStart(2, "0")}:00`;
      const isPastOrCurrent = h <= currentHour;
      const isCurrentHour = h === currentHour;

      const yB = yesterdayBuckets[h];
      cumYestCa += yB.ca;
      cumYestRecues += yB.recues;
      cumYestLivrees += yB.livrees;

      if (isPastOrCurrent) {
        const tB = todayBuckets[h];
        cumTodayCa += tB.ca;
        cumTodayCaVentes += tB.caVentes;
        cumTodayRecues += tB.recues;
        cumTodayLivrees += tB.livrees;
        cumTodayInjoignables += tB.injoignables;

        list.push({
          hour: h,
          label,
          timeStr,
          isPastOrCurrent: true,
          isCurrentHour,
          // Rebonds réels par heure (allure viridique)
          ca: tB.ca,
          caVentes: tB.caVentes,
          recues: tB.recues,
          livrees: tB.livrees,
          injoignables: tB.injoignables,
          // Progression cumulée
          caCumul: cumTodayCa,
          caVentesCumul: cumTodayCaVentes,
          recuesCumul: cumTodayRecues,
          livreesCumul: cumTodayLivrees,
          injoignablesCumul: cumTodayInjoignables,
          // Référence Hier
          caHier: yB.ca,
          caHierVentes: yB.caVentes,
          recuesHier: yB.recues,
          livreesHier: yB.livrees,
          caHierCumul: cumYestCa,
          recuesHierCumul: cumYestRecues,
        });
      } else {
        // HEURES FUTURES : STRICTEMENT NULL AFIN DE STOPPER LE TRACÉ AU TEMPS PRÉSENT
        list.push({
          hour: h,
          label,
          timeStr,
          isPastOrCurrent: false,
          isCurrentHour: false,
          ca: null,
          caVentes: null,
          recues: null,
          livrees: null,
          injoignables: null,
          caCumul: null,
          caVentesCumul: null,
          recuesCumul: null,
          livreesCumul: null,
          injoignablesCumul: null,
          // Hier reste tracé sur 24h pour donner la trajectoire témoin
          caHier: yB.ca,
          caHierVentes: yB.caVentes,
          recuesHier: yB.recues,
          livreesHier: yB.livrees,
          caHierCumul: cumYestCa,
          recuesHierCumul: cumYestRecues,
        });
      }
    }

    return list;
  }, [baseLiveOrders, nowTime, currentHour]);

  // 2. SÉRIE JOURNALIÈRE CLASSIQUE (POUR PÉRIODE SEMAINE / MOIS)
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

  // Colis en cours sur le terrain
  const pendingDeliveryCount = useMemo(
    () =>
      baseLiveOrders.filter(
        (o) =>
          (o.statutCloseuse === "en_cours" ||
            o.statutCloseuse === "programme" ||
            o.statutLivreur === "recu" ||
            o.statutLivreur === "en_route") &&
          o.statutLivreur !== "livre" &&
          o.statutLivreur !== "injoignable"
      ).length,
    [baseLiveOrders]
  );

  // Cash en circulation sur le terrain
  const cashEnRoute = useMemo(
    () =>
      baseLiveOrders
        .filter(
          (o) =>
            (o.statutCloseuse === "en_cours" ||
              o.statutCloseuse === "programme" ||
              o.statutLivreur === "recu" ||
              o.statutLivreur === "en_route") &&
            o.statutLivreur !== "livre" &&
            o.statutLivreur !== "injoignable"
        )
        .reduce((sum, o) => sum + (o.amount || 0), 0),
    [baseLiveOrders]
  );

  // Dot radar animé sur le point de l'heure actuelle
  const renderLivePulseDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || cx == null || cy == null) return null;
    if (payload.isCurrentHour) {
      return (
        <g key={`live-pulse-${payload.hour}`}>
          <circle cx={cx} cy={cy} r={10} fill="var(--brand)" opacity={0.35} className="animate-ping" />
          <circle cx={cx} cy={cy} r={5} fill="var(--brand)" stroke="#ffffff" strokeWidth={2} />
        </g>
      );
    }
    if (payload.isPastOrCurrent && props.value != null && props.value > 0) {
      return <circle key={`dot-${payload.hour}`} cx={cx} cy={cy} r={2.5} fill="var(--brand)" />;
    }
    return null;
  };

  const isLiveMode = viewType === "live24h";

  return (
    <div className="space-y-3.5">
      {/* Synthèse Trésorerie : Cash Sécurisé en Caisse vs Cash en Circulation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <PackageCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Cash Sécurisé (Encaissé)</p>
              <p className="text-sm sm:text-base font-bold tabular-nums text-emerald-400">
                {displayTotals.ca.toLocaleString("fr-FR")}{" "}
                <span className="text-xs font-semibold text-emerald-400/80">{currency}</span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            {displayTotals.livraisons} livraisons validées
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-sky-500/25 bg-sky-950/20 p-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Cash en Circulation (Sur la route)</p>
              <p className="text-sm sm:text-base font-bold tabular-nums text-sky-400">
                {cashEnRoute.toLocaleString("fr-FR")}{" "}
                <span className="text-xs font-semibold text-sky-400/80">{currency}</span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
            {pendingDeliveryCount} colis sur le terrain
          </span>
        </div>
      </div>

      {/* Carte principale Live Analytics style Shopify */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised shadow-xs overflow-hidden">
        {/* 4 Onglets de métriques cliquables */}
        <div className="grid grid-cols-2 border-b border-surface-border lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setMetric("ca")}
            className={`flex flex-col justify-between border-b-2 p-4 text-left transition-all ${
              metric === "ca" ? "border-brand bg-brand-light/20" : "border-transparent hover:bg-surface/30"
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
              metric === "orders" ? "border-b-brand bg-brand-light/20" : "border-b-transparent hover:bg-surface/30"
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
              metric === "deliveries" ? "border-b-brand bg-brand-light/20" : "border-b-transparent hover:bg-surface/30"
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

        {/* Contrôles du graphique & Style Live Shopify */}
        <div className="border-b border-surface-border bg-surface/30 px-3.5 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Gauche : Légende claire et informative */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              {isLiveMode ? (
                <>
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand shadow-xs" />
                    Aujourd'hui (00h à {currentHourLabel})
                  </span>

                  {showYesterday && (
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      <span className="h-0.5 w-3 border-t-2 border-dashed border-slate-500" />
                      Hier à la même heure
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowYesterday((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Afficher ou masquer la référence d'hier"
                  >
                    {showYesterday ? <Eye className="h-3 w-3 text-brand" /> : <EyeOff className="h-3 w-3" />}
                    <span>Hier</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand" />
                    Tendance journalière
                  </span>
                  <span className="text-[11px] text-slate-400">Période : {periodLabel}</span>
                </div>
              )}
            </div>

            {/* Droite : Bascules (Live 24h vs Période) + (Rebonds vs Cumul) + Badge Live Pulsant */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Bascule Rebonds vs Cumul (en mode Live 24h) */}
              {isLiveMode && (
                <div className="inline-flex items-center rounded-lg border border-surface-border bg-surface p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setCurveMode("bounce")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      curveMode === "bounce" ? "bg-brand text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Tracer les rebondissements réels d'achat par heure"
                  >
                    <Activity className="h-3 w-3" />
                    <span>Rebonds par heure</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurveMode("cumul")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      curveMode === "cumul" ? "bg-brand text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Tracer la montée progressive cumulée"
                  >
                    <Layers className="h-3 w-3" />
                    <span>Cumul progressif</span>
                  </button>
                </div>
              )}

              {/* Bascule En Direct 24h vs Vue Historique Période */}
              <div className="inline-flex items-center rounded-lg border border-surface-border bg-surface p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewType("live24h")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    viewType === "live24h"
                      ? "bg-slate-700 text-slate-100 font-bold shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Activer la courbe live 24h arrêtée à l'instant T (Style Shopify)"
                >
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span>En Direct 24h</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewType("daily")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    viewType === "daily"
                      ? "bg-slate-700 text-slate-100 font-bold shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Afficher l'historique par jour de la période sélectionnée"
                >
                  <Calendar className="h-3 w-3" />
                  <span>Vue Période</span>
                </button>
              </div>

              {/* Badge Pulsant d'Actualisation en Direct */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="tabular-nums">
                  {isLiveMode ? `En direct · ${currentTimeFormatted}` : "Flux synchronisé"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Zone Graphique Principale Haute Fidélité */}
        <div className="p-3.5 sm:p-4">
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {isLiveMode ? (
                /* ================= MODE LIVE 24H SHOPIFY (ARRÊT PRÉCIS AU TEMPS PRÉSENT) ================= */
                <ComposedChart data={hourlySeries} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="shopifyLiveBrandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="shopifyLiveSkyFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="shopifyLiveEmeraldFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="shopifyLiveRoseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />

                  <XAxis
                    dataKey="label"
                    interval={1}
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
                    wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload as HourlyPoint;
                      const isBounce = curveMode === "bounce";

                      return (
                        <div className="surface-popover rounded-xl p-3 text-xs shadow-lg border border-surface-border min-w-[210px] space-y-2">
                          <div className="flex items-center justify-between border-b border-surface-border pb-1.5">
                            <span className="font-semibold text-slate-200">
                              {pt.timeStr} {pt.isCurrentHour ? `· Maintenant (${currentTimeFormatted})` : ""}
                            </span>
                            {pt.isCurrentHour ? (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                EN DIRECT
                              </span>
                            ) : pt.isPastOrCurrent ? (
                              <span className="text-[10px] text-slate-400">Enregistré</span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Heure à venir</span>
                            )}
                          </div>

                          {pt.isPastOrCurrent ? (
                            <div className="space-y-1.5">
                              {metric === "ca" && (
                                <div>
                                  <p className="text-[11px] text-slate-400">
                                    {isBounce ? "Ventes de l'heure :" : "Cumul à cette heure :"}
                                  </p>
                                  <p className="text-base font-bold tabular-nums text-slate-100">
                                    {(isBounce ? pt.ca : pt.caCumul)?.toLocaleString("fr-FR")} {currency}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {(pt.livrees ?? 0)} livrée{(pt.livrees ?? 0) > 1 ? "s" : ""} sur {(pt.recues ?? 0)} reçue{(pt.recues ?? 0) > 1 ? "s" : ""}
                                  </p>
                                  {showYesterday && (
                                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-surface-border/50 pt-1">
                                      <span>Hier même heure :</span>
                                      <span className="tabular-nums font-semibold text-slate-300">
                                        {(isBounce ? pt.caHier : pt.caHierCumul)?.toLocaleString("fr-FR")} {currency}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {metric === "orders" && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sky-400">Commandes reçues :</span>
                                    <span className="font-bold tabular-nums text-slate-100">
                                      {isBounce ? pt.recues : pt.recuesCumul}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-emerald-400">Commandes livrées :</span>
                                    <span className="font-bold tabular-nums text-slate-100">
                                      {isBounce ? pt.livrees : pt.livreesCumul}
                                    </span>
                                  </div>
                                  {showYesterday && (
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-surface-border/50 pt-1">
                                      <span>Reçues hier :</span>
                                      <span className="tabular-nums text-slate-300">
                                        {isBounce ? pt.recuesHier : pt.recuesHierCumul}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {metric === "deliveries" && (
                                <div>
                                  <p className="text-[11px] text-slate-400">
                                    {isBounce ? "Livrées dans l'heure :" : "Cumul livraisons :"}
                                  </p>
                                  <p className="text-base font-bold tabular-nums text-emerald-400">
                                    {isBounce ? pt.livrees : pt.livreesCumul}
                                  </p>
                                  {showYesterday && (
                                    <p className="text-[11px] text-slate-400 mt-1 border-t border-surface-border/50 pt-1">
                                      Hier même heure : <span className="font-semibold text-slate-300">{pt.livreesHier}</span>
                                    </p>
                                  )}
                                </div>
                              )}

                              {metric === "injoignables" && (
                                <div>
                                  <p className="text-[11px] text-slate-400">
                                    {isBounce ? "Injoignables dans l'heure :" : "Cumul injoignables :"}
                                  </p>
                                  <p className="text-base font-bold tabular-nums text-rose-400">
                                    {isBounce ? pt.injoignables : pt.injoignablesCumul}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-1">
                              <p className="text-[11px] text-slate-400 italic">
                                Tracé arrêté à {currentTimeFormatted}. En attente du flux de commandes.
                              </p>
                              {showYesterday && (
                                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-surface-border/50 pt-1">
                                  <span>Hier même heure :</span>
                                  <span className="tabular-nums font-semibold text-slate-300">
                                    {(isBounce ? pt.caHier : pt.caHierCumul)?.toLocaleString("fr-FR")} {currency}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />

                  {/* Ligne repère verticale à l'instant T (Heure actuelle) */}
                  <ReferenceLine
                    x={currentHourLabel}
                    stroke="var(--brand)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                  />

                  {/* Courbe témoin Hier (complète 24h pour benchmark) */}
                  {showYesterday && metric === "ca" && (
                    <Line
                      type="monotone"
                      dataKey={curveMode === "bounce" ? "caHier" : "caHierCumul"}
                      stroke="#64748b"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={true}
                    />
                  )}

                  {showYesterday && metric === "orders" && (
                    <Line
                      type="monotone"
                      dataKey={curveMode === "bounce" ? "recuesHier" : "recuesHierCumul"}
                      stroke="#64748b"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={true}
                    />
                  )}

                  {/* Tracé Aujourd'hui : S'arrête strictement à l'heure actuelle grâce à connectNulls={false} */}
                  {metric === "ca" && (
                    <Area
                      type="monotone"
                      dataKey={curveMode === "bounce" ? "ca" : "caCumul"}
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      fill="url(#shopifyLiveBrandFill)"
                      connectNulls={false}
                      dot={renderLivePulseDot}
                      activeDot={{ r: 5, fill: "var(--brand)", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  )}

                  {metric === "orders" && (
                    <>
                      <Area
                        type="monotone"
                        dataKey={curveMode === "bounce" ? "recues" : "recuesCumul"}
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fill="url(#shopifyLiveSkyFill)"
                        connectNulls={false}
                        dot={renderLivePulseDot}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey={curveMode === "bounce" ? "livrees" : "livreesCumul"}
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#shopifyLiveEmeraldFill)"
                        connectNulls={false}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </>
                  )}

                  {metric === "deliveries" && (
                    <Area
                      type="monotone"
                      dataKey={curveMode === "bounce" ? "livrees" : "livreesCumul"}
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#shopifyLiveEmeraldFill)"
                      connectNulls={false}
                      dot={renderLivePulseDot}
                      activeDot={{ r: 5 }}
                    />
                  )}

                  {metric === "injoignables" && (
                    <Area
                      type="monotone"
                      dataKey={curveMode === "bounce" ? "injoignables" : "injoignablesCumul"}
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      fill="url(#shopifyLiveRoseFill)"
                      connectNulls={false}
                      dot={renderLivePulseDot}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </ComposedChart>
              ) : (
                /* ================= MODE JOURNALIER MULTI-JOURS (SEMAINE, MOIS, TOUT) ================= */
                <ComposedChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
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
                    wrapperStyle={{ zIndex: 10, pointerEvents: "none" }}
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
                  {metric === "ca" ? (
                    <Area
                      type="monotone"
                      dataKey="ca"
                      stroke="var(--brand)"
                      strokeWidth={2.5}
                      fill="url(#shopifyCaFill)"
                      dot={{ r: 3, fill: "var(--brand)" }}
                      activeDot={{ r: 5 }}
                    />
                  ) : metric === "injoignables" ? (
                    <Bar dataKey="injoignables" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  ) : (
                    <>
                      <Bar dataKey="recues" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="livrees" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </>
                  )}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
