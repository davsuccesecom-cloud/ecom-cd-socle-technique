import { useState } from "react";
import { useOrders, useRegisterPushNotifications, useUpdateOrderStatus, NotificationBell } from "@ecomcod/shared";
import OrderCard from "../components/OrderCard";

interface DashboardProps {
  workspaceId: string;
  teamId: string;
  livreurId: string;
}

type LivreurTab = "a_livrer" | "en_cours" | "terminees";

const TABS: { key: LivreurTab; label: string }[] = [
  { key: "a_livrer", label: "À livrer" },
  { key: "en_cours", label: "En cours" },
  { key: "terminees", label: "Terminées" },
];

export default function Dashboard({ workspaceId, teamId, livreurId }: DashboardProps) {
  const { orders, loading } = useOrders({ workspaceId, teamId, livreurId });
  const { updateLivreurStatus } = useUpdateOrderStatus(workspaceId);
  useRegisterPushNotifications(workspaceId, livreurId, import.meta.env.VITE_FIREBASE_VAPID_KEY);

  const [activeTab, setActiveTab] = useState<LivreurTab>("a_livrer");

  const matchesTab = (status: string | null, tab: LivreurTab) => {
    const s = status ?? "recu";
    if (tab === "a_livrer") return s === "recu";
    if (tab === "en_cours") return s === "en_route";
    return s === "livre" || s === "injoignable";
  };

  const visibleOrders = orders.filter((o) => matchesTab(o.statutLivreur, activeTab));
  const countFor = (tab: LivreurTab) => orders.filter((o) => matchesTab(o.statutLivreur, tab)).length;

  return (
    <div className="min-h-screen pb-6">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <h1 className="text-base font-medium">Mes livraisons</h1>
        <NotificationBell workspaceId={workspaceId} userId={livreurId} />
      </header>

      <nav className="flex gap-1 overflow-x-auto px-4 py-3">
        {TABS.map((tab) => {
          const count = countFor(tab.key);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                active ? "bg-brand text-white" : "bg-white text-slate-600"
              }`}
            >
              {tab.label} {count > 0 && <span className="opacity-70">· {count}</span>}
            </button>
          );
        })}
      </nav>

      <main className="space-y-3 px-4">
        {loading && <p className="pt-10 text-center text-slate-400">Chargement…</p>}

        {!loading && visibleOrders.length === 0 && (
          <p className="pt-10 text-center text-slate-400">Aucune livraison ici pour l'instant.</p>
        )}

        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onChangeStatus={(status) => updateLivreurStatus(order.id, status)}
          />
        ))}
      </main>
    </div>
  );
}
