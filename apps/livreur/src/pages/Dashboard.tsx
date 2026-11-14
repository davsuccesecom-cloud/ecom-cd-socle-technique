import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  useOrders,
  useRegisterPushNotifications,
  useUpdateOrderStatus,
  useTheme,
  NotificationBell,
  getDb,
  type LivreurUpdateExtras,
  type Team,
} from "@ecomcod/shared";
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
  const [team, setTeam] = useState<Team | null>(null);
  const [livreurName, setLivreurName] = useState<string>("");
  useRegisterPushNotifications(workspaceId, livreurId, import.meta.env.VITE_FIREBASE_VAPID_KEY);

  useEffect(() => {
    if (!workspaceId || !teamId) return;
    const db = getDb();
    const unsub = onSnapshot(doc(db, "workspaces", workspaceId, "teams", teamId), (snap) => {
      if (snap.exists()) {
        setTeam({ id: snap.id, ...snap.data() } as Team);
      }
    });
    return () => unsub();
  }, [workspaceId, teamId]);

  useEffect(() => {
    if (!workspaceId || !livreurId) return;
    const db = getDb();
    const unsub = onSnapshot(doc(db, "workspaces", workspaceId, "users", livreurId), (snap) => {
      if (snap.exists()) {
        setLivreurName((snap.data() as { name?: string })?.name || "");
      }
    });
    return () => unsub();
  }, [workspaceId, livreurId]);

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
    }, 250);
  };

  const navigateToOrder = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      const status = target.statutLivreur ?? "recu";
      let tab: LivreurTab;
      if (status === "recu") tab = "a_livrer";
      else if (status === "en_route") tab = "en_cours";
      else tab = "terminees";
      setActiveTab(tab);
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
      <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-1.5">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight">Mes livraisons</h1>
          {livreurName && (
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{livreurName}</p>
          )}
        </div>

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
            userId={livreurId}
            onNotificationClick={(orderId) => navigateToOrder(orderId)}
          />
        </div>
      </header>

      <nav aria-label="Onglets de tournée" className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {TABS.map((tab) => {
          const count = countFor(tab.key);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <span>{tab.label}</span>
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

      <main className="mx-auto max-w-2xl space-y-3 px-4">
        {/* Bannière illustrée d'incitation à démarrer la tournée */}
        {countFor("a_livrer") > 0 && activeTab === "a_livrer" && (
          <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-slate-800 p-3.5 shadow-sm">
            <img
              src="/icons/app-livreur-native.png"
              alt="Livreur en moto"
              className="h-11 w-11 rounded-2xl object-cover border border-sky-200 dark:border-sky-700/60 bg-slate-900 shadow-sm shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {countFor("a_livrer")} colis en attente de livraison !
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Démarrez votre tournée avant de prendre la route et encaissez le cash à la remise.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <p className="pt-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Chargement de votre feuille de route…
          </p>
        )}

        {!loading && visibleOrders.length === 0 && (
          <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Aucune livraison dans cet onglet pour l'instant.
            </p>
          </div>
        )}

        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            team={team}
            livreurName={livreurName}
            onChangeStatus={(status, extras?: LivreurUpdateExtras) =>
              updateLivreurStatus(order.id, status, extras)
            }
          />
        ))}
      </main>
    </div>
  );
}
