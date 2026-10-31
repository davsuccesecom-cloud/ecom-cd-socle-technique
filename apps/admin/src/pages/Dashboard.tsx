import { useMemo, useState } from "react";
import { useOrders, useTeams, useTeamUsers, useRegisterPushNotifications, useDailyStats, sumDailyStats, dailyStatDateToMs } from "@ecomcod/shared";
import type { CloseuseStatus } from "@ecomcod/shared";
import Sidebar from "../components/Sidebar";
import MobileNav from "../components/MobileNav";
import CreateTeamForm from "../components/CreateTeamForm";
import MarketSelector from "../components/MarketSelector";
import StatCard from "../components/StatCard";
import StatusDonut from "../components/StatusDonut";
import LivraisonsParLivreur from "../components/LivraisonsParLivreur";
import FluxTempsReel from "../components/FluxTempsReel";
import PerformanceEmployes from "../components/PerformanceEmployes";
import NotificationBell from "../components/NotificationBell";
import QuickSummary from "../components/QuickSummary";
import QuickSummaryFab from "../components/QuickSummaryFab";
import Utilisateurs from "./Utilisateurs";
import Commandes from "./Commandes";
import EquipesSheets from "./EquipesSheets";
import Parametres from "./Parametres";
import RevenueChart from "../components/RevenueChart";
import Remuneration from "./Remuneration";
import AiAssistant from "./AiAssistant";

interface DashboardProps {
  workspaceId: string;
  onLogout: () => void;
  userEmail: string | null;
  adminId: string;
}

import PeriodSelector, { type Period, periodRangeMs, periodLabel } from "../components/PeriodSelector";


const EMPTY_COUNTS: Record<CloseuseStatus, number> = {
  nouveau: 0,
  programme: 0,
  en_cours: 0,
  livre: 0,
  rejete: 0,
  injoignable: 0,
  indisponible: 0,
};

const PAGE_TITLES: Record<string, string> = {
  ai_assistant: "Analyste IA & Secrétaire de Direction ⭐",
  performance: "Performance des employés 📊",
  users: "Utilisateurs & Accès 👥",
  orders: "Commandes 🛒",
  teams: "Équipes & Sheets 📊",
  remuneration: "Rémunération 💰",
  settings: "Paramètres ⚙️",
};

