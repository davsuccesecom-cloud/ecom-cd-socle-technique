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
import {
  TrendingUp,
  PackageCheck,
  PhoneCall,
  PhoneOff,
  AlertTriangle,
  ArrowUpRight,
  Radio,
  Bot,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import type { DailyStatRow, Order } from "@ecomcod/shared";

interface LiveShopifyAnalyticsProps {
  dailyStats: DailyStatRow[];
  orders: Order[];
  allOrders?: Order[];
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
  onNavigateToOrders?: (filter?: string) => void;
  onNavigateToAi?: (prompt?: string) => void;
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
  allOrders,
  currency,
  periodLabel,
  displayTotals,
  tauxConfirmation,
  tauxLivraisonReelle,
  onNavigateToOrders,
  onNavigateToAi,
}: LiveShopifyAnalyticsProps) {
  const [metric, setMetric] = useState<ActiveMetric>("ca");

  const baseLiveOrders = useMemo(() => {
    return allOrders && allOrders.length > 0 ? allOrders : orders;
  }, [allOrders, orders]);

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
    () => baseLiveOrders.filter((o) => o.statutCloseuse === "nouveau").length,
    [baseLiveOrders]
  );

  // 1. Leads froids / commandes Nouveau dépassant 15 min sans appel closeuse
  const staleNewOrders = useMemo(() => {
    const now = Date.now();
    return baseLiveOrders.filter((o) => {
      const rec = o.timestamps?.received ?? (o as any).createdAt ?? 0;
      return o.statutCloseuse === "nouveau" && rec > 0 && now - rec >= 15 * 60 * 1000;
    });
  }, [baseLiveOrders]);

  // 2. Livraisons retardées / bloquées sur le terrain (> 3h sur moto sans mise à jour)
  const delayedDeliveries = useMemo(() => {
    const now = Date.now();
    return baseLiveOrders.filter((o) => {
      const isOut = o.statutLivreur === "recu" || o.statutLivreur === "en_route";
      const isNotDone = o.statutCloseuse !== "livre" && o.statutCloseuse !== "rejete";
      if (!isOut || !isNotDone) return false;
      const refTs =
        o.timestamps?.livreurRespondedAt ??
        o.timestamps?.assignedToLivreur ??
        o.timestamps?.closeuseDecidedAt ??
        o.timestamps?.received ??
        now;
      return now - refTs >= 3 * 3600 * 1000;
    });
  }, [baseLiveOrders]);

  // 3. Rappels clients programmés arrivés à échéance et oubliés
  const overdueReminders = useMemo(() => {
    const now = Date.now();
    return baseLiveOrders.filter(
      (o) => o.statutCloseuse === "programme" && o.reminderAt && o.reminderAt <= now
    );
  }, [baseLiveOrders]);

  // 4. Colis confirmés qui dorment au dépôt sans livreur assigné (> 25 min)
  const unassignedConfirmed = useMemo(() => {
    const now = Date.now();
    return baseLiveOrders.filter((o) => {
      if (o.statutCloseuse !== "en_cours" || o.livreurId) return false;
      const refTs = o.timestamps?.closeuseDecidedAt ?? o.timestamps?.received ?? now;
      return now - refTs >= 25 * 60 * 1000;
    });
  }, [baseLiveOrders]);

  // Total des anomalies critiques Vigie IA
  const criticalAlertsCount =
    staleNewOrders.length +
    delayedDeliveries.length +
    overdueReminders.length +
    unassignedConfirmed.length;

  // Commandes confirmées en attente d'expédition ou sur le terrain (Prise de conscience livraisons)
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

  // Cash en circulation sur le terrain (colis sortis avec les coursiers)
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
                {displayTotals.ca.toLocaleString("fr-FR")} <span className="text-xs font-semibold text-emerald-400/80">{currency}</span>
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
                {cashEnRoute.toLocaleString("fr-FR")} <span className="text-xs font-semibold text-sky-400/80">{currency}</span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
            {pendingDeliveryCount} colis sur le terrain
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIGIE IA OPÉRATIONNELLE : DÉTECTION PROACTIVE DES ANOMALIES  */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
        {/* En-tête Vigie IA avec statut temps réel et bouton d'action IA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold shadow-xs ${
                criticalAlertsCount > 0
                  ? "bg-rose-600 text-white ring-2 ring-rose-500/30"
                  : "bg-emerald-600 text-white ring-2 ring-emerald-500/30"
              }`}
            >
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Vigie IA Logistique &amp; Terrain</h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    criticalAlertsCount > 0
                      ? "bg-rose-500/15 border border-rose-500/30 text-rose-400"
                      : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      criticalAlertsCount > 0 ? "bg-rose-400 animate-pulse" : "bg-emerald-400"
                    }`}
                  />
                  {criticalAlertsCount > 0
                    ? `${criticalAlertsCount} alerte${criticalAlertsCount > 1 ? "s" : ""} critique${criticalAlertsCount > 1 ? "s" : ""}`
                    : "Sous contrôle (0 alerte)"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Surveillance active 24/7 : réactivité des appels leads, coursiers sur la route et colis bloqués.
              </p>
            </div>
          </div>

          {onNavigateToAi && (
            <button
              type="button"
              onClick={() =>
                onNavigateToAi(
                  criticalAlertsCount > 0
                    ? `Vigie IA : voici le point d'alerte terrain actuel (${criticalAlertsCount} alertes détectées : ${staleNewOrders.length} lead(s) > 15 min, ${delayedDeliveries.length} livraison(s) > 3h sur moto, ${overdueReminders.length} rappel(s) dépassé(s), ${unassignedConfirmed.length} colis sans coursier). Établis-moi un plan d'action d'urgence immédiat pour débloquer ces commandes aujourd'hui.`
                    : "Vigie IA : fais-moi un audit complet de la journée (taux de confirmation, livraisons terrain, caisse livreurs et recommandations)."
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-100 px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer min-h-[44px] shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>{criticalAlertsCount > 0 ? "Auditer avec Vigie IA →" : "Demander audit IA →"}</span>
            </button>
          )}
        </div>

        {/* Grille des 4 alertes opérationnelles concrètes */}
        {criticalAlertsCount === 0 ? (
          <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Aucun retard critique : tous les nouveaux prospects ont été pris en charge en moins de 15 minutes et les livraisons progressent normalement.
              </span>
            </div>
            {onNavigateToOrders && (
              <button
                type="button"
                onClick={() => onNavigateToOrders()}
                className="text-xs font-bold text-brand hover:underline shrink-0"
              >
                Voir toutes les commandes →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-3.5">
            {/* Carte 1 : Leads froids (> 15 min) */}
            <div
              className={`rounded-xl border p-3 flex flex-col justify-between gap-3 ${
                staleNewOrders.length > 0
                  ? "border-amber-500/40 bg-amber-950/20"
                  : "border-surface-border bg-surface/50 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Leads Froids
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${
                      staleNewOrders.length > 0
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {staleNewOrders.length}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  {staleNewOrders.length > 0
                    ? `${staleNewOrders.length} commande(s) en attente > 15 min`
                    : "Aucun lead en attente"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Taux de closing divisé par 2 après 15 min sans premier appel WhatsApp.
                </p>
              </div>
              {onNavigateToOrders && staleNewOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToOrders("nouveau")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-2 text-xs font-bold transition min-h-[40px] cursor-pointer"
                >
                  <span>Appeler à chaud</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Carte 2 : Livraisons bloquées terrain (> 3h) */}
            <div
              className={`rounded-xl border p-3 flex flex-col justify-between gap-3 ${
                delayedDeliveries.length > 0
                  ? "border-rose-500/40 bg-rose-950/20"
                  : "border-surface-border bg-surface/50 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                    Livraisons Terrain
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${
                      delayedDeliveries.length > 0
                        ? "bg-rose-500 text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {delayedDeliveries.length}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  {delayedDeliveries.length > 0
                    ? `${delayedDeliveries.length} colis sur moto > 3h`
                    : "Toutes les tournées sont fluides"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Risque élevé d'annulation si le livreur tarde à se présenter chez le client.
                </p>
              </div>
              {onNavigateToOrders && delayedDeliveries.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToOrders("terrain")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white px-3 py-2 text-xs font-bold transition min-h-[40px] cursor-pointer"
                >
                  <span>Relancer coursiers</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Carte 3 : Rappels programmés dépassés */}
            <div
              className={`rounded-xl border p-3 flex flex-col justify-between gap-3 ${
                overdueReminders.length > 0
                  ? "border-amber-500/40 bg-amber-950/20"
                  : "border-surface-border bg-surface/50 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Rappels Dépassés
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${
                      overdueReminders.length > 0
                        ? "bg-amber-400 text-slate-950"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {overdueReminders.length}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  {overdueReminders.length > 0
                    ? `${overdueReminders.length} rendez-vous manqué(s)`
                    : "Aucun rappel en souffrance"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Créneaux convenus avec les clients qui n'ont pas encore été honorés.
                </p>
              </div>
              {onNavigateToOrders && overdueReminders.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToOrders("programme")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-2 text-xs font-bold transition min-h-[40px] cursor-pointer"
                >
                  <span>Rappeler client</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Carte 4 : Colis confirmés sans coursier (> 25 min) */}
            <div
              className={`rounded-xl border p-3 flex flex-col justify-between gap-3 ${
                unassignedConfirmed.length > 0
                  ? "border-sky-500/40 bg-sky-950/20"
                  : "border-surface-border bg-surface/50 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                    Sans Coursier
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${
                      unassignedConfirmed.length > 0
                        ? "bg-sky-500 text-slate-950"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {unassignedConfirmed.length}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  {unassignedConfirmed.length > 0
                    ? `${unassignedConfirmed.length} colis en attente au hub`
                    : "Toutes les commandes sont attribuées"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Confirmées par la closeuse mais aucun coursier n'a été assigné.
                </p>
              </div>
              {onNavigateToOrders && unassignedConfirmed.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToOrders("en_cours")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 px-3 py-2 text-xs font-bold transition min-h-[40px] cursor-pointer"
                >
                  <span>Assigner coursier</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

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
                    wrapperStyle={{ zIndex: 10, pointerEvents: "none" }}
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
                    wrapperStyle={{ zIndex: 10, pointerEvents: "none" }}
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
