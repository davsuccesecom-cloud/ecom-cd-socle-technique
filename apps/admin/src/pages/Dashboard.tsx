import { useMemo, useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  useOrders,
  useTeams,
  useTeamUsers,
  useRegisterPushNotifications,
  useDailyStats,
  sumDailyStats,
  dailyStatDateToMs,
  getDb,
  useWhiteLabel,
  PushToast,
  PushPermissionPrompt,
} from "@ecomcod/shared";
import type { CloseuseStatus, CodCountryInsight, Order } from "@ecomcod/shared";
import {
  Truck,
  Ban,
  Sparkles,
  CalendarClock,
  Receipt,
  Globe,
  Keyboard,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import MobileNav from "../components/MobileNav";
import CreateTeamForm from "../components/CreateTeamForm";
import WariTrackOnboardingWizard from "../components/WariTrackOnboardingWizard";
import MarketSelector from "../components/MarketSelector";
import StatCard from "../components/StatCard";
import StatusDonut from "../components/StatusDonut";
import LivraisonsParLivreur from "../components/LivraisonsParLivreur";
import FluxTempsReel from "../components/FluxTempsReel";
import PerformanceEmployes from "../components/PerformanceEmployes";
import NotificationBell from "../components/NotificationBell";
import ThemeQuickPicker from "../components/ThemeQuickPicker";
import WariTrackLogo from "../components/WariTrackLogo";
import CommandPalette from "../components/CommandPalette";
import TabErrorBoundary from "../components/TabErrorBoundary";
import LiveShopifyAnalytics from "../components/LiveShopifyAnalytics";
import OrderReceipt3DModal from "../components/OrderReceipt3DModal";
import WhatsNewModal from "../components/WhatsNewModal";
import KeyboardShortcutsModal from "../components/KeyboardShortcutsModal";
import SequenceIndicator from "../components/SequenceIndicator";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { useTheme } from "../hooks/useTheme";
import Utilisateurs from "./Utilisateurs";
import Commandes from "./Commandes";
import EquipesSheets from "./EquipesSheets";
import Parametres from "./Parametres";
import Remuneration from "./Remuneration";
import CaisseLivreurs from "./CaisseLivreurs";
import AiAssistant from "./AiAssistant";
import LandingPage from "./LandingPage";
import PeriodSelector, { type Period, periodRangeMs, periodLabel } from "../components/PeriodSelector";

interface DashboardProps {
  workspaceId: string;
  onLogout: () => void;
  userEmail: string | null;
  adminId: string;
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

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: "Poste de Pilotage",
    subtitle: "Cockpit unifié · Suivi en direct des confirmations, livraisons et flux financiers COD",
  },
  ai_assistant: {
    title: "Analyste Direction",
    subtitle: "Diagnostic opérationnel, rentabilité et bilans stratégiques par marché",
  },
  performance: {
    title: "Performance des Opérateurs",
    subtitle: "Taux de closing des closeuses, rapidité d'appel et efficacité des livreurs",
  },
  users: {
    title: "Utilisateurs & Accès",
    subtitle: "Gestion sécurisée des comptes closeuses et livreurs du marché actif",
  },
  orders: {
    title: "Registre des Commandes",
    subtitle: "Dispatch des colis, impression des bons et traçabilité en temps réel",
  },
  teams: {
    title: "Marchés & Google Sheets",
    subtitle: "Configuration des équipes par pays et synchronisation des flux tableurs",
  },
  caisse: {
    title: "Caisse & Versements Livreurs",
    subtitle: "Pointage de caisse journalier · Contrôle du cash terrain et rapprochement des versements",
  },
  remuneration: {
    title: "Rémunération & Commissions",
    subtitle: "Commissions opérateurs calculées sur les livraisons confirmées et soldes nets à régler",
  },
  settings: {
    title: "Paramètres Système",
    subtitle: "Boutiques Shopify, règles métiers, Meta CAPI et intégrations",
  },
};

