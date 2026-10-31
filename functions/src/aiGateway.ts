/**
 * Passerelle IA multi-fournisseurs avec rotation automatique.
 *
 * Pourquoi ce module existe :
 * les paliers gratuits de chaque fournisseur sont plafonnes (Groq ~1 000 req/jour,
 * OpenRouter 50 req/jour sans achat de credits, Cloudflare 10 000 neurones/jour...).
 * Un seul fournisseur = l'assistant tombe au premier pic d'usage. Ici on enchaine
 * les fournisseurs : en cas de 429 (quota), 401 (cle invalide) ou 5xx, on passe
 * au suivant jusqu'a obtenir une reponse.
 *
 * Les modeles listes ci-dessous sont ceux documentes comme gratuits ou credites
 * sur chaque portail. Les quotas cites sont releves sur la doc officielle (voir
 * docs/APIS-GRATUITES.md pour les liens et les dates).
 *
 * Aucun secret n'est code en dur : les cles viennent de process.env, injectees
 * par firebase (functions/.env en local, variables d'environnement en prod).
 */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderConfig {
  id: string;
  label: string;
  /** Endpoint OpenAI-compatible (POST, corps { model, messages, ... }). */
  baseUrl: string;
  /** Modele prefere. */
  defaultModel: string;
  /** Modeles de repli, testes dans l'ordre si le precedent est indisponible. */
  models: string[];
  /** Variables d'environnement requises. Toutes doivent etre remplies. */
  envKeys: string[];
  /** En-tetes additionnels (ex: account id Cloudflare). */
  extraHeaders?: (env: Record<string, string | undefined>) => Record<string, string>;
  /** Libelle court du quota gratuit, affiche dans l'admin. */
  freeTier: string;
  /** Documentation officielle des quotas. */
  docsUrl: string;
}

/* -------------------------------------------------------------------------- */
/*  Catalogue des fournisseurs                                                 */
/* -------------------------------------------------------------------------- */

export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "openai/gpt-oss-120b",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
    envKeys: ["GROQ_API_KEY"],
    freeTier: "30 req/min, 1 000 req/jour, 200 000 tokens/jour",
    docsUrl: "https://console.groq.com/docs/rate-limits",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-3.8-flash",
    models: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
    envKeys: ["GEMINI_API_KEY"],
    freeTier: "Entree et sortie gratuites (palier free), quotas par modele",
    docsUrl: "https://ai.google.dev/gemini-api/docs/rate-limits",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    defaultModel: "nvidia/nemotron-3-super-120b-a12b",
    models: [
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3.5-lightning-30b-a3b",
      "openai/gpt-oss-120b",
      "z-ai/glm-5.3-flash",
      "meta/llama-3.3-70b-instruct",
    ],
    envKeys: ["NVIDIA_API_KEY"],
    freeTier: "Credits de developpeur offerts sur build.nvidia.com",
    docsUrl: "https://docs.api.nvidia.com/nim/reference/llm-apis",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openrouter/free",
    models: [
      "openrouter/free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
      "minimax/minimax-m3.1-flash:free",
    ],
    envKeys: ["OPENROUTER_API_KEY"],
    freeTier: "20 req/min ; 50 req/jour sans credit, 1 000 avec 10 $ de credits",
    docsUrl: "https://openrouter.ai/docs/api-reference/limits",
  },
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions",
    defaultModel: "@cf/openai/gpt-oss-120b",
    models: [
      "@cf/openai/gpt-oss-120b",
      "@cf/qwen/qwen3.8-27b",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/ibm-granite-4.0-h-micro",
      "@cf/google/gemma-4-26b-a4b-it",
    ],
    envKeys: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
    freeTier: "10 000 neurones/jour, 300 req/min en generation de texte",
    docsUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
  },
  {
    id: "pollinations",
    label: "Pollinations",
    baseUrl: "https://gen.pollinations.ai/v1/chat/completions",
    defaultModel: "openai/gpt-oss-20b",
    models: ["openai/gpt-oss-20b", "meta/llama-3.3-70b-instruct", "google/gemini-3.8-flash"],
    envKeys: ["POLLINATIONS_API_KEY"],
    freeTier: "Pollen gratuit via les quetes de la communaute",
    docsUrl: "https://gen.pollinations.ai/docs/llm.txt",
  },
];

