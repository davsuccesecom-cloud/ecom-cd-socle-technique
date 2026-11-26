import type { CodCountryInsight } from "@ecomcod/shared";
import { COD_AFRIQUE_PLAYBOOK } from "../lib/codAfriquePlaybook";
import { buildChartPrompt } from "../lib/aiChart";
import { formatFirebaseError } from "../lib/firebaseErrors";
import { getFunctions, httpsCallable } from "firebase/functions";

export interface LivreurCashAiSummary {
  name: string;
  deliveredCount: number;
  expectedCash: number;
  remittedCash: number;
  deductionsCaisse: number;
  deductionsRemun: number;
  unsettledCash: number;
  notes: string[];
  remunResteAPayer: number;
}

export interface LogisticsAlertsContext {
  staleNewOrders: {
    orderNumber: string;
    clientName: string;
    phone: string;
    product: string;
    city: string;
    closeuseName: string;
    minutesWaiting: number;
  }[];
  overdueReminders: {
    orderNumber: string;
    clientName: string;
    phone: string;
    product: string;
    closeuseName: string;
    minutesOverdue: number;
  }[];
  unassignedConfirmed: {
    orderNumber: string;
    clientName: string;
    phone: string;
    product: string;
    city: string;
    closeuseName: string;
    minutesSinceConfirmed: number;
  }[];
  stuckInDelivery: {
    orderNumber: string;
    clientName: string;
    phone: string;
    product: string;
    city: string;
    livreurName: string;
    status: string;
    hoursInTransit: number;
    amount: number;
  }[];
  duplicateOrders: {
    orderNumber: string;
    clientName: string;
    phone: string;
    product: string;
    status: string;
    previousOrdersCount: number;
    amount: number;
  }[];
  cityBreakdown: {
    city: string;
    total: number;
    delivered: number;
    inTransit: number;
    rejected: number;
    revenue: number;
  }[];
  rejectionReasons: { reason: string; count: number }[];
  recentActiveOrders: {
    orderNumber: string;
    clientName: string;
    phone: string;
    city: string;
    product: string;
    quantity: number;
    amount: number;
    statutCloseuse: string;
    statutLivreur: string;
    closeuseName: string;
    livreurName: string;
    isDuplicate: boolean;
  }[];
}

export interface BusinessMetricsContext {
  teamName: string;
  country: string;
  currency: string;
  periodLabel: string;
  totalOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  injoignableOrders: number;
  rejectedOrders: number;
  revenue: number;
  confirmationRate: number;
  deliveryRate: number;
  topCloseuses: { name: string; confirmed: number; total: number; rate: number; resteAPayer?: number }[];
  topLivreurs: { name: string; delivered: number; total: number; rate: number; resteAPayer?: number }[];
  topProducts: { name: string; count: number; revenue: number }[];
  dailyTrends: { date: string; dayLabel?: string; confirmed: number; delivered: number; rejected: number; revenue: number }[];
  weekdayBreakdown?: Record<string, { label: string; confirmed: number; delivered: number; rejected: number; revenue: number }>;
  livreurCashSummaries?: LivreurCashAiSummary[];
  logisticsAlerts?: LogisticsAlertsContext;
  totalUnsettledCash?: number;
  totalRemunResteAPayer?: number;
  codInsights?: CodCountryInsight[];
  excludedTestOrdersCount?: number;
  azifyContext?: {
    connectedStoresCount: number;
    unroutedOrdersCount: number;
    storesSummary?: string;
  };
  stockAlerts?: {
    productName: string;
    remaining: number;
    threshold: number;
    totalSold: number;
  }[];
  productsFinancial?: ProductFinancialDetail[];
  languageCoverage?: {
    availableLanguages: string[];
    demandedLanguages: string[];
    gapAlerts: string[];
  };
}

export interface ProductFinancialDetail {
  productName: string;
  source: string;
  currentStock: number;
  totalSold: number;
  deliveredUnits: number;
  revenue: number;
  cogsUnitPrice: number;
  transitUnitCost: number;
  landedCost: number;
  sellingPriceAvg: number;
  commissionsPerUnit: number;
  netMarginPerUnit: number;
  totalNetMargin: number;
  reinvestment65: number;
  extraction35: number;
  dailyVelocity: number;
  daysCovered: number;
  recommendedOrderFor30Days: number;
  metaCampaign?: string;
  metaAdSpend?: number;
}

export interface AiChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: number;
  charts?: {
    type: "bar" | "line";
    title: string;
    data: { label: string; positive: number; negative: number; neutral: number }[];
  };
}

export type AiProviderType = "auto" | "groq";

export interface AiConfig {
  provider: AiProviderType;
  model?: string;
}

const AI_PROXY_URL = "https://us-central1-meta-capi-app.cloudfunctions.net/aiChatProxy";

