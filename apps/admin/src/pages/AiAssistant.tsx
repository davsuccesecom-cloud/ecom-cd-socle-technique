import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { Team, Order } from "@ecomcod/shared";
import {
  BarChart3,
  Award,
  ShieldAlert,
  TrendingUp,
  Send,
  Copy,
  Check,
  Trash2,
  ArrowDown,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Layers,
} from "lucide-react";
import { aiService, type BusinessMetricsContext, type AiChatMessage } from "../services/aiService";
import { splitMessage, type ChartSpec } from "../lib/aiChart";
import ProChart from "../components/ProChart";
import { fetchDailyStats } from "../lib/dailyStatsSeries";
import ExportMenu from "../components/ExportMenu";
import { makeKpis, type BilanReport, type BilanEmployee, type BilanProduct, type BilanDay } from "../lib/bilan/types";
import { formatFirebaseError } from "../lib/firebaseErrors";

const SUGGESTIONS = [
  {
    icon: BarChart3,
    title: "Bilan global",
    desc: "Synthèse chiffrée, points forts et axes d'amélioration.",
    prompt: "Fais-moi le bilan complet de la période : chiffres clés, points forts, courbe d'évolution et points d'amélioration.",
  },
  {
    icon: Award,
    title: "Audit des opérateurs",
    desc: "Classement closeuses et livreurs par rendement.",
    prompt: "Analyse la performance de mes closeuses et livreurs. Qui mérite une prime et qui doit être recadré ? Justifie avec les chiffres.",
  },
  {
    icon: ShieldAlert,
    title: "Plan anti-rejets",
    desc: "Réduire les annulations et clients injoignables.",
    prompt: "Analyse mes rejets et mes injoignables sur cette équipe et propose un plan d'action opérationnel immédiat.",
  },
  {
    icon: TrendingUp,
    title: "Projection & Courbe CA",
    desc: "Visualiser la dynamique d'encaissement COD.",
    prompt: "Trace la courbe du chiffre d'affaires et des livraisons sur la période et commente la tendance.",
  },
];

function renderInline(text: string, keyPrefix: string): ReactNode[] {
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
        <strong key={key} className="font-semibold text-slate-100">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-brand">
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

function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  const isTableSep = (l: string) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  const splitRow = (l: string) =>
    l
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
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
          ? "text-base font-semibold text-slate-100"
          : level === 2
            ? "text-sm font-semibold text-slate-100"
            : "text-xs font-semibold uppercase tracking-wider text-slate-300";
      out.push(
        <p key={k++} className={`${cls} pt-1`}>
          {renderInline(h[2], `h${k}`)}
        </p>
      );
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={k++} className="border-t border-surface-border" />);
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
        <div key={tk} className="overflow-x-auto rounded-xl border border-surface-border bg-surface/50">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-surface-border bg-surface text-slate-300">
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {renderInline(c, `th${tk}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-slate-300">
                      {renderInline(c, `td${tk}-${ri}-${ci}`)}
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
        <ul key={lk} className="list-disc space-y-1.5 pl-5 marker:text-brand">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `li${lk}-${ii}`)}</li>
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
        <ol key={lk} className="list-decimal space-y-1.5 pl-5 marker:text-brand">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ol${lk}-${ii}`)}</li>
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
        {renderInline(para.join("\n"), `p${pk}`)}
      </p>
    );
  }

  return <div className="space-y-3">{out}</div>;
}

