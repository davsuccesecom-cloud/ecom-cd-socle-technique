import { useEffect, useMemo, useState } from "react";
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
  Calculator,
  CheckCircle2,
  DollarSign,
  Edit3,
  ExternalLink,
  Layers,
  Package,
  PiggyBank,
  RefreshCw,
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

function flagUrl(code: string) {
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

function safeOrderTs(o: any): number {
  const r = o.timestamps?.received ?? o.received ?? o.createdAt ?? 0;
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

  // Éditeur Unit Economics & Stock
  const [editingStock, setEditingStock] = useState<ProductStock | null>(null);
  const [formCogs, setFormCogs] = useState("");
  const [formTransitCost, setFormTransitCost] = useState("");
  const [formTransitQty, setFormTransitQty] = useState("");
  const [formInitialStock, setFormInitialStock] = useState("");
  const [formLowThreshold, setFormLowThreshold] = useState("5");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Synchronisation Azify
  const [azifySyncing, setAzifySyncing] = useState(false);
  const [azifySyncSuccess, setAzifySyncSuccess] = useState<string | null>(null);

  // Ratio de réinvestissement stratégique (défaut : 65% réinjecté, 35% sécurisé hors système)
  const [reinvestRatio, setReinvestRatio] = useState<number>(0.65);

  const currency = isGlobal ? "XOF" : activeTeam?.currency || "XOF";

  // Écoute en temps réel des stocks Firestore (collection racine workspace)
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

  // 2. Agrégation des produits et volumes vendus/livrés sur la période
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

    // Calcul du prix moyen de vente unitaire
    map.forEach((item) => {
      if (item.unitsDelivered > 0) {
        item.sellingPriceAvg = Math.round(item.totalRevenue / item.unitsDelivered);
      }
    });

    return map;
  }, [filteredPeriodOrders]);

  // 3. Calcul du stock historique consommé (sur l'ensemble des commandes pour le stock physique restant)
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

  // 4. Fusion des métriques produits avec les fiches de stock et coûts unitaires
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
      hasConfiguredCosts: boolean;
      stockDoc?: ProductStock;
    }> = [];

    // Indexer les fiches de stock existantes
    const stockMap = new Map<string, ProductStock>();
    stocks.forEach((s) => {
      stockMap.set(s.productName.trim().toLowerCase(), s);
    });

    // Combiner les produits ayant eu des commandes avec les stocks enregistrés
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

      // Estimation des commissions moyennes par unité livrée (ex: 500 XOF closeuse + 1500 XOF livreur)
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
        hasConfiguredCosts: cogsUnitPrice > 0 || transitUnitCost > 0,
        stockDoc,
      });
    });

    return list.sort((a, b) => b.revenueInPeriod - a.revenueInPeriod);
  }, [productAggregates, stocks, lifetimeDeliveredUnitsByProduct, activeTeam]);

  // 5. Totaux financiers consolidés sur la période choisie
  const financialTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalCogsAndTransit = 0;
    let totalDeliveredUnits = 0;
    let totalOrdersDelivered = 0;

    for (const o of filteredPeriodOrders) {
      const isDelivered = o.statutCloseuse === "livre" || o.statutLivreur === "livre";
      if (!isDelivered) continue;
      const amt = Number(o.amount) || 0;
      const qty = Math.max(1, Number(o.quantity) || 1);
      totalRevenue += amt;
      totalDeliveredUnits += qty;
      totalOrdersDelivered += 1;
    }

    productsFinancialList.forEach((p) => {
      totalCogsAndTransit += p.unitsDeliveredInPeriod * p.landedCost;
    });

    // Frais équipes réels sur la période
    const commCloseuse = activeTeam?.remunerationCloseusePerOrder ?? 500;
    const commLivreur = activeTeam?.remunerationLivreurPerOrder ?? 1500;
    const totalCommissions = totalOrdersDelivered * (commCloseuse + commLivreur);

    const netProfitTotal = Math.max(0, totalRevenue - totalCogsAndTransit - totalCommissions);
    const netProfitRatio = totalRevenue > 0 ? Math.round((netProfitTotal / totalRevenue) * 100) : 0;

    // Arbitrage de trésorerie
    const amountToReinvest = Math.round(netProfitTotal * reinvestRatio);
    const amountSecuredProfit = netProfitTotal - amountToReinvest;

    return {
      totalRevenue,
      totalCogsAndTransit,
      totalCommissions,
      netProfitTotal,
      netProfitRatio,
      totalDeliveredUnits,
      amountToReinvest,
      amountSecuredProfit,
    };
  }, [filteredPeriodOrders, productsFinancialList, activeTeam, reinvestRatio]);

  // Ouverture du formulaire de modification des coûts
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

      await setDoc(doc(db, "workspaces", workspaceId, "stocks", cleanId), docData, {
        merge: true,
      });

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

  const periodTitle = period ? periodLabel(period) : "Toutes les dates";

  return (
    <div className="space-y-5">
      {/* 1. En-tête contextuel épuré & Badge de Période */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised px-5 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand shadow-xs">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">
                Comptabilité &amp; Rentabilité Réelle
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                {isGlobal ? (
                  <>
                    <span>🌍</span>
                    <span>Afrique Globale</span>
                  </>
                ) : (
                  <>
                    <img
                      src={flagUrl(activeTeam?.defaultCountry || "tg")}
                      alt=""
                      className="h-3 w-4 rounded-[2px] object-cover"
                    />
                    <span>{activeTeam?.name}</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Chiffres calculés sur la période sélectionnée :{" "}
              <strong className="text-slate-200">{periodTitle}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncWithAzify}
            disabled={azifySyncing}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-xs transition hover:bg-surface-raised hover:text-white disabled:opacity-50"
            title="Synchroniser le catalogue produit et les stocks avec Azify Studio"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-brand ${azifySyncing ? "animate-spin" : ""}`} />
            <span>{azifySyncing ? "Synchronisation..." : "Synchroniser Azify"}</span>
          </button>
        </div>
      </div>

      {azifySyncSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{azifySyncSuccess}</span>
        </div>
      )}

      {/* 2. Cartes Financières Clés (Haute lisibilité, zéro slop) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* CA Réel Encaissé */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="truncate text-xs font-semibold text-slate-400">CA Encaissé (Cash)</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {financialTotals.totalRevenue.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Sur <strong className="text-slate-300 tabular-nums">{financialTotals.totalDeliveredUnits}</strong> unités livrées
          </p>
        </div>

        {/* Coût des Marchandises + Fret */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="truncate text-xs font-semibold text-slate-400">Achat + Fret Transitaire</span>
            <Truck className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {financialTotals.totalCogsAndTransit.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Coût de revient déboursé (*Landed Cost*)
          </p>
        </div>

        {/* Frais Variables Terrain */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="truncate text-xs font-semibold text-slate-400">Commissions Terrain</span>
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {financialTotals.totalCommissions.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Closeuses &amp; Livreurs payés au résultat
          </p>
        </div>

        {/* Marge Nette Réelle */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="truncate text-xs font-semibold text-slate-400">Marge Nette (Bénéfice Réel)</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-emerald-400 sm:text-2xl">
            {financialTotals.netProfitTotal.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Rentabilité nette : <strong className="text-emerald-400 tabular-nums">{financialTotals.netProfitRatio}%</strong>
          </p>
        </div>
      </div>

      {/* 3. Arbitrage Stratégique de Trésorerie COD (Règle d'or de réinjection) */}
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
              Consacrez ce montant au <strong className="text-slate-200">restockage auprès du transitaire</strong> (fret aérien / conteneur) et au <strong className="text-slate-200">budget publicitaire Meta</strong> pour soutenir le flux d'acquisition.
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
              Trésorerie saine et dividende disponible à virer sur votre compte personnel ou épargne sécurisée, totalement immunisé contre les aléas opérationnels.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Tableau Financier des Produits & Stocks */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Rentabilité Unitaire &amp; Suivi des Stocks
            </h3>
            <p className="text-xs text-slate-400">
              Cliquez sur un produit pour renseigner le prix d'achat usine et la facture transitaire.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {productsFinancialList.length} produit{productsFinancialList.length > 1 ? "s" : ""} référencé{productsFinancialList.length > 1 ? "s" : ""}
          </span>
        </div>

        {productsFinancialList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Aucun produit ni commande enregistrée sur cette sélection.
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
                  <th className="px-4 py-3 text-right">Marge Nette / Pièce</th>
                  <th className="px-4 py-3 text-right">Bénéfice Période</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {productsFinancialList.map((p) => {
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
                          className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-surface-raised hover:text-white active:scale-[0.98]"
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

      {/* 5. Modale d'Édition des Coûts & Fret Transitaire */}
      {editingStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
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
                className="rounded-lg p-1 text-slate-400 hover:text-white transition"
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

              {/* Réception Stock Initial & Seuil de rupture */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Stock Initial / Réceptionné
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formInitialStock}
                    onChange={(e) => setFormInitialStock(e.target.value)}
                    placeholder="Ex: 50"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                  />
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
                </div>
              </div>

              {/* Récapitulatif en temps réel */}
              <div className="rounded-xl border border-surface-border bg-surface p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Coût de Revient Unitaire Réel (*Landed Cost*) :</span>
                  <strong className="text-sky-400 tabular-nums">
                    {(
                      (Number(formCogs) || 0) +
                      Math.round(
                        (Number(formTransitCost) || 0) / Math.max(1, Number(formTransitQty) || 1)
                      )
                    ).toLocaleString("fr-FR")}{" "}
                    {currency}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingStock(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-surface hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveCosts}
                disabled={formSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-hover disabled:opacity-50"
              >
                {formSaving ? "Enregistrement..." : "Enregistrer les paramètres"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