export default function Dashboard({ workspaceId, onLogout, userEmail, adminId }: DashboardProps) {
  const { permission: pushPermission, requestPushPermission } = useRegisterPushNotifications(
    workspaceId,
    adminId,
    import.meta.env.VITE_FIREBASE_VAPID_KEY
  );
  const whiteLabel = useWhiteLabel(workspaceId, "admin");
  const brandLogoUrl =
    whiteLabel?.customLogoUrl && whiteLabel?.useNativeIcons !== true
      ? whiteLabel.customLogoUrl
      : null;
  const brandTitle = whiteLabel?.brandName;
  const [page, setPage] = useState<string>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { teams, loading: teamsLoading } = useTeams(workspaceId);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>({ type: "preset", value: "jour" });
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { toggleTheme } = useTheme();
  const [codInsights, setCodInsights] = useState<CodCountryInsight[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    const ref = collection(getDb(), "workspaces", workspaceId, "codInsights");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setCodInsights(
          snap.docs.map((d) => {
            const raw = d.data() as Partial<CodCountryInsight>;
            return {
              ...(raw as CodCountryInsight),
              countryCode: raw.countryCode || d.id,
            };
          })
        );
      },
      () => {
        setCodInsights([]);
      }
    );
    return () => unsub();
  }, [workspaceId]);

  const CURRENT_APP_VERSION = "3.2";
  const VERSION_STORAGE_KEY = "waritrack_acknowledged_version";
  const [showWhatsNew, setShowWhatsNew] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VERSION_STORAGE_KEY) !== CURRENT_APP_VERSION;
    } catch {
      return false;
    }
  });

  const handleAcknowledgeWhatsNew = () => {
    setShowWhatsNew(false);
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_APP_VERSION);
    } catch {}
  };

  const { pendingSequence } = useGlobalShortcuts({
    onNavigate: setPage,
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onOpenShortcutsModal: () => setShowShortcutsModal(true),
    onToggleTheme: toggleTheme,
    onAddMarket: () => setShowAddMarket(true),
    isModalOpen: showShortcutsModal || commandPaletteOpen || showAddMarket || !!receiptOrder || showWhatsNew,
    onCloseModals: () => {
      setShowShortcutsModal(false);
      setCommandPaletteOpen(false);
      setShowAddMarket(false);
      setReceiptOrder(null);
      setShowWhatsNew(false);
    },
  });

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
      const isConfirmed =
        order.statutCloseuse === "en_cours" ||
        order.statutCloseuse === "programme" ||
        isDelivered;
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

    const tauxConfirmation = closeuseFinal > 0 ? Math.min(100, Math.round((closeuseConfirmees / closeuseFinal) * 100)) : 0;
    const tauxLivraisonReelle =
      closeuseConfirmees > 0 ? Math.min(100, Math.round((livraisonsReussies / closeuseConfirmees) * 100)) : 0;

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

  const displayTotals = useMemo(() => {
    return {
      ca: Math.max(periodTotals.ca || 0, stats.caOrders || 0),
      livraisons: Math.max(periodTotals.livraisons || 0, stats.livraisonsReussies || 0),
      injoignables: Math.max(periodTotals.injoignables || 0, stats.injoignablesOrders || 0),
      rejetees: Math.max(periodTotals.rejetees || 0, stats.rejeteesOrders || 0),
      commandes: Math.max(periodTotals.commandes || 0, orders.length),
    };
  }, [periodTotals, stats, orders.length]);

  const totalPendingOrders = useMemo(
    () => allOrders.filter((o) => o.statutCloseuse === "nouveau").length,
    [allOrders]
  );

  const loading = teamsLoading || ordersLoading;
  const showPeriodFilter = page === "overview" || page === "remuneration" || page === "caisse";
  const currency = activeTeam?.currency || activeTeam?.metaCapiConfig?.currency || "XOF";
  const headerMeta = PAGE_TITLES[page] ?? PAGE_TITLES.overview;

  return (
    <div className="min-h-screen bg-surface md:flex">
      <Sidebar
        active={page}
        userEmail={userEmail}
        collapsed={sidebarCollapsed}
        onToggleCollapse={setSidebarCollapsed}
        onLogout={onLogout}
        onNavigate={setPage}
        pendingOrdersCount={totalPendingOrders}
        customLogoUrl={brandLogoUrl}
        customBrandName={brandTitle}
      />

      {/* Mobile Top Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-surface-border bg-surface/95 px-4 py-2.5 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <WariTrackLogo
            size="sm"
            variant="full"
            subtitle={activeTeam ? activeTeam.name : "Cockpit"}
            customLogoUrl={brandLogoUrl}
            customBrandName={brandTitle}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeQuickPicker />
          <NotificationBell
            workspaceId={workspaceId}
            onNotificationClick={(notif) => {
              const t = `${notif.title} ${notif.body}`.toLowerCase();
              if (notif.title.startsWith("🤖") || t.includes("rappel ia") || t.includes("vigie ia")) {
                setPage("ai_assistant");
              } else if (t.includes("caisse") || t.includes("versement")) {
                setPage("caisse");
              } else if (t.includes("rémunération") || t.includes("prime") || t.includes("paie")) {
                setPage("remuneration");
              } else if (notif.orderId || t.includes("commande") || t.includes("colis") || t.includes("rappel") || t.includes("doublon") || t.includes("closeuse")) {
                setPage("orders");
              } else if (t.includes("connexion")) {
                setPage("users");
              }
            }}
          />
        </div>
      </div>

      <main className="min-w-0 flex-1 px-4 py-5 pb-24 md:px-6 md:py-4 md:pb-8">
        {pushPermission === "default" && (
          <div className="mb-3">
            <PushPermissionPrompt permission={pushPermission} onRequest={requestPushPermission} />
          </div>
        )}
        {/* Global Top Header Bar : 1 seule ligne compacte sur ordinateur, inchangé sur mobile */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-3 md:flex-nowrap">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-slate-100 md:text-xl">
              {headerMeta.title}
            </h1>
            <p className="mt-0.5 truncate text-xs text-slate-500">{headerMeta.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap">
            {/* Global Search / Command Palette Trigger */}
            <CommandPalette
              orders={allOrders}
              teams={teams}
              activeTeamId={activeTeamId}
              onNavigate={setPage}
              onSelectTeam={setTeamId}
              onInspectOrder={(order) => setReceiptOrder(order)}
              isOpenExternal={commandPaletteOpen}
              onCloseExternal={() => setCommandPaletteOpen(false)}
              onOpenShortcuts={() => setShowShortcutsModal(true)}
            />

            {/* Bouton d'aide Raccourcis Clavier (?) style grand SaaS */}
            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              title="Raccourcis clavier (? ou ⌘/)"
              className="inline-flex min-h-[44px] md:h-9 items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
            >
              <Keyboard className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden xl:inline">Raccourcis</span>
              <kbd className="rounded border border-surface-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                ?
              </kbd>
            </button>

            {teams.length > 0 && page !== "teams" && (
              <MarketSelector
                teams={teams}
                activeTeamId={activeTeamId}
                onSelectTeam={setTeamId}
                onAddMarket={() => setShowAddMarket(true)}
              />
            )}

            {showPeriodFilter && <PeriodSelector period={period} onChange={setPeriod} />}

            {/* Contrôleur de thème & Palette */}
            <div className="hidden md:flex md:items-center">
              <ThemeQuickPicker />
            </div>

            {/* Notification Bell anchored at top-right corner on desktop */}
            <div className="hidden md:flex md:items-center">
              <NotificationBell
                workspaceId={workspaceId}
                onNotificationClick={(notif) => {
                  const t = `${notif.title} ${notif.body}`.toLowerCase();
                  if (notif.title.startsWith("🤖") || t.includes("rappel ia") || t.includes("vigie ia")) {
                    setPage("ai_assistant");
                  } else if (t.includes("caisse") || t.includes("versement")) {
                    setPage("caisse");
                  } else if (t.includes("rémunération") || t.includes("prime") || t.includes("paie")) {
                    setPage("remuneration");
                  } else if (
                    notif.orderId ||
                    t.includes("commande") ||
                    t.includes("colis") ||
                    t.includes("rappel") ||
                    t.includes("doublon") ||
                    t.includes("closeuse")
                  ) {
                    setPage("orders");
                  } else if (t.includes("connexion")) {
                    setPage("users");
                  }
                }}
              />
            </div>
          </div>
        </header>

        {/* WIZARD ONBOARDING OBLIGATOIRE TANT QU'AUCUNE ÉQUIPE N'EST CRÉÉE (PAS DE SKIP VERS UN COCKPIT VIDE) */}
        {teams.length === 0 && !teamsLoading && (
          <WariTrackOnboardingWizard
            workspaceId={workspaceId}
            adminEmail={userEmail}
            onCompleted={(newTeamId) => {
              setTeamId(newTeamId);
            }}
          />
        )}

        {/* CONTENU PRINCIPAL DE L'ONGLET AVEC PROTECTION ANTI-CRASH ISOLÉE */}
        <TabErrorBoundary key={page} tabName={page}>
          {page === "ai_assistant" ? (
            <AiAssistant
              workspaceId={workspaceId}
              team={activeTeam}
              allTeams={teams}
              orders={allOrders}
              closeuses={closeuses}
              livreurs={livreurs}
              codInsights={codInsights}
              onNavigate={setPage}
            />
          ) : page === "performance" ? (
            <PerformanceEmployes team={activeTeam} closeuses={closeuses} livreurs={livreurs} orders={allOrders} />
          ) : page === "users" ? (
            <Utilisateurs workspaceId={workspaceId} team={activeTeam} closeuses={closeuses} livreurs={livreurs} />
          ) : page === "orders" ? (
            <Commandes
              workspaceId={workspaceId}
              team={activeTeam}
              orders={allOrders}
              closeuses={closeuses}
              livreurs={livreurs}
            />
          ) : page === "teams" ? (
            <EquipesSheets workspaceId={workspaceId} teams={teams} />
          ) : page === "caisse" ? (
            <CaisseLivreurs
              workspaceId={workspaceId}
              team={activeTeam}
              livreurs={livreurs}
              orders={orders}
              onNavigateToRemuneration={() => setPage("remuneration")}
            />
          ) : page === "remuneration" ? (
            <Remuneration
              team={activeTeam}
              closeuses={closeuses}
              livreurs={livreurs}
              orders={orders}
              onOpenCaisse={() => setPage("caisse")}
            />
          ) : page === "settings" ? (
            <Parametres workspaceId={workspaceId} team={activeTeam} teams={teams} orders={allOrders} />
          ) : (
            <div className="space-y-4">
              {/* 1. Primary Live Shopify-Style Analytics Deck */}
              <LiveShopifyAnalytics
                dailyStats={dailyStatsInPeriod}
                orders={orders}
                currency={currency}
                periodLabel={periodLabel(period)}
                displayTotals={displayTotals}
                tauxConfirmation={stats.tauxConfirmation}
                tauxLivraisonReelle={stats.tauxLivraisonReelle}
                onNavigateToOrders={() => setPage("orders")}
              />

              {/* 2. Operational Companion Grid (immediately visible alongside the chart) */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 lg:col-span-1">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Statuts des Commandes
                    </h3>
                    <button
                      type="button"
                      onClick={() => setPage("ai_assistant")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/20 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      Analyser
                    </button>
                  </div>
                  <StatusDonut counts={stats.statusCounts} />
                </div>

                <div className="lg:col-span-1">
                  <LivraisonsParLivreur orders={orders} livreurs={livreurs} />
                </div>

                <div className="lg:col-span-1">
                  <FluxTempsReel orders={orders} />
                </div>
              </div>

              {/* 3. Complementary Non-Redundant Indicators (Rejetées, Terrain & Panier Moyen) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
                <StatCard
                  label="Commandes Rejetées"
                  value={String(displayTotals.rejetees)}
                  subtitle="Refus client & annulations"
                  icon={<Ban className="h-4 w-4" />}
                  accent="orange"
                  onClick={() => setPage("orders")}
                />
                <StatCard
                  label="En Cours de Livraison"
                  value={String(stats.statusCounts.en_cours || 0)}
                  subtitle="Colis sortis sur le terrain"
                  icon={<Truck className="h-4 w-4" />}
                  accent="blue"
                  onClick={() => setPage("orders")}
                />
                <StatCard
                  label="Programmées & Relances"
                  value={String(stats.statusCounts.programme || 0)}
                  subtitle="Rendez-vous calés avec créneau"
                  icon={<CalendarClock className="h-4 w-4" />}
                  accent="purple"
                  onClick={() => setPage("orders")}
                />
                <StatCard
                  label="Panier Moyen Encaissé"
                  value={
                    displayTotals.livraisons > 0
                      ? `${Math.round(displayTotals.ca / displayTotals.livraisons).toLocaleString("fr-FR")} ${currency}`
                      : `0 ${currency}`
                  }
                  subtitle="Moyenne nette par colis livré"
                  icon={<Receipt className="h-4 w-4" />}
                  accent="green"
                />
              </div>

              {loading && <p className="text-center text-xs text-slate-500">Mise à jour en direct…</p>}
            </div>
          )}
        </TabErrorBoundary>
      </main>

      <MobileNav
        active={page}
        onNavigate={setPage}
        pendingOrdersCount={totalPendingOrders}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Indicateur visuel flottant du mode séquence (style Linear/Raycast HUD) */}
      <SequenceIndicator pendingSequence={pendingSequence} />

      {/* Modale d'aide complète des raccourcis clavier (?) */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        onNavigate={setPage}
      />

      {receiptOrder && (
        <OrderReceipt3DModal
          order={receiptOrder}
          team={activeTeam}
          closeuses={closeuses}
          livreurs={livreurs}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* Modal Notes de version & Nouveautés v3.2 (popup automatique sur fond flouté) */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={handleAcknowledgeWhatsNew}
      />

      {showAddMarket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
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

      <PushToast
        customLogoUrl={brandLogoUrl}
        fallbackIcon="/icons/waritrack-3d-192.png"
        onOpenOrder={() => setPage("orders")}
      />
    </div>
  );
}
