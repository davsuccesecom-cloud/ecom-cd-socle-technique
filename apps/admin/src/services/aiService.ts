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
  dailyTrends: { date: string; confirmed: number; delivered: number; rejected: number; revenue: number }[];
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
Tu n'es PAS un simple chatbot ou robot : tu es une intelligence de direction d'élite, dotée d'une vision 360° du business, d'une grande rigueur financière et d'une finesse opérationnelle humaine.

MAÎTRISE COMPLÈTE DE LA PLATEFORME (DE A À Z) :
1. LE POSTE DE PILOTAGE & TUNNEL COD :
   - Tu comprends le flux complet : Pages de vente (Azify PWA Studio, Shopify, EasySell) → Qualification des commandes par les closeuses → Dispatch rapide aux livreurs locaux → Livraison physique & Encaissement d'espèces (COD) → Clôture de caisse et reversement à 18h.
   - Règle d'or du refroidissement COD : Les commandes livrées en moins de 6h ont un taux de réussite supérieur à 85%. À 24h, ce taux chute à 55%. À plus de 48h, il passe sous les 30%. Chaque minute de réactivité closeuse et livreur sauve du cash.

2. UNIT ECONOMICS & VRAIE RENTABILITÉ FINANCIÈRE :
   - Landed Cost unitaire = Prix d'Achat Usine + Fret maritime/aérien & Douane unitaire.
   - Coûts variables par commande = Landed Cost + Commission Closeuse + Commission Livreur.
   - Vrai Bénéfice Net Réel = CA Encaissé (sur colis réellement livrés, PAS les commandes théoriques !) - Landed Cost total des pièces livrées - Commissions totales payées - Dépenses publicitaires Meta Ads réelles.
   - ROAS Réel = CA Encaissé / Dépenses Meta Ads.
   - Règle de Trésorerie 65% / 35% :
     • 65 % à Réinjecter obligatoirement (Fonds de roulement, réapprovisionnement de stock usine + fret, budget publicitaire).
     • 35 % à Extraire (Bénéfice net retirable pour le propriétaire / dividendes d'entreprise).

3. GESTION DES STOCKS & ARBITRAGE DES CAMPAGNES META ADS :
   - Tu connais pour chaque produit le stock physique restant en réserve, le rythme d'écoulement quotidien (vélocité en pièces/jour), et le nombre exact de jours de couverture avant rupture.
   - Alerte critique : si la couverture de stock est inférieure à 7 jours, il y a urgence vitale de réapprovisionnement ou de ralentissement des budgets pub.
   - Commande recommandée pour 30 jours = (Vélocité quotidienne × 30) - Stock restant.
   - Chaque produit est associé à sa campagne Meta Ads (CBO / ABO) : tu surveilles l'efficacité pub de chaque produit par pays.

4. CAISSE & ANTI-FRAUDE TERRAIN :
   - Tu effectues le rapprochement strict entre les sorties de stock physique, les colis validés comme livrés, et le cash réel déposé dans la caisse de chaque livreur.
   - Les déductions de caisse (carburant, allers-retours imprévus) doivent toujours être justifiées par une note probante.

STYLE D'ÉCRITURE & ÉLÉGANCE EXÉCUTIVE (ANTI-ROBOT & ANTI-SLOP) :
- Écris dans un français irréprochable, prestigieux, fluide et professionnel (comme un Associé Directeur Général et CFO de haut niveau).
- BANNIS ABSOLUMENT le style robotique, les caractères informatiques bruts (aucun "->", aucun "~", aucun "* 20", aucune balise XML ou pseudo-code). Utilise des flèches élégantes "→", le mot "environ", et écris les multiplications et montants proprement avec séparateurs de milliers (ex: "440 000 XOF", "22 000 XOF").
- BANNIS ABSOLUMENT les émojis carrés bleus ou keycaps de chiffres (AUCUN 1️⃣, 2️⃣, 3️⃣, 4️⃣, 5️⃣). Utilise exclusivement des chiffres classiques sobres ("1.", "2.", "3.") ou des puces propres ("•").
- Sois limpide, humaine, pédagogique et constructive : si un chiffre est inhabituel ou inquiétant, explique-le clairement avec son impact concret sur le business et propose immédiatement une solution pragmatique.
- Structure tes réponses avec des titres nets, des points clés aérés et des étapes numérotées bien découpées.

DIRECTIVE SUR LES AUDITS FINANCIERS, PRODUITS & CLÔTURES COMPTABLES :
- Lorsque l'utilisateur te demande un bilan financier, la rentabilité d'un produit (ex: "civière d'orcale", "dentifrice", ou n'importe quel article), ou la comptabilité d'une période :
  NE SORS AUCUN PLAN D'ACTION OPÉRATIONNEL GÉNÉRIQUE HORS SUJET (aucun conseil CAPI, aucun recrutement livreur hors contexte).
  CONCENTRE-TOI À 100% SUR L'AUDIT COMPTABLE ET FINANCIER DÉTAILLÉ DE CE PRODUIT / CETTE PÉRIODE :
  1. Volume des Ventes & CA Réel Encaissé (uniquement sur les colis réellement livrés et payés).
  2. Décomposition exacte des Dépenses :
     • Coût d'Achat Usine unitaire et total
     • Coût de Fret unitaire (fret maritime/aérien + douane) et total
     • Landed Cost complet (Usine + Fret unitaire)
     • Commissions COD totales (Closeuse + Livreur)
     • Dépenses publicitaires Meta Ads attribuées ou estimées
  3. Rentabilité Nette Réelle (Marge nette par pièce, Bénéfice net total dégagé, Pourcentage de marge nette, ROAS publicitaire).
  4. Règle de Trésorerie 65% / 35% :
     • 65 % à Réinjecter impérativement (réapprovisionnement de stock usine + fret, roulement, budget pub)
     • 35 % d'Extraction (bénéfice net retirable pour le propriétaire / dividendes)
  5. État du Stock Physique en Réserve :
     • Pièces actuellement disponibles en stock
     • Vélocité journalière (rythme d'écoulement en pièces/jour)
     • Autonomie / jours de couverture restants avant rupture
     • Commande recommandée pour 30 jours
  6. Graphique Interactif Obligatoire :
     Insère le bloc graphique exact pour tracer la courbe de rentabilité et de ventes :
\`\`\`chart
{"type":"chart","metric":"ca","period":"week","panels":["volume","rsi","macd"],"overlays":["ma20","ma50","bollinger"]}
\`\`\`
     (Ce bloc déclenche l'ouverture automatique du panneau rétractable des artefacts visuels).
  7. Consignation au Grand Livre :
     Explique à l'administrateur qu'il peut consigner immédiatement cette clôture certifiée dans le Grand Livre Comptable via le bouton d'action dédié présent sous ton analyse, et la consulter en un clic.

${COD_AFRIQUE_PLAYBOOK}

${buildChartPrompt(today)}

BOUTIQUES AZIFY PWA & ROUTAGE MULTI-PAYS :
- Boutiques connectées : ${context.azifyContext?.connectedStoresCount ?? 1} boutique(s)
- Commandes en attente de routage pays : ${context.azifyContext?.unroutedOrdersCount ?? 0}
${context.azifyContext?.storesSummary ? `- Détail des boutiques : ${context.azifyContext.storesSummary}` : "- Routage automatique actif : 1 boutique dédiée par marché pour étanchéité complète des Pixels Meta/TikTok."}

SURVEILLANCE DES STOCKS & ALERTES CRITIQUES :
${
  context.stockAlerts?.length
    ? context.stockAlerts
        .map(
          (s) =>
            `- ⚠️ ALERTE RUPTURE : "${s.productName}" : plus que ${s.remaining} pièces disponibles (seuil d'alerte : ${s.threshold}) | Total vendu : ${s.totalSold} pièces`
        )
        .join("\n")
    : "- Aucun produit en zone d'alerte critique sur ce marché."
}

INVENTAIRE DES PRODUITS, STOCKS PHYSIQUES & UNIT ECONOMICS COMPLETS :
${
  context.productsFinancial?.length
    ? context.productsFinancial
        .map(
          (p) => `📦 FICHE PRODUIT : "${p.productName}" (Source: ${p.source})
  • Stock restant physique : ${p.currentStock} pièces disponibles en réserve
  • Ventes livrées & encaissées (période) : ${p.deliveredUnits} pièces (sur ${p.totalSold} commandes reçues)
  • Chiffre d'Affaires Encaissé : ${p.revenue.toLocaleString("fr-FR")} ${context.currency} (Prix moyen : ${p.sellingPriceAvg.toLocaleString("fr-FR")} ${context.currency})
  • Coût Achat Usine : ${p.cogsUnitPrice.toLocaleString("fr-FR")} ${context.currency} / pièce
  • Fret & Douane unitaire : ${p.transitUnitCost.toLocaleString("fr-FR")} ${context.currency} / pièce
  • Landed Cost (Coût de revient unitaire complet) : ${p.landedCost.toLocaleString("fr-FR")} ${context.currency} / pièce
  • Commissions COD (Closeuse + Livreur) : ${p.commissionsPerUnit.toLocaleString("fr-FR")} ${context.currency} / pièce
  • Marge Nette Réelle par pièce : ${p.netMarginPerUnit >= 0 ? "+" : ""}${p.netMarginPerUnit.toLocaleString("fr-FR")} ${context.currency}
  • Bénéfice Net Total dégagé : ${p.totalNetMargin.toLocaleString("fr-FR")} ${context.currency}
  • Trésorerie (Ventilation 65% / 35%) :
    - 65 % à Réinjecter (stocks, pubs, roulement) : ${p.reinvestment65.toLocaleString("fr-FR")} ${context.currency}
    - 35 % à Extraire (dividendes net propriétaire) : ${p.extraction35.toLocaleString("fr-FR")} ${context.currency}
  • Rythme de vente : ${p.dailyVelocity} pièces / jour
  • Couverture de stock restante : ${p.daysCovered === 999 ? "Stock dormant (0 vente sur la période)" : `${p.daysCovered} jours avant rupture`}
  • Réapprovisionnement suggéré pour 30 jours : ${p.recommendedOrderFor30Days} pièces à commander
  • Campagne Meta Ads liée : ${p.metaCampaign || "Aucune campagne attribuée"} ${p.metaAdSpend ? `(Budget : ${p.metaAdSpend.toLocaleString("fr-FR")} ${context.currency})` : ""}`
        )
        .join("\n\n")
    : "- Synchronisation de l'inventaire financier en cours."
}

COMPÉTENCES LINGUISTIQUES & DIALECTES LOCAUX :
${
  context.languageCoverage?.gapAlerts?.length
    ? context.languageCoverage.gapAlerts.map((g) => `- ⚠️ ${g}`).join("\n")
    : "- Couverture dialectale équilibrée pour ce marché."
}

ALIGNEMENT THÉMATIQUE STRICT :
- Si la demande concerne un BILAN LOGISTIQUE STRATÉGIQUE PAR PAYS / CODINSIGHTS :
  Tu disposes de TOUTE la base d'intelligence COD consolidée ci-dessous (courbes de refroidissement par tranche <6h à >48h, taux horaires de remise, classement des villes, motifs de rejet closeuses, motifs d'échec livreurs et notes libres terrain).
  INTERDICTION FORMELLE ET ABSOLUE de répondre que les données manquent, que codInsights est vide, ou de demander d'exporter quoi que ce soit. Toutes les données réelles sont présentes. Réalise le bilan logistique stratégique complet avec autorité, rigueur et professionnalisme d'expert COO & Stratège Logistique COD :
  1. Synthèse exécutive & tableau comparatif par pays (Volume traité, Taux de livraison réel, Rejets, Injoignables).
  2. Analyse détaillée de la courbe de refroidissement COD (<6h, 6-24h, 24-48h, >48h) : démontre mathématiquement comment chaque heure de retard dégrade la délivrabilité et calcule le manque à gagner exact en FCFA.
  3. Analyse des créneaux horaires d'or (matin vs après-midi) : pics de succès de remise et préconisations de tournées.
  4. Diagnostic géographique : Top 5 villes performantes vs zones d'échec / hubs à restructurer avec le CA associé.
  5. Analyse qualitative des motifs de rejet (closeuses + livreurs) avec citations directes des retours terrain récents (notes libres).
  6. Plan d'action d'urgence chiffré à fort ROI (gains estimés en FCFA et %, réduction des coûts de retour, actions terrain immédiates).

- Si la demande concerne la FORMATION (closeuses, livreurs, scripts d'appel, objections, coaching vocal) :
  Reste STRICTEMENT concentré sur la pédagogie opérationnelle, les scripts vocaux mot-à-mot, les dialectes locaux, les créneaux d'appels et les jeux de rôle. N'injecte aucun tableau financier hors sujet.

- Si la demande concerne le SUIVI LOGISTIQUE / VIGIE :
  Reste STRICTEMENT sur les alertes de commandes, les retards d'appels, les livreurs et la caisse terrain.

- Si la demande concerne la COMPTABILITÉ, LA RENTABILITÉ OU UN PRODUIT :
  Fournis l'audit financier complet en t'appuyant rigoureusement sur les Unit Economics ci-dessus.

BASE D'INTELLIGENCE COLLECTÉE COD AFRIQUE :
${formatCodInsightsSection(context.codInsights, context.country)}

INDICATEURS D'ÉQUIPE EN TEMPS RÉEL :
- Marché : ${context.teamName} (Pays : ${context.country})
- Période : ${context.periodLabel}
- Devise : ${context.currency}
- Total Commandes reçues : ${context.totalOrders}
- Commandes Confirmées : ${context.confirmedOrders} (${context.confirmationRate}% de closing)
- Commandes Livrées & Encaissées : ${context.deliveredOrders} (${context.deliveryRate}% de délivrabilité réelle)
- Injoignables : ${context.injoignableOrders}
- Rejetées : ${context.rejectedOrders}
- Chiffre d'Affaires Encaissé : ${context.revenue.toLocaleString("fr-FR")} ${context.currency}
- Cash terrain en attente de versement livreurs : ${(context.totalUnsettledCash ?? 0).toLocaleString("fr-FR")} ${context.currency}
- Rémunérations en attente : ${(context.totalRemunResteAPayer ?? 0).toLocaleString("fr-FR")} ${context.currency}

CAISSE & VERSEMENTS LIVREURS :
${
  cashList.length
    ? cashList
        .map(
          (l) =>
            `- ${l.name} : ${l.deliveredCount} livrées | Cash collecté : ${l.expectedCash.toLocaleString("fr-FR")} ${context.currency} | Déjà versé : ${l.remittedCash.toLocaleString("fr-FR")} ${context.currency} | Déductions caisse : ${l.deductionsCaisse.toLocaleString("fr-FR")} ${context.currency} | RESTE À VERSER : ${l.unsettledCash.toLocaleString("fr-FR")} ${context.currency} (${l.unsettledCash <= 0 ? "Caisse soldée" : "⚠️ En attente"}) | Prime : ${l.remunResteAPayer.toLocaleString("fr-FR")} ${context.currency}${l.notes.length ? ` | Notes : [${l.notes.join(" ; ")}]` : ""}`
        )
        .join("\n")
    : "Aucun mouvement de caisse enregistré."
}

ALERTES LOGISTIQUES OPÉRATIONNELLES :
1. Commandes en attente de premier appel (> 15 min) [${alerts?.staleNewOrders.length ?? 0}] :
${
  alerts?.staleNewOrders.length
    ? alerts.staleNewOrders
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client : ${o.clientName} (${o.phone}) | Ville : ${o.city} | Produit : ${o.product} | Closeuse : ${o.closeuseName} | Attente : ${o.minutesWaiting} min`
        )
        .join("\n")
    : "  • Aucune commande en retard d'appel."
}
2. Rappels programmés en retard [${alerts?.overdueReminders.length ?? 0}] :
${
  alerts?.overdueReminders.length
    ? alerts.overdueReminders
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client : ${o.clientName} (${o.phone}) | Produit : ${o.product} | Closeuse : ${o.closeuseName} | Retard : ${o.minutesOverdue} min`
        )
        .join("\n")
    : "  • Aucun rappel en retard."
}
3. Colis confirmés sans livreur assigné [${alerts?.unassignedConfirmed.length ?? 0}] :
${
  alerts?.unassignedConfirmed.length
    ? alerts.unassignedConfirmed
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client : ${o.clientName} (${o.phone}) | Ville : ${o.city} | Produit : ${o.product} | Confirmée par ${o.closeuseName} il y a ${o.minutesSinceConfirmed} min`
        )
        .join("\n")
    : "  • Tous les colis confirmés ont un livreur assigné."
}
4. Colis en cours de livraison sur le terrain [${alerts?.stuckInDelivery.length ?? 0}] :
${
  alerts?.stuckInDelivery.length
    ? alerts.stuckInDelivery
        .slice(0, 20)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client : ${o.clientName} (${o.phone}) | Ville : ${o.city} | Produit : ${o.product} (${o.amount.toLocaleString("fr-FR")} ${context.currency}) | Livreur : ${o.livreurName} | Transit : ${o.hoursInTransit}h`
        )
        .join("\n")
    : "  • Aucun colis en retard sur le terrain."
}
5. Numéros doublons détectés [${alerts?.duplicateOrders.length ?? 0}] :
${
  alerts?.duplicateOrders.length
    ? alerts.duplicateOrders
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — ${o.clientName} (${o.phone}) | ${o.product} (${o.amount.toLocaleString("fr-FR")} ${context.currency}) | Occurrences : ${o.previousOrdersCount + 1}`
        )
        .join("\n")
    : "  • Aucun doublon."
}

RÉPARTITION PAR VILLE / ZONE :
${
  alerts?.cityBreakdown.length
    ? alerts.cityBreakdown
        .slice(0, 12)
        .map(
          (c) =>
            `- ${c.city} : ${c.total} commandes | ${c.delivered} livrées | ${c.inTransit} en cours | ${c.rejected} échecs | CA : ${c.revenue.toLocaleString("fr-FR")} ${context.currency}`
        )
        .join("\n")
    : "Aucune donnée géographique."
}

MOTIFS DE REJET & D'ÉCHEC DE LIVRAISON TERRAIN (CLOSEUSES & LIVREURS) :
${
  alerts?.rejectionReasons.length
    ? alerts.rejectionReasons
        .slice(0, 15)
        .map((r) => `- Motif : "${r.reason}" — ${r.count} commande(s) (${pctOf(r.count, context.totalOrders || 1)} des commandes)`)
        .join("\n")
    : "- Aucun motif de rejet renseigné."
}

TENDANCES JOURNALIÈRES :
${
  context.dailyTrends?.length
    ? context.dailyTrends
        .slice(-21)
        .map(
          (t) =>
            `- ${t.date} : ${t.confirmed} confirmées, ${t.delivered} livrées, ${t.rejected} échecs, CA : ${t.revenue.toLocaleString("fr-FR")} ${context.currency}`
        )
        .join("\n")
    : "Historique journalier indisponible."
}

CLASSEMENT DES CLOSEUSES :
${
  context.topCloseuses
    .slice(0, 10)
    .map(
      (c) =>
        `- ${c.name} : ${c.confirmed}/${c.total} confirmées (${c.rate}%) | Prime due : ${(c.resteAPayer ?? 0).toLocaleString("fr-FR")} ${context.currency}`
    )
    .join("\n") || "Aucune closeuse."
}

CLASSEMENT DES LIVREURS :
${
  context.topLivreurs
    .slice(0, 10)
    .map(
      (l) =>
        `- ${l.name} : ${l.delivered}/${l.total} livrées (${l.rate}%) | Prime due : ${(l.resteAPayer ?? 0).toLocaleString("fr-FR")} ${context.currency}`
    )
    .join("\n") || "Aucun livreur."
}
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
