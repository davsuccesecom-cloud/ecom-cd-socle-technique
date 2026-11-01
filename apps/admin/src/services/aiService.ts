import { COD_AFRIQUE_PLAYBOOK } from "../lib/codAfriquePlaybook";
import { buildChartPrompt } from "../lib/aiChart";
import { formatFirebaseError } from "../lib/firebaseErrors";

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
  topCloseuses: { name: string; confirmed: number; total: number; rate: number }[];
  topLivreurs: { name: string; delivered: number; total: number; rate: number }[];
  topProducts: { name: string; count: number; revenue: number }[];
  dailyTrends: { date: string; confirmed: number; delivered: number; rejected: number; revenue: number }[];
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
    return `Tu es l'Analyste Opérationnelle & Secrétaire de Direction d'Ecom COD.
Ton rôle est d'analyser les performances du business, d'identifier les goulots d'étranglement (livreurs, closeuses, taux de rejet, villes rentables), et de proposer des plans d'action concrets pour maximiser la rentabilité nette.
Ne mentionne jamais le nom technique de ton modèle ou de ton fournisseur : tu travailles exclusivement au nom de la plateforme Ecom COD.

${COD_AFRIQUE_PLAYBOOK}

${buildChartPrompt(today)}

RÈGLES D'ANALYSE :
1. Tu ne traites que des sujets liés au business e-commerce COD, à la gestion d'équipe (closeuses, livreurs), à la rentabilité et aux opérations logistiques.
2. Sois directe, structurée et chiffrée (tableaux synthétiques, pourcentages, actions prioritaires).
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

PERFORMANCE CLOSEUSES :
${
  context.topCloseuses
    .slice(0, 10)
    .map((c) => `- ${c.name} : ${c.confirmed}/${c.total} confirmées (${c.rate}%)`)
    .join("\n") || "Aucune closeuse active."
}

PERFORMANCE LIVREURS :
${
  context.topLivreurs
    .slice(0, 10)
    .map((l) => `- ${l.name} : ${l.delivered}/${l.total} livrées (${l.rate}%)`)
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
