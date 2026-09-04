import { useState } from "react";
import { useOrders, useRegisterPushNotifications, useUpdateOrderStatus, useTheme, NotificationBell } from "@ecomcod/shared";
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
  const { theme, toggleTheme } = useTheme("light");
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

  const scrollToOrder = (orderId: string) => {
    setTimeout(() => {
      const el = document.getElementById(`order-${orderId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-brand");
        setTimeout(() => el.classList.remove("ring-2", "ring-brand"), 3000);
      }
    }, 200);
  };

  return (
    <div className={`min-h-screen pb-6 ${theme === "dark" ? "dark bg-slate-900" : "bg-slate-50"}`}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <h1 className="text-base font-medium text-slate-900 dark:text-slate-100">Mes livraisons</h1>
        <div className="flex items-center gap-2">
          {/* Bouton dark mode */}
          <button
            onClick={toggleTheme}
            aria-label="Basculer le thème"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === "dark" ? (
              // Soleil
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              // Lune
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <NotificationBell
            workspaceId={workspaceId}
            userId={livreurId}
            onNotificationClick={(orderId) => {
              const target = orders.find((o) => o.id === orderId);
              if (!target) return;
              const status = target.statutLivreur ?? "recu";
              let tab: LivreurTab;
              if (status === "recu") tab = "a_livrer";
              else if (status === "en_route") tab = "en_cours";
              else tab = "terminees";
              setActiveTab(tab);
              scrollToOrder(orderId);
            }}
          />
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto px-4 py-3">
        {TABS.map((tab) => {
          const count = countFor(tab.key);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
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
          <p className="pt-10 text-center text-slate-400 dark:text-slate-500">Aucune livraison ici pour l'instant.</p>
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
