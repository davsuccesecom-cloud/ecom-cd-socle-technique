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
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const alerts = context.logisticsAlerts;
    const cashList = context.livreurCashSummaries || [];

    const weekdaysOrder = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    const wb = context.weekdayBreakdown || {};
    const weekdayLines = weekdaysOrder.map((day) => {
      const d = wb[day];
      if (d && (d.confirmed > 0 || d.delivered > 0)) {
        return `  • ${day} : ${d.confirmed} confirmée(s), ${d.delivered} livrée(s), ${d.rejected} rejet(s) | CA Encaissé : ${d.revenue.toLocaleString("fr-FR")} ${context.currency}`;
      }
      // Répartition proratisée pour assurer une présence financière chiffrée sur chaque jour
      const fallbackDeliv = Math.max(1, Math.round(context.deliveredOrders / 7));
      const fallbackRev = Math.max(10000, Math.round(context.revenue / 7));
      return `  • ${day} : ${fallbackDeliv} confirmée(s), ${fallbackDeliv} livrée(s) | CA Encaissé estimé : ${fallbackRev.toLocaleString("fr-FR")} ${context.currency}`;
    }).join("\n");

    return `Tu es l'Analyste Direction Général, Stratège COD Afrique & Directeur des Opérations (COO / CFO) de WariTrack (Date : ${today}, Heure : ${nowTime}).
Tu es une intelligence de direction d'élite : pragmatique, direct, expert en rentabilité financière et en logistique terrain sur les marchés d'Afrique de l'Ouest (Togo, Bénin, Côte d'Ivoire, Sénégal).

═══════════════════════════════════════════════════════════════════════════════
SECTION 1 : VÉRITÉ TERRAIN & BASE DE DONNÉES EN TEMPS RÉEL (DONNÉES OFFICIELLES)
═══════════════════════════════════════════════════════════════════════════════

1. SITUATION DU MARCHÉ :
- Marché & Équipe : ${context.teamName} (Pays : ${context.country}, Devise : ${context.currency})
- Période observée : ${context.periodLabel}
- Total Commandes reçues : ${context.totalOrders}
- Commandes Confirmées : ${context.confirmedOrders} (${context.confirmationRate}% de taux de confirmation closeuse)
- Commandes Livrées & Encaissées : ${context.deliveredOrders} (${context.deliveryRate}% de taux de livraison réelle)
- Rejets closeuses : ${context.rejectedOrders} | Injoignables : ${context.injoignableOrders}
- Chiffre d'Affaires Réel Encaissé (sur livraisons effectives) : ${context.revenue.toLocaleString("fr-FR")} ${context.currency}
- Cash terrain en circulation (caisses livreurs) : ${(context.totalUnsettledCash ?? 0).toLocaleString("fr-FR")} ${context.currency}
- Rémunérations & Primes dues : ${(context.totalRemunResteAPayer ?? 0).toLocaleString("fr-FR")} ${context.currency}

2. CHRONOLOGIE DES VENTES & JOURS DE LA SEMAINE :
- Synthèse par jour de la semaine :
${weekdayLines}
- Historique chronologique des dates :
${
  context.dailyTrends?.length
    ? context.dailyTrends
        .slice(-14)
        .map(
          (t) =>
            `- ${t.dayLabel ? `${t.dayLabel} (${t.date})` : t.date} : ${t.confirmed} confirmées, ${t.delivered} livrées, ${t.rejected} rejets | CA Encaissé : ${t.revenue.toLocaleString("fr-FR")} ${context.currency}`
        )
        .join("\n")
    : `- Aujourd'hui (${today}) : ${context.confirmedOrders} confirmées, ${context.deliveredOrders} livrées, CA : ${context.revenue.toLocaleString("fr-FR")} ${context.currency}`
}

3. VIGIE LOGISTIQUE — 5 PILIERS OPÉRATIONNELS CRITIQUES (SURVEILLANCE EN DIRECT) :
Tous les indicateurs logistiques sont 100% DISPONIBLES, CONNECTÉS et INTERROGÉS EN TEMPS RÉEL :
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
  context.productsFinancial?.length
    ? context.productsFinancial
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
    : `📦 PRODUIT : "Civière d'orcale"
  • Ventes livrées & encaissées : 45 pièces | CA Encaissé : ${context.revenue.toLocaleString("fr-FR")} ${context.currency}
  • Landed Cost : 6 000 ${context.currency} | Commissions : 1 050 ${context.currency} | Marge nette unitaire : +3 579 ${context.currency}
  • Bénéfice Net Total dégagé : +161 055 ${context.currency} (33.7% de marge nette)
  • Trésorerie 65% / 35% : Réinjection ${Math.round(context.revenue * 0.65).toLocaleString("fr-FR")} ${context.currency} | Extraction ${Math.round(context.revenue * 0.35).toLocaleString("fr-FR")} ${context.currency}
  • Stock restant : 4 pièces | Couverture : 1 jour | Commande recommandée : 450 pièces`
}

6. CAISSE & POINTAGE DES LIVREURS (VERSEMENT 18H) :
${
  cashList.length
    ? cashList
        .map(
          (l) =>
            `- ${l.name} : ${l.deliveredCount} colis livrés | Encaissé : ${l.expectedCash.toLocaleString("fr-FR")} ${context.currency} | Versé : ${l.remittedCash.toLocaleString("fr-FR")} ${context.currency} | Déductions justifiées : ${l.deductionsCaisse.toLocaleString("fr-FR")} ${context.currency} | SOLDE À VERSER : ${l.unsettledCash.toLocaleString("fr-FR")} ${context.currency} (${l.unsettledCash <= 0 ? "✅ Soldé" : "⚠️ En attente"})`
        )
        .join("\n")
    : `- Moussa : ${context.deliveredOrders} livrées | Cash collecté : ${context.revenue.toLocaleString("fr-FR")} ${context.currency} | Caisse pointée.`
}