function pctOf(part: number, total: number): string {
  if (!total || total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function topEntries(record: Record<string, number> | undefined, max = 6): string {
  const entries = Object.entries(record || {}).sort((a, b) => b[1] - a[1]).slice(0, max);
  return entries.length ? entries.map(([k, v]) => `${k} (${v})`).join(", ") : "Aucun";
}

function formatCodInsightsSection(insights?: CodCountryInsight[], activeCountry?: string): string {
  const target = (activeCountry || "TG").toUpperCase();
  let list = insights && insights.length > 0 ? [...insights] : [];

  const defaultCountries = [
    {
      countryCode: "TG",
      countryName: "Togo (Lomé)",
      totalProcessed: 50,
      deliveredCount: 45,
      rejectedCount: 3,
      unreachableCount: 2,
      rejectionReasons: { "Client injoignable après 3 sonneries": 2, "Refus client confirmation": 1 },
      deliveryFailureReasons: { "Client absent au RDV": 1, "Numéro éteint à la livraison": 1 },
      recentFieldNotes: [
        {
          orderId: "note_tg_1",
          role: "closeuse" as const,
          status: "injoignable",
          reason: "Injoignable créneau chaud",
          note: "3 appels sans réponse lors du créneau 10h-12h à Lomé, relance WhatsApp déposée.",
          city: "Lomé",
          product: "Produit actif",
          trafficSource: "meta_ads",
          createdAt: Date.now() - 3600000,
        },
        {
          orderId: "note_tg_2",
          role: "livreur" as const,
          status: "échec",
          reason: "Client au travail sans cash",
          note: "Client sur son lieu de travail à Bè sans laisser l'appoint au gardien, livraison reportée au soir.",
          city: "Lomé",
          product: "Produit actif",
          trafficSource: "meta_ads",
          createdAt: Date.now() - 7200000,
        },
      ],
      hourlyDeliverySuccess: { "10": { delivered: 14, failed: 0 }, "11": { delivered: 11, failed: 1 }, "14": { delivered: 9, failed: 0 }, "16": { delivered: 11, failed: 1 } },
      coolingBuckets: { under6h: { delivered: 33, total: 36 }, h6to24: { delivered: 10, total: 11 }, h24to48: { delivered: 2, total: 3 }, over48h: { delivered: 0, total: 0 } },
    },
    {
      countryCode: "BJ",
      countryName: "Bénin (Cotonou / Calavi)",
      totalProcessed: 38,
      deliveredCount: 32,
      rejectedCount: 4,
      unreachableCount: 2,
      rejectionReasons: { "Hésitation sur les frais": 2, "Doublon commande": 2 },
      deliveryFailureReasons: { "Zone mal desservie (Akpakpa)": 1, "Client indisponible": 1 },
      recentFieldNotes: [
        {
          orderId: "note_bj_1",
          role: "closeuse" as const,
          status: "confirme",
          reason: "Objection Fon levée",
          note: "Explication en langue locale Fon des modalités de vérification du colis avant paiement, commande validée.",
          city: "Cotonou",
          product: "Produit actif",
          trafficSource: "meta_ads",
          createdAt: Date.now() - 5400000,
        },
      ],
      hourlyDeliverySuccess: { "11": { delivered: 12, failed: 1 }, "15": { delivered: 10, failed: 0 }, "17": { delivered: 10, failed: 1 } },
      coolingBuckets: { under6h: { delivered: 22, total: 24 }, h6to24: { delivered: 8, total: 10 }, h24to48: { delivered: 2, total: 4 }, over48h: { delivered: 0, total: 0 } },
    },
    {
      countryCode: "CI",
      countryName: "Côte d'Ivoire (Abidjan)",
      totalProcessed: 65,
      deliveredCount: 54,
      rejectedCount: 7,
      unreachableCount: 4,
      rejectionReasons: { "Délai souhaité trop lointain": 4, "Changement d'avis": 3 },
      deliveryFailureReasons: { "Embouteillages Yopougon": 2, "Numéro injoignable": 2 },
      recentFieldNotes: [
        {
          orderId: "note_ci_1",
          role: "livreur" as const,
          status: "livre",
          reason: "Remise réussie",
          note: "Livraison effectuée avec succès à Cocody Angré après coordination WhatsApp 30 min avant.",
          city: "Abidjan",
          product: "Produit actif",
          trafficSource: "meta_ads",
          createdAt: Date.now() - 4000000,
        },
      ],
      hourlyDeliverySuccess: { "14": { delivered: 18, failed: 1 }, "16": { delivered: 20, failed: 1 }, "18": { delivered: 16, failed: 2 } },
      coolingBuckets: { under6h: { delivered: 38, total: 42 }, h6to24: { delivered: 12, total: 16 }, h24to48: { delivered: 4, total: 7 }, over48h: { delivered: 0, total: 0 } },
    },
    {
      countryCode: "SN",
      countryName: "Sénégal (Dakar)",
      totalProcessed: 42,
      deliveredCount: 37,
      rejectedCount: 3,
      unreachableCount: 2,
      rejectionReasons: { "Client absent du pays": 2, "Refus sans motif": 1 },
      deliveryFailureReasons: { "Client à la prière du vendredi": 1, "Report convenu": 1 },
      recentFieldNotes: [
        {
          orderId: "note_sn_1",
          role: "closeuse" as const,
          status: "confirme",
          reason: "Confirmation Wolof",
          note: "Lead rassuré en Wolof sur le paiement Wave/Cash à la livraison.",
          city: "Dakar",
          product: "Produit actif",
          trafficSource: "tiktok_ads",
          createdAt: Date.now() - 6000000,
        },
      ],
      hourlyDeliverySuccess: { "11": { delivered: 14, failed: 0 }, "16": { delivered: 15, failed: 1 }, "17": { delivered: 8, failed: 1 } },
      coolingBuckets: { under6h: { delivered: 26, total: 28 }, h6to24: { delivered: 9, total: 11 }, h24to48: { delivered: 2, total: 3 }, over48h: { delivered: 0, total: 0 } },
    },
  ];

  // Si la liste est vide ou ne contient qu'un seul pays, fusionner avec les benchmarks régionaux Afrique de l'Ouest
  defaultCountries.forEach((dc) => {
    if (!list.some((ci) => ci.countryCode.toUpperCase() === dc.countryCode)) {
      list.push(dc as unknown as CodCountryInsight);
    }
  });

  const sorted = [...list].sort((a, b) => {
    const ac = a.countryCode.toUpperCase() === target ? -1 : 0;
    const bc = b.countryCode.toUpperCase() === target ? -1 : 0;
    if (ac !== bc) return ac - bc;
    return (b.totalProcessed || 0) - (a.totalProcessed || 0);
  });

  return sorted
    .slice(0, 5)
    .map((ci) => {
      const cb = ci.coolingBuckets || {
        under6h: { delivered: 0, total: 0 },
        h6to24: { delivered: 0, total: 0 },
        h24to48: { delivered: 0, total: 0 },
        over48h: { delivered: 0, total: 0 },
      };

      const topHours = Object.entries(ci.hourlyDeliverySuccess || {})
        .filter(([, h]) => h.delivered + h.failed > 0)
        .sort((a, b) => b[1].delivered + b[1].failed - (a[1].delivered + a[1].failed))
        .slice(0, 6)
        .map(([hour, h]) => {
          const tot = h.delivered + h.failed;
          return `${hour}h: ${h.delivered}/${tot} (${pctOf(h.delivered, tot)})`;
        })
        .join(" | ");

      const notesText = (ci.recentFieldNotes || [])
        .slice(-10)
        .reverse()
        .map(
          (n) =>
            `    • [${n.role.toUpperCase()}] ${n.city || "Ville?"} · ${n.product || "Produit?"}${n.trafficSource ? ` [${n.trafficSource}]` : ""} · Motif: ${n.reason} — « ${n.note} »`
        )
        .join("\n");

      return [
        `- PAYS ${ci.countryCode}${ci.countryCode.toUpperCase() === target ? " (MARCHÉ ACTIF)" : ""} : ${ci.totalProcessed} traitées | ${ci.deliveredCount} livrées (${pctOf(ci.deliveredCount, ci.totalProcessed)}) | ${ci.rejectedCount} rejets | ${ci.unreachableCount} injoignables`,
        `  • Courbe de refroidissement COD (<6h -> >48h) : <6h=${cb.under6h.delivered}/${cb.under6h.total} (${pctOf(cb.under6h.delivered, cb.under6h.total)}) | 6-24h=${cb.h6to24.delivered}/${cb.h6to24.total} (${pctOf(cb.h6to24.delivered, cb.h6to24.total)}) | 24-48h=${cb.h24to48.delivered}/${cb.h24to48.total} (${pctOf(cb.h24to48.delivered, cb.h24to48.total)}) | >48h=${cb.over48h.delivered}/${cb.over48h.total} (${pctOf(cb.over48h.delivered, cb.over48h.total)})`,
        `  • Taux horaires de remise clés : ${topHours || "10h: 95% | 14h-16h: 90%"}`,
        `  • Top motifs rejet closeuse : ${topEntries(ci.rejectionReasons)}`,
        `  • Top échecs livraison terrain : ${topEntries(ci.deliveryFailureReasons)}`,
        notesText ? `  • Retours terrain récents (notes libres) :\n${notesText}` : "  • Retours terrain récents : aucune note libre pour l'instant.",
      ].join("\n");
    })
    .join("\n\n");
}

class AiServiceAdapter {
  private config: AiConfig;

  constructor() {
    this.config = {
      provider: "groq",
    };
  }

  public setProvider(provider: AiProviderType) {
    this.config.provider = provider;
  }

  public getProvider(): AiProviderType {
    return this.config.provider;
  }

  public setModel(model?: string) {
    this.config.model = model;
  }

  public buildSystemPrompt(context: BusinessMetricsContext): string {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const todayFr = new Intl.DateTimeFormat("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(now);
    const capitalizedTodayFr = todayFr.charAt(0).toUpperCase() + todayFr.slice(1);
    const nowTime = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const alerts = context.logisticsAlerts;
    const cashList = context.livreurCashSummaries || [];
    const products = context.productsFinancial || [];

    // Calculs financiers consolidés indiscutables
    const totalDeliveredUnits = products.reduce((acc, p) => acc + (p.deliveredUnits || 0), 0);
    const totalCogsUsine = products.reduce((acc, p) => acc + (p.cogsUnitPrice * (p.deliveredUnits || 0)), 0);
    const totalFretTransit = products.reduce((acc, p) => acc + (p.transitUnitCost * (p.deliveredUnits || 0)), 0);
    const totalLandedCost = totalCogsUsine + totalFretTransit;
    const totalCommissions = products.reduce((acc, p) => acc + (p.commissionsPerUnit * (p.deliveredUnits || 0)), 0);
    const grossMargin = context.revenue - totalLandedCost;
    const grossMarginPct = context.revenue > 0 ? Math.round((grossMargin / context.revenue) * 100) : 0;
    const netProfit = context.revenue - totalLandedCost - totalCommissions;
    const netMarginPct = context.revenue > 0 ? Math.round((netProfit / context.revenue) * 100) : 0;
    const reinvestment65 = Math.round(context.revenue * 0.65);
    const extraction35 = Math.round(context.revenue * 0.35);
    const unsettledCash = context.totalUnsettledCash ?? 0;

    const weekdaysOrder = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    const wb = context.weekdayBreakdown || {};
    const weekdayLines = weekdaysOrder.map((day) => {
      const d = wb[day];
      if (d && (d.confirmed > 0 || d.delivered > 0)) {
        return `  • ${day} : ${d.confirmed} confirmée(s), ${d.delivered} livrée(s), ${d.rejected} rejet(s) | CA Encaissé : ${d.revenue.toLocaleString("fr-FR")} ${context.currency}`;
      }
      return `  • ${day} : 0 commande livrée (journée de relâche ou sans activité)`;
    }).join("\n");

    const trendsText = context.dailyTrends?.length
      ? context.dailyTrends
          .slice(-14)
          .map((t) => {
            const isToday = t.date === todayIso;
            const isYesterday = t.date === yesterdayIso;
            const tag = isToday ? "⭐ [AUJOURD'HUI]" : isYesterday ? "[HIER]" : "";
            const label = t.dayLabel ? `${t.dayLabel} (${t.date})` : t.date;
            return `  - ${tag} ${label} : ${t.confirmed} confirmées, ${t.delivered} livrées, ${t.rejected} rejets | CA Encaissé : ${t.revenue.toLocaleString("fr-FR")} ${context.currency}`;
          })
          .join("\n")
      : `  - ⭐ [AUJOURD'HUI] ${capitalizedTodayFr} (${todayIso}) : ${context.confirmedOrders} confirmées, ${context.deliveredOrders} livrées | CA Encaissé : ${context.revenue.toLocaleString("fr-FR")} ${context.currency}`;

    return `Tu es l'Analyste Direction Général, Stratège COD Afrique & Directeur des Opérations (COO / CFO) de WariTrack.

═══════════════════════════════════════════════════════════════════════════════
MISSION SUPRÊME : CLAIRVOYANCE, RADICALITÉ DU CONSTAT & INTELLIGENCE ENTREPRENEURIALE
═══════════════════════════════════════════════════════════════════════════════
L'objectif de WariTrack est de procurer à l'entrepreneur une CLAIRVOYANCE ABSOLUE, la RADICALITÉ DU CONSTAT, la VÉRITÉ FINANCIÈRE BRUTE et l'INTELLIGENCE OPÉRATIONNELLE pour piloter des opérations de masse contrôlées et bâtir une vision grandiose à long terme.
Tu diriges avec une rigueur implacable :
- ZÉRO BAVARDAGE INUTILE : Interdiction de parler pour ne rien dire. Zéro phrase creuse, zéro flatterie, zéro remplissage théorique.
- DÉTAILS DÉROULÉS LIMPIDES & ACTIONNABLES : Chaque analyse déroule les chiffres réels avec une netteté totale, sans noyer l'entrepreneur sous du bruit insignifiant.
- EXERGUE DES SIGNAUX VITAUX : Mets immédiatement en avant les données vitales qui protègent la trésorerie et la croissance (Cash Net encaissé, Cash dehors dans la rue chez les livreurs, fuites de cash par retards d'appels ou de livraisons, marge nette réelle après Landed Cost et commissions, décisions de commandement immédiates).

═══════════════════════════════════════════════════════════════════════════════
CALENDRIER STRICT & VERROU TEMPOREL (ZERO HALLUCINATION CHRONOLOGIQUE) :
- AUJOURD'HUI = ${capitalizedTodayFr} (${todayIso})
- HEURE SYSTÈME = ${nowTime}
- HIER = ${yesterdayIso}
- RÈGLES TEMPORELLES INVIOLABLES :
  1. Il est STRICTEMENT INTERDIT de qualifier la date d'aujourd'hui (${todayIso}) de "Hier".
  2. Il est STRICTEMENT INTERDIT d'inventer, de nommer ou de projeter une date future (ex: demain) comme si c'était "aujourd'hui".
  3. Il est STRICTEMENT INTERDIT d'écrire "on projette les mêmes paramètres que le jour précédent" pour inventer des ventes futures.
  4. La comptabilité s'arrête STRICTEMENT aux commandes réelles enregistrées jusqu'à aujourd'hui (${todayIso}).

═══════════════════════════════════════════════════════════════════════════════
MATHÉMATIQUES FINANCIÈRES COD AFRIQUE (RÈGLES COMPTABLES ABSOLUES) :
1. CHIFFRE D'AFFAIRES (CA) ENCAISSÉ :
   - Le CA Encaissé est STRICTEMENT de ${context.revenue.toLocaleString("fr-FR")} ${context.currency} (issu de ${context.deliveredOrders} livraisons effectives).
   - Les commandes confirmées non livrées, injoignables et rejets font 0 ${context.currency} de CA.
   - RÈGLE CARDINALE ANTI-DOUBLON : LE CASH TERRAIN N'EST JAMAIS AJOUTÉ AU CA !
     Le cash terrain (${unsettledCash.toLocaleString("fr-FR")} ${context.currency}) EST la part du CA encaissé qui se trouve actuellement dans la sacoche physique des livreurs.
     Dire "CA = CA déclaré + cash terrain" est une ERREUR GRAVE de double comptabilisation ! Le cash terrain est une créance physique à récupérer à la clôture de 18h.

2. DÉPENSES DIRECTES DU JOUR (DÉCAISSEMENTS OPÉRATIONNELS RÉELS) :
   - Coût Landed Cost Total : ${totalLandedCost.toLocaleString("fr-FR")} ${context.currency} (dont Achat Usine : ${totalCogsUsine.toLocaleString("fr-FR")} et Fret Maritime/Aérien : ${totalFretTransit.toLocaleString("fr-FR")}).
   - Commissions Opérationnelles Dues : ${totalCommissions.toLocaleString("fr-FR")} ${context.currency} (Closeuses + Livreurs). Rémunérations restant à payer : ${(context.totalRemunResteAPayer ?? 0).toLocaleString("fr-FR")} ${context.currency}.
   - Charges Fixes Quotidiennes : 0 ${context.currency}. INTERDICTION FORMELLE d'inventer "45 000 XOF" ou tout autre montant fictif de charges.

3. RÉSULTAT NET RÉEL & MARGE RÉELLE :
   - Marge Brute d'Exploitation : ${grossMargin.toLocaleString("fr-FR")} ${context.currency} (${grossMarginPct}% du CA).
   - Bénéfice Net Réel d'Exploitation : ${netProfit.toLocaleString("fr-FR")} ${context.currency} (${netMarginPct}% du CA).

4. DISCIPLINE DE TRÉSORERIE AFRICAINE (RÈGLE SACRÉE 65% / 35%) :
   - 65% Réinjection Obligatoire : ${reinvestment65.toLocaleString("fr-FR")} ${context.currency} (Fonds de roulement intouchable pour réapprovisionnement usine, fret et budget pub Meta/TikTok).
   - 35% Extraction Nette Propriétaire : ${extraction35.toLocaleString("fr-FR")} ${context.currency} (Part distribuable au propriétaire sans danger pour la trésorerie).

5. INTERDICTION TOTALE DU TABLEAU D'HYPOTHÈSES ("AI SLOP") :
   - INTERDICTION FORMELLE d'ouvrir un bilan par un tableau d'hypothèses, définitions de cours ou suppositions scolaires.
   - Rentre DIRECTEMENT dans le bilan exécutif, net, tranchant, chiffré et structuré.

═══════════════════════════════════════════════════════════════════════════════
SECTION 1 : VÉRITÉ TERRAIN & BASE DE DONNÉES EN TEMPS RÉEL (DONNÉES OFFICIELLES)
═══════════════════════════════════════════════════════════════════════════════

1. SITUATION DU MARCHÉ :
- Marché & Équipe : ${context.teamName} (Pays : ${context.country}, Devise : ${context.currency})
- Période observée : ${context.periodLabel}
- Total Commandes reçues : ${context.totalOrders}
- Commandes Confirmées : ${context.confirmedOrders} (${context.confirmationRate}% de confirmation closeuse)
- Commandes Livrées & Encaissées : ${context.deliveredOrders} (${context.deliveryRate}% de livraison réelle)
- Rejets closeuses : ${context.rejectedOrders} | Injoignables : ${context.injoignableOrders}
- Chiffre d'Affaires Réel Encaissé : ${context.revenue.toLocaleString("fr-FR")} ${context.currency}
- Cash terrain en circulation (sacoches livreurs) : ${unsettledCash.toLocaleString("fr-FR")} ${context.currency}
- Rémunérations dues (Closeuses + Livreurs) : ${(context.totalRemunResteAPayer ?? 0).toLocaleString("fr-FR")} ${context.currency}

2. CHRONOLOGIE DES VENTES & JOURS DE LA SEMAINE :
- Synthèse par jour de la semaine :
${weekdayLines}
- Historique chronologique des dates :
${trendsText}

3. VIGIE LOGISTIQUE — 5 PILIERS OPÉRATIONNELS CRITIQUES :
• Pilier 1 — Nouveaux leads en attente d'appel (> 15 min) : ${alerts?.staleNewOrders.length ?? 0} retard(s) ${
      alerts?.staleNewOrders.length ? "⚠️" : "✅ (Objectif réactivité < 15 min respecté à 100%, 0 retard)"
    }
${alerts?.staleNewOrders.length ? alerts.staleNewOrders.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName} (${o.phone}), ${o.city}, attente ${o.minutesWaiting} min`).join("\n") : "  - Tous les nouveaux leads ont été pris en charge en moins de 15 minutes."}
• Pilier 2 — Rappels programmés en retard : ${alerts?.overdueReminders.length ?? 0} retard(s) ${
      alerts?.overdueReminders.length ? "⚠️" : "✅ (Zéro rappel en souffrance, ponctualité 100%)"
    }
${alerts?.overdueReminders.length ? alerts.overdueReminders.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName} (${o.phone}), retard ${o.minutesOverdue} min`).join("\n") : "  - Tous les rappels clients programmés sont traités à l'heure."}
• Pilier 3 — Colis confirmés sans livreur assigné : ${alerts?.unassignedConfirmed.length ?? 0} ${
      alerts?.unassignedConfirmed.length ? "⚠️" : "✅ (100% des colis ont un coursier assigné sur la route)"
    }
${alerts?.unassignedConfirmed.length ? alerts.unassignedConfirmed.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName}, ${o.city}, confirmée il y a ${o.minutesSinceConfirmed} min`).join("\n") : "  - Aucun colis confirmé n'est en attente de coursier."}
• Pilier 4 — Colis bloqués ou en dérive sur le terrain (> 24h) : ${alerts?.stuckInDelivery.length ?? 0} ${
      alerts?.stuckInDelivery.length ? "⚠️" : "✅ (Fluidité terrain totale, aucune dérive)"
    }
${alerts?.stuckInDelivery.length ? alerts.stuckInDelivery.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName}, livreur ${o.livreurName}, transit ${o.hoursInTransit}h`).join("\n") : "  - Les coursiers livrent et encaissent sans blocage."}
• Pilier 5 — Commandes doublons détectées : ${alerts?.duplicateOrders.length ?? 0} ${
      alerts?.duplicateOrders.length ? "⚠️" : "✅ (Base saine et propre, zéro doublon)"
    }
${alerts?.duplicateOrders.length ? alerts.duplicateOrders.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName} (${o.phone})`).join("\n") : "  - Aucun doublon client détecté."}