const formatTime = (ts: unknown) => {
  const d =
    typeof ts === "object" &&
    ts !== null &&
    "toDate" in ts &&
    typeof (ts as { toDate: unknown }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as number | string);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

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
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [showArtifactsPanel, setShowArtifactsPanel] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  const context: BusinessMetricsContext = useMemo(() => {
    const totalOrders = orders.length;
    const confirmedOrders = orders.filter(
      (o) => o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || o.statutCloseuse === "livre"
    ).length;
    const deliveredOrders = orders.filter(
      (o) => o.statutLivreur === "livre" || o.statutCloseuse === "livre"
    ).length;
    const injoignableOrders = orders.filter(
      (o) => o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable"
    ).length;
    const rejectedOrders = orders.filter((o) => o.statutCloseuse === "rejete").length;
    const revenue = orders
      .filter((o) => o.statutLivreur === "livre" || o.statutCloseuse === "livre")
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
        const del = lOrders.filter((o) => o.statutLivreur === "livre" || o.statutCloseuse === "livre").length;
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
      if (o.statutLivreur === "livre" || o.statutCloseuse === "livre") {
        productMap[p].revenue += o.amount || 0;
      }
    });

    const topProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.count - a.count);

    const trendsMap: Record<
      string,
      { date: string; confirmed: number; delivered: number; rejected: number; revenue: number }
    > = {};
    orders.forEach((o) => {
      const ts = o.timestamps?.received;
      if (!ts) return;
      const d = new Date(ts);
      const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
      if (!trendsMap[dateKey]) {
        trendsMap[dateKey] = { date: dateKey, confirmed: 0, delivered: 0, rejected: 0, revenue: 0 };
      }
      if (o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || o.statutCloseuse === "livre") {
        trendsMap[dateKey].confirmed += 1;
      }
      if (o.statutLivreur === "livre" || o.statutCloseuse === "livre") {
        trendsMap[dateKey].delivered += 1;
        trendsMap[dateKey].revenue += o.amount || 0;
      }
      if (o.statutCloseuse === "rejete" || o.statutLivreur === "injoignable" || o.statutCloseuse === "injoignable") {
        trendsMap[dateKey].rejected += 1;
      }
    });
    const dailyTrends = Object.values(trendsMap).sort((a, b) => a.date.localeCompare(b.date));

    const timestamps = orders
      .map((o) => o.timestamps?.received)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const periodLabel =
      timestamps.length > 0
        ? `Du ${new Date(Math.min(...timestamps)).toLocaleDateString("fr-FR")} au ${new Date(
            Math.max(...timestamps)
          ).toLocaleDateString("fr-FR")}`
        : "Période active";

    return {
      teamName: team?.name || "Toutes les équipes",
      country: team?.defaultCountry || "Général",
      currency: team?.currency || "XOF",
      periodLabel,
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
      dailyTrends,
    };
  }, [orders, closeuses, livreurs, team]);

  // Extract all chart artifacts generated across the conversation
  const chartArtifacts = useMemo(() => {
    const list: { id: string; spec: ChartSpec; timestamp: number }[] = [];
    for (const m of messages) {
      if (m.sender !== "assistant") continue;
      const parts = splitMessage(m.content);
      parts.forEach((p, idx) => {
        if (p.kind === "chart") {
          list.push({
            id: `${m.id}_${idx}`,
            spec: p.spec,
            timestamp: m.timestamp,
          });
        }
      });
    }
    return list.reverse();
  }, [messages]);

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
      (err) => {
        setHistoryLoaded(true);
        const formatted = formatFirebaseError(err);
        setErrorMsg(formatted.message);
      }
    );
    return () => unsub();
  }, [workspaceId]);

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

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [inputPrompt]);

  const handleSendMessage = async (textToSend?: string, skipSavingUserMsg = false) => {
    const prompt = (textToSend ?? inputPrompt).trim();
    if (!prompt || loading) return;

    setInputPrompt("");
    setErrorMsg("");
    setLastFailedPrompt(null);
    setLoading(true);
    stickRef.current = true;

    try {
      const db = getDb();
      if (!skipSavingUserMsg) {
        const userMsgId = `msg_${Date.now()}`;
        const userMsg: AiChatMessage = {
          id: userMsgId,
          sender: "user",
          content: prompt,
          timestamp: Date.now(),
        };
        await setDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", userMsgId), userMsg);
      }

      const history = messages.slice(-6).map((m) => ({
        role: m.sender as "user" | "assistant",
        content: m.content,
      }));

      const systemPrompt = aiService.buildSystemPrompt(context);

      let reply = "";
      try {
        reply = await aiService.sendRaw([
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: prompt },
        ]);
      } catch (e) {
        const formatted = formatFirebaseError(e);
        setLastFailedPrompt(prompt);
        setErrorMsg(formatted.message);
        return;
      }

      if (!reply) {
        setLastFailedPrompt(prompt);
        setErrorMsg("L'analyse n'a pas pu être finalisée. Cliquez sur Réessayer.");
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
      const formatted = formatFirebaseError(err);
      setLastFailedPrompt(prompt);
      setErrorMsg(formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Réinitialiser l'historique de cette session d'analyse ?")) return;
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

  const buildBilanReport = async (): Promise<BilanReport> => {
    const lastAssistant = [...messages].reverse().find((m) => m.sender === "assistant");
    const analysisMarkdown = lastAssistant ? lastAssistant.content : "Bilan récapitulatif des performances.";

    const kpis = makeKpis({
      ca: context.revenue,
      recues: context.totalOrders,
      confirmees: context.confirmedOrders,
      livrees: context.deliveredOrders,
      injoignables: context.injoignableOrders,
      rejetees: context.rejectedOrders,
      currency: context.currency,
    });

    const funnel = [
      { label: "Commandes reçues", value: context.totalOrders },
      { label: "Confirmées", value: context.confirmedOrders },
      { label: "Livrées et payées", value: context.deliveredOrders },
    ];

    const employees: BilanEmployee[] = [
      ...context.topCloseuses.map((c) => ({
        name: c.name,
        role: "closeuse" as const,
        done: c.confirmed,
        total: c.total,
      })),
      ...context.topLivreurs.map((l) => ({
        name: l.name,
        role: "livreur" as const,
        done: l.delivered,
        total: l.total,
      })),
    ];

    const products: BilanProduct[] = context.topProducts.map((p) => ({
      name: p.name,
      sales: p.count,
    }));

    const days: BilanDay[] = (context.dailyTrends || []).map((d) => ({
      date: d.date,
      ca: d.revenue,
      livraisons: d.delivered,
      rejetees: d.rejected,
      injoignables: 0,
    }));

    return {
      title: `Bilan Opérationnel & Stratégique - ${context.teamName}`,
      team: context.teamName,
      periodLabel: context.periodLabel,
      generatedAt: new Date().toISOString(),
      currency: context.currency,
      kpis,
      funnel,
      employees,
      products,
      days,
      analysisMarkdown,
    };
  };

  const isEmpty = messages.length === 0;
  const canSend = inputPrompt.trim().length > 0 && !loading;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex h-[calc(100dvh-9.5rem)] min-h-[520px] overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-sm">
        {/* Left / Main Chat Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Workspace Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border bg-surface/40 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/15 text-brand">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-100">
                    Analyste Direction — {context.teamName}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Temps réel
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {context.totalOrders} cmd · {context.confirmedOrders} confirmées ({context.confirmationRate}%) ·{" "}
                  {context.deliveredOrders} livrées ({context.deliveryRate}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ExportMenu getReport={buildBilanReport} />
              {!isEmpty && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Réinitialiser</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowArtifactsPanel((v) => !v)}
                className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition lg:inline-flex ${
                  showArtifactsPanel
                    ? "border-brand/40 bg-brand/15 text-brand"
                    : "border-surface-border bg-surface text-slate-400 hover:text-slate-200"
                }`}
                title="Afficher / masquer le panneau d'artefacts et courbes"
              >
                {showArtifactsPanel ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
                <span>Artefacts ({chartArtifacts.length})</span>
              </button>
            </div>
          </div>

          {/* Conversation Scroll Area */}
          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain">
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
                {!historyLoaded ? (
                  <div className="my-auto py-10 text-center text-xs text-slate-500">
                    Chargement du dossier d'analyse…
                  </div>
                ) : isEmpty && !loading ? (
                  <div className="my-auto py-4">
                    <div className="mb-6 text-center">
                      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-100">
                        Diagnostic Opérationnel — {team?.name || "Direction"}
                      </h3>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                        Interrogez vos indicateurs de closing, livraison et encaissement Cash-On-Delivery ou générez un bilan exécutif complet.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {SUGGESTIONS.map((s) => {
                        const Icon = s.icon;
                        return (
                          <button
                            key={s.title}
                            type="button"
                            onClick={() => handleSendMessage(s.prompt)}
                            className="group flex items-start gap-3 rounded-xl border border-surface-border bg-surface/50 p-3.5 text-left transition hover:border-brand/50 hover:bg-surface"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-brand group-hover:border-brand/40">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block text-xs font-semibold text-slate-100">{s.title}</span>
                              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                                {s.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((m) => {
                      const isUser = m.sender === "user";
                      return isUser ? (
                        <div key={m.id} className="flex flex-col items-end">
                          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-xs leading-relaxed text-white shadow-sm sm:text-sm">
                            {m.content}
                          </div>
                          <span className="mt-1 text-[10px] text-slate-500">{formatTime(m.timestamp)}</span>
                        </div>
                      ) : (
                        <div key={m.id} className="flex gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/15 text-brand">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1 text-xs leading-6 text-slate-200 sm:text-sm">
                            {splitMessage(m.content).map((part, pIdx) => {
                              if (part.kind === "text") {
                                return <Markdown key={pIdx} content={part.text} />;
                              }
                              return (
                                <div
                                  key={pIdx}
                                  className="my-3 overflow-hidden rounded-xl border border-surface-border bg-surface p-3.5"
                                >
                                  <ProChart
                                    spec={part.spec}
                                    load={(p) => fetchDailyStats(getDb(), workspaceId, team?.id || "", p)}
                                  />
                                </div>
                              );
                            })}
                            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                              <span>{formatTime(m.timestamp)}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(m)}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:text-slate-200"
                              >
                                {copiedId === m.id ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                <span>{copiedId === m.id ? "Copié" : "Copier"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/15 text-brand">
                          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        </div>
                        <span className="text-xs text-slate-400">Calcul et consolidation du bilan en cours…</span>
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
                className="absolute bottom-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-surface-border bg-surface-raised text-slate-300 shadow-lg hover:text-white"
                aria-label="Aller au dernier message"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Bottom Composer */}
          <div className="border-t border-surface-border bg-surface/40 px-4 py-3">
            <div className="mx-auto w-full max-w-3xl">
              {!isEmpty && (
                <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                  {SUGGESTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => handleSendMessage(s.prompt)}
                        disabled={loading}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-brand/40 hover:text-slate-100 disabled:opacity-40"
                      >
                        <Icon className="h-3 w-3 text-brand" />
                        <span>{s.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastFailedPrompt && (
                      <button
                        type="button"
                        onClick={() => handleSendMessage(lastFailedPrompt, true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 font-semibold text-rose-200 hover:bg-rose-500/30"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Réessayer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setErrorMsg("")}
                      className="text-rose-300/70 hover:text-rose-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 focus-within:border-brand"
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
                  placeholder="Demandez un bilan, une analyse par closeuse ou une courbe de CA…"
                  className="max-h-36 min-h-[32px] flex-1 resize-none bg-transparent py-1 text-xs leading-5 text-slate-100 outline-none placeholder:text-slate-500 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Envoyer"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-hover disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Side Panel: Live Metrics & Chart Artifacts */}
        {showArtifactsPanel && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-surface-border bg-surface/30 lg:flex xl:w-96">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Layers className="h-3.5 w-3.5 text-brand" />
                <span>Artefacts & Indicateurs</span>
              </div>
              <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-slate-400">
                {context.currency}
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Live Executive Summary Card */}
              <div className="rounded-xl border border-surface-border bg-surface-raised p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Synthèse en direct
                  </span>
                  <span className="text-[11px] font-medium text-brand">{context.teamName}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2.5">
                    <p className="text-[10px] text-slate-500">CA Encaissé</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-slate-100">
                      {context.revenue.toLocaleString("fr-FR")} {context.currency}
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2.5">
                    <p className="text-[10px] text-slate-500">Livraisons</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-emerald-400">
                      {context.deliveredOrders} ({context.deliveryRate}%)
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2.5">
                    <p className="text-[10px] text-slate-500">Closing</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-sky-400">
                      {context.confirmedOrders}/{context.totalOrders} ({context.confirmationRate}%)
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2.5">
                    <p className="text-[10px] text-slate-500">Échecs / Rejets</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-rose-400">
                      {context.rejectedOrders + context.injoignableOrders}
                    </p>
                  </div>
                </div>
              </div>

              {/* Generated Charts Deck */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Graphiques générés ({chartArtifacts.length})
                </p>
                {chartArtifacts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-surface-border bg-surface/30 p-5 text-center">
                    <BarChart3 className="mx-auto mb-2 h-5 w-5 text-slate-500" />
                    <p className="text-xs text-slate-400">
                      Demandez un bilan ou une courbe pour épingler automatiquement les graphiques ici.
                    </p>
                  </div>
                ) : (
                  chartArtifacts.map((item) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-surface-border bg-surface-raised p-3"
                    >
                      <ProChart
                        spec={item.spec}
                        load={(p) => fetchDailyStats(getDb(), workspaceId, team?.id || "", p)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
