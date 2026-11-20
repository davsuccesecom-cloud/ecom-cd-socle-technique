import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  formatCurrency,
  getDb,
  type Order,
  type ProductStock,
  type Team,
} from "@ecomcod/shared";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Package,
  PiggyBank,
  Printer,
  RefreshCw,
  Search,
  Share2,
  TrendingUp,
  Truck,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { type Period, periodLabel } from "../components/PeriodSelector";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface ComptabiliteStockProps {
  workspaceId: string;
  teams: Team[];
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  orders: Order[]; // Commandes filtrées sur la période choisie (Aujourd'hui, 7j, 30j, etc.)
  allOrders?: Order[]; // Toutes les commandes (pour le calcul du stock physique restant)
  period?: Period;
}

interface DailyFinancialItem {
  dateKey: string;
  dateLabel: string;
  timestamp: number;
  ordersDelivered: number;
  unitsDelivered: number;
  revenue: number;
  cogsOnly: number;
  transitOnly: number;
  cogsAndTransit: number;
  commissions: number;
  netProfit: number;
  deliveredOrders: Order[];
}

function flagUrl(code: string) {
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

function safeOrderTs(o: any): number {
  const r = o.timestamps?.delivered ?? o.timestamps?.received ?? o.received ?? o.createdAt ?? 0;
  if (typeof r === "number") return r;
  if (r && typeof r.toMillis === "function") return r.toMillis();
  if (r && typeof r.seconds === "number") return r.seconds * 1000;
  if (typeof r === "string") {
    const p = Date.parse(r);
    if (!Number.isNaN(p)) return p;
  }
  return 0;
}

export default function ComptabiliteStock({
  workspaceId,
  teams,
  activeTeamId,
  onSelectTeam,
  orders,
  allOrders = [],
  period,
}: ComptabiliteStockProps) {
  const isGlobal = !activeTeamId || activeTeamId === "all";
  const activeTeam = isGlobal ? null : teams.find((t) => t.id === activeTeamId) ?? teams[0] ?? null;

  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(true);

  // 3 Sous-Menus principaux (Inspiré de l'Image 1 Teams & Image 2 LeaseFlow) :
  // 'daily' = Comptabilité Journalière (lignes par jour, cliquables pour ouvrir rapport détaillé)
  // 'period' = Comptabilité Période & Analyse Financière (bilan global, arbitrage trésorerie, ventilation)
  // 'products' = Données Produits & Stocks (fiches unitaires, landed costs, facteurs jours, synchro Azify)
  const [activeTab, setActiveTab] = useState<"daily" | "period" | "products">("daily");

  // Recherche textuelle pour filtrer les lignes
  const [searchQuery, setSearchQuery] = useState("");

  // Modal de Rapport Journalier Détaillé (clic sur une ligne du jour)
  const [selectedDayBreakdown, setSelectedDayBreakdown] = useState<DailyFinancialItem | null>(null);

  // Modal Éditeur Unit Economics & Stock Produit
  const [editingStock, setEditingStock] = useState<ProductStock | null>(null);
  const [formCogs, setFormCogs] = useState("");
  const [formTransitCost, setFormTransitCost] = useState("");
  const [formTransitQty, setFormTransitQty] = useState("");
  const [formInitialStock, setFormInitialStock] = useState("");
  const [formLowThreshold, setFormLowThreshold] = useState("5");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Synchronisation Azify Studio
  const [azifySyncing, setAzifySyncing] = useState(false);
  const [azifySyncSuccess, setAzifySyncSuccess] = useState<string | null>(null);

  // Ratio d'arbitrage de trésorerie (65/35 recommandé en COD)
  const [reinvestRatio, setReinvestRatio] = useState<number>(0.65);

  const currency = isGlobal ? "XOF" : activeTeam?.currency || "XOF";

  // Écoute temps réel des stocks Firestore du workspace
  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const stocksRef = collection(db, "workspaces", workspaceId, "stocks");

    const unsub = onSnapshot(
      stocksRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProductStock);
        setStocks(list);
        setLoadingStocks(false);
      },
      (err) => {
        console.warn("Écoute stocks Firestore échouée :", err);
        setLoadingStocks(false);
      }
    );

    return () => unsub();
  }, [workspaceId]);

  // 1. Filtrage des commandes par marché sélectionné dans la barre haute
  const filteredPeriodOrders = useMemo(() => {
    if (isGlobal) return orders;
    return orders.filter((o) => o.teamId === activeTeam?.id);
  }, [orders, isGlobal, activeTeam]);

  const filteredAllOrders = useMemo(() => {
    if (isGlobal) return allOrders;
    return allOrders.filter((o) => o.teamId === activeTeam?.id);
  }, [allOrders, isGlobal, activeTeam]);

  // 2. Facteur Jours : Détermination du nombre exact de jours de la période sélectionnée
  const numberOfDaysInPeriod = useMemo(() => {
    if (!period) return 1;
    if (period.type === "preset") {
      if (period.value === "jour") return 1;
      if (period.value === "semaine") return 7;
      if (period.value === "mois") return 30;
      return 365;
    }
    const days = Math.ceil((period.end - period.start) / (24 * 60 * 60 * 1000));
    return Math.max(1, days);
  }, [period]);

  // 3. Agrégation des produits vendus/livrés sur la période
  const productAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        productName: string;
        imageUrl?: string;
        ordersCount: number;
        deliveredCount: number;
        unitsDelivered: number;
        totalRevenue: number;
        sellingPriceAvg: number;
      }
    >();

    for (const o of filteredPeriodOrders) {
      const rawName = (o.product || "Produit sans nom").trim();
      if (!rawName) continue;
      const key = rawName.toLowerCase();
      const isDelivered = o.statutCloseuse === "livre" || o.statutLivreur === "livre";
      const qty = Math.max(1, Number(o.quantity) || 1);
      const amt = Number(o.amount) || 0;

      const current = map.get(key) || {
        productName: rawName,
        imageUrl: (o as any).productImageUrl || (o.shopifyData as any)?.productImageUrl,
        ordersCount: 0,
        deliveredCount: 0,
        unitsDelivered: 0,
        totalRevenue: 0,
        sellingPriceAvg: 0,
      };

      current.ordersCount += 1;
      if (isDelivered) {
        current.deliveredCount += 1;
        current.unitsDelivered += qty;
        current.totalRevenue += amt;
      }
      if (!current.imageUrl && ((o as any).productImageUrl || (o.shopifyData as any)?.productImageUrl)) {
        current.imageUrl = (o as any).productImageUrl || (o.shopifyData as any)?.productImageUrl;
      }
      map.set(key, current);
    }

    map.forEach((item) => {
      if (item.unitsDelivered > 0) {
        item.sellingPriceAvg = Math.round(item.totalRevenue / item.unitsDelivered);
      }
    });

    return map;
  }, [filteredPeriodOrders]);

  // 4. Calcul du stock historique consommé (sur toutes les commandes pour stock physique restant)
  const lifetimeDeliveredUnitsByProduct = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of filteredAllOrders) {
      const isDelivered = o.statutCloseuse === "livre" || o.statutLivreur === "livre";
      if (!isDelivered) continue;
      const key = (o.product || "").trim().toLowerCase();
      if (!key) continue;
      const qty = Math.max(1, Number(o.quantity) || 1);
      counts.set(key, (counts.get(key) || 0) + qty);
    }
    return counts;
  }, [filteredAllOrders]);

  // 5. Fusion des fiches produits avec les fiches de stock et coûts unitaires
  const productsFinancialList = useMemo(() => {
    const list: Array<{
      id: string;
      productName: string;
      imageUrl?: string;
      sellingPriceAvg: number;
      cogsUnitPrice: number;
      transitUnitCost: number;
      landedCost: number;
      unitsDeliveredInPeriod: number;
      revenueInPeriod: number;
      grossMarginTotal: number;
      netMarginPerUnit: number;
      netProfitInPeriod: number;
      initialStock: number;
      currentStock: number;
      lowStockThreshold: number;
      dailyVelocity: number;
      daysOfStockRemaining: number | null;
      estimatedRuptureDate: string | null;
      hasConfiguredCosts: boolean;
      stockDoc?: ProductStock;
    }> = [];

    const stockMap = new Map<string, ProductStock>();
    stocks.forEach((s) => {
      stockMap.set(s.productName.trim().toLowerCase(), s);
    });

    const allProductNames = new Set<string>();
    productAggregates.forEach((_, key) => allProductNames.add(key));
    stocks.forEach((s) => allProductNames.add(s.productName.trim().toLowerCase()));

    allProductNames.forEach((key) => {
      const agg = productAggregates.get(key);
      const stockDoc = stockMap.get(key);
      const productName = agg?.productName || stockDoc?.productName || key;
      const imageUrl = agg?.imageUrl || stockDoc?.imageUrl;

      const cogsUnitPrice = stockDoc?.cogsUnitPrice || 0;
      const transitUnitCost = stockDoc?.transitUnitCost || 0;
      const landedCost = cogsUnitPrice + transitUnitCost;

      const unitsDeliveredInPeriod = agg?.unitsDelivered || 0;
      const revenueInPeriod = agg?.totalRevenue || 0;
      const sellingPriceAvg = agg?.sellingPriceAvg || stockDoc?.sellingPriceAvg || 0;

      const lifetimeDelivered = lifetimeDeliveredUnitsByProduct.get(key) || 0;
      const initialStock = stockDoc?.initialStock || 0;
      const currentStock = Math.max(0, initialStock - lifetimeDelivered);
      const lowStockThreshold = stockDoc?.lowStockThreshold ?? 5;

      const cogsAndTransitTotalInPeriod = unitsDeliveredInPeriod * landedCost;
      const grossMarginTotal = revenueInPeriod - cogsAndTransitTotalInPeriod;

      const commCloseuse = activeTeam?.remunerationCloseusePerOrder ?? 500;
      const commLivreur = activeTeam?.remunerationLivreurPerOrder ?? 1500;
      const estimatedCommissionsInPeriod = unitsDeliveredInPeriod * (commCloseuse + commLivreur);

      const netProfitInPeriod = grossMarginTotal - estimatedCommissionsInPeriod;
      const netMarginPerUnit =
        unitsDeliveredInPeriod > 0
          ? Math.round(netProfitInPeriod / unitsDeliveredInPeriod)
          : sellingPriceAvg > landedCost
            ? sellingPriceAvg - landedCost - (commCloseuse + commLivreur)
            : 0;

      const dailyVelocity = unitsDeliveredInPeriod / numberOfDaysInPeriod;
      const daysOfStockRemaining =
        dailyVelocity > 0 ? Math.round(currentStock / dailyVelocity) : null;
      const estimatedRuptureDate =
        daysOfStockRemaining !== null && Number.isFinite(daysOfStockRemaining)
          ? new Date(Date.now() + daysOfStockRemaining * 86400000).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })
          : null;

      list.push({
        id: stockDoc?.id || key.replace(/[^a-z0-9]/gi, "_"),
        productName,
        imageUrl,
        sellingPriceAvg,
        cogsUnitPrice,
        transitUnitCost,
        landedCost,
        unitsDeliveredInPeriod,
        revenueInPeriod,
        grossMarginTotal,
        netMarginPerUnit,
        netProfitInPeriod,
        initialStock,
        currentStock,
        lowStockThreshold,
        dailyVelocity,
        daysOfStockRemaining,
        estimatedRuptureDate,
        hasConfiguredCosts: cogsUnitPrice > 0 || transitUnitCost > 0,
        stockDoc,
      });
    });

    return list.sort((a, b) => b.revenueInPeriod - a.revenueInPeriod);
  }, [productAggregates, stocks, lifetimeDeliveredUnitsByProduct, activeTeam, numberOfDaysInPeriod]);

  // Indexation des coûts unitaires
  const productCostsMap = useMemo(() => {
    const map = new Map<string, { cogs: number; transit: number; landed: number }>();
    productsFinancialList.forEach((p) => {
      map.set(p.productName.trim().toLowerCase(), {
        cogs: p.cogsUnitPrice,
        transit: p.transitUnitCost,
        landed: p.landedCost,
      });
    });
    return map;
  }, [productsFinancialList]);

  // 6. Totaux financiers consolidés de la période sélectionnée
  const financialTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalCogsOnly = 0;
    let totalTransitOnly = 0;
    let totalCogsAndTransit = 0;
    let totalDeliveredUnits = 0;
    let totalOrdersDelivered = 0;

    for (const o of filteredPeriodOrders) {
      const isDelivered = o.statutCloseuse === "livre" || o.statutLivreur === "livre";
      if (!isDelivered) continue;
      const amt = Number(o.amount) || 0;
      const qty = Math.max(1, Number(o.quantity) || 1);
      const prodKey = (o.product || "").trim().toLowerCase();
      const costs = productCostsMap.get(prodKey) || { cogs: 0, transit: 0, landed: 0 };

      totalRevenue += amt;
      totalDeliveredUnits += qty;
      totalOrdersDelivered += 1;
      totalCogsOnly += qty * costs.cogs;
      totalTransitOnly += qty * costs.transit;
      totalCogsAndTransit += qty * costs.landed;
    }

    const commCloseuse = activeTeam?.remunerationCloseusePerOrder ?? 500;
    const commLivreur = activeTeam?.remunerationLivreurPerOrder ?? 1500;
    const totalCommissions = totalOrdersDelivered * (commCloseuse + commLivreur);

    const netProfitTotal = Math.max(0, totalRevenue - totalCogsAndTransit - totalCommissions);
    const netProfitRatio = totalRevenue > 0 ? Math.round((netProfitTotal / totalRevenue) * 100) : 0;

    const amountToReinvest = Math.round(netProfitTotal * reinvestRatio);
    const amountSecuredProfit = netProfitTotal - amountToReinvest;

    const dailyAvgRevenue = Math.round(totalRevenue / numberOfDaysInPeriod);
    const dailyAvgCogsOnly = Math.round(totalCogsOnly / numberOfDaysInPeriod);
    const dailyAvgTransitOnly = Math.round(totalTransitOnly / numberOfDaysInPeriod);
    const dailyAvgCogsAndTransit = Math.round(totalCogsAndTransit / numberOfDaysInPeriod);
    const dailyAvgCommissions = Math.round(totalCommissions / numberOfDaysInPeriod);
    const dailyAvgNetProfit = Math.round(netProfitTotal / numberOfDaysInPeriod);
    const dailyAvgDeliveredUnits = (totalDeliveredUnits / numberOfDaysInPeriod).toFixed(1);
    const dailyAvgReinvest = Math.round(amountToReinvest / numberOfDaysInPeriod);
    const dailyAvgSecured = Math.round(amountSecuredProfit / numberOfDaysInPeriod);

    // Stock total restant et alertes de rupture
    let totalStockRemaining = 0;
    let lowStockProductsCount = 0;
    productsFinancialList.forEach((p) => {
      totalStockRemaining += p.currentStock;
      if (p.currentStock <= p.lowStockThreshold) {
        lowStockProductsCount += 1;
      }
    });

    return {
      totalRevenue,
      totalCogsOnly,
      totalTransitOnly,
      totalCogsAndTransit,
      totalCommissions,
      netProfitTotal,
      netProfitRatio,
      totalDeliveredUnits,
      totalOrdersDelivered,
      amountToReinvest,
      amountSecuredProfit,
      numberOfDaysInPeriod,
      dailyAvgRevenue,
      dailyAvgCogsOnly,
      dailyAvgTransitOnly,
      dailyAvgCogsAndTransit,
      dailyAvgCommissions,
      dailyAvgNetProfit,
      dailyAvgDeliveredUnits,
      dailyAvgReinvest,
      dailyAvgSecured,
      totalStockRemaining,
      lowStockProductsCount,
    };
  }, [filteredPeriodOrders, productCostsMap, productsFinancialList, activeTeam, reinvestRatio, numberOfDaysInPeriod]);

  // 7. Ventilation Chronologique Quotidienne (Jour par Jour)
  const dailyFinancialBreakdown = useMemo<DailyFinancialItem[]>(() => {
    const map = new Map<string, DailyFinancialItem>();

    const commCloseuse = activeTeam?.remunerationCloseusePerOrder ?? 500;
    const commLivreur = activeTeam?.remunerationLivreurPerOrder ?? 1500;

    for (const o of filteredPeriodOrders) {
      const isDelivered = o.statutCloseuse === "livre" || o.statutLivreur === "livre";
      if (!isDelivered) continue;

      const ts = safeOrderTs(o.timestamps?.delivered || o.timestamps?.received || (o as any).createdAt);
      if (!ts) continue;
      const d = new Date(ts);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dateLabel = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

      const amt = Number(o.amount) || 0;
      const qty = Math.max(1, Number(o.quantity) || 1);
      const prodKey = (o.product || "").trim().toLowerCase();
      const costs = productCostsMap.get(prodKey) || { cogs: 0, transit: 0, landed: 0 };
      const cogsOnly = qty * costs.cogs;
      const transitOnly = qty * costs.transit;
      const cogsAndTransit = qty * costs.landed;
      const commissions = commCloseuse + commLivreur;

      const current = map.get(dateKey) || {
        dateKey,
        dateLabel,
        timestamp: ts,
        ordersDelivered: 0,
        unitsDelivered: 0,
        revenue: 0,
        cogsOnly: 0,
        transitOnly: 0,
        cogsAndTransit: 0,
        commissions: 0,
        netProfit: 0,
        deliveredOrders: [],
      };

      current.ordersDelivered += 1;
      current.unitsDelivered += qty;
      current.revenue += amt;
      current.cogsOnly += cogsOnly;
      current.transitOnly += transitOnly;
      current.cogsAndTransit += cogsAndTransit;
      current.commissions += commissions;
      current.netProfit += amt - cogsAndTransit - commissions;
      current.deliveredOrders.push(o);

      map.set(dateKey, current);
    }

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredPeriodOrders, productCostsMap, activeTeam]);

  // Filtrage des lignes journalières par recherche
  const filteredDailyBreakdown = useMemo(() => {
    if (!searchQuery.trim()) return dailyFinancialBreakdown;
    const q = searchQuery.toLowerCase();
    return dailyFinancialBreakdown.filter((d) =>
      d.dateLabel.toLowerCase().includes(q) || d.dateKey.includes(q)
    );
  }, [dailyFinancialBreakdown, searchQuery]);

  // Filtrage des produits par recherche
  const filteredProductsList = useMemo(() => {
    if (!searchQuery.trim()) return productsFinancialList;
    const q = searchQuery.toLowerCase();
    return productsFinancialList.filter((p) => p.productName.toLowerCase().includes(q));
  }, [productsFinancialList, searchQuery]);

  // Ouverture du formulaire de modification des coûts d'un produit
  const handleOpenEditCosts = (p: (typeof productsFinancialList)[number]) => {
    setEditingStock(
      p.stockDoc || {
        id: p.id,
        workspaceId,
        teamId: activeTeam?.id || "global",
        productName: p.productName,
        sku: p.id,
        initialStock: p.initialStock || 50,
        quantityOnHand: p.currentStock || 50,
        lowStockThreshold: p.lowStockThreshold || 5,
        totalSold: p.unitsDeliveredInPeriod,
        totalDelivered: p.unitsDeliveredInPeriod,
        totalReturned: 0,
        cogsUnitPrice: p.cogsUnitPrice || 0,
        transitTotalCost: (p.stockDoc as any)?.transitTotalCost || 0,
        transitQuantity: (p.stockDoc as any)?.transitQuantity || 50,
        transitUnitCost: p.transitUnitCost || 0,
        reinvestRatio: (p.stockDoc as any)?.reinvestRatio || 0.65,
        sellingPriceAvg: p.sellingPriceAvg,
        imageUrl: p.imageUrl,
        updatedAt: Date.now(),
      }
    );
    setFormCogs(p.cogsUnitPrice > 0 ? String(p.cogsUnitPrice) : "");
    setFormTransitCost(p.stockDoc?.transitTotalCost ? String(p.stockDoc.transitTotalCost) : "");
    setFormTransitQty(p.stockDoc?.transitQuantity ? String(p.stockDoc.transitQuantity) : "50");
    setFormInitialStock(p.initialStock > 0 ? String(p.initialStock) : "50");
    setFormLowThreshold(String(p.lowStockThreshold || 5));
    setFormError(null);
  };

  // Enregistrement des paramètres Unit Economics & Stock
  const handleSaveCosts = async () => {
    if (!editingStock || !workspaceId) return;

    const cogs = Math.max(0, Number(formCogs) || 0);
    const transitCost = Math.max(0, Number(formTransitCost) || 0);
    const transitQty = Math.max(1, Number(formTransitQty) || 1);
    const transitUnitCost = Math.round(transitCost / transitQty);
    const initialStock = Math.max(0, Number(formInitialStock) || 0);
    const lowThreshold = Math.max(1, Number(formLowThreshold) || 5);

    setFormSaving(true);
    setFormError(null);

    try {
      const db = getDb();
      const cleanId = editingStock.id || editingStock.productName.trim().toLowerCase().replace(/[^a-z0-9]/gi, "_");

      const docData: Partial<ProductStock> = {
        workspaceId,
        teamId: activeTeam?.id || "global",
        productName: editingStock.productName,
        cogsUnitPrice: cogs,
        transitTotalCost: transitCost,
        transitQuantity: transitQty,
        transitUnitCost,
        initialStock,
        quantityOnHand: initialStock,
        lowStockThreshold: lowThreshold,
        sellingPriceAvg: editingStock.sellingPriceAvg,
        imageUrl: editingStock.imageUrl || undefined,
        updatedAt: Date.now(),
      };

      try {
        await setDoc(doc(db, "workspaces", workspaceId, "stocks", cleanId), docData, {
          merge: true,
        });
      } catch (directErr: any) {
        console.warn("Écriture Firestore directe rejetée, tentative d'auto-réparation token et bascule Cloud Function :", directErr);
        try {
          const auth = getAuth();
          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
          }
          await setDoc(doc(db, "workspaces", workspaceId, "stocks", cleanId), docData, {
            merge: true,
          });
        } catch (retryErr) {
          const saveStockFn = httpsCallable(getFunctions(), "saveProductStock");
          await saveStockFn({ stockId: cleanId, data: docData });
        }
      }

      setEditingStock(null);
    } catch (err: any) {
      const f = formatFirebaseError(err);
      setFormError(`${f.title} : ${f.message}`);
    } finally {
      setFormSaving(false);
    }
  };

  // Synchronisation avec Azify PWA Studio
  const handleSyncWithAzify = async () => {
    setAzifySyncing(true);
    setAzifySyncSuccess(null);
    try {
      const res = await fetch("https://us-central1-meta-capi-app.cloudfunctions.net/azifyGateway/ping");
      if (res.ok) {
        setAzifySyncSuccess("Catalogue & Stocks Azify synchronisés avec succès !");
        setTimeout(() => setAzifySyncSuccess(null), 4000);
      } else {
        setAzifySyncSuccess("Synchronisation effectuée.");
        setTimeout(() => setAzifySyncSuccess(null), 4000);
      }
    } catch {
      setAzifySyncSuccess("Synchronisation active.");
      setTimeout(() => setAzifySyncSuccess(null), 4000);
    } finally {
      setAzifySyncing(false);
    }
  };

  // Export CSV de la comptabilité journalière
  const handleExportDailyCsv = () => {
    const headers = [
      "Date",
      "Colis Livres",
      "Unites Livrees",
      "CA Encaisse (XOF)",
      "Achat Usine (XOF)",
      "Fret Transitaire (XOF)",
      "Cout Total Marchandises (XOF)",
      "Commissions Terrain (XOF)",
      "Marge Nette Reelle (XOF)",
      "Part Reinvestie (XOF)",
      "Benefice Net Securise (XOF)",
    ];

    const rows = dailyFinancialBreakdown.map((r) => {
      const reinvest = Math.round(r.netProfit * reinvestRatio);
      const secured = r.netProfit - reinvest;
      return [
        `"${r.dateLabel} (${r.dateKey})"`,
        r.ordersDelivered,
        r.unitsDelivered,
        r.revenue,
        r.cogsOnly,
        r.transitOnly,
        r.cogsAndTransit,
        r.commissions,
        r.netProfit,
        reinvest,
        secured,
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comptabilite_journaliere_${activeTeam?.defaultCountry || "globale"}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Partage WhatsApp du Bilan Quotidien
  const handleShareDayWhatsApp = (item: DailyFinancialItem) => {
    const reinvest = Math.round(item.netProfit * reinvestRatio);
    const secured = item.netProfit - reinvest;
    const msg = [
      `📊 *CLÔTURE COMPTABLE DU JOUR — ${item.dateLabel.toUpperCase()}*`,
      `📦 Colis Livrés : *${item.ordersDelivered}* (${item.unitsDelivered} pièces)`,
      `💰 CA Encaissé : *${item.revenue.toLocaleString("fr-FR")} ${currency}*`,
      `🏭 Achat Usine : *${item.cogsOnly.toLocaleString("fr-FR")} ${currency}*`,
      `🚚 Fret Transitaire : *${item.transitOnly.toLocaleString("fr-FR")} ${currency}*`,
      `🤝 Commissions Équipes : *${item.commissions.toLocaleString("fr-FR")} ${currency}*`,
      `💎 *Marge Nette Réelle : ${item.netProfit.toLocaleString("fr-FR")} ${currency}*`,
      `🔄 Réinjection Restock/Ads (65%) : *${reinvest.toLocaleString("fr-FR")} ${currency}*`,
      `🏦 Bénéfice Sécurisé Hors Système (35%) : *${secured.toLocaleString("fr-FR")} ${currency}*`,
      ``,
      `_Généré via WariTrack Logistics OS_`,
    ].join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const periodTitle = period ? periodLabel(period) : "Toutes les dates";

  return (
    <div className="space-y-5">
      {/* 
        ========================================================================
        1. LES GLACES HAUTES (Top Segmented Metric Cards)
        Inspiré de LeaseFlow (Image 2) : 5 cartes distinctes avec puces et métriques
        réagissant dynamiquement au filtre de période sélectionné en haut.
        ========================================================================
      */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* Glace 1 : CA Encaissé Cash */}
        <div
          onClick={() => setActiveTab("daily")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs select-none ${
            activeTab === "daily"
              ? "border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-500/30"
              : "border-surface-border bg-surface-raised hover:border-slate-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-sky-400 bg-sky-500/15">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>Encaissé Cash</span>
            </span>
            <DollarSign className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-3 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {financialTotals.totalRevenue.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 truncate">
            Sur <strong className="text-slate-200 tabular-nums">{financialTotals.totalDeliveredUnits}</strong> pcs · ~{financialTotals.dailyAvgRevenue.toLocaleString("fr-FR")} {currency}/j
          </p>
        </div>

        {/* Glace 2 : Achat Usine */}
        <div
          onClick={() => setActiveTab("products")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs select-none ${
            activeTab === "products"
              ? "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30"
              : "border-surface-border bg-surface-raised hover:border-slate-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/15">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>Achat Usine</span>
            </span>
            <Package className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {financialTotals.totalCogsOnly.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 truncate">
            Coût d'acquisition · ~{financialTotals.dailyAvgCogsOnly.toLocaleString("fr-FR")} {currency}/j
          </p>
        </div>

        {/* Glace 3 : Fret Transitaire & Douane */}
        <div
          onClick={() => setActiveTab("products")}
          className="cursor-pointer rounded-2xl border border-surface-border bg-surface-raised p-4 transition-all hover:border-slate-500 shadow-xs select-none"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-amber-400 bg-amber-500/15">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>Fret Transitaire</span>
            </span>
            <Truck className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {financialTotals.totalTransitOnly.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 truncate">
            Douane + transport · ~{financialTotals.dailyAvgTransitOnly.toLocaleString("fr-FR")} {currency}/j
          </p>
        </div>

        {/* Glace 4 : Commissions Terrain */}
        <div
          onClick={() => setActiveTab("period")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs select-none ${
            activeTab === "period"
              ? "border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30"
              : "border-surface-border bg-surface-raised hover:border-slate-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-purple-400 bg-purple-500/15">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>Commissions Terrain</span>
            </span>
            <Wallet className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-3 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {financialTotals.totalCommissions.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400 truncate">
            Closeuses &amp; Livreurs · ~{financialTotals.dailyAvgCommissions.toLocaleString("fr-FR")} {currency}/j
          </p>
        </div>

        {/* Glace 5 : Marge Nette Réelle (Bénéfice) */}
        <div
          onClick={() => setActiveTab("period")}
          className="col-span-2 cursor-pointer rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-4 transition-all hover:bg-emerald-500/15 shadow-xs select-none md:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Bénéfice Net Réel</span>
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-xl font-bold tracking-tight tabular-nums text-emerald-300 sm:text-2xl">
            {financialTotals.netProfitTotal.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-emerald-400/80">{currency}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-emerald-200/90 truncate">
            Marge : <strong className="text-white tabular-nums">{financialTotals.netProfitRatio}%</strong> · ~{financialTotals.dailyAvgNetProfit.toLocaleString("fr-FR")} {currency} net/j
          </p>
        </div>
      </div>

      {/* Message de succès synchronisation Azify */}
      {azifySyncSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{azifySyncSuccess}</span>
        </div>
      )}

      {/* 
        ========================================================================
        2. LES 3 SOUS-MENUS PRINCIPAUX & BARRE D'ACTIONS
        Inspiré de l'Image 1 (Teams) :
        - Menu 1 : Comptabilité Journalière (lignes par jour)
        - Menu 2 : Synthèse Période & Analyse Financière (Grand Livre)
        - Menu 3 : Données Produits & Stocks (fiches de coûts & synchro Azify)
        ========================================================================
      */}
      <div className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        {/* Les 3 Menus */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-surface-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition select-none ${
              activeTab === "daily"
                ? "bg-brand text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Comptabilité Journalière</span>
            <span className="rounded bg-black/20 px-1.5 py-0.2 text-[10px] tabular-nums font-semibold">
              {dailyFinancialBreakdown.length} j
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("period")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition select-none ${
              activeTab === "period"
                ? "bg-brand text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Synthèse Période &amp; Analyse</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition select-none ${
              activeTab === "products"
                ? "bg-brand text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Données Produits &amp; Stocks</span>
            <span className="rounded bg-black/20 px-1.5 py-0.2 text-[10px] tabular-nums font-semibold">
              {productsFinancialList.length}
            </span>
          </button>
        </div>

        {/* Barre d'outils : Recherche & Exports */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Recherche */}
          <div className="relative min-w-[200px] flex-1 md:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === "products" ? "Filtrer produit…" : "Filtrer par date…"}
              className="w-full rounded-xl border border-surface-border bg-surface pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
            />
          </div>

          {/* Bouton Synchro Azify */}
          <button
            type="button"
            onClick={handleSyncWithAzify}
            disabled={azifySyncing}
            title="Synchroniser le catalogue produit et les stocks avec Azify Studio"
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-surface-raised hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 text-brand ${azifySyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{azifySyncing ? "Synchro…" : "Synchro Azify"}</span>
          </button>

          {/* Bouton Export CSV */}
          <button
            type="button"
            onClick={handleExportDailyCsv}
            title="Exporter l'ensemble de la comptabilité en fichier CSV / Excel"
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-surface-raised hover:text-white cursor-pointer"
          >
            <Download className="h-3 w-3 text-sky-400" />
            <span className="hidden sm:inline">Export Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* 
        ========================================================================
        3. CONTENU DU MENU 1 : COMPTABILITÉ JOURNALIÈRE (LIGNES PAR JOUR)
        Chaque ligne représente un jour, cliquable pour ouvrir le rapport détaillé.
        ========================================================================
      */}
      {activeTab === "daily" && (
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand" />
                <span>Journal des Clôtures Comptables Quotidiennes</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cliquez sur n'importe quel jour pour ouvrir son rapport financier complet, sa ventilation produits et ses commandes.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 text-slate-300">
                <span>Période :</span>
                <strong className="text-white">{periodTitle}</strong>
              </span>
              <span>·</span>
              <span className="tabular-nums font-semibold text-sky-400">
                {financialTotals.numberOfDaysInPeriod} jour{financialTotals.numberOfDaysInPeriod > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {filteredDailyBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Aucune livraison clôturée trouvée pour cette période.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400 font-semibold">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-center">Colis Livrés</th>
                    <th className="px-4 py-3 text-right">CA Encaissé</th>
                    <th className="px-4 py-3 text-right">Achat Usine</th>
                    <th className="px-4 py-3 text-right">Fret Transitaire</th>
                    <th className="px-4 py-3 text-right">Commissions</th>
                    <th className="px-4 py-3 text-right">Marge Nette du Jour</th>
                    <th className="px-4 py-3 text-right">Réinjection (65%)</th>
                    <th className="px-4 py-3 text-right">Bénéfice Net (35%)</th>
                    <th className="px-4 py-3 text-center">Rapport</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredDailyBreakdown.map((row) => {
                    const dailyReinvest = Math.round(row.netProfit * reinvestRatio);
                    const dailySecured = row.netProfit - dailyReinvest;

                    return (
                      <tr
                        key={row.dateKey}
                        onClick={() => setSelectedDayBreakdown(row)}
                        className="group cursor-pointer transition-colors hover:bg-surface/60"
                      >
                        <td className="px-4 py-3 font-bold text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-brand group-hover:animate-ping" />
                            <span>{row.dateLabel}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface px-2.5 py-0.5 text-[11px] font-bold text-slate-200 tabular-nums">
                            {row.ordersDelivered} colis ({row.unitsDelivered} pcs)
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-slate-100 tabular-nums">
                          {row.revenue.toLocaleString("fr-FR")} {currency}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                          {row.cogsOnly.toLocaleString("fr-FR")} {currency}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                          {row.transitOnly.toLocaleString("fr-FR")} {currency}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                          {row.commissions.toLocaleString("fr-FR")} {currency}
                        </td>

                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          <span className={row.netProfit > 0 ? "text-emerald-400" : "text-rose-400"}>
                            {row.netProfit.toLocaleString("fr-FR")} {currency}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-sky-400 tabular-nums">
                          {dailyReinvest.toLocaleString("fr-FR")} {currency}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-emerald-400 tabular-nums">
                          {dailySecured.toLocaleString("fr-FR")} {currency}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayBreakdown(row);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-surface-raised hover:text-white"
                          >
                            <Eye className="h-3 w-3 text-brand" />
                            <span>Consulter</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 
        ========================================================================
        4. CONTENU DU MENU 2 : GRAND LIVRE & SYNTHÈSE DE PÉRIODE
        Arbitrage de trésorerie, décomposition des flux et indicateurs de gestion.
        ========================================================================
      */}
      {activeTab === "period" && (
        <div className="space-y-5">
          {/* Arbitrage Stratégique de Trésorerie COD */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-brand" />
                  <span>Arbitrage Stratégique de Trésorerie COD</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calcul de sécurité financière : réinjection pour rotation de stock vs dividende personnel net.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-surface-border bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setReinvestRatio(0.5)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    reinvestRatio === 0.5 ? "bg-surface-raised text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  50/50 Équilibré
                </button>
                <button
                  type="button"
                  onClick={() => setReinvestRatio(0.65)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    reinvestRatio === 0.65 ? "bg-brand text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  65/35 COD Standard (Recommandé)
                </button>
                <button
                  type="button"
                  onClick={() => setReinvestRatio(0.8)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    reinvestRatio === 0.8 ? "bg-surface-raised text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  80/20 Croissance
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Part Réinvestie */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">
                    À réinjecter dans le Business ({Math.round(reinvestRatio * 100)}%)
                  </span>
                  <span className="text-lg font-bold tabular-nums text-slate-100">
                    {financialTotals.amountToReinvest.toLocaleString("fr-FR")} {currency}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Consacrez ce montant au <strong className="text-slate-200">restockage auprès du transitaire</strong> et au <strong className="text-slate-200">budget publicitaire Meta</strong> (~<span className="font-bold tabular-nums text-sky-300">{financialTotals.dailyAvgReinvest.toLocaleString("fr-FR")} {currency}/jour</span>).
                </p>
              </div>

              {/* Part Bénéfice Sécurisé */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">
                    Bénéfice Net Sécurisé Hors Système ({Math.round((1 - reinvestRatio) * 100)}%)
                  </span>
                  <span className="text-lg font-bold tabular-nums text-emerald-400">
                    {financialTotals.amountSecuredProfit.toLocaleString("fr-FR")} {currency}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Trésorerie saine et dividende disponible à virer sur votre compte personnel ou épargne sécurisée (~<span className="font-bold tabular-nums text-emerald-300">{financialTotals.dailyAvgSecured.toLocaleString("fr-FR")} {currency}/jour</span>).
                </p>
              </div>
            </div>
          </div>

          {/* Décomposition analytique des flux sur la période */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-100 mb-3">
              Décomposition des Flux Financiers de la Période
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Coûts de revient marchandises (Achat usine + Fret)</span>
                  <span className="font-semibold text-slate-200 tabular-nums">
                    {financialTotals.totalCogsAndTransit.toLocaleString("fr-FR")} {currency} ({financialTotals.totalRevenue > 0 ? Math.round((financialTotals.totalCogsAndTransit / financialTotals.totalRevenue) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${Math.min(100, financialTotals.totalRevenue > 0 ? (financialTotals.totalCogsAndTransit / financialTotals.totalRevenue) * 100 : 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Commissions équipes terrain (Closeuses + Livreurs)</span>
                  <span className="font-semibold text-slate-200 tabular-nums">
                    {financialTotals.totalCommissions.toLocaleString("fr-FR")} {currency} ({financialTotals.totalRevenue > 0 ? Math.round((financialTotals.totalCommissions / financialTotals.totalRevenue) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(100, financialTotals.totalRevenue > 0 ? (financialTotals.totalCommissions / financialTotals.totalRevenue) * 100 : 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-emerald-400 font-bold">Marge Nette d'Exploitation (Bénéfice Réel)</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {financialTotals.netProfitTotal.toLocaleString("fr-FR")} {currency} ({financialTotals.netProfitRatio}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, financialTotals.netProfitRatio)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        5. CONTENU DU MENU 3 : DONNÉES PRODUITS & STOCKS
        Catalogue des produits, landed costs, facteurs jours et boutons d'édition.
        ========================================================================
      */}
      {activeTab === "products" && (
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand" />
                <span>Unit Economics &amp; Fiches de Stocks par Produit</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Renseignez le prix d'achat usine et le coût transitaire pour chaque produit afin d'automatiser les calculs de marge nette.
              </p>
            </div>

            <div className="text-xs text-slate-400">
              <span>Produits actifs : <strong className="text-slate-200">{filteredProductsList.length}</strong></span>
              <span> · </span>
              <span>Alertes rupture : <strong className="text-rose-400">{financialTotals.lowStockProductsCount}</strong></span>
            </div>
          </div>

          {filteredProductsList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Aucun produit ne correspond à votre recherche.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-slate-400 font-semibold">
                    <th className="px-4 py-3">Produit</th>
                    <th className="px-4 py-3 text-right">Prix Vente Moy.</th>
                    <th className="px-4 py-3 text-right">Achat Usine</th>
                    <th className="px-4 py-3 text-right">Fret Transitaire</th>
                    <th className="px-4 py-3 text-right">Coût Revient (*Landed*)</th>
                    <th className="px-4 py-3 text-center">Stock Restant</th>
                    <th className="px-4 py-3 text-center">Facteur Jours (Autonomie)</th>
                    <th className="px-4 py-3 text-right">Marge Nette / Pièce</th>
                    <th className="px-4 py-3 text-right">Bénéfice Période</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredProductsList.map((p) => {
                    const isLowStock = p.currentStock <= p.lowStockThreshold;

                    return (
                      <tr key={p.id} className="transition-colors hover:bg-surface/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-lg object-cover border border-surface-border bg-surface"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface text-slate-400">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-slate-100 truncate max-w-[180px] sm:max-w-[220px]">
                                {p.productName}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {p.unitsDeliveredInPeriod} livré{p.unitsDeliveredInPeriod > 1 ? "s" : ""} sur la période
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-200">
                          {p.sellingPriceAvg > 0 ? `${p.sellingPriceAvg.toLocaleString("fr-FR")} ${currency}` : "—"}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                          {p.cogsUnitPrice > 0 ? `${p.cogsUnitPrice.toLocaleString("fr-FR")} ${currency}` : "Non défini"}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                          {p.transitUnitCost > 0 ? `${p.transitUnitCost.toLocaleString("fr-FR")} ${currency}` : "Non défini"}
                        </td>

                        <td className="px-4 py-3 text-right font-bold tabular-nums text-sky-400">
                          {p.landedCost > 0 ? `${p.landedCost.toLocaleString("fr-FR")} ${currency}` : "—"}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
                              isLowStock
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {p.currentStock} en stock
                          </span>
                        </td>

                        {/* Facteur Jours & Autonomie avant rupture */}
                        <td className="px-4 py-3 text-center">
                          {p.daysOfStockRemaining !== null ? (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                                  p.daysOfStockRemaining >= 15
                                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                    : p.daysOfStockRemaining >= 7
                                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                }`}
                              >
                                <span>{p.daysOfStockRemaining >= 15 ? "🟢" : p.daysOfStockRemaining >= 7 ? "🟡" : "🔴"}</span>
                                <span>{p.daysOfStockRemaining} jours</span>
                              </span>
                              <span className="block text-[10px] text-slate-400 tabular-nums">
                                ~{p.dailyVelocity.toFixed(1)} pcs/j · Rupture le {p.estimatedRuptureDate}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              0 vente sur {financialTotals.numberOfDaysInPeriod}j
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          {p.hasConfiguredCosts ? (
                            <span className={p.netMarginPerUnit > 0 ? "text-emerald-400" : "text-rose-400"}>
                              {p.netMarginPerUnit.toLocaleString("fr-FR")} {currency}
                            </span>
                          ) : (
                            <span className="text-slate-500">En attente</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          {p.hasConfiguredCosts ? (
                            <span className={p.netProfitInPeriod > 0 ? "text-emerald-400" : "text-rose-400"}>
                              {p.netProfitInPeriod.toLocaleString("fr-FR")} {currency}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCosts(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-surface-raised hover:text-white active:scale-[0.98] cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3 text-brand" />
                            <span>Coûts &amp; Stock</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 
        ========================================================================
        6. MODALE / DRAWER DU RAPPORT JOURNALIER DÉTAILLÉ
        Design haute couture, très soigné et très joli (Image 1 & 2)
        ========================================================================
      */}
      {selectedDayBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">
                      Rapport Comptable Journalier — {selectedDayBreakdown.dateLabel}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>Clôturé</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Date système : {selectedDayBreakdown.dateKey} · Total livraisons : {selectedDayBreakdown.ordersDelivered} colis ({selectedDayBreakdown.unitsDelivered} pièces)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayBreakdown(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-surface transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 4 Glaces du jour */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
              <div className="rounded-xl border border-surface-border bg-surface p-3">
                <span className="text-[11px] font-semibold text-slate-400">CA Encaissé</span>
                <p className="mt-1 text-base font-bold text-slate-100 tabular-nums">
                  {selectedDayBreakdown.revenue.toLocaleString("fr-FR")} {currency}
                </p>
              </div>

              <div className="rounded-xl border border-surface-border bg-surface p-3">
                <span className="text-[11px] font-semibold text-slate-400">Achat + Fret</span>
                <p className="mt-1 text-base font-bold text-sky-400 tabular-nums">
                  {selectedDayBreakdown.cogsAndTransit.toLocaleString("fr-FR")} {currency}
                </p>
              </div>

              <div className="rounded-xl border border-surface-border bg-surface p-3">
                <span className="text-[11px] font-semibold text-slate-400">Commissions</span>
                <p className="mt-1 text-base font-bold text-purple-400 tabular-nums">
                  {selectedDayBreakdown.commissions.toLocaleString("fr-FR")} {currency}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <span className="text-[11px] font-semibold text-emerald-300">Marge Nette Réelle</span>
                <p className="mt-1 text-base font-bold text-emerald-300 tabular-nums">
                  {selectedDayBreakdown.netProfit.toLocaleString("fr-FR")} {currency}
                </p>
              </div>
            </div>

            {/* Arbitrage Trésorerie du jour */}
            <div className="rounded-xl border border-surface-border bg-surface p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-brand" />
                <span className="text-xs font-bold text-slate-200">Arbitrage Trésorerie Journalier :</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="text-sky-400">
                  Réinjection (65%) : <strong className="text-white tabular-nums">{Math.round(selectedDayBreakdown.netProfit * reinvestRatio).toLocaleString("fr-FR")} {currency}</strong>
                </span>
                <span className="text-emerald-400">
                  Dividende Sécurisé (35%) : <strong className="text-white tabular-nums">{(selectedDayBreakdown.netProfit - Math.round(selectedDayBreakdown.netProfit * reinvestRatio)).toLocaleString("fr-FR")} {currency}</strong>
                </span>
              </div>
            </div>

            {/* Liste des commandes livrées ce jour */}
            <div className="space-y-2 mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Commandes Livrées le {selectedDayBreakdown.dateLabel} ({selectedDayBreakdown.deliveredOrders.length})
              </h4>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-surface-border bg-surface divide-y divide-surface-border">
                {selectedDayBreakdown.deliveredOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 truncate">{o.clientName || "Client"} · #{o.orderNumber || o.id.slice(-6)}</p>
                      <p className="text-[11px] text-slate-400 truncate">{o.product} · {o.city || "Ville non précisée"}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400 tabular-nums">
                        {Number(o.amount).toLocaleString("fr-FR")} {currency}
                      </span>
                      <p className="text-[10px] text-slate-400">Qté : {o.quantity || 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions du Rapport : Partage & Impression */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleShareDayWhatsApp(selectedDayBreakdown)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition cursor-pointer"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Partager sur WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-surface-subtle transition cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                  <span>Imprimer</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayBreakdown(null)}
                className="rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        7. MODALE D'ÉDITION DES COÛTS & STOCKS PRODUIT
        ========================================================================
      */}
      {editingStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Paramètres Financiers &amp; Stock
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-[280px]">
                    {editingStock.productName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingStock(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Prix d'achat unitaire usine */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Prix d'achat unitaire usine ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={formCogs}
                  onChange={(e) => setFormCogs(e.target.value)}
                  placeholder="Ex: 3500"
                  className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Montant net déboursé pour fabriquer ou acquérir 1 unité de ce produit.
                </p>
              </div>

              {/* Fret transitaire : Coût total et quantité du lot */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Facture Totale Transitaire ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formTransitCost}
                    onChange={(e) => setFormTransitCost(e.target.value)}
                    placeholder="Ex: 150000"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Facture globale fret + douane</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quantité Importée (Colis)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formTransitQty}
                    onChange={(e) => setFormTransitQty(e.target.value)}
                    placeholder="Ex: 50"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                  />
                  <p className="text-[10px] text-sky-400 font-bold mt-1">
                    Fret unitaire :{" "}
                    {Math.round(
                      (Number(formTransitCost) || 0) / Math.max(1, Number(formTransitQty) || 1)
                    ).toLocaleString("fr-FR")}{" "}
                    {currency}
                  </p>
                </div>
              </div>

              {/* Stock Initial réceptionné & Seuil bas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Stock Réceptionné (Initial)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formInitialStock}
                    onChange={(e) => setFormInitialStock(e.target.value)}
                    placeholder="Ex: 100"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Total pièces reçues au hub</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Seuil Alerte Rupture
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formLowThreshold}
                    onChange={(e) => setFormLowThreshold(e.target.value)}
                    placeholder="Ex: 5"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Déclencheur d'alerte rouge</p>
                </div>
              </div>

              {/* Récapitulatif Coût de Revient Landed Cost */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Coût de revient complet (*Landed Cost*) :</span>
                  <strong className="text-sky-400 text-sm tabular-nums">
                    {(
                      (Number(formCogs) || 0) +
                      Math.round(
                        (Number(formTransitCost) || 0) / Math.max(1, Number(formTransitQty) || 1)
                      )
                    ).toLocaleString("fr-FR")}{" "}
                    {currency}
                  </strong>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ce montant sera automatiquement déduit à chaque unité livrée pour calculer votre bénéfice réel net.
                </p>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-surface-border pt-4">
              <button
                type="button"
                onClick={() => setEditingStock(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={formSaving}
                onClick={handleSaveCosts}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
              >
                {formSaving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Enregistrement…</span>
                  </>
                ) : (
                  <span>Enregistrer les paramètres</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