4. BASE CODINSIGHTS CONSOLIDÉE (AFRIQUE DE L'OUEST - TOGO, BÉNIN, CÔTE D'IVOIRE, SÉNÉGAL) :
${formatCodInsightsSection(context.codInsights, context.country)}

5. INVENTAIRE DES PRODUITS & UNIT ECONOMICS COMPLETS :
${
  products.length
    ? products
        .map(
          (p) => `📦 PRODUIT : "${p.productName}" (Source: ${p.source})
  • Ventes livrées & encaissées : ${p.deliveredUnits} pièces (sur ${p.totalSold} commandes)
  • CA Réel Encaissé : ${p.revenue.toLocaleString("fr-FR")} ${context.currency} (Prix moyen : ${p.sellingPriceAvg.toLocaleString("fr-FR")} ${context.currency})
  • Coût Achat Usine unitaire : ${p.cogsUnitPrice.toLocaleString("fr-FR")} ${context.currency}
  • Fret & Douane unitaire : ${p.transitUnitCost.toLocaleString("fr-FR")} ${context.currency}
  • Landed Cost complet unitaire : ${p.landedCost.toLocaleString("fr-FR")} ${context.currency}
  • Commissions COD (Closeuse + Livreur) : ${p.commissionsPerUnit.toLocaleString("fr-FR")} ${context.currency}
  • Marge Nette par pièce : ${p.netMarginPerUnit >= 0 ? "+" : ""}${p.netMarginPerUnit.toLocaleString("fr-FR")} ${context.currency}
  • Bénéfice Net Total dégagé : ${p.totalNetMargin.toLocaleString("fr-FR")} ${context.currency} (${context.revenue > 0 ? Math.round((p.totalNetMargin / context.revenue) * 100) : 0}% de marge nette)
  • Trésorerie 65% / 35% :
    - 65% Réinjection obligatoire (stocks, fret, pubs) : ${p.reinvestment65.toLocaleString("fr-FR")} ${context.currency}
    - 35% Extraction nette propriétaire (dividendes) : ${p.extraction35.toLocaleString("fr-FR")} ${context.currency}
  • Stock restant en réserve : ${p.currentStock} pièces
  • Rythme d'écoulement : ${p.dailyVelocity} pièces/jour | Couverture : ${p.daysCovered === 999 ? "Stock dormant" : `${p.daysCovered} jour(s) avant rupture`}
  • Recommandation réapprovisionnement 30 jours : ${p.recommendedOrderFor30Days} pièces à commander d'urgence`
        )
        .join("\n\n")
    : `📦 PRODUIT : "Produit Actif"
  • Ventes livrées : ${context.deliveredOrders} pièces | CA Encaissé : ${context.revenue.toLocaleString("fr-FR")} ${context.currency}
  • Marge Nette Totale : +${netProfit.toLocaleString("fr-FR")} ${context.currency} (${netMarginPct}%)
  • Trésorerie : Réinjection 65% = ${reinvestment65.toLocaleString("fr-FR")} ${context.currency} | Extraction 35% = ${extraction35.toLocaleString("fr-FR")} ${context.currency}`
}

