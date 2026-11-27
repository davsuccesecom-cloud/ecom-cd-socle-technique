import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Layers,
  Eye,
  EyeOff,
  Radio,
  PackageCheck,
  TrendingUp,
  PhoneCall,
  PhoneOff,
  ArrowUpRight,
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
    commandes: number;
    livraisons: number;
    injoignables: number;
    rejetees: number;
  };
  tauxConfirmation: number;
  tauxLivraisonReelle: number;
  onNavigateToOrders?: () => void;
  onNavigateToAi?: (prompt?: string) => void;
}

export type ActiveMetric = "ca" | "orders" | "deliveries" | "injoignables";
export type LiveCurveMode = "bounce" | "cumul";

export interface UnifiedChartPoint {
  key: string;
  label: string;
  timeStr: string;
  isCurrent: boolean;
  isPastOrCurrent: boolean;

  // Valeurs période active (null pour le futur = arrêt net du tracé)
  ca: number | null;
  caCumul: number | null;
  caVentes: number | null;
  recues: number | null;
  recuesCumul: number | null;
  livrees: number | null;
  livreesCumul: number | null;
  injoignables: number | null;
  injoignablesCumul: number | null;

  // Référence comparaison (hier, semaine passée, mois passé)
  caRef: number;
  caRefCumul: number;
  caRefVentes: number;
  recuesRef: number;
  recuesRefCumul: number;
  livreesRef: number;
  livreesRefCumul: number;
  injoignablesRef: number;
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
  const [curveMode, setCurveMode] = useState<LiveCurveMode>("bounce");
  const [showComparison, setShowComparison] = useState<boolean>(true);

  // Détection de la granularité selon la période globale du cockpit
  const isDayPreset =
    periodLabel === "Jour" ||
    periodLabel === "Aujourd'hui" ||
    (period?.type === "preset" && period.value === "jour");

  const isWeekPreset =
    periodLabel === "Semaine" ||
    (period?.type === "preset" && period.value === "semaine");

  const isMonthPreset =
    periodLabel === "Mois" ||
    (period?.type === "preset" && period.value === "mois");

  // Horloge en direct : rafraîchissement d'état local chaque minute (0 requête réseau !)
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

  // Utilise les commandes déjà chargées en mémoire par le listener Firestore existant (0 requête supplémentaire)
  const baseLiveOrders = useMemo(() => {
    return allOrders && allOrders.length > 0 ? allOrders : orders;
  }, [allOrders, orders]);