export default function Dashboard({ workspaceId, onLogout, userEmail, adminId }: DashboardProps) {
  useRegisterPushNotifications(workspaceId, adminId, import.meta.env.VITE_FIREBASE_VAPID_KEY);
  const [page, setPage] = useState<string>("overview");
  const { teams, loading: teamsLoading } = useTeams(workspaceId);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>({ type: "preset", value: "jour" });
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [showRevenueChart, setShowRevenueChart] = useState(false);
  const activeTeamId = teamId ?? teams[0]?.id ?? null;
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  const { orders: allOrders, loading: ordersLoading } = useOrders({
    workspaceId,
    teamId: activeTeamId ?? "",
  });
  const { users: closeuses } = useTeamUsers(workspaceId, activeTeamId, "closeuse");
  const { users: livreurs } = useTeamUsers(workspaceId, activeTeamId, "livreur");

  const getReceivedTs = (o: any): number => {
    if (!o) return 0;
    const r = o.timestamps?.received ?? o.received ?? o.createdAt;
    if (typeof r === "number") return r;
    if (r && typeof r.toMillis === "function") return r.toMillis();
    if (r && typeof r.seconds === "number") return r.seconds * 1000;
    if (typeof r === "string") {
      const parsed = Date.parse(r);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
  };

  const orders = useMemo(() => {
    const { start, end } = periodRangeMs(period);
    return allOrders.filter((o) => {
      const ts = getReceivedTs(o);
      return ts >= start && ts <= end;
    });
  }, [allOrders, period]);

  // Marge de jours a recuperer sur dailyStats pour couvrir la periode
  // selectionnee. Limité à 365 max pour éviter tout débordement de date négative.
  const daysBack = useMemo(() => {
    const { start } = periodRangeMs(period);
    if (start <= 0) return 365;
    const diffDays = Math.ceil((Date.now() - start) / (24 * 60 * 60 * 1000));
    return Math.min(Math.max(diffDays + 1, 31), 365);
  }, [period]);

  const { rows: dailyStatRows } = useDailyStats(workspaceId, activeTeamId, daysBack);

  const dailyStatsInPeriod = useMemo(() => {
    const { start, end } = periodRangeMs(period);
    return dailyStatRows.filter((row) => {
      const dayStart = dailyStatDateToMs(row.date);
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
      return dayEnd >= start && dayStart <= end;
    });
  }, [dailyStatRows, period]);

  const periodTotals = useMemo(() => sumDailyStats(dailyStatsInPeriod), [dailyStatsInPeriod]);

  const stats = useMemo(() => {
    const statusCounts = { ...EMPTY_COUNTS };
    let closeuseFinal = 0;
    let closeuseConfirmees = 0;
    let livraisonsReussies = 0;
    let caOrders = 0;
    let injoignablesOrders = 0;
    let rejeteesOrders = 0;

    for (const order of orders) {
      if (order.statutCloseuse && order.statutCloseuse in statusCounts) {
        statusCounts[order.statutCloseuse] = (statusCounts[order.statutCloseuse] ?? 0) + 1;
      }

      const isDelivered = order.statutLivreur === "livre" || order.statutCloseuse === "livre";
      const isConfirmed = order.statutCloseuse === "en_cours" || order.statutCloseuse === "programme" || order.statutCloseuse === "livre";
      const isInjoignable = order.statutLivreur === "injoignable" || order.statutCloseuse === "injoignable";
      const isRejected = order.statutCloseuse === "rejete";

      if (isDelivered) {
        livraisonsReussies += 1;
        caOrders += order.amount ?? 0;
      }
      if (isInjoignable) {
        injoignablesOrders += 1;
      }
      if (isRejected) {
        rejeteesOrders += 1;
      }
      if (
        isConfirmed ||
        isRejected ||
        isInjoignable ||
        order.statutCloseuse === "indisponible"
      ) {
        closeuseFinal += 1;
        if (isConfirmed) closeuseConfirmees += 1;
      }
    }

    const tauxConfirmation = closeuseFinal > 0 ? Math.round((closeuseConfirmees / closeuseFinal) * 100) : 0;
    const tauxLivraisonReelle =
      closeuseConfirmees > 0 ? Math.round((livraisonsReussies / closeuseConfirmees) * 100) : 0;

    return {
      statusCounts,
      tauxConfirmation,
      tauxLivraisonReelle,
      livraisonsReussies,
      caOrders,
      injoignablesOrders,
      rejeteesOrders,
    };
  }, [orders]);

  // Fusionne les totaux : prend le maximum entre dailyStats (qui persiste les
  // commandes après leur purge) et les commandes réelles en mémoire.
  const displayTotals = useMemo(() => {
    return {
      ca: Math.max(periodTotals.ca || 0, stats.caOrders || 0),
      livraisons: Math.max(periodTotals.livraisons || 0, stats.livraisonsReussies || 0),
      injoignables: Math.max(periodTotals.injoignables || 0, stats.injoignablesOrders || 0),
      rejetees: Math.max(periodTotals.rejetees || 0, stats.rejeteesOrders || 0),
      commandes: Math.max(periodTotals.commandes || 0, orders.length),
    };
  }, [periodTotals, stats, orders.length]);

  const quickCounts = useMemo(
    () => ({
      total: displayTotals.commandes,
      enAttente: (stats.statusCounts.nouveau || 0) + (stats.statusCounts.programme || 0),
      enCours: stats.statusCounts.en_cours || 0,
      livrees: stats.statusCounts.livre || 0,
      rejetees: (stats.statusCounts.rejete || 0) + (stats.statusCounts.injoignable || 0) + (stats.statusCounts.indisponible || 0),
    }),
    [displayTotals.commandes, stats.statusCounts]
  );

  const loading = teamsLoading || ordersLoading;
  const showPeriodFilter = page === "overview" || page === "remuneration";

  return (
    <div className="min-h-screen bg-surface md:flex">
      <Sidebar active={page} userEmail={userEmail} onLogout={onLogout} onNavigate={setPage} />

      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
            <LogoIcon />
          </div>
          <span className="text-base font-semibold text-slate-100">Ecom COD</span>
        </div>
        <NotificationBell workspaceId={workspaceId} />
      </div>

      <main className="flex-1 px-5 py-6 pb-24 md:px-8 md:pb-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 md:text-2xl">
              {PAGE_TITLES[page] ?? "Vue globale du business 👋"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {teams.length > 0 && page !== "teams" && (
              <MarketSelector
                teams={teams}
                activeTeamId={activeTeamId}
                onSelectTeam={setTeamId}
                onAddMarket={() => setShowAddMarket(true)}
              />
            )}

            {showPeriodFilter && (
              <PeriodSelector period={period} onChange={setPeriod} />
            )}

            <div className="hidden md:block">
              <NotificationBell workspaceId={workspaceId} />
            </div>
          </div>
        </header>

        {teams.length === 0 && !teamsLoading ? (
          <CreateTeamForm workspaceId={workspaceId} onCreated={(newTeamId) => setTeamId(newTeamId)} />
        ) : page === "ai_assistant" ? (
          <AiAssistant
            workspaceId={workspaceId}
            team={activeTeam}
            allTeams={teams}
            orders={allOrders}
            closeuses={closeuses}
            livreurs={livreurs}
          />
        ) : page === "performance" ? (
          <PerformanceEmployes team={activeTeam} closeuses={closeuses} livreurs={livreurs} orders={allOrders} />
        ) : page === "users" ? (
          <Utilisateurs workspaceId={workspaceId} team={activeTeam} closeuses={closeuses} livreurs={livreurs} />
        ) : page === "orders" ? (
          <Commandes workspaceId={workspaceId} team={activeTeam} orders={allOrders} closeuses={closeuses} livreurs={livreurs} />
        ) : page === "teams" ? (
          <EquipesSheets workspaceId={workspaceId} teams={teams} />
        ) : page === "remuneration" ? (
          <Remuneration team={activeTeam} closeuses={closeuses} livreurs={livreurs} orders={orders} />
        ) : page === "settings" ? (
          <Parametres workspaceId={workspaceId} team={activeTeam} teams={teams} />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              <StatCard
                label="Chiffre d'affaires"
                value={`${displayTotals.ca.toLocaleString("fr-FR")} ${activeTeam?.currency || activeTeam?.metaCapiConfig?.currency || "XOF"}`}
                icon={<CaIcon />}
                accent="blue"
                onClick={() => setShowRevenueChart(true)}
              />
              <StatCard label="Livraisons réussies" value={String(displayTotals.livraisons)} icon={<TruckIcon />} accent="green" />
              <StatCard label="Injoignables" value={String(displayTotals.injoignables)} icon={<XIcon />} accent="red" />
              <StatCard label="Rejetées" value={String(displayTotals.rejetees)} icon={<BanIcon />} accent="orange" />
              <StatCard label="Taux de confirmation" value={`${stats.tauxConfirmation}%`} icon={<PhoneIcon />} accent="purple" />
              <StatCard label="Taux de livraison réelle" value={`${stats.tauxLivraisonReelle}%`} icon={<TargetIcon />} accent="cyan" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 lg:col-span-1">
                <h3 className="mb-3 text-sm font-medium text-slate-200">Répartition des statuts</h3>
                <StatusDonut counts={stats.statusCounts} />
              </div>

              <div className="lg:col-span-1">
                <LivraisonsParLivreur orders={orders} livreurs={livreurs} />
              </div>

              <div className="lg:col-span-1">
                <FluxTempsReel orders={orders} />
              </div>
            </div>

            {loading && <p className="mt-4 text-center text-xs text-slate-600">Mise à jour des données…</p>}
            {closeuses.length === 0 && livreurs.length === 0 && !loading && (
              <p className="mt-4 text-center text-xs text-slate-600">Aucun employé sur cette équipe pour l'instant.</p>
            )}
          </>
        )}
      </main>

      <MobileNav active={page} onNavigate={setPage} />

      {showRevenueChart && (
        <RevenueChart
          dailyStats={dailyStatsInPeriod}
          orders={orders}
          currency={activeTeam?.currency || activeTeam?.metaCapiConfig?.currency || "XOF"}
          periodLabel={periodLabel(period)}
          onClose={() => setShowRevenueChart(false)}
        />
      )}

      {showAddMarket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowAddMarket(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <CreateTeamForm
              workspaceId={workspaceId}
              onCreated={(newTeamId) => {
                setTeamId(newTeamId);
                setShowAddMarket(false);
              }}
              onCancel={() => setShowAddMarket(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LogoIcon() {
  return <img src="/icons/icon-192.png" alt="Ecom COD" className="h-full w-full object-cover" />;
}

function iconProps() {
  return { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}
function CaIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M1 3h13v13H1z" />
      <path d="M14 8h4l3 3v5h-7V8Z" />
      <circle cx="5.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function BanIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a2 2 0 0 1-2 2C9.6 22 2 14.4 2 6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}
