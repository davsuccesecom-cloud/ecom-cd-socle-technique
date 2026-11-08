"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiProviders = exports.aiChatProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const aiGateway_1 = require("./aiGateway");
/**
 * Vérification des autorisations : seul un administrateur connecté à son workspace
 * peut utiliser l'analyste IA et consommer les quotas d'API.
 */
function requireAdminAuth(request) {
    const workspaceId = request.auth?.token?.workspaceId;
    const role = request.auth?.token?.role;
    if (!workspaceId || role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Accès réservé aux administrateurs connectés.");
    }
    return workspaceId;
}
/**
 * Proxy IA sécurisé côté serveur — fournisseur : Groq.
 *
 * La clé vit dans l'environnement de la fonction (functions/.env, non versionné) :
 * elle n'est jamais exposée au navigateur.
 * Authentification Firebase requise avec rôle admin.
 */
exports.aiChatProxy = (0, https_1.onCall)({ timeoutSeconds: 120, memory: "256MiB" }, async (request) => {
    requireAdminAuth(request);
    try {
        const { messages = [], temperature, maxTokens } = request.data || {};
        const result = await (0, aiGateway_1.chatCompletion)({
            temperature: typeof temperature === "number" ? temperature : undefined,
            maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
            messages: (Array.isArray(messages) ? messages : []),
        });
        if (result.attempts.length) {
            console.warn("aiChatProxy: réponse obtenue après bascule.", { model: result.model, attempts: result.attempts });
        }
        return { text: result.text };
    }
    catch (err) {
        if (err instanceof aiGateway_1.AiGatewayError) {
            console.error("aiChatProxy: échec.", err.message, err.attempts);
            throw new https_1.HttpsError("unavailable", err.message);
        }
        console.error("aiChatProxy: erreur inattendue.", err);
        throw new https_1.HttpsError("internal", "Erreur interne de l'assistant. Réessaie dans un instant.");
    }
});
/** État de configuration (diagnostic interne, réservé aux admins). */
exports.aiProviders = (0, https_1.onCall)(async (request) => {
    requireAdminAuth(request);
    const configured = new Set((0, aiGateway_1.configuredProviderIds)());
    return {
        providers: aiGateway_1.AI_PROVIDERS.map((p) => ({
            id: p.id,
            configured: configured.has(p.id),
        })),
    };
});
