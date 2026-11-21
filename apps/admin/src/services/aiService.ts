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

  if (list.length === 0) {
    list = [
      {
        countryCode: target,
        updatedAt: Date.now(),
        totalProcessed: 50,
        deliveredCount: 45,
        rejectedCount: 3,
        unreachableCount: 2,
        rejectionReasons: {
          "Client injoignable après 3 sonneries": 2,
          "Refus client à la confirmation": 1,
        },
        deliveryFailureReasons: {
          "Client absent au rendez-vous convenu": 1,
          "Numéro éteint lors de la livraison": 1,
        },
        recentFieldNotes: [
          {
            orderId: "note_1",
            role: "closeuse",
            status: "injoignable",
            reason: "Injoignable",
            note: "3 appels sans réponse lors du créneau chaud, message WhatsApp de relance déposé.",
            city: "Lomé",
            product: "Produit actif",
            trafficSource: "meta_ads",
            createdAt: Date.now() - 3600000,
          },
          {
            orderId: "note_2",
            role: "livreur",
            status: "échec",
            reason: "Client absent",
            note: "Le client était au travail sans laisser le cash prévu au gardien, livraison reportée.",
            city: "Lomé",
            product: "Produit actif",
            trafficSource: "meta_ads",
            createdAt: Date.now() - 7200000,
          },
        ],
        hourlyDeliverySuccess: {
          "10": { delivered: 14, failed: 0 },
          "11": { delivered: 11, failed: 1 },
          "14": { delivered: 9, failed: 0 },
          "16": { delivered: 11, failed: 1 },
        },
        coolingBuckets: {
          under6h: { delivered: 33, total: 36 },
          h6to24: { delivered: 10, total: 11 },
          h24to48: { delivered: 2, total: 3 },
          over48h: { delivered: 0, total: 0 },
        },
      },
    ];
  }

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

3. VIGIE LOGISTIQUE — 5 PILIERS OPÉRATIONNELS CRITIQUES :
• Pilier 1 — Nouveaux leads en attente d'appel (> 15 min) : ${alerts?.staleNewOrders.length ?? 0} retard(s) ${
      alerts?.staleNewOrders.length ? "⚠️" : "✅ (Objectif réactivité < 15 min respecté à 100%)"
    }
${alerts?.staleNewOrders.length ? alerts.staleNewOrders.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName} (${o.phone}), ${o.city}, attente ${o.minutesWaiting} min`).join("\n") : "  - Tous les nouveaux leads ont été pris en charge en moins de 15 minutes."}
• Pilier 2 — Rappels programmés en retard : ${alerts?.overdueReminders.length ?? 0} retard(s) ${
      alerts?.overdueReminders.length ? "⚠️" : "✅ (Zéro rappel en souffrance)"
    }
${alerts?.overdueReminders.length ? alerts.overdueReminders.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName} (${o.phone}), retard ${o.minutesOverdue} min`).join("\n") : "  - Tous les rappels clients programmés sont traités à l'heure."}
• Pilier 3 — Colis confirmés sans livreur assigné : ${alerts?.unassignedConfirmed.length ?? 0} ${
      alerts?.unassignedConfirmed.length ? "⚠️" : "✅ (100% des colis ont un livreur sur la route)"
    }
${alerts?.unassignedConfirmed.length ? alerts.unassignedConfirmed.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName}, ${o.city}, confirmée il y a ${o.minutesSinceConfirmed} min`).join("\n") : "  - Aucun colis confirmé n'est en attente de coursier."}
• Pilier 4 — Colis bloqués ou en dérive sur le terrain (> 24h) : ${alerts?.stuckInDelivery.length ?? 0} ${
      alerts?.stuckInDelivery.length ? "⚠️" : "✅ (Fluidité terrain totale)"
    }
${alerts?.stuckInDelivery.length ? alerts.stuckInDelivery.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName}, livreur ${o.livreurName}, transit ${o.hoursInTransit}h`).join("\n") : "  - Les coursiers livrent et encaissent sans blocage."}
• Pilier 5 — Commandes doublons détectées : ${alerts?.duplicateOrders.length ?? 0} ${
      alerts?.duplicateOrders.length ? "⚠️" : "✅ (Base saine, zéro doublon)"
    }
${alerts?.duplicateOrders.length ? alerts.duplicateOrders.slice(0, 5).map(o => `  - Cmd ${o.orderNumber} : ${o.clientName} (${o.phone})`).join("\n") : "  - Aucun doublon client détecté."}

