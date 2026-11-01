import { onRequest } from "firebase-functions/v2/https";
import { chatCompletion, AiGatewayError, configuredProviderIds, AI_PROVIDERS, type AiMessage } from "./aiGateway";

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
export const aiChatProxy = onRequest(
  { cors: true, timeoutSeconds: 120, memory: "256MiB" },
  async (req, res): Promise<void> => {
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

      const result = await chatCompletion({
        temperature: typeof temperature === "number" ? temperature : undefined,
        maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
        messages: (Array.isArray(messages) ? messages : []) as AiMessage[],
      });

      if (result.attempts.length) {
        console.warn("aiChatProxy: réponse obtenue après bascule.", { model: result.model, attempts: result.attempts });
      }
      res.status(200).json({ text: result.text });
    } catch (err) {
      if (err instanceof AiGatewayError) {
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
  }
);

/** État de configuration (diagnostic interne). */
export const aiProviders = onRequest(
  { cors: true },
  async (_req, res): Promise<void> => {
    const configured = new Set(configuredProviderIds());
    res.status(200).json({
      providers: AI_PROVIDERS.map((p) => ({
        id: p.id,
        configured: configured.has(p.id),
      })),
    });
  }
);