/* -------------------------------------------------------------------------- */
/*  Utilitaires                                                                */
/* -------------------------------------------------------------------------- */

export interface AiAttempt {
  provider: string;
  model: string;
  status: number | null;
  error?: string;
}

export interface AiResult {
  text: string;
  provider: string;
  model: string;
  attempts: AiAttempt[];
}

const MAX_TOKENS_CEILING = 8192;
const MAX_MESSAGES = 30;

/** Duree de blocage d'un fournisseur apres un 429 (ms). */
const RATE_LIMIT_COOLDOWN_MS = 60_000;

const cooldowns = new Map<string, number>();

function isCoolingDown(providerId: string): boolean {
  const until = cooldowns.get(providerId);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns.delete(providerId);
    return false;
  }
  return true;
}

function coolDown(providerId: string): void {
  cooldowns.set(providerId, Date.now() + RATE_LIMIT_COOLDOWN_MS);
}

export function getProvider(id: string): AiProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

/** Un fournisseur est utilisable si toutes ses variables d'environnement sont remplies. */
export function isProviderConfigured(id: string, env: Record<string, string | undefined> = process.env): boolean {
  const provider = getProvider(id);
  if (!provider) return false;
  return provider.envKeys.every((key) => Boolean(env[key] && env[key]!.trim()));
}

export function configuredProviderIds(env: Record<string, string | undefined> = process.env): string[] {
  return AI_PROVIDERS.filter((p) => isProviderConfigured(p.id, env)).map((p) => p.id);
}

function buildUrl(provider: AiProviderConfig, env: Record<string, string | undefined>): string {
  return provider.baseUrl.replace(/\{(\w+)\}/g, (_m, key: string) => env[key] ?? "");
}

/**
 * Ordre d'essai en mode "auto" : on demarre sur un fournisseur different a chaque
 * appel (rotation sur le quart d'heure) pour repartir la charge sur tous les
 * quotas gratuits au lieu de vider celui du premier de la liste.
 */
export function rotationOrder(
  providerIds: string[],
  preferred?: string | null,
  now: number = Date.now()
): string[] {
  if (providerIds.length === 0) return [];
  if (preferred && providerIds.includes(preferred)) {
    return [preferred, ...providerIds.filter((id) => id !== preferred)];
  }
  const bucket = Math.floor(now / (15 * 60 * 1000));
  const offset = bucket % providerIds.length;
  return [...providerIds.slice(offset), ...providerIds.slice(0, offset)];
}

/** Seuls les modeles gpt-oss exposent reasoning_effort de facon fiable. */
function supportsReasoningEffort(model: string): boolean {
  return model.includes("gpt-oss");
}

function extractText(payload: unknown): string {
  const data = payload as {
    choices?: { message?: { content?: unknown }; text?: unknown }[];
    output?: { text?: unknown }[];
    result?: { response?: unknown };
  };
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    // Certains fournisseurs (OpenAI-compat) renvoient un tableau de fragments.
    const joined = content
      .map((part) => (typeof part === "string" ? part : (part as { text?: string })?.text ?? ""))
      .join("");
    if (joined.trim()) return joined.trim();
  }
  if (typeof choice?.text === "string") return choice.text.trim();
  const output = data?.output?.[0]?.text;
  if (typeof output === "string") return output.trim();
  const cf = data?.result?.response;
  if (typeof cf === "string") return cf.trim();
  return "";
}

function describeError(status: number, body: string): string {
  const trimmed = body.replace(/\s+/g, " ").slice(0, 300);
  return `HTTP ${status}${trimmed ? ` : ${trimmed}` : ""}`;
}