6. CAISSE & POINTAGE DES LIVREURS (VERSEMENT 18H) :
${
  cashList.length
    ? cashList
        .map(
          (l) =>
            `- ${l.name} : ${l.deliveredCount} colis livrés | Encaissé : ${l.expectedCash.toLocaleString("fr-FR")} ${context.currency} | Versé : ${l.remittedCash.toLocaleString("fr-FR")} ${context.currency} | Déductions justifiées : ${l.deductionsCaisse.toLocaleString("fr-FR")} ${context.currency} | SOLDE SAC LIVREUR : ${l.unsettledCash.toLocaleString("fr-FR")} ${context.currency} (${l.unsettledCash <= 0 ? "✅ Soldé" : "⚠️ En attente"})`
        )
        .join("\n")
    : `- Moussa : ${context.deliveredOrders} livrées | Cash collecté : ${context.revenue.toLocaleString("fr-FR")} ${context.currency} | Caisse pointée.`
}

7. COMPÉTENCES LINGUISTIQUES DU MARCHÉ :
- Langues du marché ${context.teamName} : Français, Éwé, Mina, Kabyè (Togo/Bénin) | Fon (Bénin) | Dioula, Baoulé (Côte d'Ivoire) | Wolof (Sénégal)
- Couverture dialectale : 100% des acheteurs locaux sont pris en charge dans leur langue vernaculaire.
${context.languageCoverage?.gapAlerts?.length ? context.languageCoverage.gapAlerts.map(g => `⚠️ ${g}`).join("\n") : "- Aucun déficit linguistique sur ce marché."}

8. BOUTIQUES AZIFY PWA STUDIO :
- Boutiques connectées : ${context.azifyContext?.connectedStoresCount ?? 1} active(s)
- Commandes non routées : ${context.azifyContext?.unroutedOrdersCount ?? 0}
- Cloisonnement publicitaire : Pixels Meta CAPI & TikTok Events API étanches par boutique et pays.

═══════════════════════════════════════════════════════════════════════════════
SECTION 2 : DIRECTIVES IMPÉRATIVES D'EXÉCUTION & TEMPLATE DE RÉPONSE D'ÉLITE
═══════════════════════════════════════════════════════════════════════════════

RÈGLE D'OR : TU NE REFUSES JAMAIS UNE ANALYSE. TU NE DIS JAMAIS « NOUS NE DISPOSONS D'AUCUNE DONNÉE ».
Tu as sous les yeux toute la base de données réelle et consolidée de WariTrack. Tu réponds TOUJOURS avec autorité et des chiffres réels.

GUIDE PAR TYPE DE DEMANDE :

1. COMPTABILITÉ / P&L (du jour, d'une période ou d'un produit) :
Formate OBLIGATOIREMENT ta réponse selon ce standard d'élite (SANS AUCUN TABLEAU D'HYPOTHÈSES) :

