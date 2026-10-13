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
  const [showSettings, setShowSettings] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Calcul des métriques business réelles (exclusif opérations)
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

  // Écoute temps réel des messages dans Firestore
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

      const history = messages.slice(-10).map((m) => ({
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

  const handleClearHistory = async () => {
    if (!window.confirm("Voulez-vous réinitialiser l'historique de cette session d'analyse ?")) return;
    const db = getDb();
    for (const m of messages) {
      await deleteDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", m.id));
    }
  };

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
    <div className="relative min-h-[82vh] w-full rounded-3xl bg-[#090C10] p-6 md:p-8 text-slate-100 shadow-2xl overflow-hidden border border-slate-800/80">
      {/* Lueur et reflets d'arrière plan (Aura futuriste comme sur la maquette) */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-gradient-to-tr from-indigo-500/15 via-purple-500/20 to-teal-400/15 blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 h-80 w-[42rem] rounded-full bg-teal-500/10 blur-3xl opacity-50" />

      {/* Barre d'outils supérieure discrète */}
      <div className="relative z-10 flex items-center justify-between pb-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
            ECOM AI CORE
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
            {currentProvider.toUpperCase()} ONLINE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:text-white transition-colors"
          >
            ⚙️ Moteur IA
          </button>
          <button
            onClick={handleExportWord}
            disabled={messages.length === 0}
            className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-30 transition-colors"
          >
            📄 Bilan Word
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Paramètres du Moteur IA */}
      {showSettings && (
        <div className="relative z-20 my-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Choix du Fournisseur d'IA
            </span>
            <button onClick={() => setShowSettings(false)} className="text-xs text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: "groq", name: "Groq (Llama-3 Ultra-Rapide)", desc: "Réponses instantanées en millisecondes" },
              { id: "nvidia", name: "NVIDIA API (Nemotron / Llama)", desc: "Moteur IA haute capacité analytique" },
              { id: "custom", name: "Custom Provider (Futur modèle)", desc: "OpenAI, Claude, Mistral ou local" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setCurrentProvider(p.id as any);
                  aiService.setProvider(p.id as any);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  currentProvider === p.id
                    ? "border-teal-500 bg-teal-500/10 text-white"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="text-xs font-bold text-slate-200">{p.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section Principale */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-4 pb-2">
        {/* Orbe Lumineux Holographique (Style LIX de la photo) */}
        <div className="relative flex items-center justify-center my-3">
          <div className="h-28 w-28 md:h-32 md:w-32 rounded-full p-1 bg-gradient-to-tr from-purple-600 via-indigo-500 to-teal-400 shadow-[0_0_50px_rgba(99,102,241,0.45)] animate-pulse">
            <div className="h-full w-full rounded-full bg-[#0E131F] flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/40 via-purple-600/30 to-teal-400/50 mix-blend-screen animate-spin duration-10000" />
              <span className="relative text-3xl md:text-4xl filter drop-shadow">🔮</span>
            </div>
          </div>
        </div>

        {/* Titre et Sous-titre */}
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight text-center mt-2">
          Bonjour {team?.name || "Direction"} 👋
        </h2>
        <p className="text-sm md:text-base font-semibold text-slate-200 text-center mt-1">
          Comment puis-je vous aider aujourd'hui ?
        </p>
        <p className="text-xs text-slate-400 text-center max-w-md mt-1">
          Votre analyste dédié pour optimiser vos marges, piloter vos closeuses & livreurs et dresser vos bilans.
        </p>
      </div>

      {/* Historique des messages déroulant si conversation active */}
      {messages.length > 0 && (
        <div className="relative z-10 my-4 max-h-72 overflow-y-auto space-y-3 px-2 py-2 rounded-2xl bg-slate-950/40 border border-slate-800/60">
          {messages.map((m) => {
            const isUser = m.sender === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
                    IA
                  </div>
                )}
                <div
                  className={`max-w-xl rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-tr-none shadow-md"
                      : "bg-[#141B26] border border-slate-800 text-slate-200 rounded-tl-none shadow-md"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-teal-400 animate-pulse px-2">
              <span>⏳</span> Analyse de vos opérations en cours...
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
      )}

      {/* Zone de saisie principale (Design Boîte Flottante avec bannière comme la maquette) */}
      <div className="relative z-10 max-w-2xl mx-auto mt-4">
        <div className="rounded-3xl border border-slate-700/60 bg-[#121824]/90 p-3 shadow-2xl backdrop-blur-xl">
          {/* Petit bandeau supérieur discret */}
          <div className="flex items-center gap-1.5 px-3 pt-1 pb-2 text-[11px] font-semibold text-teal-400">
            <span>⚡</span> Données {team?.defaultCountry || "COD"} synchronisées en temps réel
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="space-y-2"
          >
            <textarea
              rows={2}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Posez une question sur vos ventes, employés, livraisons..."
              className="w-full resize-none rounded-2xl bg-[#090D14] px-4 py-3 text-xs text-slate-100 placeholder-slate-500 outline-none border border-slate-800/80 focus:border-teal-500/60 transition-colors"
            />

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  {context.confirmedOrders} conf. · {context.deliveredOrders} livrées
                </span>
              </div>

              <button
                type="submit"
                disabled={!inputPrompt.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-950 shadow-lg hover:opacity-90 disabled:opacity-30 transition-all font-bold text-sm"
              >
                ↑
              </button>
            </div>
          </form>
        </div>

        {/* 3 Cartes Raccourcis Stratégiques (Bas de la maquette) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <button
            onClick={() => handleSendMessage("📊 Fais-moi le bilan complet et les points d'amélioration de la journée.")}
            className="flex flex-col text-left rounded-2xl border border-slate-800/80 bg-[#121824]/60 p-3.5 hover:border-teal-500/40 hover:bg-[#121824] transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 group-hover:text-teal-300">
              <span>📊</span> Bilan Global
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Analyse complète des taux, confirmation et encaissements.
            </p>
          </button>

          <button
            onClick={() => handleSendMessage("🏆 Quel employé (closeuse ou livreur) mérite une promotion ou prime aujourd'hui ?")}
            className="flex flex-col text-left rounded-2xl border border-slate-800/80 bg-[#121824]/60 p-3.5 hover:border-teal-500/40 hover:bg-[#121824] transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 group-hover:text-teal-300">
              <span>🏆</span> Top Employés
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Détecte qui performe et qui mérite une promotion.
            </p>
          </button>

          <button
            onClick={() => handleSendMessage("⚠️ Quels sont les motifs de rejet et comment réduire les injoignables ?")}
            className="flex flex-col text-left rounded-2xl border border-slate-800/80 bg-[#121824]/60 p-3.5 hover:border-teal-500/40 hover:bg-[#121824] transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 group-hover:text-teal-300">
              <span>⚠️</span> Réduire les Rejets
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Plans d'actions concrets pour sauver les commandes perdues.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
