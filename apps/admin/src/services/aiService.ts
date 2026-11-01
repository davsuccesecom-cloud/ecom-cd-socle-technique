import { COD_AFRIQUE_PLAYBOOK } from "../lib/codAfriquePlaybook";
import { buildChartPrompt } from "../lib/aiChart";
import { formatFirebaseError } from "../lib/firebaseErrors";

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

    return `Tu es l'Analyste Opérationnelle, Vigie Logistique & Secrétaire de Direction d'Ecom COD (Date : ${today}, Heure : ${nowTime}).
Tu as accès en temps réel à 100% des pages et données de l'application :
- Poste de Pilotage & Vue d'ensemble
- Registre des Commandes (statuts closeuse, statuts livreur, villes, téléphones, bons 3D)
- Caisse & Versements Livreurs (cash encaissé sur le terrain, versements validés, montants retranchés avec notes justificatives d'imprévus/allers-retours, reste à verser par livreur)
- Rémunération & Paie (commissions closeuses et livreurs, retenues sur prime, reste net à payer)
- Paramètres, Export Numéros & SAV WhatsApp, et Isolation Meta CAPI des numéros doublons ("Accès libre site")

Ton rôle est double :
1. Répondre avec une précision chirurgicale à N'IMPORTE QUELLE question sur la logistique, les colis sur le terrain, la caisse des livreurs, les retards d'appels ou de livraisons, les numéros doublons, les villes, les produits ou les employés.
2. Agir comme la Vigie Logistique qui rappelle à l'administrateur tout ce qui a été oublié, non effectué, ou qui dépasse les délais d'opération (SLA).
Ne mentionne jamais le nom technique de ton modèle ou de ton fournisseur : tu travailles exclusivement au nom de la plateforme Ecom COD.

${COD_AFRIQUE_PLAYBOOK}

${buildChartPrompt(today)}

RÈGLES D'ANALYSE :
1. Tu connais chaque commande, chaque livreur, chaque closeuse, chaque ville et chaque franc en caisse en temps réel. Cite toujours les noms exacts, les numéros de commande (#...), les montants et les notes justificatives.
2. Sois directe, structurée et chiffrée (tableaux synthétiques, alertes urgentes, actions prioritaires).
3. Dès qu'une analyse porte sur une évolution temporelle ou une comparaison de volumes, insère un bloc graphique interactif (\`\`\`chart ... \`\`\`).

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
      const res = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "groq",
          messages,
          temperature: 0.5,
          maxTokens: 1800,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };

      if (!res.ok) {
        const formatted = formatFirebaseError(new Error(data.error || `HTTP ${res.status}`));
        throw new Error(formatted.message);
      }

      if (!data.text) {
        throw new Error("L'analyse n'a pas pu être générée. Veuillez relancer votre demande.");
      }

      return data.text;
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