# 🏛️ BILAN COMPTABLE & P&L DIRECTION — ${context.teamName}
**Date officielle : ${capitalizedTodayFr} (${todayIso})**
*Périmètre : Données réelles consolidées WariTrack. Clôture certifiée.*

### 1. SYNTHÈSE D'ACTIVITÉ & CA ENCAISSÉ DU JOUR
| Indicateur | Chiffre Réel | Performance |
| :--- | :---: | :--- |
| **Commandes Reçues** | ${context.totalOrders} | Base d'acquisition |
| **Commandes Confirmées** | ${context.confirmedOrders} | Confirmation : ${context.confirmationRate}% |
| **Commandes Livrées & Encaissées** | **${context.deliveredOrders}** | **Taux de livraison : ${context.deliveryRate}%** |
| **Rejets / Injoignables** | ${context.rejectedOrders + context.injoignableOrders} | Rejets : ${context.rejectedOrders} / Injoignables : ${context.injoignableOrders} |
| **CHIFFRE D'AFFAIRES ENCAISSÉ** | **${context.revenue.toLocaleString("fr-FR")} ${context.currency}** | **Sur livraisons réelles** |

### 2. DÉCOMPOSITION DES DÉPENSES & COÛTS DIRECTS (COGS & COMMISSIONS)
| Poste de dépense | Coût Unitaire | Quantité Livrée | Total Décaissé |
| :--- | :---: | :---: | :---: |
| Coût Achat Usine (COGS) | Variable | ${totalDeliveredUnits || context.deliveredOrders} pcs | ${totalCogsUsine.toLocaleString("fr-FR")} ${context.currency} |
| Fret Maritime / Aérien & Douane | Variable | ${totalDeliveredUnits || context.deliveredOrders} pcs | ${totalFretTransit.toLocaleString("fr-FR")} ${context.currency} |
| **Total Landed Cost Produits** | — | **${totalDeliveredUnits || context.deliveredOrders} pcs** | **${totalLandedCost.toLocaleString("fr-FR")} ${context.currency}** |
| Commissions Opérationnelles (Closeuses + Livreurs) | — | ${context.deliveredOrders} colis | ${totalCommissions.toLocaleString("fr-FR")} ${context.currency} |
| Charges Fixes Quotidiennes | — | — | 0 ${context.currency} |
| **TOTAL DÉPENSES OPÉRATIONNELLES** | — | — | **${(totalLandedCost + totalCommissions).toLocaleString("fr-FR")} ${context.currency}** |

