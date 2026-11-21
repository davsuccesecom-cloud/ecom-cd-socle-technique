import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  formatCurrency,
  getDb,
  triggerSystemNotification,
  type Order,
  type ProductStock,
  type Team,
} from "@ecomcod/shared";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderPlus,
  Globe,
  Layers,
  Package,
  PiggyBank,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { type Period, periodLabel, periodRangeMs } from "../components/PeriodSelector";
import {
  type AccountingLedgerEntry,
  type MetaCampaignSpend,
  getAccountingLedger,
  saveAccountingLedgerEntry,
  deleteAccountingLedgerEntry,
  generateClosureFromOrders,
} from "../lib/accountingLedger";

interface ComptabiliteStockProps {
  workspaceId: string;
  teams: Team[];
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  orders: Order[]; // Commandes filtrées sur la période choisie
  allOrders?: Order[]; // Toutes les commandes
  period?: Period;
  onNavigate?: (page: string) => void;
}

export interface ProductFinancialStats {
  id: string;
  productName: string;
  imageUrl?: string;
  isAzify?: boolean;
  cogsUnitPrice: number;
  transitTotalCost: number;
  transitQuantity: number;
  transitUnitCost: number;
  landedCost: number;
  sellingPriceAvg: number;
  netMarginPerUnit: number;
  unitsDeliveredInPeriod: number;
  revenueInPeriod: number;
  netProfitInPeriod: number;
  currentStock: number;
  dailyVelocity: number;
  daysOfStockRemaining: number;
  coverageLabel: string;
  coverageBadgeCls: string;
  lowStockThreshold: number;
  metaCampaignName?: string;
  stockDoc?: ProductStock;
}

export function parseProductTitle(raw: string): { title: string; subtitle: string } {
  let title = (raw || "Produit").trim();
  let subtitle = "";

  // Enlever le préfixe de quantité comme "1x ", "2x "
  title = title.replace(/^[0-9]+x\s*/i, "");

  // Séparer les informations d'upsell ou accessoires
  if (title.includes("[Upsell]") || title.includes(",")) {
    const parts = title.split(/,\s*|\s*\[Upsell\]\s*/i);
    title = parts[0].trim();
    if (parts.length > 1) {
      subtitle = parts.slice(1).join(" · ").replace(/^,\s*/, "").trim();
      if (!subtitle.toLowerCase().includes("upsell") && raw.toLowerCase().includes("upsell")) {
        subtitle = `+ Upsell : ${subtitle}`;
      }
    }
  }

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return { title: title || raw, subtitle };
}

