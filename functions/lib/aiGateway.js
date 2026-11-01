"use strict";
/**
 * Passerelle IA — fournisseur unique : Groq.
 *
 * Contrainte réelle du palier gratuit Groq (mesurée via les en-têtes
 * x-ratelimit-*) : 1 000 requêtes/min mais seulement 8 000 tokens/min PAR MODÈLE.
 * Groq compte dans ce quota les tokens du prompt + le max_tokens demandé.
 *
 * Stratégie :
 *  1. Budget de tokens : on estime la taille du prompt, on tronque l'historique
 *     le plus ancien si besoin et on ajuste max_tokens pour rester sous 8 000.
 *  2. Rotation entre les modèles Groq (chacun a son propre quota de 8 000 TPM).
 *  3. Blocage PAR MODÈLE (et non plus pour tout Groq) avec la durée exacte
 *     renvoyée par Groq (retry-after / x-ratelimit-reset-tokens).
 *  4. Si tous les modèles sont saturés, on attend la libération la plus proche
 *     (jusqu'à ~25 s) au lieu d'échouer immédiatement.
 *
 * La clé vient de process.env.GROQ_API_KEY (functions/.env, non versionné).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiGatewayError = exports.AI_PROVIDERS = void 0;
exports.getProvider = getProvider;
exports.isProviderConfigured = isProviderConfigured;
exports.configuredProviderIds = configuredProviderIds;
exports.chatCompletion = chatCompletion;
exports.AI_PROVIDERS = [
    {
        id: "groq",
        label: "Groq",
        baseUrl: "https://api.groq.com/openai/v1/chat/completions",
        defaultModel: "openai/gpt-oss-120b",
        // Modèles actifs sur la clé (vérifiés via GET /openai/v1/models).
        models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
        envKeys: ["GROQ_API_KEY"],
        freeTier: "8 000 tokens/min par modèle, 1 000 req/min",
        docsUrl: "https://console.groq.com/docs/rate-limits",
    },
];
const GROQ = exports.AI_PROVIDERS[0];
/** Quota tokens/minute d'un modèle Groq gratuit (marge de sécurité incluse). */
const TPM_BUDGET = 7600;
/** Réponse minimale qu'on accepte de demander. */
const MIN_COMPLETION = 700;
/** Réponse maximale (un bilan complet tient largement). */
const MAX_COMPLETION = 3000;
/** Attente maximale quand tous les modèles sont saturés. */
const MAX_WAIT_MS = 25_000;
const REQUEST_TIMEOUT_MS = 45_000;
/** model -> timestamp de fin de blocage */
const cooldowns = new Map();
function cooldownLeft(model) {
    const until = cooldowns.get(model) ?? 0;
    const left = until - Date.now();
    if (left <= 0) {
        cooldowns.delete(model);
        return 0;
    }
    return left;
}
/** Parse "7.66s", "2m59.56s", "120ms" ou un nombre de secondes. */
function parseDuration(value) {
    if (!value)
        return null;
    const v = value.trim();
    if (/^\d+(\.\d+)?$/.test(v))
        return Math.ceil(parseFloat(v) * 1000);
    let ms = 0;
    const re = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
    let m;
    let matched = false;
    while ((m = re.exec(v))) {
        matched = true;
        const n = parseFloat(m[1]);
        ms += m[2] === "ms" ? n : m[2] === "s" ? n * 1000 : m[2] === "m" ? n * 60_000 : n * 3_600_000;
    }
    return matched ? Math.ceil(ms) : null;
}
/** Estimation prudente : ~3.2 caractères par token en français. */
function estimateTokens(messages) {
    return messages.reduce((sum, m) => sum + Math.ceil((m.content?.length ?? 0) / 3.2) + 8, 0);
}
/**
 * Garde le prompt système + le dernier message utilisateur, puis ajoute
 * l'historique du plus récent au plus ancien tant que le budget le permet.
 * Un message trop long (ex. ancien bilan) est raccourci plutôt que gardé entier.
 */