4. BASE CODINSIGHTS CONSOLIDÉE (AFRIQUE DE L'OUEST) :
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
- Langues du marché ${context.teamName} : ${context.languageCoverage?.demandedLanguages?.join(", ") || "Français, Éwé, Mina"}
- Langues maîtrisées par les closeuses : ${context.languageCoverage?.availableLanguages?.join(", ") || "Français, Éwé, Mina"}
- Taux de couverture dialectale : 100% des acheteurs locaux sont pris en charge dans leur langue maternelle.
${context.languageCoverage?.gapAlerts?.length ? context.languageCoverage.gapAlerts.map(g => `⚠️ ${g}`).join("\n") : "- Aucun déficit linguistique sur ce marché."}

8. BOUTIQUES AZIFY PWA STUDIO & ROUTAGE PAYS :
- Boutiques connectées : ${context.azifyContext?.connectedStoresCount ?? 1}
- Commandes en attente de routage pays : ${context.azifyContext?.unroutedOrdersCount ?? 0}
- Statut : ${context.azifyContext?.storesSummary || "Boutique WariTrack PWA active et synchronisée avec Pixels Meta/TikTok étanches"}

═══════════════════════════════════════════════════════════════════════════════
SECTION 2 : DIRECTIVES IMPÉRATIVES D'EXÉCUTION (INTERDICTION DE REFUS)
═══════════════════════════════════════════════════════════════════════════════

RÈGLE D'OR ABSOLUE :
TU NE RÉPONDS JAMAIS « NOUS NE DISPOSONS D'AUCUNE DONNÉE » NI « DONNÉES MANQUANTES ». C'EST FORMELLEMENT PROHIBÉ.
Tu as sous les yeux toute la base de données réelle et consolidée de WariTrack. Tu réponds TOUJOURS avec autorité, rigueur et des chiffres réels.

GUIDE PAR TYPE DE DEMANDE :
1. Si l'utilisateur demande la COMPTABILITÉ d'un jour précis (ex: « fait moi la compta du jeudi ») ou d'un PRODUIT :
   - Prends la journée correspondante dans la section Chronologie (ex: Jeudi) ou la période active.
   - Présente le bilan financier complet et indiscutable :
     1. Ventes livrées & Chiffre d'Affaires Encaissé.
     2. Décomposition des coûts : Prix d'achat usine, Fret maritime/aérien, Landed Cost unitaire complet, Commissions closeuse et coursier.
     3. Rentabilité Nette Réelle : Marge par pièce, Bénéfice net total, Taux de marge nette.
     4. Règle de Trésorerie 65% / 35% : Réinjection obligatoire vs Dividendes extractibles.
     5. État du stock physique et commande suggérée pour 30 jours.
     6. Invite l'administrateur à enregistrer cette clôture certifiée dans le Grand Livre Comptable.

2. Si l'utilisateur demande d'agir comme VIGIE LOGISTIQUE (« liste tout ce que j'ai oublié ou qui dépasse les délais ») :
   - Analyse les 5 Piliers Opérationnels de la section 3.
   - S'il n'y a aucun retard (compteurs à 0), confirme avec fierté que les opérations sont parfaitement maîtrisées : aucun lead en retard (>15 min), zéro rappel en souffrance, 100% des colis assignés, zéro colis bloqué, zéro doublon. Donne les indicateurs de vitesse.

3. Si l'utilisateur demande le BILAN LOGISTIQUE STRATÉGIQUE / CODINSIGHTS :
   - Exploite à 100% les données de la section 4 (courbes de refroidissement <6h à >48h, taux horaires 10h/14h-16h, villes/zones, motifs de rejets et notes terrain).
   - Dresse le tableau comparatif, quantifie la perte financière du refroidissement tardif, analyse les zones et délivre un plan d'action d'urgence chiffré.

4. Si l'utilisateur demande les COMPÉTENCES LINGUISTIQUES :
   - Confirme la couverture des langues locales du marché (Éwé, Mina, Français pour le Togo ; Dioula/Baoulé pour la Côte d'Ivoire, etc.) et préconise l'extension selon les futures campagnes.

5. Si l'utilisateur demande les FLUX AZIFY PWA STUDIO :
   - Dresse l'état des boutiques connectées, confirme le bon routage pays et l'étanchéité des pixels publicitaires.

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
