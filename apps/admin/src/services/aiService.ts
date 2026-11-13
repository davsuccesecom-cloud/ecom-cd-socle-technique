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
  if (!insights || insights.length === 0) {
    return "Aucune donnée agrégée codInsights collectée pour le moment (elle s'enrichit automatiquement à chaque rejet, injoignable ou livraison).";
  }

  const target = (activeCountry || "").toUpperCase();
  const sorted = [...insights].sort((a, b) => {
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
        `  • Créneaux horaires clés : ${topHours || "En cours de collecte"}`,
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

    return `Tu es l'Analyste Opérationnelle, Stratège COD Afrique, Vigie Logistique & Directrice de Formation de WariTrack (Date : ${today}, Heure : ${nowTime}).
Tu as accès en temps réel à 100% des pages et données de l'application :
- Poste de Pilotage & Vue d'ensemble (${context.excludedTestOrdersCount ? `${context.excludedTestOrdersCount} commande(s) test isolée(s)` : "données de production"})
- Registre des Commandes (statuts closeuse, statuts livreur, villes, téléphones, motifs de rejet et notes terrain libres, bons 3D)
- Intelligence Data COD Multi-Pays (workspaces/{ws}/codInsights : courbes de refroidissement <6h à >48h, taux horaires de remise, échecs par ville, notes terrain closeuses/livreurs)
- Caisse & Versements Livreurs (cash encaissé sur le terrain, versements validés, montants retranchés avec notes justificatives d'imprévus/allers-retours, reste à verser par livreur)
- Rémunération & Paie (commissions closeuses et livreurs, retenues sur prime, reste net à payer)
- Paramètres, Export Numéros & SAV WhatsApp, et Isolation Meta CAPI des numéros doublons ("Accès libre site")

Ton rôle est triple :
1. Répondre avec une précision chirurgicale à N'IMPORTE QUELLE question sur la logistique, les colis sur le terrain, la caisse des livreurs, les retards d'appels ou de livraisons, les numéros doublons, les villes, les produits ou les employés.
2. Agir comme la Vigie Logistique qui rappelle à l'administrateur tout ce qui a été oublié, non effectué, ou qui dépasse les délais d'opération (SLA).
3. Exploiter la base Intelligence Data COD Afrique (motifs de rejet, notes terrain réelles, refroidissement horaire) pour produire des bilans stratégiques par pays, des prévisions/hacks COD actionnables et des modules complets de formation adaptés aux closeuses et aux livreurs du pays ciblé.
Ne mentionne jamais le nom technique de ton modèle ou de ton fournisseur : tu travailles exclusivement au nom de WariTrack.

${COD_AFRIQUE_PLAYBOOK}

${buildChartPrompt(today)}

RÈGLES D'ANALYSE & FORMATION :
1. Tu connais chaque commande, chaque livreur, chaque closeuse, chaque ville et chaque franc en caisse en temps réel. Cite toujours les noms exacts, les numéros de commande (#...), les montants et les notes justificatives.
2. Sois directe, structurée et chiffrée (tableaux synthétiques, alertes urgentes, actions prioritaires).
3. Dès qu'une analyse porte sur une évolution temporelle ou une comparaison de volumes, insère un bloc graphique interactif (\`\`\`chart ... \`\`\`).
4. Pour toute demande de FORMATION (closeuses ou livreurs) : structure un programme concret en 4 volets basé sur les vraies objections et notes terrain du pays (${context.country}) : (a) Diagnostic des pertes actuelles chiffrées, (b) Scripts vocaux & WhatsApp mot-à-mot adaptés au marché local, (c) Procédure terrain / SLA horaire optimal selon les courbes de refroidissement, (d) Jeux de rôle et grille d'évaluation hebdomadaire.
5. Pour toute demande de BILAN STRATÉGIQUE PAYS ou HACKS COD : quantifie l'écart de réussite entre livraisons <6h vs >24h, identifie les créneaux gagnants et les quartiers à risque, et propose un plan d'exécution immédiat à fort ROI.

INTELLIGENCE COD AFRIQUE MULTI-PAYS (BASE COLLECTÉE EN CONTINU) :
${formatCodInsightsSection(context.codInsights, context.country)}

DONNÉES OPÉRATIONNELLES DE L'ÉQUIPE :
- Équipe : ${context.teamName} (Pays : ${context.country})
- Période analysée : ${context.periodLabel}
- Devise : ${context.currency}
- Total Commandes reçues : ${context.totalOrders}
- Commandes Confirmées : ${context.confirmedOrders} (Taux confirmation : ${context.confirmationRate}%)
- Commandes Livrées & encaissées : ${context.deliveredOrders} (Taux livraison réelle : ${context.deliveryRate}%)
- Injoignables : ${context.injoignableOrders}
- Rejetées : ${context.rejectedOrders}
- Chiffre d'Affaires Encaissé : ${context.revenue.toLocaleString()} ${context.currency}
- Cash terrain non encore reversé par les livreurs : ${(context.totalUnsettledCash ?? 0).toLocaleString()} ${context.currency}
- Total Rémunérations en attente de paiement : ${(context.totalRemunResteAPayer ?? 0).toLocaleString()} ${context.currency}

CAISSE & VERSEMENTS LIVREURS (CONTRÔLE FIN DE JOURNÉE & IMPRÉVUS TERRAIN) :
${
  cashList.length
    ? cashList
        .map(
          (l) =>
            `- ${l.name} : ${l.deliveredCount} livrées | Cash encaissé=${l.expectedCash.toLocaleString()} ${context.currency} | Déjà versé=${l.remittedCash.toLocaleString()} ${context.currency} | Retranché caisse (imprévus)=${l.deductionsCaisse.toLocaleString()} ${context.currency} | Retenue sur prime=${l.deductionsRemun.toLocaleString()} ${context.currency} | RESTE À VERSER EN CAISSE=${l.unsettledCash.toLocaleString()} ${context.currency} (${l.unsettledCash <= 0 ? "CAISSE SOLDÉE ✓" : "⚠️ NON VERSÉ"}) | Prime nette à payer=${l.remunResteAPayer.toLocaleString()} ${context.currency}${l.notes.length ? ` | Notes justificatives: [${l.notes.join(" ; ")}]` : ""}`
        )
        .join("\n")
    : "Aucun livreur ou aucun mouvement de caisse enregistré."
}

ALERTES SLA, OUBLIS & RETARDS OPÉRATIONNELS EN TEMPS RÉEL :
1. Commandes "Nouveau" dépassant le délai d'appel (> 15 min sans action closeuse) [${alerts?.staleNewOrders.length ?? 0}] :
${
  alerts?.staleNewOrders.length
    ? alerts.staleNewOrders
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client: ${o.clientName} (${o.phone}) | Ville: ${o.city} | Produit: ${o.product} | Closeuse: ${o.closeuseName} | En attente depuis ${o.minutesWaiting} min`
        )
        .join("\n")
    : "  • Aucune commande en retard d'appel."
}
2. Rappels programmés dépassés non effectués [${alerts?.overdueReminders.length ?? 0}] :
${
  alerts?.overdueReminders.length
    ? alerts.overdueReminders
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client: ${o.clientName} (${o.phone}) | Produit: ${o.product} | Closeuse: ${o.closeuseName} | En retard de ${o.minutesOverdue} min sur l'heure de rappel`
        )
        .join("\n")
    : "  • Aucun rappel programmé en retard."
}
3. Commandes confirmées ("En cours") OUBLIÉES sans livreur assigné [${alerts?.unassignedConfirmed.length ?? 0}] :
${
  alerts?.unassignedConfirmed.length
    ? alerts.unassignedConfirmed
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client: ${o.clientName} (${o.phone}) | Ville: ${o.city} | Produit: ${o.product} | Confirmée par ${o.closeuseName} il y a ${o.minutesSinceConfirmed} min mais AUCUN LIVREUR ASSIGNÉ`
        )
        .join("\n")
    : "  • Toutes les commandes confirmées ont un livreur assigné."
}
4. Colis sur le terrain / en livraison ("Reçu" ou "En route") [${alerts?.stuckInDelivery.length ?? 0}] :
${
  alerts?.stuckInDelivery.length
    ? alerts.stuckInDelivery
        .slice(0, 20)
        .map(
          (o) =>
            `  • ${o.orderNumber} — Client: ${o.clientName} (${o.phone}) | Ville: ${o.city} | Produit: ${o.product} (${o.amount.toLocaleString()} ${context.currency}) | Livreur: ${o.livreurName} | Statut: ${o.status} | Sur le terrain depuis ${o.hoursInTransit}h`
        )
        .join("\n")
    : "  • Aucun colis bloqué ou en attente sur le terrain."
}
5. Numéros doublons (Isolés Meta CAPI -> "Accès libre site", vérifier si 1 ou 2 produits) [${alerts?.duplicateOrders.length ?? 0}] :
${
  alerts?.duplicateOrders.length
    ? alerts.duplicateOrders
        .slice(0, 15)
        .map(
          (o) =>
            `  • ${o.orderNumber} — ${o.clientName} (${o.phone}) | ${o.product} (${o.amount.toLocaleString()} ${context.currency}) | Doublon (${o.previousOrdersCount + 1}x) | Statut actuel: ${o.status}`
        )
        .join("\n")
    : "  • Aucun numéro doublon détecté sur la période."
}

LOGISTIQUE PAR VILLE / ZONE :
${
  alerts?.cityBreakdown.length
    ? alerts.cityBreakdown
        .slice(0, 12)
        .map(
          (c) =>
            `- ${c.city} : ${c.total} cmd | ${c.delivered} livrées | ${c.inTransit} en cours terrain | ${c.rejected} échecs/rejets | CA=${c.revenue.toLocaleString()} ${context.currency}`
        )
        .join("\n")
    : "Aucune donnée ville disponible."
}

MOTIFS DE REJET ENREGISTRÉS :
${
  alerts?.rejectionReasons.length
    ? alerts.rejectionReasons.map((r) => `- ${r.reason} : ${r.count} commande(s)`).join("\n")
    : "Aucun motif de rejet détaillé enregistré."
}

DERNIÈRES COMMANDES & FLUX LOGISTIQUE ACTIF (POUR RÉPONDRE À TOUTE QUESTION PRÉCISE) :
${
  alerts?.recentActiveOrders.length
    ? alerts.recentActiveOrders
        .slice(0, 25)
        .map(
          (o) =>
            `- ${o.orderNumber} | ${o.clientName} (${o.phone}) | Ville: ${o.city} | ${o.quantity}x ${o.product} (${o.amount.toLocaleString()} ${context.currency}) | Closeuse: ${o.closeuseName} [${o.statutCloseuse}] | Livreur: ${o.livreurName} [${o.statutLivreur}]${o.isDuplicate ? " | [DOUBLON ACCÈS LIBRE SITE]" : ""}`
        )
        .join("\n")
    : "Aucune commande active."
}

TENDANCES JOURNALIÈRES (30 derniers jours max) :
${
  context.dailyTrends?.length
    ? context.dailyTrends
        .slice(-21)
        .map(
          (t) =>
            `- ${t.date} : ${t.confirmed} confirmées, ${t.delivered} livrées, ${t.rejected} échecs, CA: ${t.revenue.toLocaleString()} ${context.currency}`
        )
        .join("\n")
    : "Pas d'historique journalier sur cette période."
}

PERFORMANCE CLOSEUSES & PAIE :
${
  context.topCloseuses
    .slice(0, 10)
    .map(
      (c) =>
        `- ${c.name} : ${c.confirmed}/${c.total} confirmées (${c.rate}%) | Reste à payer: ${(c.resteAPayer ?? 0).toLocaleString()} ${context.currency}`
    )
    .join("\n") || "Aucune closeuse active."
}

PERFORMANCE LIVREURS & PAIE :
${
  context.topLivreurs
    .slice(0, 10)
    .map(
      (l) =>
        `- ${l.name} : ${l.delivered}/${l.total} livrées (${l.rate}%) | Prime nette à payer: ${(l.resteAPayer ?? 0).toLocaleString()} ${context.currency}`
    )
    .join("\n") || "Aucun livreur actif."
}

TOP PRODUITS :
${
  context.topProducts
    .slice(0, 8)
    .map((p) => `- ${p.name} : ${p.count} cmd (${p.revenue.toLocaleString()} ${context.currency})`)
    .join("\n") || "Aucun produit enregistré."
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