  // =========================================================================
  // MOTEUR UNIFIÉ DE CALCUL DE LA COURBE EN DIRECT & ARRÊT STRICT À L'INSTANT T
  // =========================================================================
  const {
    chartPoints,
    currentLabel,
    currentRefLabel,
    currentPointLabel,
    refButtonLabel,
    bounceLabel,
  } = useMemo(() => {
    // -----------------------------------------------------------------------
    // CAS 1 : JOUR (24 heures : 00h à 23h, arrêt net à l'heure en cours)
    // -----------------------------------------------------------------------
    if (isDayPreset) {
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

        // Commandes reçues aujourd'hui
        if (recvTs >= startOfToday && recvTs <= endOfToday) {
          const h = new Date(recvTs).getHours();
          if (h >= 0 && h < 24) {
            todayBuckets[h].recues += 1;
            todayBuckets[h].caVentes += amount;
            if (isInjoignable) todayBuckets[h].injoignables += 1;
          }
        }

        // Livraisons encaissées aujourd'hui
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

        // Commandes reçues hier (benchmark)
        if (recvTs >= startOfYesterday && recvTs <= endOfYesterday) {
          const h = new Date(recvTs).getHours();
          if (h >= 0 && h < 24) {
            yesterdayBuckets[h].recues += 1;
            yesterdayBuckets[h].caVentes += amount;
          }
        }

        // Livraisons encaissées hier
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
      let cumTodayRecues = 0;
      let cumTodayLivrees = 0;
      let cumTodayInjoignables = 0;

      let cumYestCa = 0;
      let cumYestRecues = 0;
      let cumYestLivrees = 0;
      let cumYestInjoignables = 0;

      const pts: UnifiedChartPoint[] = [];

      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, "0")}h`;
        const timeStr = `${String(h).padStart(2, "0")}:00`;
        const isPastOrCurrent = h <= currentHour;
        const isCurrent = h === currentHour;

        const yB = yesterdayBuckets[h];
        cumYestCa += yB.ca;
        cumYestRecues += yB.recues;
        cumYestLivrees += yB.livrees;
        cumYestInjoignables += yB.injoignables;

        if (isPastOrCurrent) {
          const tB = todayBuckets[h];
          cumTodayCa += tB.ca;
          cumTodayRecues += tB.recues;
          cumTodayLivrees += tB.livrees;
          cumTodayInjoignables += tB.injoignables;

          pts.push({
            key: `h-${h}`,
            label,
            timeStr,
            isCurrent,
            isPastOrCurrent: true,
            ca: tB.ca,
            caCumul: cumTodayCa,
            caVentes: tB.caVentes,
            recues: tB.recues,
            recuesCumul: cumTodayRecues,
            livrees: tB.livrees,
            livreesCumul: cumTodayLivrees,
            injoignables: tB.injoignables,
            injoignablesCumul: cumTodayInjoignables,
            caRef: yB.ca,
            caRefCumul: cumYestCa,
            caRefVentes: yB.caVentes,
            recuesRef: yB.recues,
            recuesRefCumul: cumYestRecues,
            livreesRef: yB.livrees,
            livreesRefCumul: cumYestLivrees,
            injoignablesRef: yB.injoignables,
          });
        } else {
          // Heure future : valeurs nulles pour arrêter net la courbe
          pts.push({
            key: `h-${h}`,
            label,
            timeStr,
            isCurrent: false,
            isPastOrCurrent: false,
            ca: null,
            caCumul: null,
            caVentes: null,
            recues: null,
            recuesCumul: null,
            livrees: null,
            livreesCumul: null,
            injoignables: null,
            injoignablesCumul: null,
            caRef: yB.ca,
            caRefCumul: cumYestCa,
            caRefVentes: yB.caVentes,
            recuesRef: yB.recues,
            recuesRefCumul: cumYestRecues,
            livreesRef: yB.livrees,
            livreesRefCumul: cumYestLivrees,
            injoignablesRef: yB.injoignables,
          });
        }
      }

      return {
        chartPoints: pts,
        currentLabel: `Aujourd'hui (00h à ${currentHourLabel})`,
        currentRefLabel: "Hier à la même heure",
        currentPointLabel: currentHourLabel,
        refButtonLabel: "Hier",
        bounceLabel: "Rebonds par heure",
      };
    }

    // -----------------------------------------------------------------------
    // CAS 2 : SEMAINE (Lundi à Dimanche, arrêt net au jour actuel)
    // -----------------------------------------------------------------------
    if (isWeekPreset) {
      const d = new Date(nowTime);
      const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Lundi, 6 = Dimanche
      const startOfThisWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek, 0, 0, 0, 0).getTime();
      const startOfLastWeek = startOfThisWeek - 7 * 86400000;

      const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
      const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

      interface DayBucket {
        ca: number;
        caVentes: number;
        recues: number;
        livrees: number;
        injoignables: number;
      }

      const thisWeekBuckets: DayBucket[] = Array.from({ length: 7 }, () => ({
        ca: 0,
        caVentes: 0,
        recues: 0,
        livrees: 0,
        injoignables: 0,
      }));

      const lastWeekBuckets: DayBucket[] = Array.from({ length: 7 }, () => ({
        ca: 0,
        caVentes: 0,
        recues: 0,
        livrees: 0,
        injoignables: 0,
      }));

      for (const o of baseLiveOrders) {
        const recvTs = getOrderTimestamp(o);
        const delivTs = getOrderDeliveredTimestamp(o);
        const isDelivered = o.statutLivreur === "livre" || o.statutCloseuse === "livre";
        const isInjoignable = o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable";
        const amount = o.amount || 0;

        // Cette semaine
        if (recvTs >= startOfThisWeek && recvTs < startOfThisWeek + 7 * 86400000) {
          const idx = Math.floor((recvTs - startOfThisWeek) / 86400000);
          if (idx >= 0 && idx < 7) {
            thisWeekBuckets[idx].recues += 1;
            thisWeekBuckets[idx].caVentes += amount;
            if (isInjoignable) thisWeekBuckets[idx].injoignables += 1;
          }
        }
        if (isDelivered) {
          const effectiveDelivTs = delivTs >= startOfThisWeek && delivTs < startOfThisWeek + 7 * 86400000 ? delivTs : recvTs;
          if (effectiveDelivTs >= startOfThisWeek && effectiveDelivTs < startOfThisWeek + 7 * 86400000) {
            const idx = Math.floor((effectiveDelivTs - startOfThisWeek) / 86400000);
            if (idx >= 0 && idx < 7) {
              thisWeekBuckets[idx].livrees += 1;
              thisWeekBuckets[idx].ca += amount;
            }
          }
        }

        // Semaine passée
        if (recvTs >= startOfLastWeek && recvTs < startOfThisWeek) {
          const idx = Math.floor((recvTs - startOfLastWeek) / 86400000);
          if (idx >= 0 && idx < 7) {
            lastWeekBuckets[idx].recues += 1;
            lastWeekBuckets[idx].caVentes += amount;
          }
        }
        if (isDelivered) {
          const effectiveDelivTs = delivTs >= startOfLastWeek && delivTs < startOfThisWeek ? delivTs : recvTs;
          if (effectiveDelivTs >= startOfLastWeek && effectiveDelivTs < startOfThisWeek) {
            const idx = Math.floor((effectiveDelivTs - startOfLastWeek) / 86400000);
            if (idx >= 0 && idx < 7) {
              lastWeekBuckets[idx].livrees += 1;
              lastWeekBuckets[idx].ca += amount;
            }
          }
        }
      }

      let cumThisCa = 0;
      let cumThisRecues = 0;
      let cumThisLivrees = 0;
      let cumThisInjoignables = 0;

      let cumLastCa = 0;
      let cumLastRecues = 0;
      let cumLastLivrees = 0;
      let cumLastInjoignables = 0;

      const pts: UnifiedChartPoint[] = [];

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const label = DAY_LABELS[dayIdx];
        const timeStr = DAY_NAMES[dayIdx];
        const isPastOrCurrent = dayIdx <= dayOfWeek;
        const isCurrent = dayIdx === dayOfWeek;

        const lB = lastWeekBuckets[dayIdx];
        cumLastCa += lB.ca;
        cumLastRecues += lB.recues;
        cumLastLivrees += lB.livrees;
        cumLastInjoignables += lB.injoignables;

        if (isPastOrCurrent) {
          const tB = thisWeekBuckets[dayIdx];
          cumThisCa += tB.ca;
          cumThisRecues += tB.recues;
          cumThisLivrees += tB.livrees;
          cumThisInjoignables += tB.injoignables;

          pts.push({
            key: `w-${dayIdx}`,
            label,
            timeStr,
            isCurrent,
            isPastOrCurrent: true,
            ca: tB.ca,
            caCumul: cumThisCa,
            caVentes: tB.caVentes,
            recues: tB.recues,
            recuesCumul: cumThisRecues,
            livrees: tB.livrees,
            livreesCumul: cumThisLivrees,
            injoignables: tB.injoignables,
            injoignablesCumul: cumThisInjoignables,
            caRef: lB.ca,
            caRefCumul: cumLastCa,
            caRefVentes: lB.caVentes,
            recuesRef: lB.recues,
            recuesRefCumul: cumLastRecues,
            livreesRef: lB.livrees,
            livreesRefCumul: cumLastLivrees,
            injoignablesRef: lB.injoignables,
          });
        } else {
          // Jour futur de la semaine : null pour arrêter net la courbe
          pts.push({
            key: `w-${dayIdx}`,
            label,
            timeStr,
            isCurrent: false,
            isPastOrCurrent: false,
            ca: null,
            caCumul: null,
            caVentes: null,
            recues: null,
            recuesCumul: null,
            livrees: null,
            livreesCumul: null,
            injoignables: null,
            injoignablesCumul: null,
            caRef: lB.ca,
            caRefCumul: cumLastCa,
            caRefVentes: lB.caVentes,
            recuesRef: lB.recues,
            recuesRefCumul: cumLastRecues,
            livreesRef: lB.livrees,
            livreesRefCumul: cumLastLivrees,
            injoignablesRef: lB.injoignables,
          });
        }
      }

      return {
        chartPoints: pts,
        currentLabel: `Cette semaine (Lun. à ${DAY_NAMES[dayOfWeek]})`,
        currentRefLabel: "Semaine dernière même jour",
        currentPointLabel: DAY_LABELS[dayOfWeek],
        refButtonLabel: "Semaine passée",
        bounceLabel: "Rebonds par jour",
      };
    }

    // -----------------------------------------------------------------------
    // CAS 3 : MOIS (1er au dernier jour, arrêt net à aujourd'hui ex: 75% du mois)
    // -----------------------------------------------------------------------
    if (isMonthPreset) {
      const y = nowTime.getFullYear();
      const m = nowTime.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const currentDay = nowTime.getDate();
      const monthProgressPercent = Math.round((currentDay / daysInMonth) * 100);

      const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
      const curMonthName = monthNames[m];

      // Mois précédent
      const prevY = m === 0 ? y - 1 : y;
      const prevM = m === 0 ? 11 : m - 1;
      const daysInPrevMonth = new Date(prevY, prevM + 1, 0).getDate();

      const startOfThisMonth = new Date(y, m, 1, 0, 0, 0, 0).getTime();
      const endOfThisMonth = new Date(y, m, daysInMonth, 23, 59, 59, 999).getTime();

      const startOfPrevMonth = new Date(prevY, prevM, 1, 0, 0, 0, 0).getTime();
      const endOfPrevMonth = new Date(prevY, prevM, daysInPrevMonth, 23, 59, 59, 999).getTime();

      interface MonthDayBucket {
        ca: number;
        caVentes: number;
        recues: number;
        livrees: number;
        injoignables: number;
      }

      const thisMonthBuckets: Record<number, MonthDayBucket> = {};
      const prevMonthBuckets: Record<number, MonthDayBucket> = {};

      for (let day = 1; day <= daysInMonth; day++) {
        thisMonthBuckets[day] = { ca: 0, caVentes: 0, recues: 0, livrees: 0, injoignables: 0 };
        prevMonthBuckets[day] = { ca: 0, caVentes: 0, recues: 0, livrees: 0, injoignables: 0 };
      }

      for (const o of baseLiveOrders) {
        const recvTs = getOrderTimestamp(o);
        const delivTs = getOrderDeliveredTimestamp(o);
        const isDelivered = o.statutLivreur === "livre" || o.statutCloseuse === "livre";
        const isInjoignable = o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable";
        const amount = o.amount || 0;

        // Commandes ce mois
        if (recvTs >= startOfThisMonth && recvTs <= endOfThisMonth) {
          const day = new Date(recvTs).getDate();
          if (thisMonthBuckets[day]) {
            thisMonthBuckets[day].recues += 1;
            thisMonthBuckets[day].caVentes += amount;
            if (isInjoignable) thisMonthBuckets[day].injoignables += 1;
          }
        }
        if (isDelivered) {
          const effectiveDelivTs = delivTs >= startOfThisMonth && delivTs <= endOfThisMonth ? delivTs : recvTs;
          if (effectiveDelivTs >= startOfThisMonth && effectiveDelivTs <= endOfThisMonth) {
            const day = new Date(effectiveDelivTs).getDate();
            if (thisMonthBuckets[day]) {
              thisMonthBuckets[day].livrees += 1;
              thisMonthBuckets[day].ca += amount;
            }
          }
        }

        // Commandes mois passé
        if (recvTs >= startOfPrevMonth && recvTs <= endOfPrevMonth) {
          const day = new Date(recvTs).getDate();
          if (prevMonthBuckets[day]) {
            prevMonthBuckets[day].recues += 1;
            prevMonthBuckets[day].caVentes += amount;
          }
        }
        if (isDelivered) {
          const effectiveDelivTs = delivTs >= startOfPrevMonth && delivTs <= endOfPrevMonth ? delivTs : recvTs;
          if (effectiveDelivTs >= startOfPrevMonth && effectiveDelivTs <= endOfPrevMonth) {
            const day = new Date(effectiveDelivTs).getDate();
            if (prevMonthBuckets[day]) {
              prevMonthBuckets[day].livrees += 1;
              prevMonthBuckets[day].ca += amount;
            }
          }
        }
      }

      let cumThisCa = 0;
      let cumThisRecues = 0;
      let cumThisLivrees = 0;
      let cumThisInjoignables = 0;

      let cumPrevCa = 0;
      let cumPrevRecues = 0;
      let cumPrevLivrees = 0;

      const pts: UnifiedChartPoint[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const label = `${day}`;
        const timeStr = `${day} ${curMonthName}`;
        const isPastOrCurrent = day <= currentDay;
        const isCurrent = day === currentDay;

        const pB = prevMonthBuckets[day] || { ca: 0, caVentes: 0, recues: 0, livrees: 0, injoignables: 0 };
        cumPrevCa += pB.ca;
        cumPrevRecues += pB.recues;
        cumPrevLivrees += pB.livrees;

        if (isPastOrCurrent) {
          const tB = thisMonthBuckets[day] || { ca: 0, caVentes: 0, recues: 0, livrees: 0, injoignables: 0 };
          cumThisCa += tB.ca;
          cumThisRecues += tB.recues;
          cumThisLivrees += tB.livrees;
          cumThisInjoignables += tB.injoignables;

          pts.push({
            key: `m-${day}`,
            label,
            timeStr,
            isCurrent,
            isPastOrCurrent: true,
            ca: tB.ca,
            caCumul: cumThisCa,
            caVentes: tB.caVentes,
            recues: tB.recues,
            recuesCumul: cumThisRecues,
            livrees: tB.livrees,
            livreesCumul: cumThisLivrees,
            injoignables: tB.injoignables,
            injoignablesCumul: cumThisInjoignables,
            caRef: pB.ca,
            caRefCumul: cumPrevCa,
            caRefVentes: pB.caVentes,
            recuesRef: pB.recues,
            recuesRefCumul: cumPrevRecues,
            livreesRef: pB.livrees,
            livreesRefCumul: cumPrevLivrees,
            injoignablesRef: pB.injoignables,
          });
        } else {
          // Jour futur du mois : null pour arrêter net la courbe à l'instant T
          pts.push({
            key: `m-${day}`,
            label,
            timeStr,
            isCurrent: false,
            isPastOrCurrent: false,
            ca: null,
            caCumul: null,
            caVentes: null,
            recues: null,
            recuesCumul: null,
            livrees: null,
            livreesCumul: null,
            injoignables: null,
            injoignablesCumul: null,
            caRef: pB.ca,
            caRefCumul: cumPrevCa,
            caRefVentes: pB.caVentes,
            recuesRef: pB.recues,
            recuesRefCumul: cumPrevRecues,
            livreesRef: pB.livrees,
            livreesRefCumul: cumPrevLivrees,
            injoignablesRef: pB.injoignables,
          });
        }
      }

      return {
        chartPoints: pts,
        currentLabel: `Ce mois (1er au ${currentDay} ${curMonthName} · ${monthProgressPercent}%)`,
        currentRefLabel: "Mois dernier même date",
        currentPointLabel: `${currentDay}`,
        refButtonLabel: "Mois passé",
        bounceLabel: "Rebonds par jour",
      };
    }

    // -----------------------------------------------------------------------
    // CAS 4 : PÉRIODE GLOBALE / TOUT / PERSONNALISÉ
    // -----------------------------------------------------------------------
    const todayIso = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate()).toISOString().slice(0, 10);
    const dayMap = new Map<string, { ca: number; recues: number; livrees: number; injoignables: number }>();

    for (const o of baseLiveOrders) {
      const dateKey = getOrderDayKey(o);
      const isDelivered = o.statutLivreur === "livre" || o.statutCloseuse === "livre";
      const isInjoignable = o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable";
      const amount = o.amount || 0;

      const cur = dayMap.get(dateKey) || { ca: 0, recues: 0, livrees: 0, injoignables: 0 };
      cur.recues += 1;
      if (isDelivered) {
        cur.livrees += 1;
        cur.ca += amount;
      }
      if (isInjoignable) cur.injoignables += 1;
      dayMap.set(dateKey, cur);
    }

    const sortedDates = Array.from(dayMap.keys()).sort();
    if (sortedDates.length === 0) sortedDates.push(todayIso);

    let cumCa = 0;
    let cumRecues = 0;
    let cumLivrees = 0;
    let cumInjoignables = 0;

    const pts: UnifiedChartPoint[] = sortedDates.map((dStr, idx) => {
      const b = dayMap.get(dStr) || { ca: 0, recues: 0, livrees: 0, injoignables: 0 };
      const isPastOrCurrent = dStr <= todayIso;
      const isCurrent = dStr === todayIso || idx === sortedDates.length - 1;
      cumCa += b.ca;
      cumRecues += b.recues;
      cumLivrees += b.livrees;
      cumInjoignables += b.injoignables;

      return {
        key: `d-${dStr}`,
        label: formatShortDay(dStr),
        timeStr: dStr,
        isCurrent,
        isPastOrCurrent,
        ca: isPastOrCurrent ? b.ca : null,
        caCumul: isPastOrCurrent ? cumCa : null,
        caVentes: isPastOrCurrent ? b.ca : null,
        recues: isPastOrCurrent ? b.recues : null,
        recuesCumul: isPastOrCurrent ? cumRecues : null,
        livrees: isPastOrCurrent ? b.livrees : null,
        livreesCumul: isPastOrCurrent ? cumLivrees : null,
        injoignables: isPastOrCurrent ? b.injoignables : null,
        injoignablesCumul: isPastOrCurrent ? cumInjoignables : null,
        caRef: 0,
        caRefCumul: 0,
        caRefVentes: 0,
        recuesRef: 0,
        recuesRefCumul: 0,
        livreesRef: 0,
        livreesRefCumul: 0,
        injoignablesRef: 0,
      };
    });

    return {
      chartPoints: pts,
      currentLabel: `${periodLabel} (jusqu'à aujourd'hui)`,
      currentRefLabel: "Période précédente",
      currentPointLabel: pts.find((p) => p.isCurrent)?.label ?? "",
      refButtonLabel: "Période préc.",
      bounceLabel: "Rebonds par jour",
    };
  }, [baseLiveOrders, isDayPreset, isWeekPreset, isMonthPreset, nowTime, currentHour, periodLabel]);

  // Colis en cours sur le terrain (calcul local en mémoire)
  const pendingDeliveryOrders = useMemo(
    () =>
      baseLiveOrders.filter(
        (o) =>
          (o.statutCloseuse === "en_cours" ||
            o.statutCloseuse === "programme" ||
            o.statutLivreur === "recu" ||
            o.statutLivreur === "en_route") &&
          o.statutLivreur !== "livre" &&
          o.statutLivreur !== "injoignable"
      ),
    [baseLiveOrders]
  );
  const pendingDeliveryCount = pendingDeliveryOrders.length;

  // Colis dont le délai de traitement ou tournée est dépassé (> 12h)
  const lateDeliveryCount = useMemo(() => {
    const TWELVE_HOURS_MS = 12 * 3600 * 1000;
    const nowMs = nowTime.getTime();
    return pendingDeliveryOrders.filter((o) => {
      const startTime =
        o.timestamps?.assignedToLivreur ||
        o.timestamps?.closeuseDecidedAt ||
        o.timestamps?.received ||
        0;
      return startTime > 0 && nowMs - startTime > TWELVE_HOURS_MS;
    }).length;
  }, [pendingDeliveryOrders, nowTime]);

  // Cash en circulation sur le terrain
  const cashEnRoute = useMemo(
    () => pendingDeliveryOrders.reduce((sum, o) => sum + (o.amount || 0), 0),
    [pendingDeliveryOrders]
  );

  // Commandes urgentes à appeler à chaud (statut nouveau)
  const urgentOrders = useMemo(
    () => baseLiveOrders.filter((o) => o.statutCloseuse === "nouveau"),
    [baseLiveOrders]
  );
  const urgentCount = urgentOrders.length;

  // Commandes à confirmer dont le délai de traitement est dépassé (> 15 minutes)
  const lateConfirmationCount = useMemo(() => {
    const FIFTEEN_MINS_MS = 15 * 60 * 1000;
    const nowMs = nowTime.getTime();
    return urgentOrders.filter((o) => {
      const received = o.timestamps?.received || 0;
      return received > 0 && nowMs - received > FIFTEEN_MINS_MS;
    }).length;
  }, [urgentOrders, nowTime]);

  // Point d'arrêt exact et stable au moment présent (zéro clignotement ni effet parasite)
  const dotFillColor =
    metric === "ca"
      ? "var(--brand)"
      : metric === "orders"
      ? "#0ea5e9"
      : metric === "deliveries"
      ? "#10b981"
      : "#f43f5e";

  const renderLivePulseDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || cx == null || cy == null) return null;
    if (payload.isCurrent) {
      return (
        <g key={`live-tip-${payload.key || payload.label}`}>
          <circle
            cx={cx}
            cy={cy}
            r={4.5}
            fill={dotFillColor}
            stroke="#ffffff"
            strokeWidth={2}
          />
        </g>
      );
    }
    return null;
  };

  // Sélection dynamique des clés de données selon la métrique et le mode de courbe
  const activeKey =
    metric === "ca"
      ? "ca"
      : metric === "orders"
      ? "recues"
      : metric === "deliveries"
      ? "livrees"
      : "injoignables";

  const activeCumulKey =
    metric === "ca"
      ? "caCumul"
      : metric === "orders"
      ? "recuesCumul"
      : metric === "deliveries"
      ? "livreesCumul"
      : "injoignablesCumul";

  const activeRefKey =
    metric === "ca"
      ? "caRef"
      : metric === "orders"
      ? "recuesRef"
      : metric === "deliveries"
      ? "livreesRef"
      : "injoignablesRef";

  const activeRefCumulKey =
    metric === "ca"
      ? "caRefCumul"
      : metric === "orders"
      ? "recuesRefCumul"
      : metric === "deliveries"
      ? "livreesRefCumul"
      : "injoignablesRef";

  return (
    <div className="space-y-3.5">
      {/* 1. Bandeau de Sécurité Financière : Encaissé vs Circulation (Compact & Allégé) */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-500/10 px-3.5 py-2 shadow-xs transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <PackageCheck className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 tracking-tight leading-none">Cash Sécurisé (Encaissé)</p>
              <p className="mt-0.5 text-base sm:text-lg font-extrabold tabular-nums text-emerald-950 dark:text-emerald-100 leading-tight">
                {displayTotals.ca.toLocaleString("fr-FR")}{" "}
                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-300">{currency}</span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 shrink-0">
            {displayTotals.livraisons} livraison{displayTotals.livraisons > 1 ? "s" : ""} validée{displayTotals.livraisons > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-sky-300 dark:border-sky-500/25 bg-sky-50/70 dark:bg-sky-500/10 px-3.5 py-2 shadow-xs transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300 tracking-tight leading-none">Cash en Circulation (Sur la route)</p>
              <p className="mt-0.5 text-base sm:text-lg font-extrabold tabular-nums text-sky-950 dark:text-sky-100 leading-tight">
                {cashEnRoute.toLocaleString("fr-FR")}{" "}
                <span className="text-[11px] font-normal text-sky-700 dark:text-sky-300">{currency}</span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-300 shrink-0">
            {pendingDeliveryCount} colis sur le terrain
          </span>
        </div>
      </div>

      {/* 2. Bannières de Vigilance Opérationnelle : STRICTEMENT conditionnées aux commandes actives & dépassements */}
      {(pendingDeliveryCount > 0 || urgentCount > 0) && (
        <div
          className={`grid gap-2.5 ${
            pendingDeliveryCount > 0 && urgentCount > 0
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {/* Volet 1 : Tournées & Livraisons (Affiché uniquement si colis actifs > 0) */}
          {pendingDeliveryCount > 0 && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 shadow-xs transition-all ${
                lateDeliveryCount > 0
                  ? "border-rose-300 dark:border-rose-500/40 bg-rose-50/70 dark:bg-gradient-to-r dark:from-rose-950/40 dark:via-sky-950/20 dark:to-surface-raised"
                  : "border-sky-300 dark:border-sky-500/25 bg-sky-50/70 dark:bg-gradient-to-r dark:from-sky-950/40 dark:via-sky-900/15 dark:to-surface-raised hover:border-sky-400 dark:hover:border-sky-500/40"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src="/icons/app-livreur-native.png"
                    alt="Tournées & Livraisons"
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-cover border border-sky-400/40 bg-slate-900 shadow-xs ring-1 ring-sky-500/20"
                  />
                  <span
                    className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] sm:h-4.5 sm:min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] sm:text-[10px] font-black ring-1 ring-slate-950 ${
                      lateDeliveryCount > 0
                        ? "bg-rose-500 text-white animate-pulse"
                        : "bg-sky-500 text-slate-950"
                    }`}
                  >
                    {pendingDeliveryCount}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-full bg-sky-100 dark:bg-sky-500/20 border border-sky-300 dark:border-sky-500/30 px-2 py-0.5 text-[9px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                      Tournées &amp; Livraisons
                    </span>
                    {lateDeliveryCount > 0 && (
                      <span className="rounded-full bg-rose-500/25 border border-rose-500/40 px-2 py-0.5 text-[9px] font-bold text-rose-300 uppercase tracking-wider animate-pulse">
                        ⚠️ Retard Critique ({lateDeliveryCount} &gt; 12h)
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {pendingDeliveryCount} commande{pendingDeliveryCount > 1 ? "s" : ""} à livrer
                    {lateDeliveryCount > 0 ? ` · ${lateDeliveryCount} en dépassement de délai` : ""}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5 truncate">
                    {lateDeliveryCount > 0
                      ? "Temps de traitement dépassé sur le terrain ! Activez vos livreurs pour éviter les annulations."
                      : "Chaque heure de retard réduit le taux de succès client · Activez vos livreurs."}
                  </p>
                </div>
              </div>
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer ${
                    lateDeliveryCount > 0
                      ? "bg-rose-500 hover:bg-rose-400 text-white"
                      : "bg-sky-500 hover:bg-sky-400 text-slate-950"
                  }`}
                >
                  <span>Livrer</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Volet 2 : Appels WhatsApp (Affiché uniquement si commandes à confirmer > 0) */}
          {urgentCount > 0 && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 shadow-xs transition-all ${
                lateConfirmationCount > 0
                  ? "border-rose-300 dark:border-rose-500/40 bg-rose-50/70 dark:bg-gradient-to-r dark:from-rose-950/40 dark:via-amber-950/20 dark:to-surface-raised"
                  : "border-amber-300 dark:border-amber-500/25 bg-amber-50/70 dark:bg-gradient-to-r dark:from-amber-950/40 dark:via-amber-900/15 dark:to-surface-raised hover:border-amber-400 dark:hover:border-amber-500/40"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src="/icons/app-closeuse-native.png"
                    alt="Appels WhatsApp"
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-cover border border-amber-400/40 bg-slate-900 shadow-xs ring-1 ring-amber-500/20"
                  />
                  <span
                    className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] sm:h-4.5 sm:min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] sm:text-[10px] font-black ring-1 ring-slate-950 ${
                      lateConfirmationCount > 0
                        ? "bg-rose-500 text-white animate-pulse"
                        : "bg-amber-500 text-slate-950"
                    }`}
                  >
                    {urgentCount}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      Appels WhatsApp
                    </span>
                    {lateConfirmationCount > 0 && (
                      <span className="rounded-full bg-rose-500/25 border border-rose-500/40 px-2 py-0.5 text-[9px] font-bold text-rose-300 uppercase tracking-wider animate-pulse">
                        ⚡ Urgence (&gt; 15 min)
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {urgentCount} commande{urgentCount > 1 ? "s" : ""} à confirmer
                    {lateConfirmationCount > 0 ? ` · ${lateConfirmationCount} critique${lateConfirmationCount > 1 ? "s" : ""}` : ""}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5 truncate">
                    {lateConfirmationCount > 0
                      ? "Délai de closing dépassé ! Le client se refroidit, appelez immédiatement."
                      : "Le taux de closing est divisé par 2 après 15 min · Intervenez à chaud."}
                  </p>
                </div>
              </div>
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer ${
                    lateConfirmationCount > 0
                      ? "bg-rose-500 hover:bg-rose-400 text-white"
                      : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                  }`}
                >
                  <span>Appeler</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}



      {/* 3. Cockpit Live & Tracé Évolutif Authentique */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised shadow-sm overflow-hidden">
        {/* Barre des 4 Métriques Interactives */}
        <div className="grid grid-cols-2 divide-y divide-surface-border lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <button
            type="button"
            onClick={() => setMetric("ca")}
            className={`flex flex-col justify-between border-b-2 p-4 text-left transition-all cursor-pointer ${
              metric === "ca" ? "border-b-brand bg-brand-light/20" : "border-b-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Chiffre d&apos;Affaires Encaissé</span>
              <TrendingUp className="h-3.5 w-3.5 text-brand" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100 sm:text-2xl">
              {displayTotals.ca.toLocaleString("fr-FR")}{" "}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{currency}</span>
            </p>
            <div className="mt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Période : {periodLabel}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMetric("orders")}
            className={`flex flex-col justify-between border-b-2 p-4 text-left transition-all border-l border-surface-border lg:border-l cursor-pointer ${
              metric === "orders" ? "border-b-brand bg-brand-light/20" : "border-b-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Flux des Commandes</span>
              <PhoneCall className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100 sm:text-2xl">
              {displayTotals.commandes.toLocaleString("fr-FR")}
            </p>
            <div className="mt-1">
              <span className="inline-block rounded-md border border-sky-200 dark:border-sky-500/20 bg-sky-100 dark:bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-300">
                Confirmation : {tauxConfirmation}%
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMetric("deliveries")}
            className={`flex flex-col justify-between border-b-2 border-t border-surface-border p-4 text-left transition-all lg:border-l lg:border-t-0 cursor-pointer ${
              metric === "deliveries" ? "border-b-brand bg-brand-light/20" : "border-b-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Livraisons Réussies</span>
              <PackageCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100 sm:text-2xl">
              {displayTotals.livraisons.toLocaleString("fr-FR")}
            </p>
            <div className="mt-1">
              <span className="inline-block rounded-md border border-emerald-200 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                Succès terrain : {tauxLivraisonReelle}%
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMetric("injoignables")}
            className={`flex flex-col justify-between border-b-2 border-l border-t border-surface-border p-4 text-left transition-all lg:border-t-0 cursor-pointer ${
              metric === "injoignables"
                ? "border-b-brand bg-brand-light/20"
                : "border-b-transparent hover:bg-surface/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Clients Injoignables</span>
              <PhoneOff className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-100 sm:text-2xl">
              {displayTotals.injoignables.toLocaleString("fr-FR")}
            </p>
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 dark:border-rose-500/20 bg-rose-100 dark:bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 dark:text-rose-300">
                <Radio className="h-2.5 w-2.5 text-rose-500 dark:text-rose-400 animate-pulse" />
                À relancer en priorité
              </span>
            </div>
          </button>
        </div>

        {/* Contrôles du graphique : Mode Rebonds vs Cumul + Légende & Comparaison */}
        <div className="border-b border-surface-border bg-surface/30 px-3.5 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Gauche : Légende précise de la période en cours et témoin comparatif */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand shadow-xs" />
                {currentLabel}
              </span>

              {showComparison && (
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="h-0.5 w-3 border-t-2 border-dashed border-slate-500" />
                  {currentRefLabel}
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowComparison((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Afficher ou masquer la courbe de comparaison"
              >
                {showComparison ? <Eye className="h-3 w-3 text-brand" /> : <EyeOff className="h-3 w-3" />}
                <span>{refButtonLabel}</span>
              </button>
            </div>

            {/* Droite : Bascule Rebonds vs Cumul + Badge Live */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-surface-border bg-surface p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCurveMode("bounce")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    curveMode === "bounce" ? "bg-brand text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Tracer les pics et rebondissements réels d'achat de chaque intervalle"
                >
                  <Activity className="h-3 w-3" />
                  <span>{bounceLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurveMode("cumul")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    curveMode === "cumul" ? "bg-brand text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Tracer la montée progressive cumulée au fil de la période"
                >
                  <Layers className="h-3 w-3" />
                  <span>Cumul progressif</span>
                </button>
              </div>

              {/* Badge Pulsant d'Actualisation en Direct */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="tabular-nums">
                  En direct · {currentTimeFormatted}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Zone Graphique Principale Haute Fidélité */}
        <div className="p-3.5 sm:p-4">
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartPoints} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
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
                  interval={isDayPreset ? 1 : isWeekPreset ? 0 : isMonthPreset ? 2 : "preserveStartEnd"}
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
                  cursor={false}
                  wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload as UnifiedChartPoint;
                    const isBounce = curveMode === "bounce";

                    return (
                      <div className="surface-popover rounded-xl p-3 text-xs shadow-lg border border-surface-border min-w-[220px] space-y-2">
                        <div className="flex items-center justify-between border-b border-surface-border pb-1.5">
                          <span className="font-semibold text-slate-200">
                            {pt.timeStr} {pt.isCurrent ? `· Maintenant (${currentTimeFormatted})` : ""}
                          </span>
                          {pt.isCurrent ? (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              EN DIRECT
                            </span>
                          ) : pt.isPastOrCurrent ? (
                            <span className="text-[10px] text-slate-400">Enregistré</span>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Période à venir</span>
                          )}
                        </div>

                        {pt.isPastOrCurrent ? (
                          <div className="space-y-1.5">
                            {metric === "ca" && (
                              <div>
                                <p className="text-[11px] text-slate-400">
                                  {isBounce ? "Ventes de l'intervalle :" : "Cumul à cet instant :"}
                                </p>
                                <p className="text-base font-bold tabular-nums text-slate-100">
                                  {(isBounce ? pt.ca : pt.caCumul)?.toLocaleString("fr-FR")} {currency}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {(pt.livrees ?? 0)} livrée{(pt.livrees ?? 0) > 1 ? "s" : ""} sur {(pt.recues ?? 0)} reçue{(pt.recues ?? 0) > 1 ? "s" : ""}
                                </p>
                                {showComparison && (
                                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-surface-border/50 pt-1">
                                    <span>{currentRefLabel} :</span>
                                    <span className="tabular-nums font-semibold text-slate-300">
                                      {(isBounce ? pt.caRef : pt.caRefCumul)?.toLocaleString("fr-FR")} {currency}
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
                                {showComparison && (
                                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-surface-border/50 pt-1">
                                    <span>Reçues ({currentRefLabel}) :</span>
                                    <span className="tabular-nums text-slate-300">
                                      {isBounce ? pt.recuesRef : pt.recuesRefCumul}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {metric === "deliveries" && (
                              <div>
                                <p className="text-[11px] text-slate-400">
                                  {isBounce ? "Livrées dans l'intervalle :" : "Cumul livraisons :"}
                                </p>
                                <p className="text-base font-bold tabular-nums text-emerald-400">
                                  {isBounce ? pt.livrees : pt.livreesCumul}
                                </p>
                                {showComparison && (
                                  <p className="text-[11px] text-slate-400 mt-1 border-t border-surface-border/50 pt-1">
                                    {currentRefLabel} : <span className="font-semibold text-slate-300">{isBounce ? pt.livreesRef : pt.livreesRefCumul}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {metric === "injoignables" && (
                              <div>
                                <p className="text-[11px] text-slate-400">
                                  {isBounce ? "Injoignables dans l'intervalle :" : "Cumul injoignables :"}
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
                              Tracé arrêté à l&apos;instant présent ({currentTimeFormatted}). En attente du flux de commandes.
                            </p>
                            {showComparison && (
                              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-surface-border/50 pt-1">
                                <span>{currentRefLabel} :</span>
                                <span className="tabular-nums font-semibold text-slate-300">
                                  {(isBounce ? pt.caRef : pt.caRefCumul)?.toLocaleString("fr-FR")} {currency}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />

                {/* Ligne repère verticale à l'instant T (point d'arrêt exact) */}
                {currentPointLabel && (
                  <ReferenceLine
                    x={currentPointLabel}
                    stroke="var(--brand)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                  />
                )}

                {/* Courbe témoin période précédente (complète pour référence benchmark) */}
                {showComparison && (
                  <Line
                    type="monotone"
                    dataKey={curveMode === "bounce" ? activeRefKey : activeRefCumulKey}
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={true}
                  />
                )}

                {/* Tracé actif de la période : S'ARRÊTE STRICTEMENT AU MOMENT PRÉSENT (connectNulls={false}) */}
                {metric === "ca" && (
                  <Area
                    type="monotone"
                    dataKey={curveMode === "bounce" ? activeKey : activeCumulKey}
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    fill="url(#shopifyLiveBrandFill)"
                    connectNulls={false}
                    dot={renderLivePulseDot}
                    activeDot={false}
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
                      activeDot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey={curveMode === "bounce" ? "livrees" : "livreesCumul"}
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#shopifyLiveEmeraldFill)"
                      connectNulls={false}
                      dot={false}
                      activeDot={false}
                    />
                  </>
                )}

                {metric === "deliveries" && (
                  <Area
                    type="monotone"
                    dataKey={curveMode === "bounce" ? activeKey : activeCumulKey}
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#shopifyLiveEmeraldFill)"
                    connectNulls={false}
                    dot={renderLivePulseDot}
                    activeDot={false}
                  />
                )}

                {metric === "injoignables" && (
                  <Area
                    type="monotone"
                    dataKey={curveMode === "bounce" ? activeKey : activeCumulKey}
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    fill="url(#shopifyLiveRoseFill)"
                    connectNulls={false}
                    dot={renderLivePulseDot}
                    activeDot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