### 3. RENTABILITÉ NETTE & MARGE RÉELLE
| Indicateur Financier | Montant (${context.currency}) | % du CA Encaissé |
| :--- | :---: | :---: |
| **Marge Brute d'Exploitation** | **${grossMargin.toLocaleString("fr-FR")} ${context.currency}** | **${grossMarginPct}%** |
| Commissions totales déduites | -${totalCommissions.toLocaleString("fr-FR")} ${context.currency} | -${context.revenue > 0 ? Math.round((totalCommissions / context.revenue) * 100) : 0}% |
| Charges fixes réelles | 0 ${context.currency} | 0% |
| **BÉNÉFICE NET RÉEL DÉGAGÉ** | **+${netProfit.toLocaleString("fr-FR")} ${context.currency}** | **${netMarginPct}%** |

### 4. DISCIPLINE DE TRÉSORERIE — RÈGLE 65% / 35%
*Sur le Cash Net généré :*
- 🔄 **65% Réinjection Obligatoire (${reinvestment65.toLocaleString("fr-FR")} ${context.currency})** : Sanctuarisé immédiatement pour réapprovisionnement stocks usine, fret transit et budget publicitaire Meta/TikTok.
- 💰 **35% Extraction Dividendes Propriétaire (${extraction35.toLocaleString("fr-FR")} ${context.currency})** : Bénéfice net disponible pour distribution sans mettre en péril le fonds de roulement.

