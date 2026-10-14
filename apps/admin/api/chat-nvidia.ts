export const config = {
  runtime: "edge",
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// Modèles essayés dans l'ordre. Le premier disponible pour ton compte est utilisé.
// Tu peux forcer un modèle précis avec la variable Vercel NVIDIA_MODEL.
const FALLBACK_MODELS = [
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "nvidia/nemotron-nano-3-30b-a3b",
  "openai/gpt-oss-20b",
  "google/gemma-4-31b-it",
  "nvidia/nemotron-3-super-120b-a12b",
  "z-ai/glm-5.3-flash",
];

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "NVIDIA_API_KEY manquante côté serveur (Vercel > Environment Variables)" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const candidates = [process.env.NVIDIA_MODEL, ...FALLBACK_MODELS].filter(
      (m, i, arr): m is string => !!m && arr.indexOf(m) === i
    );

    let lastStatus = 404;
    let lastText = "";

    for (const model of candidates) {
      const upstream = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ...body, model }),
      });

      // 404 / 410 = modèle indisponible pour ce compte : on essaie le suivant
      if (upstream.status !== 404 && upstream.status !== 410) {
        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: { "Content-Type": "application/json", "x-model-used": model },
        });
      }

      lastStatus = upstream.status;
      lastText = await upstream.text();
    }

    return new Response(
      lastText || JSON.stringify({ error: "Aucun modèle NVIDIA disponible pour cette clé" }),
      { status: lastStatus, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur proxy" },
      { status: 500 }
    );
  }
}
