"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiProviders = exports.aiChatProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const aiGateway_1 = require("./aiGateway");
/**
 * Proxy IA côté serveur — fournisseur unique : Groq.
 *
 * La clé vit dans l'environnement de la fonction (functions/.env, non versionné) :
 * elle n'est jamais exposée au navigateur. Les messages d'erreur renvoyés au client
 * sont neutres (aucun nom de fournisseur ni de modèle) ; le détail technique
 * reste dans les journaux serveur.
 *
 * Réponse : { text }
 */
exports.aiChatProxy = (0, https_1.onRequest)({ cors: true, timeoutSeconds: 120, memory: "256MiB" }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Méthode non autorisée." });
        return;
    }
    try {
        const { messages = [], temperature, maxTokens } = req.body || {};
        const result = await (0, aiGateway_1.chatCompletion)({
            temperature: typeof temperature === "number" ? temperature : undefined,
            maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
            messages: (Array.isArray(messages) ? messages : []),
        });
        if (result.attempts.length) {
            console.warn("aiChatProxy: réponse obtenue après bascule.", { model: result.model, attempts: result.attempts });
        }
        res.status(200).json({ text: result.text });
    }
    catch (err) {
        if (err instanceof aiGateway_1.AiGatewayError) {
            console.error("aiChatProxy: échec.", err.message, err.attempts);
            res.status(503).json({
                error: err.message,
                retryAfterMs: err.retryAfterMs,
            });
            return;
        }
        console.error("aiChatProxy: erreur inattendue.", err);
        res.status(500).json({ error: "Erreur interne de l'assistant. Réessaie dans un instant." });
    }
});
/** État de configuration (diagnostic interne). */
exports.aiProviders = (0, https_1.onRequest)({ cors: true }, async (_req, res) => {
    const configured = new Set((0, aiGateway_1.configuredProviderIds)());
    res.status(200).json({
        providers: aiGateway_1.AI_PROVIDERS.map((p) => ({
            id: p.id,
            configured: configured.has(p.id),
        })),
    });
});