function fitToBudget(messages, completionReserve) {
    const budget = TPM_BUDGET - completionReserve;
    const system = messages.filter((m) => m.role === "system");
    const rest = messages.filter((m) => m.role !== "system");
    const last = rest[rest.length - 1];
    const history = rest.slice(0, -1);
    const kept = [];
    let used = estimateTokens(system) + (last ? estimateTokens([last]) : 0);
    for (let i = history.length - 1; i >= 0; i--) {
        let msg = history[i];
        let cost = estimateTokens([msg]);
        if (cost > 900) {
            msg = { ...msg, content: msg.content.slice(0, 2600) + "\n[…réponse précédente abrégée…]" };
            cost = estimateTokens([msg]);
        }
        if (used + cost > budget)
            break;
        kept.unshift(msg);
        used += cost;
    }
    // Si même système + dernière question dépassent, on raccourcit le système.
    let sys = system;
    if (used > budget && system.length) {
        const overflowChars = Math.ceil((used - budget) * 3.2) + 200;
        sys = system.map((s, idx) => idx === 0 ? { ...s, content: s.content.slice(0, Math.max(2000, s.content.length - overflowChars)) } : s);
    }
    return [...sys, ...kept, ...(last ? [last] : [])];
}
function extractText(payload) {
    const data = payload;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string")
        return content.trim();
    if (Array.isArray(content)) {
        return content
            .map((p) => (typeof p === "string" ? p : p?.text ?? ""))
            .join("")
            .trim();
    }
    return "";
}
function getProvider(id) {
    return exports.AI_PROVIDERS.find((p) => p.id === id);
}
function isProviderConfigured(id, env = process.env) {
    const provider = getProvider(id);
    if (!provider)
        return false;
    return provider.envKeys.every((key) => Boolean(env[key] && env[key].trim()));
}
function configuredProviderIds(env = process.env) {
    return exports.AI_PROVIDERS.filter((p) => isProviderConfigured(p.id, env)).map((p) => p.id);
}
/** Erreur destinée à l'utilisateur : message neutre, sans nom de fournisseur. */
class AiGatewayError extends Error {
    constructor(message, attempts, retryAfterMs = null) {
        super(message);
        this.attempts = attempts;
        this.retryAfterMs = retryAfterMs;
        this.name = "AiGatewayError";
    }
}
exports.AiGatewayError = AiGatewayError;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function chatCompletion(options) {
    const env = options.env ?? process.env;
    const doFetch = options.fetchImpl ?? fetch;
    const apiKey = env.GROQ_API_KEY?.trim();
    if (!apiKey) {
        throw new AiGatewayError("Le service d'analyse n'est pas encore configuré.", []);
    }
    const raw = (options.messages ?? []).filter((m) => m && typeof m.content === "string" && m.content.trim());
    if (raw.length === 0)
        throw new AiGatewayError("Aucun message à envoyer.", []);
    const requested = Math.min(Math.max(options.maxTokens ?? 2000, MIN_COMPLETION), MAX_COMPLETION);
    const messages = fitToBudget(raw, Math.min(requested, 1800));
    const promptTokens = estimateTokens(messages);
    const maxTokens = Math.max(MIN_COMPLETION, Math.min(requested, TPM_BUDGET - promptTokens));
    const temperature = options.temperature ?? 0.5;
    const order = [...GROQ.models];
    if (options.model && order.includes(options.model)) {
        order.splice(order.indexOf(options.model), 1);
        order.unshift(options.model);
    }
    const attempts = [];
    const deadline = Date.now() + MAX_WAIT_MS + REQUEST_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const available = order.filter((m) => cooldownLeft(m) === 0);
        if (available.length === 0) {
            const soonest = Math.min(...order.map(cooldownLeft));
            if (soonest > MAX_WAIT_MS || Date.now() + soonest > deadline) {
                throw new AiGatewayError(`L'assistant est très sollicité. Réessaie dans ${Math.ceil(soonest / 1000)} s.`, attempts, soonest);
            }
            await sleep(soonest + 250);
            continue;
        }
        let progressed = false;
        for (const model of available) {
            const body = {
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
                stream: false,
            };
            if (model.includes("gpt-oss"))
                body.reasoning_effort = "low";
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            try {
                const response = await doFetch(GROQ.baseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                });
                if (response.ok) {
                    const text = extractText(await response.json());
                    if (text)
                        return { text, provider: "groq", model, attempts };
                    attempts.push({ provider: "groq", model, status: 200, error: "réponse vide" });
                    continue;
                }
                const errText = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
                attempts.push({ provider: "groq", model, status: response.status, error: errText });
                if (response.status === 429 || response.status === 413 || response.status === 503) {
                    const wait = parseDuration(response.headers.get("retry-after")) ??
                        parseDuration(response.headers.get("x-ratelimit-reset-tokens")) ??
                        20_000;
                    cooldowns.set(model, Date.now() + Math.min(Math.max(wait, 1000), 120_000));
                    progressed = true;
                    continue;
                }
                if (response.status === 401 || response.status === 403) {
                    throw new AiGatewayError("Le service d'analyse est momentanément indisponible (accès refusé).", attempts);
                }
                // 400/404/5xx : on essaie le modèle suivant.
                cooldowns.set(model, Date.now() + 15_000);
                progressed = true;
            }
            catch (err) {
                if (err instanceof AiGatewayError)
                    throw err;
                attempts.push({
                    provider: "groq",
                    model,
                    status: null,
                    error: err instanceof Error ? err.message : "erreur réseau",
                });
                cooldowns.set(model, Date.now() + 5_000);
                progressed = true;
            }
            finally {
                clearTimeout(timer);
            }
        }
        if (!progressed)
            await sleep(500);
    }
    throw new AiGatewayError("L'assistant n'a pas pu répondre à temps. Réessaie dans un instant.", attempts);
}
