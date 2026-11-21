import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, formatCurrency, AFRICA_COUNTRIES, type Team, type MarketplaceSubscriber } from "@ecomcod/shared";
import {
  BellRing,
  Send,
  ShoppingBag,
  Sparkles,
  Gift,
  Flame,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  ExternalLink,
  Users,
  Percent,
  RefreshCw,
  Zap,
} from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface AzifyMarketplaceMarketingProps {
  workspaceId: string;
  team: Team;
  allTeams: Team[];
}

export default function AzifyMarketplaceMarketing({
  workspaceId,
  team,
  allTeams,
}: AzifyMarketplaceMarketingProps) {
  const [subscribers, setSubscribers] = useState<MarketplaceSubscriber[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire de Campagne Push
  const [title, setTitle] = useState("🔥 Offre Spéciale : -30% + Cadeau surprise offert !");
  const [body, setBody] = useState("Commandez en 1 clic aujourd'hui et payez en espèces à la livraison. Stock ultra-limité !");
  const [clickUrl, setClickUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetCountry, setTargetCountry] = useState("all");
  const [targetAudience, setTargetAudience] = useState<"all" | "abandoned_carts">("all");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Script d'intégration
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Écoute temps réel des abonnés Marketplace
  useEffect(() => {
    const db = getDb();
    const subsRef = collection(db, "workspaces", workspaceId, "marketplaceSubscribers");
    const q = query(subsRef, orderBy("lastSeenAt", "desc"), limit(200));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MarketplaceSubscriber);
        setSubscribers(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Écoute marketplaceSubscribers warning:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [workspaceId]);

  // Statistiques calculées
  const stats = useMemo(() => {
    let totalSubscribers = subscribers.length;
    let activeAbandonedCarts = 0;
    let totalRecovered = 0;
    let totalAbandonedAmount = 0;

    subscribers.forEach((s) => {
      if (s.cart?.status === "abandoned" && !s.cartRecoverySent) {
        activeAbandonedCarts++;
        totalAbandonedAmount += Number(s.cart.amount || 0);
      }
      if (s.cart?.status === "converted" && s.cartRecoverySent) {
        totalRecovered++;
      }
    });

    return {
      totalSubscribers,
      activeAbandonedCarts,
      totalRecovered,
      totalAbandonedAmount,
    };
  }, [subscribers]);

  // Paniers abandonnés récents
  const abandonedList = useMemo(() => {
    return subscribers
      .filter((s) => s.cart && s.cart.status === "abandoned")
      .slice(0, 10);
  }, [subscribers]);

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setSendError("Le titre et le message de la notification sont obligatoires.");
      return;
    }

    setSending(true);
    setSendError(null);
    setSendResult(null);

    try {
      const functions = getFunctions(getApp());
      const callSend = httpsCallable(functions, "sendMarketplacePushCampaign");
      const res = await callSend({
        title: title.trim(),
        body: body.trim(),
        clickUrl: clickUrl.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        targetCountry: targetCountry === "all" ? undefined : targetCountry,
        targetAudience,
      });

      const data = res.data as { ok: boolean; sentCount: number; failureCount: number; message: string };
      setSendResult({ sent: data.sentCount, failed: data.failureCount });
    } catch (err: any) {
      const f = formatFirebaseError(err);
      setSendError(`${f.title} : ${f.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleManualCartRecovery = async (subscriber: MarketplaceSubscriber) => {
    if (!subscriber.token) return;
    try {
      const functions = getFunctions(getApp());
      const callSend = httpsCallable(functions, "sendMarketplacePushCampaign");
      await callSend({
        title: "🛒 Votre panier vous attend toujours !",
        body: `Finalisez votre commande de ${subscriber.cart?.product || "votre sélection"} avant rupture de stock + 1 cadeau exclusif inclus 🎁`,
        clickUrl: subscriber.cart?.checkoutUrl || undefined,
        imageUrl: subscriber.cart?.productImageUrl || undefined,
        targetAudience: "abandoned_carts",
      });

      // Mettre à jour l'état local
      const db = getDb();
      const subRef = doc(db, "workspaces", workspaceId, "marketplaceSubscribers", subscriber.id);
      await updateDoc(subRef, {
        cartRecoverySent: true,
        cartRecoverySentAt: Date.now(),
      });
    } catch (err) {
      console.warn("Relance manuelle warning:", err);
    }
  };

  // Snippet JavaScript d'intégration pour Azify PWA Studio / vitrines
  const scriptSnippet = `<!-- Snippet Web Push Marketplace Azify & WariTrack -->
<script>
(function() {
  var VAPID_KEY = "${import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BFG...'}";
  var GATEWAY_URL = "https://azifygateway-7sfexpcitq-uc.a.run.app/push/subscribe";
  var CART_URL = "https://azifygateway-7sfexpcitq-uc.a.run.app/cart/activity";

  // Demander l'accord Push pour recevoir les offres exclusives et cadeaux
  window.requestMarketplacePush = function(phone, country) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        // Enregistrement du token FCM auprès de la passerelle
        navigator.serviceWorker.ready.then(function(reg) {
          // Utiliser firebase.messaging().getToken() ou pushManager.subscribe()
          console.log("[Marketplace Push] Permission accordée pour", phone, country);
        });
      }
    });
  };

  // Suivi automatique des paniers abandonnés
  window.trackMarketplaceCart = function(product, amount, phone) {
    try {
      fetch(CART_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product,
          amount: amount,
          clientPhone: phone,
          status: 'abandoned',
          shopDomain: window.location.hostname
        }),
        keepalive: true
      }).catch(function() {});
    } catch(e) {}
  };
})();
</script>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(scriptSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Bandeau KPIs : Abonnés & Paniers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Abonnés Push Marketplace</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-100">
            {stats.totalSubscribers}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Clients & visiteurs réceptifs aux alertes promos
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Paniers Abandonnés Actifs</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-400">
            {stats.activeAbandonedCarts}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
            ~ {formatCurrency(stats.totalAbandonedAmount, team.currency || "XOF")} à récupérer
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Paniers Récupérés</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-400">
            {stats.totalRecovered}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Convertis en commandes réelles via Push
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Relance Auto Cron (30 min)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-200">
            Vigie Active 24/7
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Notification automatique envoyée après 20 min d'abandon
          </p>
        </div>
      </div>

      {/* 2. Formulaire de Campagne Push 1-Clic : Promos, Cadeaux & Relances */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 md:p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between border-b border-surface-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Diffuser une Campagne Push Marketplace
              </h3>
              <p className="text-xs text-slate-400">
                Envoyez une alerte directe sur le téléphone des acheteurs : Promos Flash, Cadeaux exclusifs et Relances paniers.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSendCampaign} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Titre accrocheur de la notification
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : 🔥 Vente Flash -30% + Cadeau surprise offert !"
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-brand focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Lien de redirection au clic (URL boutique ou produit)
              </label>
              <input
                type="url"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
                placeholder="https://votre-boutique-azify.com/produit-promo"
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-brand focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Message persuasif & Offre de valeur
            </label>
            <textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ex : Plus que quelques pièces disponibles. Commandez maintenant et payez en espèces à la livraison avec 1 cadeau VIP inclus 🎁"
              className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-brand focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Photo du produit ou cadeau (URL optionnelle)
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://.../photo-cadeau.jpg"
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-brand focus:outline-hidden"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Ciblage géographique
              </label>
              <select
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 focus:border-brand focus:outline-hidden cursor-pointer"
              >
                <option value="all">🌍 Tous les marchés (Global)</option>
                {AFRICA_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Audience ciblée
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as any)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 focus:border-brand focus:outline-hidden cursor-pointer"
              >
                <option value="all">👥 Tous les abonnés Marketplace</option>
                <option value="abandoned_carts">🛒 Paniers abandonnés uniquement</option>
              </select>
            </div>
          </div>

          {sendError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{sendError}</span>
            </div>
          )}

          {sendResult && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Campagne diffusée avec succès : <strong>{sendResult.sent}</strong> abonnés notifiés ({sendResult.failed} échecs / tokens obsolètes purgés).
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={sending}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
            >
              {sending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Diffusion en cours...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Diffuser la notification Push ({targetAudience === "abandoned_carts" ? stats.activeAbandonedCarts : stats.totalSubscribers} cibles)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Liste des Paniers Abandonnés Récents */}
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        <div className="border-b border-surface-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-bold text-slate-100">
              Paniers Abandonnés récents détectés sur la Marketplace
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            {abandonedList.length} affiché(s)
          </span>
        </div>

        {abandonedList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Aucun panier abandonné en attente. Votre taux de conversion est au maximum !
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {abandonedList.map((sub) => {
              const cart = sub.cart!;
              return (
                <div key={sub.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200">
                      {cart.product} {cart.quantity > 1 ? `(${cart.quantity}x)` : ""}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Client : <span className="font-medium text-slate-300">{sub.clientPhone || sub.clientName || "Visiteur anonyme"}</span> · Marché : {sub.country || "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                      {new Date(cart.updatedAt).toLocaleString("fr-FR")}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-slate-100">
                        {formatCurrency(cart.amount, team.currency || "XOF")}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          sub.cartRecoverySent
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {sub.cartRecoverySent ? "Relancé par Push" : "En attente relance"}
                      </span>
                    </div>

                    {!sub.cartRecoverySent && (
                      <button
                        type="button"
                        onClick={() => handleManualCartRecovery(sub)}
                        className="min-h-[38px] rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
                      >
                        Relancer maintenant
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Snippet d'intégration Push pour Azify PWA Studio */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 md:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-surface-border pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <Copy className="h-4 w-4 text-brand" />
            <h4 className="text-sm font-bold text-slate-100">
              Script d&apos;Intégration Web Push pour Azify PWA Studio
            </h4>
          </div>
          <button
            type="button"
            onClick={copySnippet}
            className={`flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition cursor-pointer ${
              copiedSnippet
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-surface-border bg-surface text-slate-300 hover:bg-surface-raised"
            }`}
          >
            {copiedSnippet ? "✓ Script copié !" : "Copier le script"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Insérez ce script sur votre vitrine Azify pour demander la permission de notification aux acheteurs et suivre automatiquement les paniers abandonnés.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-surface-border bg-surface p-3 font-mono text-[11px] text-slate-300">
          {scriptSnippet}
        </pre>
      </div>
    </div>
  );
}
