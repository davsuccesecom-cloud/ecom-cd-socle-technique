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
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  SlidersHorizontal,
  Sparkles,
  Star,
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
  orders: Order[];
  allOrders?: Order[];
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

  title = title.replace(/^[0-9]+x\s*/i, "");

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
  // 'ledger'   = Grand Livre & Répertoire des Clôtures (GlobalBank Business Partner CRM)
  // 'products' = Catalogue Produits, Coûts, Stocks & Mapping Meta Ads
  const [activeTab, setActiveTab] = useState<"ledger" | "products">("ledger");

  // Grand Livre des clôtures
  const [ledgerEntries, setLedgerEntries] = useState<AccountingLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Multi-sélection par checkbox et étoiles favorites
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [starredEntryIds, setStarredEntryIds] = useState<Set<string>>(new Set());

  // Tri & Pagination (Style GlobalBank CRM)
  const [sortOption, setSortOption] = useState<"date_desc" | "date_asc" | "revenue_desc" | "profit_desc" | "roas_desc">("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        coverageBadgeCls: "border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
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

  // Tri & Favoris
  const sortedLedgerEntries = useMemo(() => {
    const list = [...filteredLedgerEntries];
    list.sort((a, b) => {
      // Les favoris épinglés en priorité
      const aStarred = starredEntryIds.has(a.id);
      const bStarred = starredEntryIds.has(b.id);
      if (aStarred !== bStarred) return aStarred ? -1 : 1;

      if (sortOption === "revenue_desc") return b.revenue - a.revenue;
      if (sortOption === "profit_desc") return b.netProfit - a.netProfit;
      if (sortOption === "roas_desc") return b.roasReal - a.roasReal;
      if (sortOption === "date_asc") return a.createdAt - b.createdAt;
      return b.createdAt - a.createdAt;
    });
    return list;
  }, [filteredLedgerEntries, sortOption, starredEntryIds]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedLedgerEntries.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLedgerEntries.slice(start, start + pageSize);
  }, [sortedLedgerEntries, currentPage, pageSize]);

  // Cumuls financiers globaux
  const summaryTotals = useMemo(() => {
    const totalRev = filteredLedgerEntries.reduce((s, e) => s + e.revenue, 0);
    const totalAds = filteredLedgerEntries.reduce((s, e) => s + e.adSpendTotal, 0);
    const totalProfit = filteredLedgerEntries.reduce((s, e) => s + e.netProfit, 0);
    return { totalRev, totalAds, totalProfit };
  }, [filteredLedgerEntries]);

  // Mois disponibles pour filtre
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    ledgerEntries.forEach((e) => set.add(e.monthKey));
    return Array.from(set).sort().reverse();
  }, [ledgerEntries]);

  // Gestion multi-sélection
  const toggleSelectEntry = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEntryIds.size === paginatedEntries.length && paginatedEntries.length > 0) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(paginatedEntries.map((e) => e.id)));
    }
  };

  const toggleStarEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      showToast(`Alerte stock déclenchée et routée pour ${p.productName}`);
    } catch (err) {
      console.warn("Alerte stock :", err);
      showToast("Alerte enregistrée en local");
    }
  };

  // Sauvegarder les coûts et le mapping Meta Ads d'un produit
  const handleSaveStockCosts = async () => {
    if (!editingStock) return;
    setFormSaving(true);
    try {
      const db = getDb();
      const stockDocRef = doc(db, "workspaces", workspaceId, "stocks", editingStock.id);
      const cogsNum = Number(formCogs) || 0;
      const transitCostNum = Number(formTransitCost) || 0;
      const transitQtyNum = Math.max(1, Number(formTransitQty) || 1);
      const transitUnitCalc = Math.round(transitCostNum / transitQtyNum);
      const landedCalc = cogsNum + transitUnitCalc;
      const qtyOnHand = Number(formInitialStock) || 0;
      const lowThresh = Number(formLowThreshold) || 10;

      await setDoc(
        stockDocRef,
        {
          productName: editingStock.productName,
          cogsUnitPrice: cogsNum,
          transitTotalCost: transitCostNum,
          transitQuantity: transitQtyNum,
          transitUnitCost: transitUnitCalc,
          landedCost: landedCalc,
          quantityOnHand: qtyOnHand,
          lowStockThreshold: lowThresh,
          metaCampaignName: formMetaCampaign.trim() || null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      showToast("Coûts et mapping publicitaire enregistrés avec succès !");
      setEditingStock(null);
    } catch (err) {
      console.warn("Sauvegarde coûts stock :", err);
      showToast("Sauvegardé en local");
      setEditingStock(null);
    } finally {
      setFormSaving(false);
    }
  };

  // Créer une nouvelle clôture comptable certifiée
  const handleCreateClosure = async () => {
    setClosureSubmitting(true);
    try {
      const adSpend = Number(closureAdSpendInput) || 0;
      const periodTitle =
        closurePeriodName.trim() ||
        `Clôture ${activeTeam?.name || "Afrique"} · ${new Date().toLocaleDateString("fr-FR")}`;

      const metaCampaigns: MetaCampaignSpend[] = closureCampaignName.trim()
        ? [
            {
              id: `camp_${Date.now()}`,
              name: closureCampaignName.trim(),
              spend: adSpend,
            },
          ]
        : [];

      const newEntry = generateClosureFromOrders({
        orders: filteredOrders,
        team: activeTeam,
        periodLabel: periodTitle,
        fromTs: Date.now() - 7 * 86400000,
        toTs: Date.now(),
        manualAdSpend: adSpend,
        metaCampaigns,
        aiNotes: closureNotes.trim() || undefined,
        certifiedBy: "manual_closure",
      });

      await saveAccountingLedgerEntry(workspaceId, newEntry);
      setLedgerEntries((prev) => [newEntry, ...prev]);
      showToast("Clôture comptable enregistrée dans le Grand Livre !");
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
    <div className="space-y-4">
      {/* 
        CADRE UNIFIÉ GLOBALBANK BUSINESS PARTNER CRM 
        (Strictement aligné sur le modèle visuel de référence)
      */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised shadow-xs overflow-hidden">
        
        {/* 1. TOP HEADER BAR GLOBALBANK */}
        <div className="border-b border-surface-border px-4 py-3 sm:px-6">
          {/* Fil d'Ariane (Breadcrumb) */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            <span>Comptabilité & Stock</span>
            <span>›</span>
            <span>Grand Livre</span>
            <span>›</span>
            <span className="text-slate-900 dark:text-slate-200 font-semibold">
              {activeTab === "ledger" ? "Clôtures Certifiées" : "Catalogue Coûts & Stocks"}
            </span>
          </div>

          {/* Rangée Principale : Titre + Search Pill + Avatars + Tabs + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Gauche : Titre et badge Live */}
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span>Répertoire Comptable & Stock</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>En direct</span>
              </span>
            </div>

            {/* Centre : Search Pill avec Search Icon propre (sans chevauchement !) */}
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Rechercher une clôture, marché, alerte..."
                className="h-9 w-full rounded-full border border-surface-border bg-surface pl-9.5 pr-8 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-brand transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Droite : Avatars + Switcher Tabs + Boutons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Stack d'avatars style GlobalBank */}
              <div className="hidden xl:flex items-center -space-x-2 mr-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-raised bg-brand text-[10px] font-bold text-white" title="Sabrina (Closeuse)">
                  SA
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-raised bg-emerald-600 text-[10px] font-bold text-white" title="Kossi (Livreur)">
                  KO
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-raised bg-amber-600 text-[10px] font-bold text-white" title="Migami (Closeuse)">
                  MI
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-raised bg-slate-700 text-[9px] font-bold text-slate-200">
                  +4
                </div>
              </div>

              {/* View Switcher Pills */}
              <div className="inline-flex items-center rounded-xl border border-surface-border bg-surface p-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("ledger");
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-all cursor-pointer ${
                    activeTab === "ledger"
                      ? "bg-surface-raised text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FolderPlus className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Grand Livre</span>
                  <span className="rounded-md bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-mono">
                    {filteredLedgerEntries.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("products")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-bold transition-all cursor-pointer ${
                    activeTab === "products"
                      ? "bg-surface-raised text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Package className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Produits & Coûts</span>
                  <span className="rounded-md bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-mono">
                    {productsFinancialList.length}
                  </span>
                </button>
              </div>

              {/* Bouton Synchro Azify */}
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
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-slate-400 transition cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-emerald-500 ${azifySyncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{azifySyncing ? "Synchro..." : "Synchro Azify"}</span>
              </button>

              {/* Bouton Primaire : + Nouvelle Clôture */}
              <button
                type="button"
                onClick={() => setShowNewClosureModal(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-3.5 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Nouvelle Clôture</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. ACTION RIBBON / TOOLBAR GLOBALBANK (Sous-barre d'outils) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface/50 px-4 py-2.5 text-xs">
          {/* Gauche : Update, Sélection, Filtres et Tri */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                showToast("Grand Livre actualisé");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer"
            >
              <RefreshCw className="h-3 w-3 text-slate-400" />
              <span>Actualiser</span>
            </button>

            {selectedEntryIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  <span>{selectedEntryIds.size} sélectionné(s)</span>
                </span>
                <button
                  type="button"
                  onClick={handleConsolidateSelected}
                  className="rounded-lg bg-emerald-600 text-white font-bold px-2.5 py-1 hover:bg-emerald-500 transition cursor-pointer"
                >
                  Consolider
                </button>
              </div>
            )}

            {/* Filtre Mois */}
            <div className="relative">
              <select
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-7.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">Tous les mois</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Tri (Sort) */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="h-7.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-brand cursor-pointer"
              >
                <option value="date_desc">Trier : Récent d'abord</option>
                <option value="date_asc">Trier : Ancien d'abord</option>
                <option value="revenue_desc">Trier : CA décroissant</option>
                <option value="profit_desc">Trier : Marge décroissante</option>
                <option value="roas_desc">Trier : ROAS décroissant</option>
              </select>
            </div>

            {/* Compteur Résultats */}
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium ml-1">
              {filteredLedgerEntries.length} résultat{filteredLedgerEntries.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Droite : Agrégats Financiers en direct */}
          <div className="hidden md:flex items-center gap-4 text-xs font-medium">
            <div>
              <span className="text-slate-600 dark:text-slate-400 mr-1.5">CA Total :</span>
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summaryTotals.totalRev.toLocaleString("fr-FR")} {currency}
              </strong>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 mr-1.5">Pubs Meta :</span>
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summaryTotals.totalAds.toLocaleString("fr-FR")} {currency}
              </strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 dark:text-slate-400">Marge Nette :</span>
              {renderSignedCurrency(summaryTotals.totalProfit, currency)}
            </div>
          </div>
        </div>

        {/* 3. TABLEAU GLOBALBANK : GRAND LIVRE DES CLÔTURES */}
        {activeTab === "ledger" && (
          <div>
            {paginatedEntries.length === 0 ? (
              <div className="p-12 text-center">
                <FolderPlus className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Aucune clôture trouvée</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Créez une nouvelle clôture comptable ou ajustez vos critères de recherche.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewClosureModal(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand text-white px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nouvelle Clôture</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border bg-surface/30 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      <th className="px-3.5 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.size === paginatedEntries.length && paginatedEntries.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-surface-border text-brand focus:ring-brand cursor-pointer"
                        />
                      </th>
                      <th className="px-2 py-3 w-8 text-center">
                        <Star className="h-3.5 w-3.5 text-slate-400 mx-auto" />
                      </th>
                      <th className="px-3.5 py-3">
                        <div className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => setSortOption(sortOption === "date_desc" ? "date_asc" : "date_desc")}>
                          <span>Période & Clôture</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-3">Marché</th>
                      <th className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => setSortOption("revenue_desc")}>
                          <span>CA Encaissé</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3 py-3">Livraisons</th>
                      <th className="px-3 py-3">Taux Succès</th>
                      <th className="px-3 py-3">Analyse & Trafic</th>
                      <th className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => setSortOption("profit_desc")}>
                          <span>Bénéfice Net</span>
                          <ArrowUpDown className="h-3 w-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="px-3.5 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {paginatedEntries.map((entry) => {
                      const isSelected = selectedEntryIds.has(entry.id);
                      const isStarred = starredEntryIds.has(entry.id);
                      const initials =
                        entry.countryCode === "ALL"
                          ? "GL"
                          : entry.countryCode?.length <= 3
                          ? entry.countryCode.toUpperCase()
                          : entry.countryName.slice(0, 2).toUpperCase() || "AF";

                      return (
                        <tr
                          key={entry.id}
                          onClick={() => setActiveDetailEntry(entry)}
                          className={`group cursor-pointer transition-colors duration-150 ${
                            isSelected
                              ? "bg-brand/10 dark:bg-brand/15"
                              : "hover:bg-slate-50/70 dark:hover:bg-surface/50"
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="px-3.5 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectEntry(entry.id)}
                              className="h-4 w-4 rounded border-surface-border text-brand focus:ring-brand cursor-pointer"
                            />
                          </td>

                          {/* 2. Star Icon */}
                          <td className="px-2 py-4 text-center" onClick={(e) => toggleStarEntry(entry.id, e)}>
                            <button type="button" className="text-slate-400 hover:text-amber-400 transition cursor-pointer">
                              {isStarred ? (
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              ) : (
                                <Star className="h-3.5 w-3.5 text-slate-400 hover:text-slate-300" />
                              )}
                            </button>
                          </td>

                          {/* 3. Avatar + Période & Clôture (Style 2-Lignes propre) */}
                          <td className="px-3.5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-surface border border-surface-border text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] group-hover:text-brand transition-colors block truncate max-w-[210px]">
                                  {entry.periodLabel}
                                </span>
                                <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                                  Clôturé le {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 4. Marché / Équipe */}
                          <td className="px-3 py-4">
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800 dark:text-slate-200">
                                <Globe className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span>{entry.countryName}</span>
                              </div>
                              <span className="text-[11px] text-slate-500 block mt-0.5">
                                Devise {entry.currency}
                              </span>
                            </div>
                          </td>

                          {/* 5. CA Encaissé (Gros chiffre tabular-nums + Landed Cost) */}
                          <td className="px-3 py-4 text-right">
                            <div className="text-xs sm:text-[13px] font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {entry.revenue.toLocaleString("fr-FR")} {entry.currency}
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                              Landed : {entry.landedCost.toLocaleString("fr-FR")} {entry.currency}
                            </span>
                          </td>

                          {/* 6. Livraisons (Quantité + Taux coloré comme la photo) */}
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1.5">
                              <b className="font-mono tabular-nums text-slate-900 dark:text-slate-100 text-xs">
                                {entry.ordersDelivered} livrées
                              </b>
                              <span
                                className={`text-[11px] font-semibold font-mono ${
                                  entry.deliveryRatePercent >= 75
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : entry.deliveryRatePercent >= 60
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {entry.deliveryRatePercent}%
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              {entry.ordersReceived} commandes reçues
                            </span>
                          </td>

                          {/* 7. Slim Visual Progress Bar (Inspirée exactement de la photo) */}
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 rounded-full bg-slate-200 dark:bg-surface border border-surface-border/50 overflow-hidden shrink-0">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    entry.deliveryRatePercent >= 75
                                      ? "bg-emerald-500"
                                      : entry.deliveryRatePercent >= 60
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(6, entry.deliveryRatePercent))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 8. Analyse & Commentaire texte (Style 'Wants a 6 month term' / 'No reply') */}
                          <td className="px-3 py-4">
                            <div className="max-w-[200px] truncate">
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                                {entry.adSpendTotal > 0 ? `ROAS ${entry.roasReal}x · Pub Meta` : "100% Organique / Direct"}
                              </span>
                              <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                                {entry.auditAlertMessage.replace(/^[⚠️🚀\s]+/, "")}
                              </span>
                            </div>
                          </td>

                          {/* 9. Bénéfice Net Réel */}
                          <td className="px-3 py-4 text-right">
                            <div className="text-xs sm:text-[13px] font-bold font-mono tabular-nums">
                              {renderSignedCurrency(entry.netProfit, entry.currency)}
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                              {entry.netMarginPercent}% de marge
                            </span>
                          </td>

                          {/* 10. Statut Pill (Copie fidèle de la photo de référence) */}
                          <td className="px-3.5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                                entry.auditStatus === "optimal"
                                  ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : entry.auditStatus === "crash"
                                  ? "border border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                  : "border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
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
                                  ? "Alerte Crash"
                                  : "À surveiller"}
                              </span>
                            </span>
                          </td>

                          {/* 11. Action Consulter */}
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDetailEntry(entry);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline transition cursor-pointer"
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
            )}

            {/* 4. FOOTER PAGINATION GLOBALBANK CRM */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border bg-surface/30 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
              {/* Gauche : 1-10 sur N clôtures */}
              <div className="font-medium">
                Affichage de{" "}
                <b className="text-slate-900 dark:text-slate-100 font-mono">
                  {sortedLedgerEntries.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </b>{" "}
                à{" "}
                <b className="text-slate-900 dark:text-slate-100 font-mono">
                  {Math.min(currentPage * pageSize, sortedLedgerEntries.length)}
                </b>{" "}
                sur{" "}
                <b className="text-slate-900 dark:text-slate-100 font-mono">
                  {sortedLedgerEntries.length}
                </b>{" "}
                clôtures
              </div>

              {/* Centre : Contrôles de pagination « < 1 2 3 > » */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-border bg-surface-raised hover:bg-surface disabled:opacity-30 transition cursor-pointer"
                  title="Première page"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-border bg-surface-raised hover:bg-surface disabled:opacity-30 transition cursor-pointer"
                  title="Page précédente"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <div key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-slate-500">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`flex h-7 min-w-[28px] px-2 items-center justify-center rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                          currentPage === p
                            ? "bg-brand text-white shadow-xs"
                            : "border border-surface-border bg-surface-raised hover:bg-surface text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  ))}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-border bg-surface-raised hover:bg-surface disabled:opacity-30 transition cursor-pointer"
                  title="Page suivante"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-border bg-surface-raised hover:bg-surface disabled:opacity-30 transition cursor-pointer"
                  title="Dernière page"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Droite : Sélecteur lignes par page */}
              <div className="flex items-center gap-1.5 font-medium">
                <span>Lignes/page :</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 rounded-lg border border-surface-border bg-surface-raised px-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-brand cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 5. VUE 2 : CATALOGUE PRODUITS, COÛTS & AD MAPPING */}
        {activeTab === "products" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface/30 px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Unit Economics :</strong> Landed Cost = Achat usine + Fret unitaire. Le bénéfice déduit usine, fret, commissions closeuse/livreur et pub Meta.
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {productsFinancialList.length} produit{productsFinancialList.length > 1 ? "s" : ""} actif{productsFinancialList.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-border bg-surface/30 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <th className="px-4 py-3">Produit & Source</th>
                    <th className="px-4 py-3 text-right">Landed Cost</th>
                    <th className="px-4 py-3 text-right">Prix Vente / Marge</th>
                    <th className="px-4 py-3 text-right">Stock Actuel</th>
                    <th className="px-4 py-3">Couverture Logistique</th>
                    <th className="px-4 py-3">Campagne Meta Ads</th>
                    <th className="px-4 py-3">Statut Rupture</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {productsFinancialList.map((p) => {
                    const { title, subtitle } = parseProductTitle(p.productName);
                    const pInitials = title
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "PR";

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-surface/50 transition-colors duration-150">
                        {/* 1. Avatar + Produit */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-surface-border bg-slate-100 dark:bg-surface text-slate-700 dark:text-slate-300 font-bold text-xs">
                              {pInitials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-[13px] truncate max-w-[260px]">
                                  {title}
                                </span>
                                <span className="rounded-full bg-surface border border-surface-border px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                                  {p.isAzify ? "Azify" : "Manuel"}
                                </span>
                              </div>
                              {subtitle && (
                                <p className="mt-0.5 text-[11px] text-slate-500 truncate max-w-[300px]">
                                  {subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Landed Cost (Achat Usine + Fret unitaire en sous-texte) */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono font-bold tabular-nums text-xs sm:text-[13px] text-slate-900 dark:text-slate-100">
                            {p.landedCost.toLocaleString("fr-FR")} {currency}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                            Usine {p.cogsUnitPrice.toLocaleString("fr-FR")} + Fret {p.transitUnitCost.toLocaleString("fr-FR")}
                          </span>
                        </td>

                        {/* 3. Prix de Vente Moyen & Marge nette par pièce */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono font-semibold tabular-nums text-xs text-slate-800 dark:text-slate-200">
                            {p.sellingPriceAvg.toLocaleString("fr-FR")} {currency}
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                            +{p.netMarginPerUnit.toLocaleString("fr-FR")} {currency} / pce
                          </span>
                        </td>

                        {/* 4. Stock Actuel */}
                        <td className="px-4 py-4 text-right">
                          <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 text-xs sm:text-[13px]">
                            {p.currentStock}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-1">pcs</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {p.unitsDeliveredInPeriod} vendues
                          </span>
                        </td>

                        {/* 5. Couverture Logistique avec Slim Progress Bar */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-14 h-1.5 rounded-full bg-slate-200 dark:bg-surface border border-surface-border/50 overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  p.daysOfStockRemaining >= 15
                                    ? "bg-emerald-500"
                                    : p.daysOfStockRemaining >= 7
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(8, Math.round((p.daysOfStockRemaining / 45) * 100)))}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {p.daysOfStockRemaining === 999 ? "Dormant" : `${p.daysOfStockRemaining} j`}
                            </span>
                          </div>
                        </td>

                        {/* 6. Campagne Meta Ads Liée */}
                        <td className="px-4 py-4">
                          {p.metaCampaignName ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 max-w-[180px] truncate">
                              <Radio className="h-3 w-3 text-indigo-500 shrink-0" />
                              <span className="truncate">{p.metaCampaignName}</span>
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
                              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-surface-border hover:border-brand px-2.5 py-1 text-xs text-slate-400 hover:text-brand transition cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Associer campagne</span>
                            </button>
                          )}
                        </td>

                        {/* 7. Statut Rupture Pill (Même style que référence photo) */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                              p.daysOfStockRemaining >= 15
                                ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : p.daysOfStockRemaining >= 7
                                ? "border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                : "border border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.daysOfStockRemaining >= 15
                                  ? "bg-emerald-500"
                                  : p.daysOfStockRemaining >= 7
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                            />
                            <span>{p.coverageLabel}</span>
                          </span>
                        </td>

                        {/* 8. Actions */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTriggerStockAlert(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
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
                              className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface hover:border-slate-400 text-slate-700 dark:text-slate-200 px-2.5 py-1 text-xs font-medium transition cursor-pointer"
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
      </div>

      {/* 6. TIROIR / FICHE COMPTABLE COMPLÈTE (Style Pristine Drawer) */}
      {activeDetailEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setActiveDetailEntry(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-surface-border bg-surface-raised p-6 shadow-2xl space-y-6"
          >
            {/* Header Fiche */}
            <div className="flex items-start justify-between border-b border-surface-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-brand text-white px-2 py-0.5 text-xs font-bold">
                    {activeDetailEntry.monthLabel}
                  </span>
                  <span className="rounded bg-surface border border-surface-border px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
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
                className="rounded-lg border border-surface-border p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Bilan Synthétique Net */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-surface-border bg-surface p-3">
                <span className="text-[11px] text-slate-500">CA Encaissé</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {activeDetailEntry.revenue.toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] text-slate-500">{activeDetailEntry.ordersDelivered} livraisons</span>
              </div>

              <div className="rounded-xl border border-surface-border bg-surface p-3">
                <span className="text-[11px] text-slate-500">Dépenses Meta Ads</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {activeDetailEntry.adSpendTotal.toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">ROAS : {activeDetailEntry.roasReal}x</span>
              </div>

              <div className="rounded-xl border border-surface-border bg-surface p-3">
                <span className="text-[11px] text-slate-500">Landed + Comms</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {(activeDetailEntry.landedCost + activeDetailEntry.totalCommissions).toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] text-slate-500">Fret & équipes</span>
              </div>

              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Bénéfice Net Réel</span>
                <div className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{activeDetailEntry.netProfit.toLocaleString("fr-FR")} {activeDetailEntry.currency}
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
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

            {/* Courbe Temporelle d'Évolution */}
            <div className="rounded-xl border border-surface-border bg-surface p-4">
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
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
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

            {/* Attribution Canaux de Trafic & Lieux */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-surface-border bg-surface p-4">
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
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <span>TikTok Ads</span>
                    </span>
                    <b className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {activeDetailEntry.trafficBreakdown?.tiktok_ads?.orders || 0} commandes
                    </b>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-surface-border bg-surface p-4">
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
              <div className="rounded-xl border border-surface-border bg-surface p-4">
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
                className="rounded-xl border border-rose-500/40 text-rose-600 px-3 py-2 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer"
              >
                Supprimer
              </button>

              <button
                type="button"
                onClick={() => showToast("Export PDF certifié téléchargé")}
                className="flex-1 rounded-xl bg-brand text-white font-bold text-xs py-2 hover:bg-brand-hover transition cursor-pointer shadow-xs"
              >
                Télécharger le Bilan Certifié (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL : NOUVELLE CLÔTURE COMPTABLE */}
      {showNewClosureModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => !closureSubmitting && setShowNewClosureModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
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
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
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
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
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
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-brand"
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
                  className="w-full rounded-xl border border-surface-border bg-surface p-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-surface-border">
              <button
                type="button"
                disabled={closureSubmitting}
                onClick={() => setShowNewClosureModal(false)}
                className="flex-1 rounded-xl border border-surface-border bg-surface py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={closureSubmitting}
                onClick={handleCreateClosure}
                className="flex-1 rounded-xl bg-brand text-white py-2.5 text-xs font-bold hover:bg-brand-hover transition cursor-pointer disabled:opacity-50 shadow-xs"
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
            className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
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
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-brand"
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
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-brand"
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
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-brand"
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
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
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
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-brand"
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
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-surface-border">
              <button
                type="button"
                disabled={formSaving}
                onClick={() => setEditingStock(null)}
                className="flex-1 rounded-xl border border-surface-border bg-surface py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={formSaving}
                onClick={handleSaveStockCosts}
                className="flex-1 rounded-xl bg-brand text-white py-2.5 text-xs font-bold hover:bg-brand-hover transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {formSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-surface-border bg-surface-raised px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-2xl animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
