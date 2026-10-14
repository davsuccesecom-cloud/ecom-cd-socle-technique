import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { Team, Order } from "@ecomcod/shared";
import { aiService, type BusinessMetricsContext, type AiChatMessage } from "../services/aiService";

/* -------------------------------------------------------------------------- */
/*  Moteurs IA : modifier ici uniquement si un modèle est retiré               */
/* -------------------------------------------------------------------------- */
type ProviderKey = "groq" | "nvidia";

const PROVIDERS: Record<
  ProviderKey,
  { label: string; modelName: string; modelId: string; endpoint: string; hint: string }
> = {
  groq: {
    label: "Groq",
    modelName: "GPT-OSS 120B",
    modelId: "openai/gpt-oss-120b",
    endpoint: "/api/chat-groq",
    hint: "Réponses rapides",
  },
  nvidia: {
    label: "NVIDIA",
    modelName: "Nemotron 70B",
    modelId: "nvidia/llama-3.1-nemotron-70b-instruct",
    endpoint: "/api/chat-nvidia",
    hint: "Analyse approfondie",
  },
};

const SUGGESTIONS = [
  {
    icon: "📊",
    title: "Bilan global",
    desc: "Chiffres clés, points forts et points à améliorer.",
    prompt: "Fais-moi le bilan complet de la période : chiffres clés, points forts et points d'amélioration.",
  },
  {
    icon: "🏆",
    title: "Meilleurs employés",
    desc: "Qui mérite une prime ou une promotion.",
    prompt: "Quelle closeuse ou quel livreur mérite une prime ou une promotion ? Justifie avec les chiffres.",
  },
  {
    icon: "⚠️",
    title: "Réduire les rejets",
    desc: "Plan d'actions sur rejets et injoignables.",
    prompt: "Analyse mes rejets et mes injoignables, et propose un plan d'action concret pour les réduire.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Thème clair / sombre (clair par défaut, sombre si <html class="dark">)     */
/* -------------------------------------------------------------------------- */
const LIGHT = {
  card: "bg-white border-slate-200",
  bar: "border-slate-200 bg-white",
  seg: "bg-slate-100",
  segActive: "bg-white text-slate-900 shadow-sm",
  segIdle: "text-slate-500 hover:text-slate-800",
  text: "text-slate-800",
  strong: "text-slate-900",
  muted: "text-slate-500",
  ghostBtn: "border-slate-200 text-slate-600 hover:bg-slate-50",
  dangerBtn: "border-red-200 text-red-600 hover:bg-red-50",
  inputWrap:
    "border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10",
  placeholder: "placeholder-slate-400",
  chip: "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700",
  suggest: "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50",
  errorBox: "border-red-200 bg-red-50 text-red-700",
  jump: "border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50",
  code: "bg-slate-100 text-slate-800",
  tableBorder: "border-slate-200",
  tableHead: "bg-slate-50 text-slate-700",
  tableRow: "border-slate-100",
};
const DARK: typeof LIGHT = {
  card: "bg-slate-900 border-slate-800",
  bar: "border-slate-800 bg-slate-900",
  seg: "bg-slate-800",
  segActive: "bg-slate-700 text-white shadow-sm",
  segIdle: "text-slate-400 hover:text-slate-200",
  text: "text-slate-200",
  strong: "text-white",
  muted: "text-slate-400",
  ghostBtn: "border-slate-700 text-slate-300 hover:bg-slate-800",
  dangerBtn: "border-red-500/40 text-red-400 hover:bg-red-500/10",
  inputWrap:
    "border-slate-700 bg-slate-800/60 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-400/10",
  placeholder: "placeholder-slate-500",
  chip: "border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-400 hover:text-indigo-300",
  suggest: "border-slate-700 bg-slate-800/50 hover:border-indigo-400 hover:bg-slate-800",
  errorBox: "border-red-500/30 bg-red-500/10 text-red-300",
  jump: "border-slate-700 bg-slate-800 text-slate-300 shadow-md hover:bg-slate-700",
  code: "bg-slate-800 text-slate-100",
  tableBorder: "border-slate-700",
  tableHead: "bg-slate-800 text-slate-200",
  tableRow: "border-slate-800",
};
type Theme = typeof LIGHT;

let colorCanvas: HTMLCanvasElement | null = null;

/** Convertit n'importe quelle couleur CSS (rgb, oklch, hsl...) en [r, g, b, alpha]. */
function toRgba(color: string): [number, number, number, number] | null {
  try {
    if (!colorCanvas) {
      colorCanvas = document.createElement("canvas");
      colorCanvas.width = 1;
      colorCanvas.height = 1;
    }
    const ctx = colorCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  } catch {
    return null;
  }
}

/**
 * Détecte si la page est réellement sombre en lisant la couleur de fond de l'app
 * (fonctionne quelle que soit la façon dont ton thème sombre est activé).
 */
function detectDark(root: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  let node: HTMLElement | null = root?.parentElement ?? document.body;
  while (node) {
    const rgba = toRgba(getComputedStyle(node).backgroundColor);
    if (rgba && rgba[3] > 0.05) {
      const lum = (0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2]) / 255;
      return lum < 0.5;
    }
    node = node.parentElement;
  }
  const html = document.documentElement;
  return html.classList.contains("dark") || html.dataset.theme === "dark";
}

function useIsDark(rootRef: { current: HTMLElement | null }): boolean {
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    let timers: number[] = [];

    const update = () => setDark(detectDark(root));
    // Le thème peut avoir une transition : on revérifie un peu plus tard
    const schedule = () => {
      update();
      timers.forEach((id) => window.clearTimeout(id));
      timers = [window.setTimeout(update, 120), window.setTimeout(update, 450)];
    };

    update();

    const obs = new MutationObserver(schedule);
    for (let n: HTMLElement | null = root?.parentElement ?? null; n; n = n.parentElement) {
      obs.observe(n, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode", "style"] });
    }
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    mq?.addEventListener?.("change", schedule);

    return () => {
      obs.disconnect();
      mq?.removeEventListener?.("change", schedule);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [rootRef]);

  return dark;
}

/* -------------------------------------------------------------------------- */
/*  Rendu Markdown léger (sans dépendance, sans HTML brut = sans risque XSS)   */
/* -------------------------------------------------------------------------- */
function renderInline(text: string, t: Theme, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${n++}`;
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key} className={`font-semibold ${t.strong}`}>
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className={`rounded px-1.5 py-0.5 text-[0.85em] ${t.code}`}>
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ content, t }: { content: string; t: Theme }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  const isTableSep = (l: string) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  const splitRow = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const startsTable = (idx: number) =>
    lines[idx].includes("|") && idx + 1 < lines.length && isTableSep(lines[idx + 1]);
  const bulletRe = /^\s*[-*•]\s+/;
  const orderedRe = /^\s*\d+[.)]\s+/;

  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? "text-lg font-semibold"
          : level === 2
          ? "text-base font-semibold"
          : "text-[15px] font-semibold";
      out.push(
        <p key={k++} className={`${cls} ${t.strong} pt-1`}>
          {renderInline(h[2], t, `h${k}`)}
        </p>
      );
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={k++} className={`border-t ${t.tableBorder}`} />);
      i++;
      continue;
    }

    if (startsTable(i)) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const tk = k++;
      out.push(
        <div key={tk} className={`overflow-x-auto rounded-xl border ${t.tableBorder}`}>
          <table className="min-w-full text-left text-sm">
            <thead className={t.tableHead}>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {renderInline(c, t, `th${tk}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={`border-t ${t.tableRow}`}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      {renderInline(c, t, `td${tk}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (bulletRe.test(line)) {
      const items: string[] = [];
      while (i < lines.length && bulletRe.test(lines[i])) {
        items.push(lines[i].replace(bulletRe, ""));
        i++;
      }
      const lk = k++;
      out.push(
        <ul key={lk} className="list-disc space-y-1.5 pl-5 marker:text-indigo-400">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, t, `li${lk}-${ii}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (orderedRe.test(line)) {
      const items: string[] = [];
      while (i < lines.length && orderedRe.test(lines[i])) {
        items.push(lines[i].replace(orderedRe, ""));
        i++;
      }
      const lk = k++;
      out.push(
        <ol key={lk} className="list-decimal space-y-1.5 pl-5 marker:text-indigo-400">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, t, `ol${lk}-${ii}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !bulletRe.test(lines[i]) &&
      !orderedRe.test(lines[i]) &&
      !startsTable(i)
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length === 0) {
      para.push(line);
      i++;
    }
    const pk = k++;
    out.push(
      <p key={pk} className="whitespace-pre-line">
        {renderInline(para.join("\n"), t, `p${pk}`)}
      </p>
    );
  }

  return <div className="space-y-3">{out}</div>;
}

/* -------------------------------------------------------------------------- */
/*  Petites icônes                                                             */
/* -------------------------------------------------------------------------- */
const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const IconSend = () => (
  <svg {...iconProps}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);
const IconCopy = () => (
  <svg {...iconProps}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconCheck = () => (
  <svg {...iconProps}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconDownload = () => (
  <svg {...iconProps}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);
const IconTrash = () => (
  <svg {...iconProps}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const IconArrowDown = () => (
  <svg {...iconProps}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);
const IconSpark = () => (
  <svg {...iconProps} width={16} height={16}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
  </svg>
);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatTime = (ts: unknown) => {
  const d =
    typeof ts === "object" && ts !== null && "toDate" in ts && typeof (ts as { toDate: unknown }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as number | string);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

/* -------------------------------------------------------------------------- */
/*  Composant principal                                                        */
/* -------------------------------------------------------------------------- */
interface AiAssistantProps {
  workspaceId: string;
  team: Team | null;
  allTeams: Team[];
  orders: Order[];
  closeuses: { id: string; name: string }[];
  livreurs: { id: string; name: string }[];
}

export default function AiAssistant({
  workspaceId,
  team,
  orders,
  closeuses,
  livreurs,
}: AiAssistantProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isDark = useIsDark(rootRef);
  const t = isDark ? DARK : LIGHT;

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [provider, setProvider] = useState<ProviderKey>(() => {
    try {
      return localStorage.getItem("aiAssistantProvider") === "nvidia" ? "nvidia" : "groq";
    } catch {
      return "groq";
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  const chooseProvider = (p: ProviderKey) => {
    setProvider(p);
    aiService.setProvider(p);
    try {
      localStorage.setItem("aiAssistantProvider", p);
    } catch {
      /* stockage indisponible : on ignore */
    }
  };

  useEffect(() => {
    aiService.setProvider(provider);
  }, [provider]);

  /* 1. Métriques business réelles ---------------------------------------- */
  const context: BusinessMetricsContext = (() => {
    const totalOrders = orders.length;
    const confirmedOrders = orders.filter(
      (o) => o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || o.statutCloseuse === "livre"
    ).length;
    const deliveredOrders = orders.filter((o) => o.statutLivreur === "livre").length;
    const injoignableOrders = orders.filter(
      (o) => o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable"
    ).length;
    const rejectedOrders = orders.filter((o) => o.statutCloseuse === "rejete").length;
    const revenue = orders
      .filter((o) => o.statutLivreur === "livre")
      .reduce((acc, o) => acc + (o.amount || 0), 0);

    const confirmationRate = totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 100) : 0;
    const deliveryRate = confirmedOrders > 0 ? Math.round((deliveredOrders / confirmedOrders) * 100) : 0;

    const topCloseuses = closeuses
      .map((c) => {
        const cOrders = orders.filter((o) => o.closeuseId === c.id);
        const conf = cOrders.filter(
          (o) => o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || o.statutCloseuse === "livre"
        ).length;
        return {
          name: c.name,
          confirmed: conf,
          total: cOrders.length,
          rate: cOrders.length > 0 ? Math.round((conf / cOrders.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.confirmed - a.confirmed);

    const topLivreurs = livreurs
      .map((l) => {
        const lOrders = orders.filter((o) => o.livreurId === l.id);
        const del = lOrders.filter((o) => o.statutLivreur === "livre").length;
        return {
          name: l.name,
          delivered: del,
          total: lOrders.length,
          rate: lOrders.length > 0 ? Math.round((del / lOrders.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.delivered - a.delivered);

    const productMap: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const p = o.product || "Produit standard";
      if (!productMap[p]) productMap[p] = { count: 0, revenue: 0 };
      productMap[p].count += 1;
      if (o.statutLivreur === "livre") {
        productMap[p].revenue += o.amount || 0;
      }
    });

    const topProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.count - a.count);

    return {
      teamName: team?.name || "Toutes les équipes",
      country: team?.defaultCountry || "Général",
      currency: team?.currency || "XOF",
      periodLabel: "Période active",
      totalOrders,
      confirmedOrders,
      deliveredOrders,
      injoignableOrders,
      rejectedOrders,
      revenue,
      confirmationRate,
      deliveryRate,
      topCloseuses,
      topLivreurs,
      topProducts,
      dailyTrends: [],
    };
  })();

  /* 2. Écoute Firestore --------------------------------------------------- */
  useEffect(() => {
    if (!workspaceId) return;
    setHistoryLoaded(false);
    const db = getDb();
    const chatCol = collection(db, "workspaces", workspaceId, "aiAssistantChats");
    const q = query(chatCol, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AiChatMessage[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AiChatMessage);
        });
        setMessages(list);
        setHistoryLoaded(true);
      },
      () => {
        setHistoryLoaded(true);
        setErrorMsg("Impossible de charger l'historique de la conversation.");
      }
    );
    return () => unsub();
  }, [workspaceId]);

  /* 3. Défilement : uniquement DANS la zone de chat (jamais la page) ------- */
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < 120;
    setShowJump(dist > 240);
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages, loading]);

  /* Zone de saisie qui grandit avec le texte ------------------------------ */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [inputPrompt]);

  /* 4. Envoi d'un message -------------------------------------------------- */
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend ?? inputPrompt).trim();
    if (!prompt || loading) return;

    setInputPrompt("");
    setErrorMsg("");
    setLoading(true);
    stickRef.current = true;

    try {
      const db = getDb();
      const userMsgId = `msg_${Date.now()}`;
      const userMsg: AiChatMessage = {
        id: userMsgId,
        sender: "user",
        content: prompt,
        timestamp: Date.now(),
      };

      await setDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", userMsgId), userMsg);

      const history = messages.slice(-10).map((m) => ({
        role: m.sender as "user" | "assistant",
        content: m.content,
      }));

      const active = PROVIDERS[provider];

      const systemPrompt = `Tu es l'Analyste Business & Secrétaire de Direction E-commerce Cash On Delivery (COD) de l'entreprise.
Ton objectif est d'analyser la rentabilité, les performances des employés et d'orienter les décisions stratégiques.
RÈGLES : Sois percutant, chiffre tes réponses, donne des conseils concrets (promotions, optimisation des rejets, zones de livraison). Refuse poliment tout sujet hors-business.
N'INVENTE JAMAIS de données absentes des métriques ci-dessous (motifs de rejet, marges, coûts, dépenses publicitaires). Si une donnée manque, dis-le clairement et indique quelle donnée il faudrait suivre. Réponds en français, de façon structurée et concise (titres courts, listes, tableaux si utile).

MÉTRIQUES OPÉRATIONNELLES EN DIRECT :
- Équipe : ${context.teamName} (${context.country})
- Chiffre d'Affaires Livré : ${context.revenue.toLocaleString()} ${context.currency}
- Total Commandes : ${context.totalOrders}
- Confirmées : ${context.confirmedOrders} (${context.confirmationRate}%)
- Livrées et Encaissées : ${context.deliveredOrders} (${context.deliveryRate}%)
- Injoignables : ${context.injoignableOrders} | Rejetées : ${context.rejectedOrders}
TOP CLOSEUSES : ${context.topCloseuses.map((c) => `${c.name}: ${c.confirmed}/${c.total} (${c.rate}%)`).join(", ") || "Aucune"}
TOP LIVREURS : ${context.topLivreurs.map((l) => `${l.name}: ${l.delivered}/${l.total} (${l.rate}%)`).join(", ") || "Aucun"}
PRODUITS : ${context.topProducts.map((p) => `${p.name} (${p.count} ventes)`).join(", ") || "Aucun"}`;

      let reply = "";
      let apiError = "";
      try {
        const res = await fetch(active.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: active.modelId,
            messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: prompt }],
            temperature: 0.6,
            max_tokens: 4000,
            ...(provider === "groq" ? { reasoning_effort: "low" } : {}),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          reply = data.choices?.[0]?.message?.content || "";
          if (!reply) apiError = "Le modèle a renvoyé une réponse vide. Réessaie ou change de moteur.";
        } else {
          const detail =
            data.error?.message ||
            (typeof data.error === "string" ? data.error : "") ||
            data.detail ||
            "réponse invalide";
          apiError = `Erreur ${res.status} : ${detail}`;
        }
      } catch (e) {
        apiError = e instanceof Error ? e.message : "Connexion impossible";
      }

      if (apiError) {
        // Affichée, mais jamais enregistrée comme vraie réponse de l'IA
        setErrorMsg(apiError);
        return;
      }

      const botMsgId = `bot_${Date.now()}`;
      const botMsg: AiChatMessage = {
        id: botMsgId,
        sender: "assistant",
        content: reply,
        timestamp: Date.now(),
      };
      await setDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", botMsgId), botMsg);
    } catch (err) {
      setErrorMsg("Erreur Assistant IA : " + (err instanceof Error ? err.message : "Erreur de connexion"));
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Voulez-vous réinitialiser l'historique de cette session d'analyse ?")) return;
    const db = getDb();
    for (const m of messages) {
      await deleteDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", m.id));
    }
  };

  const handleCopy = async (m: AiChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1500);
    } catch {
      setErrorMsg("Copie impossible sur ce navigateur.");
    }
  };

  const handleExportWord = () => {
    const title = `Bilan_Analyste_IA_${team?.name || "Business"}_${new Date().toISOString().slice(0, 10)}`;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${escapeHtml(title)}</title></head><body>`;
    const footer = `</body></html>`;

    let body = `<h2>Rapport d'Analyse Opérationnelle & Bilan Commercial</h2>`;
    body += `<p><strong>Équipe :</strong> ${escapeHtml(team?.name || "Global")} (${escapeHtml(team?.defaultCountry || "")}) | <strong>Date :</strong> ${new Date().toLocaleDateString("fr-FR")}</p>`;
    body += `<hr/>`;
    body += `<h3>Chiffres Clés du Business :</h3>`;
    body += `<ul>
      <li>Chiffre d'Affaires Livré : <strong>${context.revenue.toLocaleString()} ${context.currency}</strong></li>
      <li>Total Commandes Reçues : <strong>${context.totalOrders}</strong></li>
      <li>Commandes Confirmées : <strong>${context.confirmedOrders} (${context.confirmationRate}%)</strong></li>
      <li>Commandes Livrées : <strong>${context.deliveredOrders} (${context.deliveryRate}%)</strong></li>
      <li>Injoignables : <strong>${context.injoignableOrders}</strong></li>
      <li>Rejets / Annulations : <strong>${context.rejectedOrders}</strong></li>
    </ul><hr/>`;

    body += `<h3>Échanges & Analyses Stratégiques :</h3>`;
    messages.forEach((m) => {
      body += `<p><strong>${m.sender === "user" ? "Direction" : "Analyste IA"} :</strong></p>`;
      body += `<p style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-left: 3px solid #6366f1;">${escapeHtml(m.content)}</p>`;
    });

    const blob = new Blob([header + body + footer], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isEmpty = messages.length === 0;
  const canSend = inputPrompt.trim().length > 0 && !loading;

  /* ------------------------------------------------------------------------ */
  /*  Rendu                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <div ref={rootRef} className="mx-auto w-full max-w-4xl">
      <div
        className={`flex h-[calc(100dvh-9rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border shadow-sm ${t.card}`}
      >
        {/* Barre du haut : choix du modèle + actions */}
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4 ${t.bar}`}>
          <div
            role="radiogroup"
            aria-label="Choisir le moteur d'IA"
            className={`inline-flex rounded-xl p-1 ${t.seg}`}
          >
            {(Object.keys(PROVIDERS) as ProviderKey[]).map((key) => {
              const p = PROVIDERS[key];
              const active = provider === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseProvider(key)}
                  className={`rounded-lg px-3 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    active ? t.segActive : t.segIdle
                  }`}
                >
                  <span className="block text-sm font-semibold leading-tight">{p.label}</span>
                  <span className="block text-[11px] leading-tight opacity-70">{p.modelName}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportWord}
              disabled={isEmpty}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${t.ghostBtn}`}
            >
              <IconDownload />
              <span className="hidden sm:inline">Exporter Word</span>
            </button>
            {!isEmpty && (
              <button
                type="button"
                onClick={handleClearHistory}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${t.dangerBtn}`}
              >
                <IconTrash />
                <span className="hidden sm:inline">Effacer</span>
              </button>
            )}
          </div>
        </div>

        {/* Zone des messages (défile seule, jamais la page) */}
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
              {!historyLoaded ? (
                <div className={`my-auto py-10 text-center text-sm ${t.muted}`}>Chargement de la conversation…</div>
              ) : isEmpty && !loading ? (
                <div className="my-auto py-6">
                  <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md">
                      <IconSpark />
                    </div>
                    <h3 className={`text-xl font-semibold ${t.strong}`}>
                      Bonjour {team?.name || "Direction"}
                    </h3>
                    <p className={`mx-auto mt-2 max-w-md text-sm leading-relaxed ${t.muted}`}>
                      Je suis connecté à vos données : {context.totalOrders} commandes, {context.confirmedOrders}{" "}
                      confirmées, {context.deliveredOrders} livrées. Posez une question ou choisissez un point de
                      départ.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => handleSendMessage(s.prompt)}
                        className={`rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${t.suggest}`}
                      >
                        <span className="text-xl" aria-hidden="true">
                          {s.icon}
                        </span>
                        <span className={`mt-2 block text-sm font-semibold ${t.strong}`}>{s.title}</span>
                        <span className={`mt-1 block text-xs leading-relaxed ${t.muted}`}>{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-7">
                  {messages.map((m) => {
                    const isUser = m.sender === "user";
                    return isUser ? (
                      <div key={m.id} className="flex flex-col items-end">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm">
                          {m.content}
                        </div>
                        <span className={`mt-1 text-[11px] ${t.muted}`}>{formatTime(m.timestamp)}</span>
                      </div>
                    ) : (
                      <div key={m.id} className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                          <IconSpark />
                        </div>
                        <div className={`min-w-0 flex-1 text-[15px] leading-7 ${t.text}`}>
                          <Markdown content={m.content} t={t} />
                          <div className={`mt-2 flex items-center gap-3 text-[11px] ${t.muted}`}>
                            <span>{formatTime(m.timestamp)}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(m)}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:text-indigo-500"
                              aria-label="Copier la réponse"
                            >
                              {copiedId === m.id ? <IconCheck /> : <IconCopy />}
                              {copiedId === m.id ? "Copié" : "Copier"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                        <IconSpark />
                      </div>
                      <div className={`flex items-center gap-2 text-sm ${t.muted}`}>
                        <span className="flex gap-1" aria-hidden="true">
                          {[0, 1, 2].map((n) => (
                            <span
                              key={n}
                              className="h-2 w-2 animate-bounce rounded-full bg-indigo-400"
                              style={{ animationDelay: `${n * 150}ms` }}
                            />
                          ))}
                        </span>
                        Analyse en cours…
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {showJump && (
            <button
              type="button"
              onClick={() => {
                stickRef.current = true;
                scrollToBottom();
              }}
              className={`absolute bottom-4 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border transition-colors ${t.jump}`}
              aria-label="Aller au dernier message"
            >
              <IconArrowDown />
            </button>
          )}
        </div>

        {/* Zone de saisie */}
        <div className={`border-t px-3 pb-3 pt-3 sm:px-4 ${t.bar}`}>
          <div className="mx-auto w-full max-w-3xl">
            {!isEmpty && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => handleSendMessage(s.prompt)}
                    disabled={loading}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${t.chip}`}
                  >
                    <span aria-hidden="true">{s.icon}</span> {s.title}
                  </button>
                ))}
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className={`mb-2 flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${t.errorBox}`}
              >
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg("")}
                  className="shrink-0 opacity-70 hover:opacity-100"
                  aria-label="Fermer le message d'erreur"
                >
                  ✕
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={`flex items-end gap-2 rounded-2xl border p-2 transition-shadow ${t.inputWrap}`}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Posez une question sur vos ventes, vos employés, vos livraisons…"
                className={`max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 outline-none ${t.text} ${t.placeholder}`}
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Envoyer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconSend />
              </button>
            </form>

            <div className={`mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[11px] ${t.muted}`}>
              <span>
                Données {team?.name || "de toutes les équipes"} · {context.confirmedOrders} confirmées ·{" "}
                {context.deliveredOrders} livrées
              </span>
              <span className="hidden sm:inline">Entrée pour envoyer · Maj+Entrée pour un retour à la ligne</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
