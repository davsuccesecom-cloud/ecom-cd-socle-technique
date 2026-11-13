import { useState, useEffect, useMemo } from "react";
import { Menu, Sun, Moon, PhoneIncoming } from "lucide-react";
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
    <div className="min-h-screen bg-surface pb-10 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between gap-2 border-b border-surface-border bg-surface-raised px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu des statuts"
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-surface-border bg-surface text-slate-700 dark:text-slate-200 hover:bg-surface-subtle transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="min-w-0 flex-1 text-center text-base font-semibold tracking-tight">
          {activeSecondary ? CLOSEUSE_STATUS_LABELS[activeSecondary] : "Mes commandes"}
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-surface-border bg-surface text-slate-700 dark:text-slate-200 hover:bg-surface-subtle transition-colors"
          >
            {theme === "dark" ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
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
                className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-surface-border bg-surface-raised text-slate-700 dark:text-slate-200 hover:bg-surface-subtle"
                }`}
              >
                <span>{CLOSEUSE_STATUS_LABELS[status]}</span>
                {count > 0 && (
                  <span
                    className={`inline-flex min-w-[22px] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                      active
                        ? "bg-white/20 text-white"
                        : status === "nouveau"
                        ? "bg-red-600 text-white"
                        : "bg-surface-subtle text-slate-700 dark:text-slate-200"
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
        {nouveauCount > 0 && activeTab === "nouveau" && !activeSecondary && (
          <div className="flex items-center gap-3 rounded-2xl border border-brand/25 bg-surface-raised p-3.5 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand dark:text-indigo-300">
              <PhoneIncoming className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {nouveauCount} commande{nouveauCount > 1 ? "s" : ""} à appeler maintenant
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
          <div className="rounded-2xl border border-surface-border bg-surface-raised px-5 py-10 text-center">
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
