import { useState } from "react";
import {
  CLOSEUSE_PRIORITY_STATUSES,
  CLOSEUSE_STATUS_LABELS,
  useCallInProgress,
  useOrders,
  useRegisterPushNotifications,
  useTeamUsers,
  useUpdateOrderStatus,
  NotificationBell,
  type CloseuseStatus,
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
  const { users: livreurs } = useTeamUsers(workspaceId, teamId, "livreur");
  const { startCall, endCall } = useCallInProgress(workspaceId);
  const { updateCloseuseStatus, assignLivreur } = useUpdateOrderStatus(workspaceId);
  useRegisterPushNotifications(workspaceId, closeuseId, import.meta.env.VITE_FIREBASE_VAPID_KEY);

  const [activeTab, setActiveTab] = useState<CloseuseStatus>("nouveau");
  const [activeSecondary, setActiveSecondary] = useState<CloseuseStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const displayedStatus = activeSecondary ?? activeTab;
  const visibleOrders = orders.filter((o) => o.statutCloseuse === displayedStatus);
  const nouveauCount = orders.filter((o) => o.statutCloseuse === "nouveau").length;

  return (
    <div className="min-h-screen pb-6">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <button onClick={() => setMenuOpen(true)} aria-label="Menu" className="p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-base font-medium">
          {activeSecondary ? CLOSEUSE_STATUS_LABELS[activeSecondary] : "Mes commandes"}
        </h1>
        <div className="flex items-center gap-2">
        <NotificationBell workspaceId={workspaceId} userId={closeuseId} />
        <button
          onClick={() => {
            setActiveSecondary(null);
            setActiveTab("nouveau");
          }}
          aria-label="Notifications"
          className="relative p-1"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {nouveauCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {nouveauCount}
            </span>
          )}
        </button>
        </div>
      </header>

      {!activeSecondary && (
        <nav className="flex gap-1 overflow-x-auto px-4 py-3">
          {CLOSEUSE_PRIORITY_STATUSES.map((status) => {
            const count = orders.filter((o) => o.statutCloseuse === status).length;
            const active = activeTab === status;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                  active ? "bg-brand text-white" : "bg-white text-slate-600"
                }`}
              >
                {CLOSEUSE_STATUS_LABELS[status]} {count > 0 && <span className="opacity-70">· {count}</span>}
              </button>
            );
          })}
        </nav>
      )}

      <main className="space-y-3 px-4">
        {loading && <p className="pt-10 text-center text-slate-400">Chargement…</p>}

        {!loading && visibleOrders.length === 0 && (
          <p className="pt-10 text-center text-slate-400">Aucune commande ici pour l'instant.</p>
        )}

        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            livreurs={livreurs}
            onCall={() => startCall(order.id, closeuseId)}
            onEndCall={() => endCall(order.id)}
            onChangeStatus={(status) => updateCloseuseStatus(order.id, status)}
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
