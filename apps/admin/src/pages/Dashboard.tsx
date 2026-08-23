import { useMemo, useState } from "react";
import { useOrders, useTeams, useTeamUsers } from "@ecomcod/shared";
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

interface DashboardProps {
  workspaceId: string;
  onLogout: () => void;
  userEmail: string | null;
}

type Period = "jour" | "semaine" | "mois" | "tout";

const PERIOD_LABELS: Record<Period, string> = {
  jour: "Jour",
  semaine: "Semaine",
  mois: "Mois",
  tout: "Tout",
};

function periodStartMs(period: Period): number {
  const now = new Date();
  if (period === "tout") return 0;
  if (period === "jour") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.getTime();
  }
  if (period === "semaine") return Date.now() - 7 * 24 * 60 * 60 * 1000;
  return Date.now() - 30 * 24 * 60 * 60 * 1000;
}

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
  performance: "Performance des employés 📊",
  users: "Utilisateurs & Accès 🔐",
  orders: "Commandes 🛒",
  teams: "Équipes & Sheets 📊",
  settings: "Paramètres ⚙️",
};

export default function Dashboard({ workspaceId, onLogout, userEmail }: DashboardProps) {
  const [page, setPage] = useState<string>("overview");
  const { teams, loading: teamsLoading } = useTeams(workspaceId);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("jour");
  const [showAddMarket, setShowAddMarket] = useState(false);
  const activeTeamId = teamId ?? teams[0]?.id ?? null;
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  const { orders: allOrders, loading: ordersLoading } = useOrders({
    workspaceId,
    teamId: activeTeamId ?? "",
  });
  const { users: closeuses } = useTeamUsers(workspaceId, activeTeamId, "closeuse");
  const { users: livreurs } = useTeamUsers(workspaceId, activeTeamId, "livreur");

  const orders = useMemo(() => {
    const start = periodStartMs(period);
    return allOrders.filter((o) => o.timestamps.received >= start);
  }, [allOrders, period]);

  const stats = useMemo(() => {
    const statusCounts = { ...EMPTY_COUNTS };
    let ca = 0;
    let livraisonsReussies = 0;
    let injoignables = 0;
    let rejetees = 0;
    let closeuseFinal = 0;
    let closeuseConfirmees = 0;

    for (const order of orders) {
      statusCounts[order.statutCloseuse] = (statusCounts[order.statutCloseuse] ?? 0) + 1;

      if (order.statutLivreur === "livre") {
        livraisonsReussies += 1;
        ca += order.amount;
      }
      if (order.statutLivreur === "injoignable" || order.statutCloseuse === "injoignable") {
        injoignables += 1;
      }
      if (order.statutCloseuse === "rejete") {
        rejetees += 1;
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

    return { statusCounts, ca, livraisonsReussies, injoignables, rejetees, tauxConfirmation, tauxLivraisonReelle };
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
  const showPeriodFilter = page === "overview";

  return (
    <div className="min-h-screen bg-surface md:flex">
      <Sidebar active={page} userEmail={userEmail} onLogout={onLogout} onNavigate={setPage} />

      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
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
              <div className="flex rounded-xl border border-surface-border bg-surface-raised p-1">
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      period === p ? "bg-brand text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
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
        ) : page === "settings" ? (
          <Parametres />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              <StatCard label="Chiffre d'affaires" value={`${stats.ca.toLocaleString("fr-FR")}`} icon={<CaIcon />} accent="blue" />
              <StatCard label="Livraisons réussies" value={String(stats.livraisonsReussies)} icon={<TruckIcon />} accent="green" />
              <StatCard label="Injoignables" value={String(stats.injoignables)} icon={<XIcon />} accent="red" />
              <StatCard label="Rejetées" value={String(stats.rejetees)} icon={<BanIcon />} accent="orange" />
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

            <div className="mt-4 hidden md:block">
              <QuickSummary counts={quickCounts} />
            </div>
            <QuickSummaryFab counts={quickCounts} />

            {loading && <p className="mt-4 text-center text-xs text-slate-600">Mise à jour des données…</p>}
            {closeuses.length === 0 && livreurs.length === 0 && !loading && (
              <p className="mt-4 text-center text-xs text-slate-600">Aucun employé sur cette équipe pour l'instant.</p>
            )}
          </>
        )}
      </main>

      <MobileNav active={page} onNavigate={setPage} />

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
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 2a10 10 0 1 0 7.07 17.07" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
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