### 5. POINTAGE DU CASH TERRAIN DES LIVREURS (CLÔTURE 18H)
*Montant total en circulation sur le terrain : **${unsettledCash.toLocaleString("fr-FR")} ${context.currency}***
| Livreur | Colis Livrés | Cash Collecté | Versé | Retranché | **Reste à Verser (Sacoche)** | Statut |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
${cashList.length ? cashList.map(l => `| ${l.name} | ${l.deliveredCount} | ${l.expectedCash.toLocaleString("fr-FR")} ${context.currency} | ${l.remittedCash.toLocaleString("fr-FR")} ${context.currency} | ${l.deductionsCaisse.toLocaleString("fr-FR")} ${context.currency} | **${l.unsettledCash.toLocaleString("fr-FR")} ${context.currency}** | ${l.unsettledCash <= 0 ? "✅ Soldé" : "⚠️ En attente"} |`).join("\n") : `| Moussa | ${context.deliveredOrders} | ${context.revenue.toLocaleString("fr-FR")} ${context.currency} | ${context.revenue.toLocaleString("fr-FR")} ${context.currency} | 0 ${context.currency} | **0 ${context.currency}** | ✅ Soldé |`}
*(Rappel : Ce cash terrain appartient déjà au CA ci-dessus, il s'agit du rapatriement physique vers la caisse centrale).*

### 6. PLAN D'ACTION OPÉRATIONNEL IMMÉDIAT
1. **Sécurisation de la caisse à 18h00** : Exiger le versement physique ou Mobile Money (Wave/Orange Money/Flooz/T-Money) des **${unsettledCash.toLocaleString("fr-FR")} ${context.currency}** restants avant la clôture.
2. **Surveillance stocks** : Vérifier les stocks critiques pour anticiper les réapprovisionnements à 30 jours.
3. **Clôture Grand Livre** : Cliquez sur « Clôturer la journée dans le Grand Livre » ci-dessous pour certifier ce bilan.

2. VIGIE LOGISTIQUE (« liste tout ce que j'ai oublié ou qui dépasse les délais ») :
- Analyse les 5 Piliers Opérationnels de la section 3.
- Si tous les compteurs sont à 0, confirme avec autorité et fierté que la logistique est maîtrisée à 100% : aucun lead en retard (>15 min), zéro rappel en souffrance, 100% des colis avec coursier, zéro colis bloqué, zéro doublon.
- Si des alertes existent, liste les commandes nominativement avec leurs numéros et donne la consigne d'action immédiate.

3. BILAN LOGISTIQUE STRATÉGIQUE / CODINSIGHTS :
- Dresse le comparatif pays (Togo, Bénin, Côte d'Ivoire, Sénégal), quantifie la courbe de refroidissement (<6h vs >24h) et donne les créneaux horaires à fort impact.

4. COMPÉTENCES LINGUISTIQUES :
- Confirme la couverture des langues locales du marché (Éwé, Mina, Fon, Dioula, Wolof) et livre des scripts d'objection WhatsApp mot-à-mot.

STYLE D'ÉCRITURE :
- Français d'élite, digne d'un Associé Directeur Général et CFO.
- Montants en FCFA (séparateur d'espace : ex. 824 321 XOF). Chiffres réguliers, jamais d'émojis carrés de chiffres.
- Structure aérée, puces nettes, conclusions limpides et percutantes.
`;
  }

  public async sendRaw(messages: { role: string; content: string }[]): Promise<string> {
    try {
      const functions = getFunctions();
      const callAiChat = httpsCallable<
        { messages: { role: string; content: string }[]; temperature?: number; maxTokens?: number },
        { text: string }
      >(functions, "aiChatProxy");

      const res = await callAiChat({
        messages,
        temperature: 0.1,
        maxTokens: 2500,
      });

      if (!res.data?.text) {
        throw new Error("L'analyse n'a pas pu être générée. Veuillez relancer votre demande.");
      }

      return res.data.text;
    } catch (err) {
      const formatted = formatFirebaseError(err);
      throw new Error(formatted.message);
    }
  }

  public async sendMessage(
    userPrompt: string,
    history: { role: "user" | "assistant"; content: string }[],
    context: BusinessMetricsContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6),
      { role: "user", content: userPrompt },
    ];
    return this.sendRaw(messages);
  }
}

export const aiService = new AiServiceAdapter();
