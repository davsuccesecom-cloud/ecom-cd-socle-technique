import { useState, useEffect, useMemo } from "react";
import { Menu } from "lucide-react";
import {
  CLOSEUSE_PRIORITY_STATUSES,
  CLOSEUSE_STATUS_LABELS,
  useCallInProgress,
  useOrders,
  useRegisterPushNotifications,
  useTeam,
  useTeamUsers,
  useUpdateOrderStatus,
  useTheme,
  NotificationBell,
  type CloseuseStatus,
  type CloseuseUpdateExtras,
} from "@ecomcod/shared";
import OrderCard from "../components/OrderCard";
import StatusMenu from "../components/StatusMenu";

interface DashboardProps {
  workspaceId: string;
  teamId: string;
  closeuseId: string;
}

export default function Dashboard({ workspaceId, teamId, closeuseId }: DashboardProps) {
  const { orders, loading } = useOrders({ workspaceId, teamId, closeuseId });
  const { team } = useTeam(workspaceId, teamId);
  const { users: livreurs } = useTeamUsers(workspaceId, teamId, "livreur");
  const { startCall, endCall } = useCallInProgress(workspaceId);
  const { updateCloseuseStatus, assignLivreur } = useUpdateOrderStatus(workspaceId);
  const { theme, toggleTheme } = useTheme("light");
  useRegisterPushNotifications(workspaceId, closeuseId, import.meta.env.VITE_FIREBASE_VAPID_KEY);

  const [activeTab, setActiveTab] = useState<CloseuseStatus>("nouveau");
  const [activeSecondary, setActiveSecondary] = useState<CloseuseStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayedStatus = activeSecondary ?? activeTab;
  const visibleOrders = orders.filter((o) => o.statutCloseuse === displayedStatus);
  const nouveauCount = orders.filter((o) => o.statutCloseuse === "nouveau").length;

  // Compteur de colis en cours par livreur pour aider à équilibrer la charge lors du choix
  const activeDeliveriesByLivreur = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      if (o.statutCloseuse === "en_cours" && o.livreurId && o.statutLivreur !== "livre") {
        counts[o.livreurId] = (counts[o.livreurId] || 0) + 1;
      }
    }
    return counts;
  }, [orders]);

  const scrollToOrder = (orderId: string) => {
    setTimeout(() => {
      const el = document.getElementById(`order-${orderId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-brand");
        setTimeout(() => el.classList.remove("ring-2", "ring-brand"), 3000);
      }
    }, 250);
  };

  const navigateToOrder = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      const isPrimary = (CLOSEUSE_PRIORITY_STATUSES as string[]).includes(target.statutCloseuse);
      if (isPrimary) {
        setActiveSecondary(null);
        setActiveTab(target.statutCloseuse);
      } else {
        setActiveSecondary(target.statutCloseuse);
      }
    }
    scrollToOrder(orderId);
  };

  // Deep-linking automatique lors de la réception d'une notification (clic push ou URL ?orderId=)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdFromUrl = urlParams.get("orderId");
    if (orderIdFromUrl && orders.length > 0) {
      navigateToOrder(orderIdFromUrl);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "NAVIGATE_ORDER" && event.data?.orderId) {
        navigateToOrder(event.data.orderId);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
      return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
    }
  }, [orders]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-10 text-slate-900 dark:text-slate-100 transition-colors">
      <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu des statuts"
          className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="min-w-0 flex-1 text-center text-base font-semibold tracking-tight">
          {activeSecondary ? CLOSEUSE_STATUS_LABELS[activeSecondary] : "Mes commandes"}
        </h1>

        <div className="flex items-center">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}
            className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          <NotificationBell
            workspaceId={workspaceId}
            userId={closeuseId}
            onNotificationClick={(orderId) => navigateToOrder(orderId)}
          />
        </div>
      </header>

      {!activeSecondary && (
        <nav aria-label="Statuts principaux" className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
          {CLOSEUSE_PRIORITY_STATUSES.map((status) => {
            const count = orders.filter((o) => o.statutCloseuse === status).length;
            const active = activeTab === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(status)}
                className={`relative flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <span>{CLOSEUSE_STATUS_LABELS[status]}</span>
                {count > 0 && (
                  <span
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tracking-tight tabular-nums ${
                      active
                        ? "bg-white text-brand"
                        : "bg-red-500 text-white shadow-sm animate-pulse"
                    }`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      <main className="mx-auto max-w-2xl space-y-3 px-4">
        {/* Bannière illustrée d'incitation à l'appel pour les nouvelles commandes */}
        {nouveauCount > 0 && activeTab === "nouveau" && !activeSecondary && (
          <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-slate-800 p-3.5 shadow-sm">
            <img
              src="/icons/app-closeuse-native.png"
              alt="Sac avec appel"
              className="h-11 w-11 rounded-2xl object-cover border border-indigo-200 dark:border-indigo-700/60 bg-slate-900 shadow-sm shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {nouveauCount} commande{nouveauCount > 1 ? "s" : ""} en attente d'appel !
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Appelez rapidement pour valider l'adresse et assigner le livreur à chaud.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <p className="pt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Chargement des commandes…
          </p>
        )}

        {!loading && visibleOrders.length === 0 && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Aucune commande dans cet onglet pour l'instant.
            </p>
          </div>
        )}

        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            team={team}
            livreurs={livreurs}
            activeDeliveriesByLivreur={activeDeliveriesByLivreur}
            onCall={() => startCall(order.id, closeuseId)}
            onEndCall={() => endCall(order.id)}
            onChangeStatus={(status, extras?: CloseuseUpdateExtras) =>
              updateCloseuseStatus(order.id, status, extras)
            }
            onAssignLivreur={(livreurId) => assignLivreur(order.id, livreurId)}
          />
        ))}
      </main>

      <StatusMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        orders={orders}
        activeSecondary={activeSecondary}
        onSelectSecondary={setActiveSecondary}
      />
    </div>
  );
}