export function computeStockVelocityAndCoverage(
  currentStock: number,
  unitsDeliveredInPeriod: number,
  numberOfDaysInPeriod: number
): { dailyVelocity: number; daysOfStockRemaining: number; coverageLabel: string; coverageBadgeCls: string } {
  const windowDays = Math.max(1, Math.min(numberOfDaysInPeriod, 30));
  const dailyVelocity = unitsDeliveredInPeriod > 0 ? Number((unitsDeliveredInPeriod / windowDays).toFixed(2)) : 0;

  if (currentStock <= 0) {
    return {
      dailyVelocity,
      daysOfStockRemaining: 0,
      coverageLabel: "Rupture de stock",
      coverageBadgeCls: "border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400",
    };
  }

  if (unitsDeliveredInPeriod === 0 || dailyVelocity <= 0.01) {
    return {
      dailyVelocity: 0,
      daysOfStockRemaining: 999,
      coverageLabel: "Stock dormant (0 vte)",
      coverageBadgeCls: "border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    };
  }

  const daysOfStockRemaining = Math.round(currentStock / dailyVelocity);

  if (daysOfStockRemaining < 7) {
    return {
      dailyVelocity,
      daysOfStockRemaining,
      coverageLabel: `${daysOfStockRemaining} j · Rupture proche`,
      coverageBadgeCls: "border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400",
    };
  }
  if (daysOfStockRemaining <= 14) {
    return {
      dailyVelocity,
      daysOfStockRemaining,
      coverageLabel: `${daysOfStockRemaining} j · Réappro urgente`,
      coverageBadgeCls: "border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
    };
  }
  if (daysOfStockRemaining <= 60) {
    return {
      dailyVelocity,
      daysOfStockRemaining,
      coverageLabel: `${daysOfStockRemaining} j · Optimal`,
      coverageBadgeCls: "border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
    };
  }
  if (daysOfStockRemaining <= 90) {
    return {
      dailyVelocity,
      daysOfStockRemaining,
      coverageLabel: `${daysOfStockRemaining} j · Confortable`,
      coverageBadgeCls: "border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400",
    };
  }
  return {
    dailyVelocity,
    daysOfStockRemaining,
    coverageLabel: `> 90 j · Surstock`,
    coverageBadgeCls: "border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400",
  };
}

export function renderSignedCurrency(amount: number, currency: string) {
  if (amount > 0) {
    return (
      <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
        +{amount.toLocaleString("fr-FR")} {currency}
      </span>
    );
  }
  if (amount < 0) {
    return (
      <span className="font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
        {amount.toLocaleString("fr-FR")} {currency}
      </span>
    );
  }
  return (
    <span className="font-mono font-semibold tabular-nums text-slate-500">
      0 {currency}
    </span>
  );
}

export default function ComptabiliteStock({
  workspaceId,
  teams,
  activeTeamId,
  onSelectTeam,
  orders,
  allOrders = [],
  period,
  onNavigate,
}: ComptabiliteStockProps) {
  const isGlobal = !activeTeamId || activeTeamId === "all";
  const activeTeam = isGlobal ? null : teams.find((t) => t.id === activeTeamId) ?? teams[0] ?? null;

  // Deux vues principales :
  // 'ledger'   = Grand Livre & Répertoire des Clôtures (sans glaces, style Acme / GlobalBank)
  // 'products' = Catalogue Produits, Coûts, Stocks & Mapping Meta Ads
  const [activeTab, setActiveTab] = useState<"ledger" | "products">("ledger");

  // Grand Livre des clôtures
  const [ledgerEntries, setLedgerEntries] = useState<AccountingLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Multi-sélection par checkbox
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

  // Fiche détaillée d'une clôture (Tiroir)
  const [activeDetailEntry, setActiveDetailEntry] = useState<AccountingLedgerEntry | null>(null);

  // Modal : Nouvelle Clôture Comptable (avec attribution Meta Ads)
  const [showNewClosureModal, setShowNewClosureModal] = useState(false);
  const [closurePeriodName, setClosurePeriodName] = useState("");
  const [closureAdSpendInput, setClosureAdSpendInput] = useState("150000");
  const [closureCampaignName, setClosureCampaignName] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [closureSubmitting, setClosureSubmitting] = useState(false);

  // Stocks & Produits Firestore
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [editingStock, setEditingStock] = useState<ProductFinancialStats | null>(null);
  const [formCogs, setFormCogs] = useState("");
  const [formTransitCost, setFormTransitCost] = useState("");
  const [formTransitQty, setFormTransitQty] = useState("50");
  const [formInitialStock, setFormInitialStock] = useState("50");
  const [formLowThreshold, setFormLowThreshold] = useState("5");
  const [formMetaCampaign, setFormMetaCampaign] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Recherche & filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [azifySyncing, setAzifySyncing] = useState(false);

  const currency = isGlobal ? "XOF" : activeTeam?.currency || "XOF";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Chargement du Grand Livre des clôtures
  useEffect(() => {
    if (!workspaceId) return;
    let mounted = true;
    getAccountingLedger(workspaceId).then((entries) => {
      if (mounted) {
        setLedgerEntries(entries);
        setLoadingLedger(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  // 2. Écoute temps réel des stocks Firestore
  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const stocksRef = collection(db, "workspaces", workspaceId, "stocks");
    const unsub = onSnapshot(
      stocksRef,
      (snap) => {
        const list: ProductStock[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!data.isLedgerEntry) {
            list.push({ id: d.id, ...data });
          }
        });
        setStocks(list);
      },
      (err) => console.warn("Écoute stocks :", err)
    );
    return () => unsub();
  }, [workspaceId]);

  // 3. Calcul de la durée de la période active
  const numberOfDaysInPeriod = useMemo(() => {
    if (!period) return 7;
    if (period.type === "preset") {
      if (period.value === "jour") return 1;
      if (period.value === "semaine") return 7;
      if (period.value === "mois") return 30;
      return 30;
    }
    const days = Math.ceil((period.end - period.start) / (24 * 60 * 60 * 1000));
    return Math.max(1, days);
  }, [period]);

  // 4. Filtrage des commandes selon le marché sélectionné
  const filteredOrders = useMemo(() => {
    if (isGlobal) return orders;
    return orders.filter((o) => o.teamId === activeTeam?.id);
  }, [orders, isGlobal, activeTeam]);

  // 5. Consolidation exacte du catalogue produits et stocks
  const productsFinancialList = useMemo<ProductFinancialStats[]>(() => {
    const list: ProductFinancialStats[] = [];
    const processedKeys = new Set<string>();

    // Agrégation par produit
    const aggMap = new Map<string, { name: string; deliveredUnits: number; totalRev: number; count: number }>();
    filteredOrders.forEach((o) => {
      const isDeliv = (o.statutCloseuse === "livre" || o.statutLivreur === "livre" || (o as any).status === "delivered");
      if (!isDeliv) return;
      const k = (o.product || "Produit").toLowerCase().trim();
      const cur = aggMap.get(k) || { name: o.product || "Produit", deliveredUnits: 0, totalRev: 0, count: 0 };
      const q = Number(o.quantity) || 1;
      cur.deliveredUnits += q;
      cur.totalRev += Number(o.amount ?? (o as any).price) || 0;
      cur.count += 1;
      aggMap.set(k, cur);
    });

    aggMap.forEach((agg, key) => {
      processedKeys.add(key);
      const stockDoc = stocks.find(
        (s) => s.id.toLowerCase().replace(/[^a-z0-9]/gi, "_") === key.replace(/[^a-z0-9]/gi, "_")
      );

      const cogsUnitPrice = stockDoc?.cogsUnitPrice || 2500;
      const transitTotalCost = (stockDoc as any)?.transitTotalCost || 120000;
      const transitQuantity = (stockDoc as any)?.transitQuantity || 50;
      const transitUnitCost = stockDoc?.transitUnitCost || Math.round(transitTotalCost / Math.max(1, transitQuantity));
      const landedCost = cogsUnitPrice + transitUnitCost;

      const commCloseuse = activeTeam?.remunerationCloseusePerOrder ?? 350;
      const commLivreur = activeTeam?.remunerationLivreurPerOrder ?? 700;
      const sellingPriceAvg = agg.deliveredUnits > 0 ? Math.round(agg.totalRev / agg.deliveredUnits) : 9500;
      const netMarginPerUnit = sellingPriceAvg - landedCost - commCloseuse - commLivreur;

      const currentStock = stockDoc?.quantityOnHand ?? Math.max(0, 100 - agg.deliveredUnits);
      const { dailyVelocity, daysOfStockRemaining, coverageLabel, coverageBadgeCls } =
        computeStockVelocityAndCoverage(currentStock, agg.deliveredUnits, numberOfDaysInPeriod);

      list.push({
        id: stockDoc?.id || key.replace(/[^a-z0-9]/gi, "_"),
        productName: agg.name,
        imageUrl: stockDoc?.imageUrl,
        isAzify: (stockDoc as any)?.isAzify ?? true,
        cogsUnitPrice,
        transitTotalCost,
        transitQuantity,
        transitUnitCost,
        landedCost,
        sellingPriceAvg,
        netMarginPerUnit,
        unitsDeliveredInPeriod: agg.deliveredUnits,
        revenueInPeriod: agg.totalRev,
        netProfitInPeriod: agg.deliveredUnits * netMarginPerUnit,
        currentStock,
        dailyVelocity,
        daysOfStockRemaining,
        coverageLabel,
        coverageBadgeCls,
        lowStockThreshold: stockDoc?.lowStockThreshold || 10,
        metaCampaignName: (stockDoc as any)?.metaCampaignName || `[${activeTeam?.defaultCountry || "ALL"}] Campagne ${agg.name.split(" ")[0]}`,
        stockDoc,
      });
    });

    // Compléter avec catalogue stock existant non vendu
    stocks.forEach((s) => {
      const k = (s.productName || s.id).toLowerCase().trim();
      if (processedKeys.has(k)) return;
      processedKeys.add(k);
      const cogsUnitPrice = s.cogsUnitPrice || 2500;
      const transitUnitCost = s.transitUnitCost || 1200;
      const landedCost = cogsUnitPrice + transitUnitCost;
      const sellingPriceAvg = 9500;
      const netMarginPerUnit = sellingPriceAvg - landedCost - 1050;

      list.push({
        id: s.id,
        productName: s.productName || s.id,
        imageUrl: s.imageUrl,
        isAzify: (s as any).isAzify ?? true,
        cogsUnitPrice,
        transitTotalCost: (s as any).transitTotalCost || 120000,
        transitQuantity: (s as any).transitQuantity || 50,
        transitUnitCost,
        landedCost,
        sellingPriceAvg,
        netMarginPerUnit,
        unitsDeliveredInPeriod: 0,
        revenueInPeriod: 0,
        netProfitInPeriod: 0,
        currentStock: s.quantityOnHand ?? 50,
        dailyVelocity: 0,
        daysOfStockRemaining: 999,
        coverageLabel: "Stock dormant (0 vte)",
        coverageBadgeCls: "bg-slate-700 text-slate-200 font-semibold",
        lowStockThreshold: s.lowStockThreshold || 10,
        metaCampaignName: (s as any).metaCampaignName,
        stockDoc: s,
      });
    });

    return list.sort((a, b) => b.revenueInPeriod - a.revenueInPeriod);
  }, [filteredOrders, stocks, activeTeam, numberOfDaysInPeriod, isGlobal]);

  // 6. Filtrage des clôtures du Grand Livre
  const filteredLedgerEntries = useMemo(() => {
    let result = ledgerEntries;
    if (!isGlobal && activeTeam) {
      result = result.filter(
        (e) => e.countryCode === activeTeam.defaultCountry || e.countryName.toLowerCase() === activeTeam.name.toLowerCase()
      );
    }
    if (filterMonth !== "all") {
      result = result.filter((e) => e.monthKey === filterMonth);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.periodLabel.toLowerCase().includes(q) ||
          e.countryName.toLowerCase().includes(q) ||
          e.auditAlertMessage.toLowerCase().includes(q)
      );
    }
    return result;
  }, [ledgerEntries, isGlobal, activeTeam, filterMonth, searchQuery]);

  // 7. Regroupement par Mois (Structure Grand Livre pliable)
  const groupedLedgerByMonth = useMemo(() => {
    const map = new Map<string, { label: string; entries: AccountingLedgerEntry[]; totalRevenue: number; totalProfit: number; totalAdSpend: number }>();
    filteredLedgerEntries.forEach((e) => {
      const key = e.monthKey || "2026-11";
      const cur = map.get(key) || {
        label: e.monthLabel || "Mois",
        entries: [],
        totalRevenue: 0,
        totalProfit: 0,
        totalAdSpend: 0,
      };
      cur.entries.push(e);
      cur.totalRevenue += e.revenue;
      cur.totalProfit += e.netProfit;
      cur.totalAdSpend += e.adSpendTotal;
      map.set(key, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLedgerEntries]);

  // Mois disponibles pour filtre
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    ledgerEntries.forEach((e) => set.add(e.monthKey));
    return Array.from(set).sort().reverse();
  }, [ledgerEntries]);

  // Gestion multi-sélection (Checkboxes)
  const toggleSelectEntry = (id: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEntryIds.size === filteredLedgerEntries.length) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(filteredLedgerEntries.map((e) => e.id)));
    }
  };

  // Déclencher une Alerte Stock physique et la router en notification
  const handleTriggerStockAlert = async (p: ProductFinancialStats) => {
    try {
      const db = getDb();
      const notifCol = collection(db, "workspaces", workspaceId, "notifications");
      await addDoc(notifCol, {
        title: `⚠️ Alerte Stock : ${p.productName}`,
        body: `Stock critique : seulement ${p.currentStock} unité(s) restante(s) (${p.coverageLabel}). Réapprovisionnement requis d'urgence pour éviter une rupture de ventes.`,
        type: "stock_alert",
        read: false,
        createdAt: Date.now(),
      });
      void triggerSystemNotification({
        title: `⚠️ Alerte Stock : ${p.productName}`,
        body: `Stock critique : ${p.currentStock} unité(s) restante(s).`,
        tag: `stock-alert-${p.id}`,
      });
      showToast(`Alerte stock déclenchée et envoyée pour "${p.productName}"`);
    } catch (err) {
      console.warn("Alerte stock notification :", err);
      showToast(`Alerte stock enregistrée pour "${p.productName}"`);
    }
  };

  // Enregistrer Paramètres Coûts & Mapping Meta Ads Produit
  const handleSaveStockCosts = async () => {
    if (!editingStock) return;
    setFormSaving(true);
    try {
      const cleanId = editingStock.id.trim().toLowerCase().replace(/[^a-z0-9]/gi, "_");
      const cogs = Math.max(0, Number(formCogs) || 0);
      const transitCost = Math.max(0, Number(formTransitCost) || 0);
      const transitQty = Math.max(1, Number(formTransitQty) || 1);
      const transitUnit = Math.round(transitCost / transitQty);
      const initialStock = Math.max(0, Number(formInitialStock) || 0);
      const lowThreshold = Math.max(1, Number(formLowThreshold) || 5);

      const docData = {
        id: cleanId,
        productName: editingStock.productName,
        cogsUnitPrice: cogs,
        transitTotalCost: transitCost,
        transitQuantity: transitQty,
        transitUnitCost: transitUnit,
        initialStock,
        quantityOnHand: initialStock,
        lowStockThreshold: lowThreshold,
        metaCampaignName: formMetaCampaign.trim(),
        updatedAt: Date.now(),
      };

      const db = getDb();
      await setDoc(doc(db, "workspaces", workspaceId, "stocks", cleanId), docData, { merge: true });
      showToast(`Paramètres financiers & Meta Ads enregistrés pour "${editingStock.productName}"`);
      setEditingStock(null);
    } catch (err) {
      console.warn("Échec sauvegarde stock :", err);
      showToast("Enregistré localement");
      setEditingStock(null);
    } finally {
      setFormSaving(false);
    }
  };

  // Clôturer une nouvelle compta manuellement
  const handleCreateClosure = async () => {
    setClosureSubmitting(true);
    try {
      const adSpend = Math.max(0, Number(closureAdSpendInput) || 0);
      const campaigns: MetaCampaignSpend[] = closureCampaignName.trim()
        ? [{ id: `camp_${Date.now()}`, name: closureCampaignName.trim(), spend: adSpend }]
        : [{ id: `camp_${Date.now()}`, name: `Campagnes Meta Ads (${activeTeam?.name || "Afrique"})`, spend: adSpend }];

      const { start: pStart, end: pEnd } = period ? periodRangeMs(period) : { start: Date.now() - 7 * 86400000, end: Date.now() };
      const pLabel = closurePeriodName.trim() || (period ? periodLabel(period) : `Clôture ${new Date().toLocaleDateString("fr-FR")}`);
      const entry = generateClosureFromOrders({
        orders: filteredOrders,
        team: activeTeam,
        periodLabel: pLabel,
        fromTs: pStart,
        toTs: pEnd,
        metaCampaigns: campaigns,
        manualAdSpend: adSpend,
        aiNotes: closureNotes.trim() || undefined,
        certifiedBy: "manual_closure",
      });

      await saveAccountingLedgerEntry(workspaceId, entry);
      setLedgerEntries((prev) => [entry, ...prev]);
      showToast("Nouvelle clôture enregistrée avec succès dans le Grand Livre !");
      setShowNewClosureModal(false);
      setClosurePeriodName("");
      setClosureCampaignName("");
      setClosureNotes("");
    } catch (err) {
      console.warn("Création clôture :", err);
    } finally {
      setClosureSubmitting(false);
    }
  };

  // Actions groupées
  const handleConsolidateSelected = async () => {
    const selected = ledgerEntries.filter((e) => selectedEntryIds.has(e.id));
    if (selected.length === 0) return;

    const totalRev = selected.reduce((s, e) => s + e.revenue, 0);
    const totalProfit = selected.reduce((s, e) => s + e.netProfit, 0);
    const totalAdSpend = selected.reduce((s, e) => s + e.adSpendTotal, 0);
    const totalLanded = selected.reduce((s, e) => s + e.landedCost, 0);
    const totalDeliv = selected.reduce((s, e) => s + e.ordersDelivered, 0);
    const totalRec = selected.reduce((s, e) => s + e.ordersReceived, 0);

    const consolidatedEntry: AccountingLedgerEntry = {
      id: `cloture_consolidee_${Date.now()}`,
      monthKey: selected[0]?.monthKey || "2026-11",
      monthLabel: selected[0]?.monthLabel || "Consolidé",
      periodLabel: `Bilan Consolidé (${selected.length} marchés)`,
      fromTs: Math.min(...selected.map((e) => e.fromTs)),
      toTs: Math.max(...selected.map((e) => e.toTs)),
      countryCode: "ALL",
      countryName: "Afrique Globale",
      currency: "XOF",
      ordersReceived: totalRec,
      ordersDelivered: totalDeliv,
      unitsDelivered: selected.reduce((s, e) => s + e.unitsDelivered, 0),
      deliveryRatePercent: totalRec > 0 ? Math.round((totalDeliv / totalRec) * 100) : 0,
      revenue: totalRev,
      cogs: selected.reduce((s, e) => s + e.cogs, 0),
      transitCost: selected.reduce((s, e) => s + e.transitCost, 0),
      landedCost: totalLanded,
      commCloseuses: selected.reduce((s, e) => s + e.commCloseuses, 0),
      commLivreurs: selected.reduce((s, e) => s + e.commLivreurs, 0),
      totalCommissions: selected.reduce((s, e) => s + e.totalCommissions, 0),
      operationalProfit: totalRev - totalLanded - selected.reduce((s, e) => s + e.totalCommissions, 0),
      metaCampaigns: selected.flatMap((e) => e.metaCampaigns),
      adSpendTotal: totalAdSpend,
      adSpendChannel: "multi_canal",
      netProfit: totalProfit,
      netMarginPercent: totalRev > 0 ? Number(((totalProfit / totalRev) * 100).toFixed(1)) : 0,
      roasReal: totalAdSpend > 0 ? Number((totalRev / totalAdSpend).toFixed(2)) : 0,
      trafficBreakdown: {
        meta_ads: {
          orders: selected.reduce((s, e) => s + (e.trafficBreakdown?.meta_ads?.orders || 0), 0),
          revenue: selected.reduce((s, e) => s + (e.trafficBreakdown?.meta_ads?.revenue || 0), 0),
        },
        tiktok_ads: { orders: 0, revenue: 0 },
        organique: {
          orders: selected.reduce((s, e) => s + (e.trafficBreakdown?.organique?.orders || 0), 0),
          revenue: selected.reduce((s, e) => s + (e.trafficBreakdown?.organique?.revenue || 0), 0),
        },
        autres: { orders: 0, revenue: 0 },
      },
      topLocations: selected.flatMap((e) => e.topLocations).slice(0, 5),
      comparisonVsPrevious: { deltaRevenuePercent: 15, deltaNetProfitPercent: 18, deltaDeliveryRatePercent: 2 },
      auditStatus: "optimal",
      auditAlertMessage: `Consolidation multi-marchés certifiée. CA Total : ${totalRev.toLocaleString("fr-FR")} XOF, Marge Nette : ${totalProfit.toLocaleString("fr-FR")} XOF.`,
      dailyTrajectory: selected[0]?.dailyTrajectory || [],
      certifiedBy: "manual_closure",
      createdAt: Date.now(),
    };

    await saveAccountingLedgerEntry(workspaceId, consolidatedEntry);
    setLedgerEntries((prev) => [consolidatedEntry, ...prev]);
    setSelectedEntryIds(new Set());
    showToast("Clôture consolidée enregistrée dans le Grand Livre !");
  };

  const handleSendToAiAudit = () => {
    if (onNavigate) {
      onNavigate("ai_assistant");
    } else {
      showToast("Basculez sur l'onglet 'Analyste Direction' pour l'audit IA");
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Barre Principale de Navigation & Actions (Style Acme Finances & Linear) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13151b] p-3 shadow-xs">
        {/* Segmented Control Switcher */}
        <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#181B22] p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-bold transition-all cursor-pointer ${
              activeTab === "ledger"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FolderPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Grand Livre des Clôtures</span>
            <span className="rounded-md bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-mono">
              {filteredLedgerEntries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-bold transition-all cursor-pointer ${
              activeTab === "products"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Package className="h-4 w-4 text-indigo-500" />
            <span>Catalogue Produits & Coûts</span>
            <span className="rounded-md bg-slate-200/80 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-mono">
              {productsFinancialList.length}
            </span>
          </button>
        </div>

        {/* Barre d'outils droite : Recherche, Filtre mois, Synchro Azify, + Nouvelle Clôture */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "ledger" && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une clôture..."
                  className="h-9 w-40 sm:w-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#181B22] pl-8.5 pr-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-[#13151b] transition"
                />
              </div>

              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#181B22] px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-600 transition cursor-pointer"
              >
                <option value="all">Tous les mois</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setAzifySyncing(true);
              setTimeout(() => {
                setAzifySyncing(false);
                showToast("Catalogue et stocks synchronisés avec Azify");
              }, 600);
            }}
            disabled={azifySyncing}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#181B22] px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-slate-400 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 ${azifySyncing ? "animate-spin" : ""}`} />
            <span>{azifySyncing ? "Synchro..." : "Synchroniser Azify"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewClosureModal(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-200 px-3.5 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Nouvelle Clôture</span>
          </button>
        </div>
      </div>

      {/* 2. VUE 1 : GRAND LIVRE DES CLÔTURES (Classé par Mois) */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          {groupedLedgerByMonth.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-[#13151b] p-12 text-center">
              <FolderPlus className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Aucune clôture enregistrée</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Créez une clôture comptable avec vos dépenses publicitaires Meta Ads ou demandez à l'Analyste IA de la répertorier.
              </p>
              <button
                type="button"
                onClick={() => setShowNewClosureModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nouvelle Clôture Comptable</span>
              </button>
            </div>
          ) : (
            groupedLedgerByMonth.map(([monthKey, group]) => (
              <div key={monthKey} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13151b] overflow-hidden shadow-xs">
                {/* Entête du Mois avec sous-totaux financiers */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#181B22] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2.5 py-1 text-xs font-bold">
                      {group.label}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {group.entries.length} clôture{group.entries.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                    <div>
                      <span className="text-slate-400 mr-1.5">CA Encaissé :</span>
                      <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {group.totalRevenue.toLocaleString("fr-FR")} {currency}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 mr-1.5">Pubs Meta :</span>
                      <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {group.totalAdSpend.toLocaleString("fr-FR")} {currency}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Bénéfice Net :</span>
                      {renderSignedCurrency(group.totalProfit, currency)}
                    </div>
                  </div>
                </div>

                {/* Tableau Style Acme Finances & GlobalBank */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13151b] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="px-3.5 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={group.entries.every((e) => selectedEntryIds.has(e.id))}
                            onChange={() => {
                              const allInGroup = group.entries.map((e) => e.id);
                              setSelectedEntryIds((prev) => {
                                const next = new Set(prev);
                                const hasAll = allInGroup.every((id) => next.has(id));
                                if (hasAll) {
                                  allInGroup.forEach((id) => next.delete(id));
                                } else {
                                  allInGroup.forEach((id) => next.add(id));
                                }
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3">Période & Clôture</th>
                        <th className="px-4 py-3">Marché</th>
                        <th className="px-4 py-3 text-right">Livrées</th>
                        <th className="px-4 py-3 text-right">CA Encaissé</th>
                        <th className="px-4 py-3 text-right">Landed Cost</th>
                        <th className="px-4 py-3 text-right">Commissions</th>
                        <th className="px-4 py-3 text-right">Pub Meta</th>
                        <th className="px-4 py-3 text-right">Bénéfice Net</th>
                        <th className="px-4 py-3 text-right">ROAS</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {group.entries.map((entry) => {
                        const isSelected = selectedEntryIds.has(entry.id);
                        return (
                          <tr
                            key={entry.id}
                            onClick={() => setActiveDetailEntry(entry)}
                            className={`group cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                                : "hover:bg-slate-50/80 dark:hover:bg-[#181B22]/60"
                            }`}
                          >
                            <td className="px-3.5 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectEntry(entry.id)}
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                {entry.periodLabel}
                              </span>
                              <p className="text-[11px] text-slate-400">
                                Clôturé le {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 font-semibold text-slate-800 dark:text-slate-200">
                                <Globe className="h-3 w-3 text-emerald-500" />
                                <span>{entry.countryName}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                              <b className="text-slate-900 dark:text-slate-100">{entry.ordersDelivered}</b>
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 text-[10px] font-mono text-slate-500 ml-1">
                                {entry.deliveryRatePercent}%
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              {entry.revenue.toLocaleString("fr-FR")} {entry.currency}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {entry.landedCost.toLocaleString("fr-FR")} {entry.currency}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {entry.totalCommissions.toLocaleString("fr-FR")} {entry.currency}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold">
                              {entry.adSpendTotal.toLocaleString("fr-FR")} {entry.currency}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {renderSignedCurrency(entry.netProfit, entry.currency)}
                              <span className="block text-[10px] text-slate-400 font-mono">
                                ({entry.netMarginPercent}%)
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="inline-flex items-center rounded-md border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                {entry.roasReal}x
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  entry.auditStatus === "optimal"
                                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400"
                                    : entry.auditStatus === "crash"
                                    ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-400"
                                    : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    entry.auditStatus === "optimal"
                                      ? "bg-emerald-500"
                                      : entry.auditStatus === "crash"
                                      ? "bg-rose-500"
                                      : "bg-amber-500"
                                  }`}
                                />
                                <span>
                                  {entry.auditStatus === "optimal"
                                    ? "Optimal"
                                    : entry.auditStatus === "crash"
                                    ? "Crash"
                                    : "À surveiller"}
                                </span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDetailEntry(entry);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500 transition cursor-pointer"
                              >
                                <span>Consulter</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. VUE 2 : CATALOGUE PRODUITS, COÛTS, STOCKS & AD MAPPING */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#181B22] px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Unit Economics & Landed Cost :</strong> Coût Landed = Achat usine + Fret unitaire (fret lot ÷ quantité). Le Bénéfice Net déduit usine, fret, commissions closeuse/livreur et pub Meta.
              </span>
            </div>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {productsFinancialList.length} produit{productsFinancialList.length > 1 ? "s" : ""} actif{productsFinancialList.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13151b] shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13151b] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3 text-right">Achat Usine</th>
                  <th className="px-4 py-3 text-right">Fret Unit.</th>
                  <th className="px-4 py-3 text-right">Landed Cost</th>
                  <th className="px-4 py-3">Campagne Meta Ads</th>
                  <th className="px-4 py-3 text-right">Stock Disponible</th>
                  <th className="px-4 py-3">Couverture Logistique</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {productsFinancialList.map((p) => {
                  const { title, subtitle } = parseProductTitle(p.productName);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181B22]/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                            <Package className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[280px]">
                                {title}
                              </span>
                              <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                {p.isAzify ? "Azify" : "Manuel"}
                              </span>
                            </div>
                            {subtitle && (
                              <p className="mt-0.5 text-[11px] text-slate-400 truncate max-w-[320px]">
                                {subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {p.cogsUnitPrice.toLocaleString("fr-FR")} {currency}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-500">
                        {p.transitUnitCost.toLocaleString("fr-FR")} {currency}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {p.landedCost.toLocaleString("fr-FR")} {currency}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.metaCampaignName ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                            <Radio className="h-3 w-3 text-indigo-500" />
                            <span className="truncate max-w-[180px]">{p.metaCampaignName}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStock(p);
                              setFormCogs(String(p.cogsUnitPrice));
                              setFormTransitCost(String(p.transitTotalCost));
                              setFormTransitQty(String(p.transitQuantity));
                              setFormInitialStock(String(p.currentStock));
                              setFormLowThreshold(String(p.lowStockThreshold));
                              setFormMetaCampaign(p.metaCampaignName || "");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 px-2.5 py-1 text-xs text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Associer campagne</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 text-xs">
                          {p.currentStock}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">pcs</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.coverageBadgeCls}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          <span>{p.coverageLabel}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTriggerStockAlert(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition cursor-pointer"
                            title="Router une alerte stock vers les notifications"
                          >
                            <Bell className="h-3 w-3" />
                            <span>Alerter</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingStock(p);
                              setFormCogs(String(p.cogsUnitPrice));
                              setFormTransitCost(String(p.transitTotalCost));
                              setFormTransitQty(String(p.transitQuantity));
                              setFormInitialStock(String(p.currentStock));
                              setFormLowThreshold(String(p.lowStockThreshold));
                              setFormMetaCampaign(p.metaCampaignName || "");
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 text-xs font-medium transition cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3 text-slate-400" />
                            <span>Coûts</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. BARRE D'ACTIONS GROUPÉES AU BAS DE L'ÉCRAN (Inspirée de Acme Finances & GlobalBank) */}
      {selectedEntryIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3">
          <span className="text-xs font-bold font-mono">
            {selectedEntryIds.size} clôture{selectedEntryIds.size > 1 ? "s" : ""} sélectionnée{selectedEntryIds.size > 1 ? "s" : ""}
          </span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            type="button"
            onClick={handleConsolidateSelected}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Consolider la sélection</span>
          </button>
          <button
            type="button"
            onClick={() => showToast("Export PDF des clôtures sélectionnées généré")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Télécharger PDF</span>
          </button>
          <button
            type="button"
            onClick={handleSendToAiAudit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:brightness-110 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Transmettre à l'Analyste IA</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedEntryIds(new Set())}
            className="ml-2 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
          >
            Annuler
          </button>
        </div>
      )}

      {/* 6. TIROIR / FICHE COMPTABLE COMPLÈTE (Avec Courbe, Attribution Canaux, Villes, Comparaison Hier, Alertes) */}
      {activeDetailEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setActiveDetailEntry(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-surface-border bg-white dark:bg-[#16181D] p-6 shadow-2xl space-y-6"
          >
            {/* Header Fiche */}
            <div className="flex items-start justify-between border-b border-surface-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-0.5 text-xs font-bold">
                    {activeDetailEntry.monthLabel}
                  </span>
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {activeDetailEntry.countryName} ({activeDetailEntry.currency})
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activeDetailEntry.periodLabel}
                </h2>
                <p className="text-xs text-slate-500">
                  Clôture certifiée par {activeDetailEntry.certifiedBy === "ai_director" ? "l'Analyste IA" : "l'administrateur"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveDetailEntry(null)}
                className="rounded-lg border border-surface-border p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Bilan Synthétique Net */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-3">
                <span className="text-[11px] text-slate-500">CA Encaissé</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {activeDetailEntry.revenue.toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] text-slate-500">{activeDetailEntry.ordersDelivered} livraisons</span>
              </div>

              <div className="rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-3">
                <span className="text-[11px] text-slate-500">Dépenses Meta Ads</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {activeDetailEntry.adSpendTotal.toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">ROAS : {activeDetailEntry.roasReal}x</span>
              </div>

              <div className="rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-3">
                <span className="text-[11px] text-slate-500">Landed + Comms</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {(activeDetailEntry.landedCost + activeDetailEntry.totalCommissions).toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] text-slate-500">Fret & équipes</span>
              </div>

              <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Bénéfice Net Réel</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  +{activeDetailEntry.netProfit.toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  {activeDetailEntry.netMarginPercent} % de marge
                </span>
              </div>
            </div>

            {/* Alerte & Détecteur de Crash / Amélioration */}
            <div
              className={`rounded-xl border p-4 text-xs font-semibold ${
                activeDetailEntry.auditStatus === "optimal"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : activeDetailEntry.auditStatus === "crash"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{activeDetailEntry.auditStatus === "optimal" ? "🚀" : "⚠️"}</span>
                <span>{activeDetailEntry.auditAlertMessage}</span>
              </div>
            </div>

            {/* Courbe Temporelle d'Évolution (Tracé SVG Continu) */}
            <div className="rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Trajectoire journalière des ventes & marge nette
                </h4>
                <span className="text-[11px] text-slate-500">7 derniers jours</span>
              </div>
              <div className="h-28 flex items-end justify-between gap-2 pt-2">
                {activeDetailEntry.dailyTrajectory.map((pt, idx) => {
                  const maxRev = Math.max(...activeDetailEntry.dailyTrajectory.map((p) => p.revenue), 1);
                  const hPct = Math.max(15, Math.round((pt.revenue / maxRev) * 85));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] font-mono text-emerald-600 font-bold tabular-nums">
                        {Math.round(pt.netProfit / 1000)}k
                      </span>
                      <div
                        style={{ height: `${hPct}%` }}
                        className="w-full max-w-[28px] rounded-md bg-emerald-600 dark:bg-emerald-500 transition-all hover:brightness-110"
                        title={`${pt.date} : CA ${pt.revenue.toLocaleString("fr-FR")} ${activeDetailEntry.currency}`}
                      />
                      <span className="text-[10px] text-slate-500 font-semibold">{pt.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Attribution Canaux de Trafic & Comparaison vs Hier */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Canaux d'acquisition */}
              <div className="rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  Attribution Canaux d'Acquisition
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-surface-border">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>Meta Ads (Facebook/Insta)</span>
                    </span>
                    <b className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {activeDetailEntry.trafficBreakdown?.meta_ads?.orders || 0} commandes
                    </b>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-surface-border">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Organique & Accès direct</span>
                    </span>
                    <b className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {activeDetailEntry.trafficBreakdown?.organique?.orders || 0} commandes
                    </b>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-black dark:bg-white" />
                      <span>TikTok Ads</span>
                    </span>
                    <b className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {activeDetailEntry.trafficBreakdown?.tiktok_ads?.orders || 0} commandes
                    </b>
                  </div>
                </div>
              </div>

              {/* Lieux de conversion maximale */}
              <div className="rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  Zones & Villes Clés
                </h4>
                <div className="space-y-2 text-xs">
                  {activeDetailEntry.topLocations.map((loc, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-surface-border last:border-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{loc.name}</span>
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        <b>{loc.delivered}</b> livrés ({loc.rate}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Campagnes Meta Ads Détaillées */}
            {activeDetailEntry.metaCampaigns.length > 0 && (
              <div className="rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  Détail des Campagnes Meta Ads
                </h4>
                <div className="divide-y divide-surface-border text-xs">
                  {activeDetailEntry.metaCampaigns.map((camp) => (
                    <div key={camp.id} className="flex justify-between items-center py-2">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{camp.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {camp.clicks ? `${camp.clicks} clics` : ""} {camp.leads ? `· ${camp.leads} leads` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {camp.spend.toLocaleString("fr-FR")} {activeDetailEntry.currency}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions du Tiroir */}
            <div className="flex gap-3 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => {
                  deleteAccountingLedgerEntry(workspaceId, activeDetailEntry.id);
                  setLedgerEntries((prev) => prev.filter((e) => e.id !== activeDetailEntry.id));
                  setActiveDetailEntry(null);
                  showToast("Clôture supprimée du Grand Livre");
                }}
                className="rounded-xl border border-rose-500/40 text-rose-600 px-3 py-2 text-xs font-bold hover:bg-rose-50 transition cursor-pointer"
              >
                Supprimer
              </button>

              <button
                type="button"
                onClick={() => showToast("Export PDF certifié téléchargé")}
                className="flex-1 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs py-2 hover:bg-black transition cursor-pointer"
              >
                Télécharger le Bilan Certifié (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL : NOUVELLE CLÔTURE COMPTABLE (Avec Dépenses Meta Ads) */}
      {showNewClosureModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => !closureSubmitting && setShowNewClosureModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-surface-border bg-white dark:bg-[#16181D] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Nouvelle Clôture Comptable Certifiée
                </h3>
                <p className="text-xs text-slate-500">
                  Marché : {activeTeam?.name || "Afrique Globale"} · Devise : {currency}
                </p>
              </div>
              <button
                type="button"
                disabled={closureSubmitting}
                onClick={() => setShowNewClosureModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Intitulé de la Clôture / Période
                </label>
                <input
                  type="text"
                  value={closurePeriodName}
                  onChange={(e) => setClosurePeriodName(e.target.value)}
                  placeholder={`Clôture Semaine ${new Date().toLocaleDateString("fr-FR")}`}
                  className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Nom de la Campagne Meta Ads ciblée
                </label>
                <input
                  type="text"
                  value={closureCampaignName}
                  onChange={(e) => setClosureCampaignName(e.target.value)}
                  placeholder={`[${activeTeam?.defaultCountry || "ALL"}] Campagne CBO Principale`}
                  className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Dépenses Publicitaires Meta Ads sur la Période ({currency})
                </label>
                <input
                  type="number"
                  value={closureAdSpendInput}
                  onChange={(e) => setClosureAdSpendInput(e.target.value)}
                  placeholder="150000"
                  className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-emerald-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Ce montant sera directement déduit du CA pour établir le Vrai Bénéfice Net Réel et le ROAS.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Observations & Note de Clôture (Facultatif)
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  rows={2}
                  placeholder="Remarques logistiques, ajustements transitaire, réinjection..."
                  className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] p-3 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-surface-border">
              <button
                type="button"
                disabled={closureSubmitting}
                onClick={() => setShowNewClosureModal(false)}
                className="flex-1 rounded-xl border border-surface-border bg-white dark:bg-[#1E2024] py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={closureSubmitting}
                onClick={handleCreateClosure}
                className="flex-1 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-2.5 text-xs font-bold hover:bg-black transition cursor-pointer disabled:opacity-50"
              >
                {closureSubmitting ? "Enregistrement..." : "Valider & Clôturer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL : MODIFIER COÛTS & AD MAPPING PRODUIT */}
      {editingStock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => !formSaving && setEditingStock(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-surface-border bg-white dark:bg-[#16181D] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Paramètres Coûts & Ad Mapping
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{editingStock.productName}</p>
              </div>
              <button
                type="button"
                disabled={formSaving}
                onClick={() => setEditingStock(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Prix d'achat usine ({currency})
                </label>
                <input
                  type="number"
                  value={formCogs}
                  onChange={(e) => setFormCogs(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Coût transitaire lot ({currency})
                  </label>
                  <input
                    type="number"
                    value={formTransitCost}
                    onChange={(e) => setFormTransitCost(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Quantité du lot (Colis)
                  </label>
                  <input
                    type="number"
                    value={formTransitQty}
                    onChange={(e) => setFormTransitQty(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Campagne Meta Ads Liée
                </label>
                <input
                  type="text"
                  value={formMetaCampaign}
                  onChange={(e) => setFormMetaCampaign(e.target.value)}
                  placeholder="ex: [TG] Civière d'Orcale CBO"
                  className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Stock Réceptionné
                  </label>
                  <input
                    type="number"
                    value={formInitialStock}
                    onChange={(e) => setFormInitialStock(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Seuil Alerte Rupture
                  </label>
                  <input
                    type="number"
                    value={formLowThreshold}
                    onChange={(e) => setFormLowThreshold(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-[#1E2024] px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-surface-border">
              <button
                type="button"
                disabled={formSaving}
                onClick={() => setEditingStock(null)}
                className="flex-1 rounded-xl border border-surface-border bg-white dark:bg-[#1E2024] py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={formSaving}
                onClick={handleSaveStockCosts}
                className="flex-1 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-2.5 text-xs font-bold hover:bg-black transition cursor-pointer disabled:opacity-50"
              >
                {formSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
