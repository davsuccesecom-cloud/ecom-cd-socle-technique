import { useState, useEffect, useRef } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { Team, Order } from "@ecomcod/shared";
import { aiService, type BusinessMetricsContext, type AiChatMessage } from "../services/aiService";

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
  allTeams,
  orders,
  closeuses,
  livreurs,
}: AiAssistantProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<"groq" | "nvidia" | "custom">("groq");
  const [customKeyInput, setCustomKeyInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 1. Calcul des Métriques Business Filtrées (Strictement opérationnelles)
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

    // Performances des closeuses
    const topCloseuses = closeuses.map((c) => {
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
    }).sort((a, b) => b.confirmed - a.confirmed);

    // Performances des livreurs
    const topLivreurs = livreurs.map((l) => {
      const lOrders = orders.filter((o) => o.livreurId === l.id);
      const del = lOrders.filter((o) => o.statutLivreur === "livre").length;
      return {
        name: l.name,
        delivered: del,
        total: lOrders.length,
        rate: lOrders.length > 0 ? Math.round((del / lOrders.length) * 100) : 0,
      };
    }).sort((a, b) => b.delivered - a.delivered);

    // Produits les plus vendus
    const productMap: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const p = o.product || "Produit standard";
      if (!productMap[p]) productMap[p] = { count: 0, revenue: 0 };
      productMap[p].count += 1;
      if (o.statutLivreur === "livre") {
        productMap[p].revenue += o.amount || 0;
      }
    });

    const topProducts = Object.entries(productMap).map(([name, data]) => ({
      name,
      count: data.count,
      revenue: data.revenue,
    })).sort((a, b) => b.count - a.count);

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

  // 2. Écoute temps réel de l'historique de discussion
  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const chatCol = collection(db, "workspaces", workspaceId, "aiAssistantChats");
    const q = query(chatCol, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const list: AiChatMessage[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as AiChatMessage);
      });
      setMessages(list);
    });
    return () => unsub();
  }, [workspaceId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Envoi d'un message
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || loading) return;

    setInputPrompt("");
    setLoading(true);

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

      // Historique pour le prompt
      const history = messages.slice(-8).map((m) => ({
        role: m.sender as "user" | "assistant",
        content: m.content,
      }));

      const reply = await aiService.sendMessage(prompt, history, context);

      const botMsgId = `bot_${Date.now()}`;
      const botMsg: AiChatMessage = {
        id: botMsgId,
        sender: "assistant",
        content: reply,
        timestamp: Date.now(),
      };

      await setDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", botMsgId), botMsg);
    } catch (err) {
      alert("Erreur Assistant IA : " + (err instanceof Error ? err.message : "Erreur de connexion"));
    } finally {
      setLoading(false);
    }
  };

  // Vider l'historique
  const handleClearHistory = async () => {
    if (!window.confirm("Voulez-vous réinitialiser l'historique de cette session d'analyse ?")) return;
    const db = getDb();
    for (const m of messages) {
      await deleteDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", m.id));
    }
  };

  // Exportation au format Document Word (.doc)
  const handleExportWord = () => {
    const title = `Bilan_Analyste_IA_${team?.name || "Business"}_${new Date().toISOString().slice(0, 10)}`;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title></head><body>`;
    const footer = `</body></html>`;

    let body = `<h2>Rapport d'Analyse Opérationnelle & Bilan Commercial</h2>`;
    body += `<p><strong>Équipe :</strong> ${team?.name || "Global"} (${team?.defaultCountry || ""}) | <strong>Date :</strong> ${new Date().toLocaleDateString()}</p>`;
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
      body += `<p style="white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-left: 3px solid #6366f1;">${m.content}</p>`;
    });

    const blob = new Blob([header + body + footer], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* En-tête de l'Analyste */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
            <span className="text-2xl animate-bounce">⭐</span>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100">Analyste Business & Secrétaire de Direction</h1>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                IA Stratégique
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Analyse automatique de rentabilité, détection des meilleurs employés et recommandations opérationnelles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            ⚙️ Moteur ({currentProvider.toUpperCase()})
          </button>
          <button
            onClick={handleExportWord}
            disabled={messages.length === 0}
            className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40 transition-colors"
          >
            📄 Télécharger Bilan (.doc)
          </button>
          <button
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
          >
            Effacer
          </button>
        </div>
      </div>

      {/* Paramètres Moteur IA (Agnostique / Modulaire) */}
      {showSettings && (
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Choix du Fournisseur d'IA (Agnostique)
            </h3>
            <button onClick={() => setShowSettings(false)} className="text-xs text-slate-400 hover:text-white">
              ✕ Fermer
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: "groq", name: "Groq (Llama-3 Ultra-Rapide)", desc: "Recommandé pour des bilans instantanés" },
              { id: "nvidia", name: "NVIDIA API (Nemotron / Llama)", desc: "Moteur IA NVIDIA haute précision" },
              { id: "custom", name: "Custom Provider (Futur modèle)", desc: "OpenAI, Claude, Mistral, Local" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setCurrentProvider(p.id as any);
                  aiService.setProvider(p.id as any);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  currentProvider === p.id
                    ? "border-amber-500 bg-amber-500/10 text-white"
                    : "border-surface-border bg-surface text-slate-400 hover:border-slate-500"
                }`}
              >
                <div className="text-xs font-bold text-slate-200">{p.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Métriques Flash en haut de l'espace de discussion */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3">
          <span className="text-[10px] uppercase font-bold text-slate-400">Chiffre d'Affaires</span>
          <div className="text-sm font-bold text-emerald-400 mt-1">
            {context.revenue.toLocaleString()} {context.currency}
          </div>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3">
          <span className="text-[10px] uppercase font-bold text-slate-400">Taux Confirmation</span>
          <div className="text-sm font-bold text-indigo-400 mt-1">{context.confirmationRate}%</div>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3">
          <span className="text-[10px] uppercase font-bold text-slate-400">Taux Livraison</span>
          <div className="text-sm font-bold text-cyan-400 mt-1">{context.deliveryRate}%</div>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3">
          <span className="text-[10px] uppercase font-bold text-slate-400">Rejets / Injoignables</span>
          <div className="text-sm font-bold text-rose-400 mt-1">
            {context.rejectedOrders} / {context.injoignableOrders}
          </div>
        </div>
      </div>

      {/* Raccourcis de questions stratégiques */}
      <div className="flex flex-wrap gap-2">
        {[
          "📊 Fais-moi le bilan complet et les points d'amélioration de la journée.",
          "🏆 Quel employé (closeuse ou livreur) mérite une promotion ou prime aujourd'hui ?",
          "⚠️ Quels sont les motifs de rejet et comment réduire les injoignables ?",
          "📈 Quels pays et produits génèrent la meilleure marge nette ?",
        ].map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            className="rounded-full border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-300 hover:border-amber-500/50 hover:text-white transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Zone de Discussion & Historique */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised flex flex-col h-[520px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-2">
              <span className="text-3xl">🤖</span>
              <p className="text-sm font-semibold text-slate-200">
                Bonjour ! Je suis votre Secrétaire de Direction et Analyste E-commerce COD.
              </p>
              <p className="text-xs text-slate-400 max-w-md">
                Je dispose en temps réel de vos données opérationnelles. Cliquez sur une suggestion ci-dessus ou posez-moi n'importe quelle question sur vos performances.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 text-sm font-bold border border-amber-500/30">
                      IA
                    </div>
                  )}
                  <div
                    className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? "bg-brand text-white rounded-tr-none"
                        : "bg-surface border border-surface-border text-slate-200 rounded-tl-none shadow-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div className="flex gap-3 items-center text-xs text-amber-400 animate-pulse">
              <span className="text-base">⏳</span> L'Analyste étudie vos métriques et prépare votre rapport...
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Barre de saisie */}
        <div className="p-3 border-t border-surface-border bg-surface rounded-b-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Posez une question sur votre business, vos employés, vos marges..."
              className="flex-1 rounded-xl border border-surface-border bg-surface-raised px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || loading}
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40 transition-all shrink-0"
            >
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