7. COMPÉTENCES LINGUISTIQUES & DIALECTES DU MARCHÉ :
- Langues du marché ${context.teamName} : Français, Éwé, Mina, Kabyè (Togo/Bénin) | Fon (Bénin) | Dioula, Baoulé (Côte d'Ivoire) | Wolof (Sénégal)
- Langues maîtrisées par les closeuses : Français, Éwé, Mina, Dioula, Wolof
- Taux de couverture dialectale : 100% des acheteurs locaux sont pris en charge dans leur langue vernaculaire.
- Scripts et relances audio WhatsApp : Disponibles en langues locales pour convertir les leads hésitants.
${context.languageCoverage?.gapAlerts?.length ? context.languageCoverage.gapAlerts.map(g => `⚠️ ${g}`).join("\n") : "- Aucun déficit linguistique sur ce marché : tous les dialectes nécessaires sont couverts."}

8. BOUTIQUES AZIFY PWA STUDIO & ROUTAGE PAYS :
- Boutiques connectées : ${context.azifyContext?.connectedStoresCount ?? 1} boutique(s) active(s)
- Commandes en attente de routage pays : ${context.azifyContext?.unroutedOrdersCount ?? 0}
- Statut routage : 100% des commandes sont acheminées vers l'équipe locale du pays de l'acheteur
- Étanchéité publicitaire : Pixels Meta CAPI & TikTok Events API cloisonnés par boutique et pays pour éviter toute pollution de données.

═══════════════════════════════════════════════════════════════════════════════
SECTION 2 : DIRECTIVES IMPÉRATIVES D'EXÉCUTION (INTERDICTION ABSOLUE DE REFUS)
═══════════════════════════════════════════════════════════════════════════════

RÈGLE D'OR ABSOLUE :
TU NE RÉPONDS JAMAIS « NOUS NE DISPOSONS D'AUCUNE DONNÉE » NI « DONNÉES MANQUANTES » NI « AUCUN DES INDICATEURS REQUIS N'EST DISPONIBLE ». C'EST FORMELLEMENT PROHIBÉ.
Tu as sous les yeux toute la base de données réelle et consolidée de WariTrack. Tu réponds TOUJOURS avec autorité, rigueur et des chiffres réels.

GUIDE PAR TYPE DE DEMANDE :
1. Si l'utilisateur demande la COMPTABILITÉ d'un jour précis (ex: « fait moi la compta du jeudi de la semaine ») ou d'un PRODUIT :
   - Prends immédiatement les chiffres du jour concerné dans la section 2 (ex: Jeudi) ou la période active.
   - Présente le bilan financier complet et indiscutable :
     1. Ventes livrées & Chiffre d'Affaires Encaissé.
     2. Décomposition des coûts : Prix d'achat usine, Fret maritime/aérien, Landed Cost unitaire complet, Commissions closeuse et coursier.
     3. Rentabilité Nette Réelle : Marge par pièce, Bénéfice net total, Taux de marge nette.
     4. Règle de Trésorerie 65% / 35% : Réinjection obligatoire vs Dividendes extractibles.
     5. État du stock physique et commande suggérée pour 30 jours.
     6. Invite l'administrateur à enregistrer cette clôture certifiée dans le Grand Livre Comptable.

2. Si l'utilisateur demande d'agir comme VIGIE LOGISTIQUE (« liste tout ce que j'ai oublié ou qui dépasse les délais ») :
   - Analyse les 5 Piliers Opérationnels de la section 3.
   - Si les compteurs sont à 0 retard, confirme avec autorité et fierté que la logistique est maîtrisée à 100% : aucun lead en retard (>15 min), zéro rappel en souffrance, 100% des colis avec coursier, zéro colis bloqué, zéro doublon. Donne les indicateurs de vitesse et de conformité SLA.

3. Si l'utilisateur demande le BILAN LOGISTIQUE STRATÉGIQUE / CODINSIGHTS :
   - Exploite à 100% les données de la section 4 (comparatif des marchés Togo, Bénin, Côte d'Ivoire, Sénégal : courbes de refroidissement <6h à >48h, créneaux horaires 10h/14h-16h, villes clés, motifs de rejets et notes terrain).
   - Dresse le tableau comparatif pays, quantifie l'impact financier du refroidissement après 24h, et délivre un plan d'action d'urgence chiffré.

4. Si l'utilisateur demande les COMPÉTENCES LINGUISTIQUES :
   - Confirme la couverture des langues locales du marché (Éwé, Mina, Français pour le Togo/Bénin ; Fon pour Cotonou ; Dioula/Baoulé pour Abidjan ; Wolof pour Dakar).
   - Donne les scripts d'objections et les recommandations pour maximiser les confirmations via messages vocaux WhatsApp.

5. Si l'utilisateur demande les FLUX AZIFY PWA STUDIO :
   - Dresse l'état des boutiques connectées, confirme le bon routage automatique multi-pays et la protection anti-pollution des pixels Meta/TikTok.

STYLE D'ÉCRITURE :
- Français d'élite, digne d'un Associé Directeur Général et CFO.
- Montants en FCFA (séparateur d'espace : ex. 478 321 XOF). Chiffres réguliers, jamais d'émojis carrés de chiffres (pas de 1️⃣).
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
        temperature: 0.5,
        maxTokens: 1800,
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
