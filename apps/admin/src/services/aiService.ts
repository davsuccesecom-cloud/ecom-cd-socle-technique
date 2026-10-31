import { COD_AFRIQUE_PLAYBOOK } from "../lib/codAfriquePlaybook";
import { buildChartPrompt } from "../lib/aiChart";

// Service d'IA Agnostique et Modulaire pour Ecom COD Admin.
//
// Les appels passent par la Cloud Function `aiChatProxy` (serveur) : les cles
// fournisseurs restent cote serveur et ne sont jamais livrees au navigateur.
// Le proxy enchaine les fournisseurs gratuits (Groq, Gemini, NVIDIA, OpenRouter,
// Cloudflare, Pollinations) et bascule automatiquement en cas de quota epuise.

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

/**
 * Identifiants de fournisseurs. "auto" laisse le proxy choisir et basculer
 * entre les moteurs disponibles (recommande : le quota d'un seul moteur ne
 * peut plus casser l'assistant).
 */
export type AiProviderType =
  | "auto"
  | "groq"
  | "gemini"
  | "nvidia"
  | "openrouter"
  | "cloudflare"
  | "pollinations";

export interface AiConfig {
  provider: AiProviderType;
  model?: string;
}

/** Endpoint de la passerelle IA (Firebase Functions, projet meta-capi-app). */
const AI_PROXY_URL = "https://us-central1-meta-capi-app.cloudfunctions.net/aiChatProxy";

class AiServiceAdapter {
  private config: AiConfig;

  constructor() {
    this.config = {
      provider: "auto",
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

  /**
   * Construit un prompt systeme complet et enrichi : l'IA est une Secretaire de Direction & Analyste E-commerce COD.
   * Injecte le Playbook COD Afrique, le formatage strict des dates (UTC Lomé/Dakar/Abidjan),
   * et les instructions pour générer des courbes d'analyse interactives.
   */
  public buildSystemPrompt(context: BusinessMetricsContext): string {
    const today = new Date().toISOString().slice(0, 10);
    return `Tu es l'Assistante Secrétaire de Direction et Cheffe Analyste Opérationnelle E-commerce Cash On Delivery (COD).
Ton rôle est d'analyser les performances du business, d'identifier les goulots d'étranglement (livreurs, closeuses, taux de rejet, villes rentables), et de proposer des plans d'action concrets pour maximiser les profits et la rentabilité.

${COD_AFRIQUE_PLAYBOOK}

${buildChartPrompt(today)}

RÈGLES STRICTES DE SÉCURITÉ ET DE PERTINENCE :
1. Tu ne traites QUE des sujets liés au business e-commerce COD, à la gestion d'équipe (closeuses, livreurs), à la rentabilité et aux opérations logistiques.
2. Si l'utilisateur te pose une question hors-sujet, réponds courtoisement que ta fonction exclusive est la direction des opérations et l'optimisation financière de cette entreprise COD.
3. Sois directe, percutante, avec des chiffres clairs, des pourcentages et des recommandations concrètes.
4. Lorsque l'analyse comporte une évolution ou une comparaison de statuts (confirmés, livrés, rejetés), ajoute systématiquement un bloc de graphique interactif (\`\`\`chart ... \`\`\`) pour visualiser la tendance.

DONNÉES BUSINESS DU COMPTE ET DE L'ÉQUIPE :
- Équipe : ${context.teamName} (Pays : ${context.country})
- Période analysée : ${context.periodLabel}
- Devise locale : ${context.currency}
- Total Commandes entrantes : ${context.totalOrders}
- Commandes Confirmées par closeuses : ${context.confirmedOrders} (Taux: ${context.confirmationRate}%)
- Commandes Livrées et encaissées : ${context.deliveredOrders} (Taux de livraison réelle: ${context.deliveryRate}%)
- Injoignables : ${context.injoignableOrders}
- Rejetées / Refusées : ${context.rejectedOrders}
- Chiffre d'Affaires Encaissé : ${context.revenue.toLocaleString()} ${context.currency}

ÉVOLUTION DES TENDANCES JOURNALIÈRES :
${context.dailyTrends?.length ? context.dailyTrends.map(t => `- ${t.date} : ${t.confirmed} confirmées, ${t.delivered} livrées, ${t.rejected} rejetées/injoignables, CA: ${t.revenue.toLocaleString()} ${context.currency}`).join("\n") : "Pas d'historique journalier suffisant sur cette période."}

TOP CLOSEUSES :
${context.topCloseuses.map((c) => `- ${c.name} : ${c.confirmed}/${c.total} confirmées (${c.rate}%)`).join("\n") || "Aucune closeuse active sur la période."}

TOP LIVREURS :
${context.topLivreurs.map((l) => `- ${l.name} : ${l.delivered}/${l.total} livraisons réussies (${l.rate}%)`).join("\n") || "Aucun livreur actif sur la période."}

PRODUITS :
${context.topProducts.map((p) => `- ${p.name} : ${p.count} vendus (${p.revenue.toLocaleString()} ${context.currency})`).join("\n") || "Aucun produit vendu sur la période."}
`;
  }

  /**
   * Envoie une conversation deja constituee au proxy serveur, sans injecting
   * de prompt systeme. Utilise par l'assistant admin qui construit son propre
   * prompt a partir des metriques live.
   */
  public async sendRaw(messages: { role: string; content: string }[]): Promise<string> {
    const res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: this.config.provider,
        model: this.config.model,
        messages,
        temperature: 0.6,
        maxTokens: 4000,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };

    if (!res.ok) {
      throw new Error(data.error || `Erreur ${res.status} du proxy IA.`);
    }

    if (!data.text) {
      throw new Error("Le proxy IA a renvoyé une réponse vide.");
    }

    return data.text;
  }

  /**
   * Envoie le message au proxy serveur, qui redistribue vers les fournisseurs.
   */
  public async sendMessage(
    userPrompt: string,
    history: { role: "user" | "assistant"; content: string }[],
    context: BusinessMetricsContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
      { role: "user", content: userPrompt },
    ];

    const res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: this.config.provider,
        model: this.config.model,
        messages,
        temperature: 0.6,
        maxTokens: 4000,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };

    if (!res.ok) {
      throw new Error(data.error || `Erreur ${res.status} du proxy IA.`);
    }

    if (!data.text) {
      throw new Error("Le proxy IA a renvoyé une réponse vide.");
    }

    return data.text;
  }
}

export const aiService = new AiServiceAdapter();