export interface ChatOptions {
  messages: AiMessage[];
  /** "auto" enchaine tous les fournisseurs configures. */
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly attempts: AiAttempt[]
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

/**
 * Envoie un chat completion, en essayant les fournisseurs un par un.
 *
 * Regles de bascule :
 *  - 401/403 : cle invalide ou non configuree -> on saute ce fournisseur.
 *  - 404/410 : modele indisponible pour cette cle -> on essaie le modele suivant
 *    du meme fournisseur, puis le fournisseur suivant.
 *  - 429 : quota epuise -> on memorise un blocage court et on passe au suivant.
 *  - 5xx / erreur reseau -> on passe au suivant.
 */
export async function chatCompletion(options: ChatOptions): Promise<AiResult> {
  const env = options.env ?? process.env;
  const doFetch = options.fetchImpl ?? fetch;

  const messages = (options.messages ?? []).slice(-MAX_MESSAGES);
  if (messages.length === 0) {
    throw new AiGatewayError("Aucun message a envoyer.", []);
  }

  const configured = configuredProviderIds(env);
  if (configured.length === 0) {
    throw new AiGatewayError(
      "Aucune cle IA configuree. Renseigne au moins une variable d'environnement (GROQ_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY, OPENROUTER_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, POLLINATIONS_API_KEY).",
      []
    );
  }

  const order = rotationOrder(configured, options.provider ?? null);
  const attempts: AiAttempt[] = [];
  const temperature = options.maxTokens !== undefined ? undefined : options.temperature ?? 0.6;
  const maxTokens = Math.min(options.maxTokens ?? 1500, MAX_TOKENS_CEILING);

  for (const providerId of order) {
    const provider = getProvider(providerId);
    if (!provider) continue;

    if (isCoolingDown(providerId)) {
      attempts.push({ provider: providerId, model: provider.defaultModel, status: null, error: "quota-epuise (attente)" });
      continue;
    }

    const apiKey = env[provider.envKeys[0]];
    if (!apiKey) continue;

    // Modeles a essayer : celui demande s'il est connu, sinon la liste du fournisseur.
    const modelChain = provider.models.filter((m) => m !== options.model);
    if (options.model && provider.models.includes(options.model)) {
      modelChain.unshift(options.model);
    }

    for (const model of modelChain) {
      const url = buildUrl(provider, env);
      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: maxTokens,
        stream: false,
      };
      if (temperature !== undefined) body.temperature = temperature;
      if (supportsReasoningEffort(model)) body.reasoning_effort = "low";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      if (provider.extraHeaders) {
        Object.assign(headers, provider.extraHeaders(env));
      }

      try {
        const response = await doFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          attempts.push({ provider: providerId, model, status: response.status, error: describeError(response.status, errorText) });

          if (response.status === 401 || response.status === 403) {
            // Cle refusee : inutile d'insister sur ce fournisseur ni sur ses autres modeles.
            break;
          }
          if (response.status === 429) {
            coolDown(providerId);
            break;
          }
          if (response.status === 404 || response.status === 410) {
            // Modele indisponible : on tente le modele suivant du meme fournisseur.
            continue;
          }
          break; // 5xx ou autre : on change de fournisseur.
        }

        const payload = await response.json();
        const text = extractText(payload);
        if (!text) {
          attempts.push({ provider: providerId, model, status: response.status, error: "reponse vide" });
          continue;
        }

        return { text, provider: providerId, model, attempts };
      } catch (err) {
        attempts.push({
          provider: providerId,
          model,
          status: null,
          error: err instanceof Error ? err.message : "erreur reseau",
        });
        break;
      }
    }
  }

  const summary = attempts
    .map((a) => `${a.provider}/${a.model} -> ${a.error ?? a.status}`)
    .join(" | ");
  throw new AiGatewayError(`Aucun fournisseur IA n'a pu repondre. ${summary}`, attempts);
}
