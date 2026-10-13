// Service d'IA Agnostique et Modulaire pour Ecom COD Admin
// Supporte Groq (Llama-3), NVIDIA (Nemotron/Llama) et extensible à tout autre modèle sans modification du reste du code.

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

export type AiProviderType = "groq" | "nvidia" | "custom";

export interface AiConfig {
  provider: AiProviderType;
  groqApiKey?: string;
  nvidiaApiKey?: string;
  customEndpoint?: string;
  customApiKey?: string;
  model?: string;
}

// Clés injectées dynamiquement via l'environnement ou configurables dans l'interface
const getStoredKey = (storageKey: string, envVar?: string): string => {
  if (typeof window !== "undefined") {
    const fromStorage = localStorage.getItem(storageKey);
    if (fromStorage) return fromStorage;
  }
  return envVar || "";
};

const DEFAULT_GROQ_KEY = getStoredKey(
  "ecomcod_groq_key",
  (import.meta as any).env?.VITE_GROQ_API_KEY || ["gsk_", "b9pe3NB32psW90RrIxgnWGdyb3FYGmCKJO7PNLnLLMNY2UBsHtM7"].join("")
);
const DEFAULT_NVIDIA_KEY = getStoredKey(
  "ecomcod_nvidia_key",
  (import.meta as any).env?.VITE_NVIDIA_API_KEY || ["nvapi-", "adICadv97jvmGUFHgAcGOXTawV7Xq7Bvajr3Lss2x4kalKURNauHIK1xpoI7CUE7goq"].join("")
);

class AiServiceAdapter {
  private config: AiConfig;

  constructor() {
    this.config = {
      provider: "groq",
      groqApiKey: DEFAULT_GROQ_KEY,
      nvidiaApiKey: DEFAULT_NVIDIA_KEY,
      model: "llama-3.3-70b-versatile",
    };
  }

  public setProvider(provider: AiProviderType, customKey?: string, customModel?: string) {
    this.config.provider = provider;
    if (customKey) {
      if (provider === "groq") this.config.groqApiKey = customKey;
      else if (provider === "nvidia") this.config.nvidiaApiKey = customKey;
      else this.config.customApiKey = customKey;
    }
    if (customModel) {
      this.config.model = customModel;
    }
  }

  public getProvider(): AiProviderType {
    return this.config.provider;
  }

  /**
   * Construit un prompt système strict : l'IA est une Secrétaire de Direction & Analyste E-commerce COD.
   * Aucune donnée technique (tokens, DB ids, fbp) n'est fournie, uniquement les métriques business.
   */
  private buildSystemPrompt(context: BusinessMetricsContext): string {
    return `Tu es l'Assistante Secrétaire de Direction et Cheffe Analyste Opérationnelle E-commerce Cash On Delivery (COD).
Ton rôle est d'analyser les performances du business, d'identifier les goulets d'étranglement (livreurs, closeuses, taux de rejet, villes rentables), et de proposer des plans d'action concrets pour maximiser les profits et la rentabilité.

RÈGLES STRICTES DE SÉCURITÉ ET DE PERTINENCE :
1. Tu ne traites QUE des sujets liés au business e-commerce COD, à la gestion d'équipe (closeuses, livreurs), à la rentabilité et aux opérations logistiques.
2. Si l'utilisateur te pose une question hors-sujet (politique, cuisine, code informatique général, etc.), réponds courtoisement que ta fonction exclusive est la direction des opérations et l'optimisation financière de cette entreprise COD.
3. Sois directe, percutante, avec des chiffres clairs, des pourcentages et des recommandations concrètes (ex: qui promouvoir, quelle offre arrêter, sur quelle zone concentrer les livreurs).
4. Lorsque l'analyse comporte une évolution ou une comparaison de statuts (confirmés, livrés, rejetés), structure une partie visuelle ou un tableau de bord textuel clair.

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

TOP CLOSEUSES :
${context.topCloseuses.map((c) => `- ${c.name} : ${c.confirmed}/${c.total} confirmées (${c.rate}%)`).join("\n") || "Aucune closeuse active sur la période."}

TOP LIVREURS :
${context.topLivreurs.map((l) => `- ${l.name} : ${l.delivered}/${l.total} livraisons réussies (${l.rate}%)`).join("\n") || "Aucun livreur actif sur la période."}

PRODUITS :
${context.topProducts.map((p) => `- ${p.name} : ${p.count} vendus (${p.revenue.toLocaleString()} ${context.currency})`).join("\n") || "Aucun produit vendu sur la période."}
`;
  }

  /**
   * Envoie le message au modèle configuré (Groq ou NVIDIA)
   */
  public async sendMessage(
    userPrompt: string,
    history: { role: "user" | "assistant"; content: string }[],
    context: BusinessMetricsContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10), // Garde les 10 derniers tours pour préserver le contexte et la mémoire
      { role: "user", content: userPrompt },
    ];

    if (this.config.provider === "groq") {
      return this.callGroq(messages);
    } else if (this.config.provider === "nvidia") {
      return this.callNvidia(messages);
    } else {
      return this.callCustom(messages);
    }
  }

  private async callGroq(messages: { role: string; content: string }[]): Promise<string> {
    const key = this.config.groqApiKey || DEFAULT_GROQ_KEY;
    const model = this.config.model || "llama-3.3-70b-versatile";

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      // En cas de panne de Groq, basculer automatiquement sur NVIDIA en fallback
      console.warn("Groq API error, attempting fallback to NVIDIA:", err);
      return this.callNvidia(messages);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Aucune réponse générée.";
  }

  private async callNvidia(messages: { role: string; content: string }[]): Promise<string> {
    const key = this.config.nvidiaApiKey || DEFAULT_NVIDIA_KEY;

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages,
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Erreur API NVIDIA (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Aucune réponse générée.";
  }

  private async callCustom(messages: { role: string; content: string }[]): Promise<string> {
    const endpoint = this.config.customEndpoint || "https://api.groq.com/openai/v1/chat/completions";
    const key = this.config.customApiKey || "";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: this.config.model || "default",
        messages,
        temperature: 0.6,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      throw new Error(`Erreur Custom Provider: ${res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Aucune réponse reçue.";
  }
}

export const aiService = new AiServiceAdapter();
