"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiProviders = exports.aiChatProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const aiGateway_1 = require("./aiGateway");
/**
 * Proxy IA du cote serveur.
 *
 * Toutes les cles vivent dans l'environnement de la fonction (functions/.env en
 * local, variables d'environnement ou secrets en prod) : aucune n'est exposee au
 * navigateur. Le proxy enchaine les fournisseurs gratuits : en cas de quota
 * epuise (429) ou de cle refusee (401), il passe au suivant.
 *
 * Reponse : { text, provider, model, attempts }
 */
exports.aiChatProxy = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed. Use POST." });
        return;
    }
    try {
        const { provider = "auto", messages = [], model, temperature, maxTokens } = req.body || {};
        const result = await (0, aiGateway_1.chatCompletion)({
            provider: provider === "auto" ? null : provider,
            model: model || undefined,
            temperature: typeof temperature === "number" ? temperature : undefined,
            maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
            messages: (Array.isArray(messages) ? messages : []),
        });
        res.status(200).json({
            text: result.text,
            provider: result.provider,
            model: result.model,
        });
    }
    catch (err) {
        if (err instanceof aiGateway_1.AiGatewayError) {
            console.error("aiChatProxy: aucun fournisseur disponible.", err.attempts);
            res.status(503).json({ error: err.message, attempts: err.attempts });
            return;
        }
        console.error("aiChatProxy: erreur inattendue.", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "Erreur proxy IA" });
    }
});
/**
 * Liste des fournisseurs et de leur etat de configuration.
 * Permet a l'admin d'afficher les moteurs reellement disponibles (et ceux dont
 * la cle manque) au lieu de deviner.
 */
exports.aiProviders = (0, https_1.onRequest)({ cors: true }, async (_req, res) => {
    const configured = new Set((0, aiGateway_1.configuredProviderIds)());
    res.status(200).json({
        providers: aiGateway_1.AI_PROVIDERS.map((p) => ({
            id: p.id,
            label: p.label,
            model: p.defaultModel,
            models: p.models,
            freeTier: p.freeTier,
            docsUrl: p.docsUrl,
            configured: configured.has(p.id),
        })),
    });
});
