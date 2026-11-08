import { onCall, HttpsError } from "firebase-functions/v2/https";
import { chatCompletion, AiGatewayError, configuredProviderIds, AI_PROVIDERS, type AiMessage } from "./aiGateway";

/**
 * Vérification des autorisations : seul un administrateur connecté à son workspace
 * peut utiliser l'analyste IA et consommer les quotas d'API.
 */
function requireAdminAuth(request: { auth?: { token?: Record<string, unknown> } }): string {
  const workspaceId = request.auth?.token?.workspaceId as string | undefined;
  const role = request.auth?.token?.role as string | undefined;
  if (!workspaceId || role !== "admin") {
    throw new HttpsError("permission-denied", "Accès réservé aux administrateurs connectés.");
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
export const aiChatProxy = onCall(
  { timeoutSeconds: 120, memory: "256MiB" },
  async (request): Promise<{ text: string }> => {
    requireAdminAuth(request);

    try {
      const { messages = [], temperature, maxTokens } = request.data || {};

      const result = await chatCompletion({
        temperature: typeof temperature === "number" ? temperature : undefined,
        maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
        messages: (Array.isArray(messages) ? messages : []) as AiMessage[],
      });

      if (result.attempts.length) {
        console.warn("aiChatProxy: réponse obtenue après bascule.", { model: result.model, attempts: result.attempts });
      }
      return { text: result.text };
    } catch (err: any) {
      if (err instanceof AiGatewayError) {
        console.error("aiChatProxy: échec.", err.message, err.attempts);
        throw new HttpsError("unavailable", err.message);
      }
      console.error("aiChatProxy: erreur inattendue.", err);
      throw new HttpsError("internal", "Erreur interne de l'assistant. Réessaie dans un instant.");
    }
  }
);

/** État de configuration (diagnostic interne, réservé aux admins). */
export const aiProviders = onCall(async (request) => {
  requireAdminAuth(request);
  const configured = new Set(configuredProviderIds());
  return {
    providers: AI_PROVIDERS.map((p) => ({
      id: p.id,
      configured: configured.has(p.id),
    })),
  };
});
