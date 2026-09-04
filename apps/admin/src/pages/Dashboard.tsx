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
  performance: "Performance des employÃ©s ðŸ“Š",
  users: "Utilisateurs & AccÃ¨s ðŸ”",
  orders: "Commandes ðŸ›’",
  teams: "Ã‰quipes & Sheets ðŸ“Š",
  remuneration: "RÃ©munÃ©ration ðŸ’°",
  settings: "ParamÃ¨tres âš™ï¸",
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

  const orders = useMemo(() => {
    const { start, end } = periodRangeMs(period);
    return allOrders.filter((o) => o.timestamps.received >= start && o.timestamps.received <= end);
  }, [allOrders, period]);

  // Marge de jours a recuperer sur dailyStats pour couvrir la periode
  // selectionnee, meme si elle remonte plus loin que la purge de 3 jours
  // des commandes brutes (orders). Toujours au moins 31 jours pour couvrir
  // un mois calendaire.
  const daysBack = useMemo(() => {
    const { start } = periodRangeMs(period);
    const diffDays = Math.ceil((Date.now() - start) / (24 * 60 * 60 * 1000));
    return Math.max(diffDays + 1, 31);
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

  // CA / livraisons / injoignables / rejetees affiches viennent de
  // dailyStats (jamais purge) plutot que d'un recalcul sur "orders"
  // (purge apres 3 jours) -- c'est ce qui corrige la perte de donnees
  // constatee sur le dashboard pour toute periode > 3 jours.
  const periodTotals = useMemo(() => sumDailyStats(dailyStatsInPeriod), [dailyStatsInPeriod]);

  const stats = useMemo(() => {
    const statusCounts = { ...EMPTY_COUNTS };
    let closeuseFinal = 0;
    let closeuseConfirmees = 0;
    let livraisonsReussies = 0;

    for (const order of orders) {
      statusCounts[order.statutCloseuse] = (statusCounts[order.statutCloseuse] ?? 0) + 1;

      if (order.statutLivreur === "livre") {
        livraisonsReussies += 1;
      }
      if (
        order.statutCloseuse === "livre" ||
        order.statutCloseuse === "rejete" ||
        order.statutCloseuse === "injoignable"
      ) {
        closeuseFinal += 1;
        if (order.statutCloseuse === "livre") closeuseConfirmees += 1;
      }
    }

    const tauxConfirmation = closeuseFinal > 0 ? Math.round((closeuseConfirmees / closeuseFinal) * 100) : 0;
    const tauxLivraisonReelle =
      closeuseConfirmees > 0 ? Math.round((livraisonsReussies / closeuseConfirmees) * 100) : 0;

    return { statusCounts, tauxConfirmation, tauxLivraisonReelle };
  }, [orders]);

  const quickCounts = useMemo(
    () => ({
      total: orders.length,
      enAttente: stats.statusCounts.nouveau + stats.statusCounts.programme,
      enCours: stats.statusCounts.en_cours,
      livrees: stats.statusCounts.livre,
      rejetees: stats.statusCounts.rejete + stats.statusCounts.injoignable,
    }),
    [orders.length, stats.statusCounts]
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
            <p className="hidden text-sm text-slate-500 md:block">Tableau de bord</p>
            <h1 className="text-xl font-semibold text-slate-100 md:text-2xl">
              {PAGE_TITLES[page] ?? "Vue globale du business ðŸ‘‹"}
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
          <Parametres workspaceId={workspaceId} team={activeTeam} />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              <StatCard
                label="Chiffre d'affaires"
                value={`${periodTotals.ca.toLocaleString("fr-FR")}`}
                icon={<CaIcon />}
                accent="blue"
                onClick={() => setShowRevenueChart(true)}
              />
              <StatCard label="Livraisons rÃ©ussies" value={String(periodTotals.livraisons)} icon={<TruckIcon />} accent="green" />
              <StatCard label="Injoignables" value={String(periodTotals.injoignables)} icon={<XIcon />} accent="red" />
              <StatCard label="RejetÃ©es" value={String(periodTotals.rejetees)} icon={<BanIcon />} accent="orange" />
              <StatCard label="Taux de confirmation" value={`${stats.tauxConfirmation}%`} icon={<PhoneIcon />} accent="purple" />
              <StatCard label="Taux de livraison rÃ©elle" value={`${stats.tauxLivraisonReelle}%`} icon={<TargetIcon />} accent="cyan" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 lg:col-span-1">
                <h3 className="mb-3 text-sm font-medium text-slate-200">RÃ©partition des statuts</h3>
                <StatusDonut counts={stats.statusCounts} />
              </div>

              <div className="lg:col-span-1">
                <LivraisonsParLivreur orders={orders} livreurs={livreurs} />
              </div>

              <div className="lg:col-span-1">
                <FluxTempsReel orders={orders} />
              </div>
            </div>

            <div className="mt-4 hidden md:block">
              <QuickSummary counts={quickCounts} />
            </div>
            <QuickSummaryFab counts={quickCounts} />

            {loading && <p className="mt-4 text-center text-xs text-slate-600">Mise Ã  jour des donnÃ©esâ€¦</p>}
            {closeuses.length === 0 && livreurs.length === 0 && !loading && (
              <p className="mt-4 text-center text-xs text-slate-600">Aucun employÃ© sur cette Ã©quipe pour l'instant.</p>
            )}
          </>
        )}
      </main>

      <MobileNav active={page} onNavigate={setPage} />

      {showRevenueChart && (
        <RevenueChart dailyStats={dailyStatsInPeriod} periodLabel={periodLabel(period)} onClose={() => setShowRevenueChart(false)} />
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
