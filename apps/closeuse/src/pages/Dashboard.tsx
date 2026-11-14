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
  useWhiteLabel,
  NotificationBell,
  PushPermissionPrompt,
  PushToast,
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
  const whiteLabel = useWhiteLabel(workspaceId, "closeuse");
  const { permission, requestPushPermission } = useRegisterPushNotifications(
    workspaceId,
    closeuseId,
    import.meta.env.VITE_FIREBASE_VAPID_KEY
  );

  const [activeTab, setActiveTab] = useState<CloseuseStatus>("nouveau");
  const [activeSecondary, setActiveSecondary] = useState<CloseuseStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayedStatus = activeSecondary ?? activeTab;
  const visibleOrders = orders.filter((o) => o.statutCloseuse === displayedStatus);
  const nouveauCount = orders.filter((o) => o.statutCloseuse === "nouveau").length;

  const hasCustomLogo = Boolean(whiteLabel?.customLogoUrl && whiteLabel?.useNativeIcons !== true);
  const brandLogoUrl = hasCustomLogo ? whiteLabel!.customLogoUrl! : null;
  const headerTitle = activeSecondary
    ? CLOSEUSE_STATUS_LABELS[activeSecondary]
    : whiteLabel?.closeuseTitle || "Mes commandes";

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
      <header className="sticky top-0 z-20 flex min-h-[52px] items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu des statuts"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 flex items-center justify-center gap-2 px-1">
          {brandLogoUrl && (
            <img
              src={brandLogoUrl}
              alt={whiteLabel?.brandName || "Logo"}
              className="h-7 w-7 rounded-lg object-cover border border-slate-200 dark:border-slate-600 shrink-0"
            />
          )}
          <h1 className="truncate text-[15px] font-semibold tracking-tight">{headerTitle}</h1>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-base text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
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
        <nav aria-label="Statuts principaux" className="flex gap-1.5 overflow-x-auto px-3.5 py-2 no-scrollbar">
          {CLOSEUSE_PRIORITY_STATUSES.map((status) => {
            const count = orders.filter((o) => o.statutCloseuse === status).length;
            const active = activeTab === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(status)}
                className={`relative flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <span>{CLOSEUSE_STATUS_LABELS[status]}</span>
                {count > 0 && (
                  <span
                    className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tracking-tight tabular-nums ${
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

      <main className="mx-auto max-w-2xl space-y-2.5 px-3.5">
        <PushPermissionPrompt permission={permission} onRequest={requestPushPermission} />

        {/* Bannière illustrée compacte pour les nouvelles commandes */}
        {nouveauCount > 0 && activeTab === "nouveau" && !activeSecondary && (
          <div className="flex items-center gap-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-slate-800 p-2.5 shadow-sm">
            <img
              src={brandLogoUrl || "/icons/app-closeuse-native.png"}
              alt="Appels en attente"
              className="h-9 w-9 rounded-xl object-cover border border-indigo-200 dark:border-indigo-700/60 bg-slate-900 shadow-sm shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {nouveauCount} commande{nouveauCount > 1 ? "s" : ""} en attente d'appel !
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
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
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-8 text-center shadow-sm">
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

      <PushToast
        customLogoUrl={brandLogoUrl}
        fallbackIcon="/icons/app-closeuse-native.png"
        onOpenOrder={navigateToOrder}
      />
    </div>
  );
}
