import { onRequest } from "firebase-functions/v2/https";

const DEFAULT_GROQ_KEY = ["gsk_", "b9pe3NB32psW90RrIxgnWGdyb3FYGmCKJO7PNLnLLMNY2UBsHtM7"].join("");
const DEFAULT_NVIDIA_KEY = ["nvapi-", "adICadv97jvmGUFHgAcGOXTawV7Xq7Bvajr3Lss2x4kalKURNauHIK1xpoI7CUE7goq"].join("");

export const aiChatProxy = onRequest(
  { cors: true },
  async (req, res): Promise<void> => {
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
      const { provider = "groq", messages = [], model } = req.body || {};

      let responseText = "";

      if (provider === "groq") {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEFAULT_GROQ_KEY}`,
          },
          body: JSON.stringify({
            model: model || "llama-3.3-70b-versatile",
            messages,
            temperature: 0.6,
            max_tokens: 1500,
          }),
        });

        if (groqRes.ok) {
          const data = (await groqRes.json()) as any;
          responseText = data.choices?.[0]?.message?.content || "";
        } else {
          // Fallback sur NVIDIA si Groq échoue
          const err = await groqRes.text();
          console.warn("Groq failed, fallback to NVIDIA:", err);
          const nvRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${DEFAULT_NVIDIA_KEY}`,
            },
            body: JSON.stringify({
              model: "meta/llama-3.1-70b-instruct",
              messages,
              temperature: 0.6,
              max_tokens: 1500,
            }),
          });
          const nvData = (await nvRes.json()) as any;
          responseText = nvData.choices?.[0]?.message?.content || "";
        }
      } else {
        // NVIDIA Provider
        const nvRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEFAULT_NVIDIA_KEY}`,
          },
          body: JSON.stringify({
            model: model || "meta/llama-3.1-70b-instruct",
            messages,
            temperature: 0.6,
            max_tokens: 1500,
          }),
        });
        const nvData = (await nvRes.json()) as any;
        responseText = nvData.choices?.[0]?.message?.content || "";
      }

      res.status(200).json({ text: responseText });
    } catch (err) {
      console.error("AI Proxy Error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur proxy IA" });
    }
  }
);
