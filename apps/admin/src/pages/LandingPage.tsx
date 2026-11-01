import { useState, useRef } from "react";
import {
  ShieldCheck,
  Sparkles,
  PhoneCall,
  Share2,
  Landmark,
  Bot,
  ArrowRight,
  CheckCircle2,
  Lock,
  Printer,
  Globe2,
  Trash2,
  BarChart3,
  Mail,
  LayoutDashboard,
} from "lucide-react";
import AfricaNetworkMap3D from "../components/AfricaNetworkMap3D";
import LegalPrivacyModal, { type LegalTab } from "../components/LegalPrivacyModal";

interface LandingPageProps {
  sendLoginLink?: (email: string) => Promise<void>;
  createWorkspace?: (name: string) => Promise<boolean>;
  needsWorkspaceName?: boolean;
  linkSent?: boolean;
  busy?: boolean;
  error?: string | null;
  isAuthenticatedPreview?: boolean;
  onBackToDashboard?: () => void;
}

function ShopifyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#95BF47"
        d="M15.337 23.979l6.163-1.098-2.29-15.424a.344.344 0 00-.313-.29s-.226-.017-.226-.017l-1.516-1.484v-.002c-.04-.08-.096-.153-.163-.217-.576-.555-1.503-.83-2.55-.817-.054 0-.108.004-.163.008-.217-.278-.486-.504-.803-.648-.915-.416-2.062-.202-2.99.558-.754.616-1.345 1.59-1.59 2.662l-2.012.624c-.595.186-.615.205-.692.768-.058.426-1.59 12.26-1.59 12.26L15.337 23.98z"
      />
      <path
        fill="#5E8E3E"
        d="M18.983 6.847s-.226-.017-.226-.017l-1.516-1.484v-.002a.88.88 0 00-.163-.217l-1.741 18.852 6.163-1.098-2.29-15.424a.344.344 0 00-.227-.61z"
      />
      <path
        fill="#FFFFFF"
        d="M12.56 10.228l-.76 2.275s-.666-.355-1.48-.355c-1.196 0-1.258.75-1.258.94 0 1.03 2.687 1.425 2.687 3.84 0 1.898-1.203 3.12-2.827 3.12-1.948 0-2.944-1.213-2.944-1.213l.52-1.72s1.024.878 1.89.878c.565 0 .795-.445.795-.77 0-1.344-2.205-1.404-2.205-3.612 0-1.86 1.335-3.662 4.027-3.662 1.037 0 1.555.28 1.555.28z"
      />
    </svg>
  );
}

function FacebookBrandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#FFFFFF"
        d="M16.671 15.469l.532-3.47h-3.328V9.749c0-.949.465-1.874 1.956-1.874h1.513V4.922s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.643H7.078v3.47h3.047v8.385a12.09 12.09 0 003.75 0v-8.385h2.796z"
      />
    </svg>
  );
}

const WORKFLOW_STEPS = [
  {
    step: "01",
    badge: "Shopify & Google Sheets",
    title: "Réception Instantanée & Isolation Anti-Doublons",
    desc: "Dès qu'un client commande sur votre boutique Shopify, la commande tombe en moins d'une seconde, est routée vers le bon pays par indicatif téléphonique et synchronisée sur Google Sheets. Si le numéro est un doublon, il est immédiatement isolé en « Accès libre site » pour ne jamais fausser votre Pixel Meta.",
    metrics: [
      { label: "Latence Webhook", value: "< 400 ms" },
      { label: "Doublons Isolés CAPI", value: "100% Auto" },
      { label: "Distribution Closeuses", value: "Round-Robin" },
    ],
    accent: "from-indigo-500/20 to-blue-500/10 border-indigo-500/30 text-indigo-300",
  },
  {
    step: "02",
    badge: "App Closeuse Dédiée",
    title: "Confirmation Téléphonique, Relance WhatsApp & Programmation",
    desc: "Chaque closeuse reçoit ses commandes sur sa PWA mobile/desktop avec alerte sonore. En 1 clic, elle appelle ou ouvre WhatsApp avec un message pré-rempli, qualifie le statut (En cours, Programmé, Injoignable, Rejeté) et assigne directement le livreur du secteur.",
    metrics: [
      { label: "Prise en charge cible", value: "< 15 min" },
      { label: "WhatsApp Pré-rempli", value: "1-Clic SAV" },
      { label: "Rappels Programmés", value: "Automatiques" },
    ],
    accent: "from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-300",
  },
  {
    step: "03",
    badge: "App Livreur & Bon 3D",
    title: "Livraison Terrain, Bordereau 3D & Suivi Temps Réel",
    desc: "Imprimez vos bons de livraison 3D personnalisés. Sur le terrain, le livreur voit ses colis assignés, passe en « En route » puis valide « Livré » dès l'encaissement ou signale un client « Injoignable » pour déclencher une relance immédiate de la closeuse.",
    metrics: [
      { label: "Bon de Livraison", value: "Format 3D Pro" },
      { label: "Suivi Colis Terrain", value: "Temps Réel" },
      { label: "Alerte Retard > 4h", value: "Vigie IA" },
    ],
    accent: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300",
  },
  {
    step: "04",
    badge: "Caisse, Paie & Meta CAPI",
    title: "Contrôle Caisse du Soir & Optimisation Meta Purchase",
    desc: "Seules les commandes réellement livrées déclenchent l'événement Purchase vers Meta Conversions API. Le soir, vous pointez le cash versé par chaque livreur dans « Caisse & Versements », déduisez les imprévus avec note justificative, et débloquez les commissions en toute sécurité.",
    metrics: [
      { label: "Signal Meta CAPI", value: "100% Livré Réel" },
      { label: "Verrouillage Paie", value: "Après Caisse" },
      { label: "Connexion Meta Externe", value: "Incognito / AdsPower" },
    ],
    accent: "from-amber-500/20 to-emerald-500/10 border-amber-500/30 text-amber-300",
  },
];

export default function LandingPage({
  sendLoginLink,
  createWorkspace,
  needsWorkspaceName = false,
  linkSent = false,
  busy = false,
  error = null,
  isAuthenticatedPreview = false,
  onBackToDashboard,
}: LandingPageProps) {
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab | null>(null);

  // Simulateur de rentabilité COD
  const [monthlyOrders, setMonthlyOrders] = useState(600);
  const [avgOrderValue, setAvgOrderValue] = useState(15000);
  const [deliveryBoostPct, setDeliveryBoostPct] = useState(18);

  // Effet 3D sur le visuel Hero
  const [heroTilt, setHeroTilt] = useState({ rx: 6, ry: -8 });
  const heroCardRef = useRef<HTMLDivElement | null>(null);
  const authBoxRef = useRef<HTMLDivElement | null>(null);

  const handleHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = heroCardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setHeroTilt({
      rx: Math.max(-12, Math.min(12, -ny * 18)),
      ry: Math.max(-12, Math.min(12, nx * 18)),
    });
  };

  const scrollToAuth = () => {
    if (isAuthenticatedPreview && onBackToDashboard) {
      onBackToDashboard();
      return;
    }
    authBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const extraDeliveredOrders = Math.round((monthlyOrders * deliveryBoostPct) / 100);
  const extraMonthlyRevenue = extraDeliveredOrders * avgOrderValue;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-brand selection:text-white overflow-x-hidden">
      {/* Halo ambiant supérieur */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[520px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.24),rgba(16,185,129,0.08),transparent)]" />

      {/* BARRE DE NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-[#0f172a] shadow-lg shadow-brand/20">
              <img src="/icons/icon-192.png" alt="Ecom COD" className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">Ecom COD</span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  OS v3.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Socle Technique Pan-Africain Cash-On-Delivery</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-medium text-slate-300 lg:flex">
            <a href="#afrique-reseau" className="hover:text-white transition-colors">
              Réseau Afrique
            </a>
            <a href="#ecosysteme-3d" className="hover:text-white transition-colors">
              Les 3 Applications
            </a>
            <a href="#simulateur-roi" className="hover:text-white transition-colors">
              Simulateur Cash
            </a>
            <a href="#securite-confidentialite" className="hover:text-white transition-colors">
              Confidentialité & Meta CAPI
            </a>
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="text-slate-400 hover:text-emerald-300 transition-colors"
            >
              Légal & RGPD
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            {isAuthenticatedPreview && onBackToDashboard ? (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Retour au Poste de Pilotage</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={scrollToAuth}
                className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover px-4 py-2 text-xs font-bold text-white shadow-lg shadow-brand/30 transition-all"
              >
                <span>Connexion Direction</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SECTION 1 : HERO 3D + CONNEXION DIRECTE */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:pt-14">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Colonne Gauche : Proposition de valeur + Boîte d'accès */}
          <div className="space-y-6 lg:col-span-6">
            {/* Bandeau des connecteurs officiels : Shopify, Facebook Meta CAPI & WhatsApp */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/35 bg-brand/10 px-3.5 py-1.5 text-xs font-semibold text-brand">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Pilotage COD Multi-Pays</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#95BF47]/40 bg-[#95BF47]/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                <ShopifyIcon className="h-4 w-4" />
                <span>Shopify Temps Réel</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1877F2]/40 bg-[#1877F2]/15 px-3 py-1.5 text-xs font-semibold text-blue-200">
                <FacebookBrandIcon className="h-4 w-4" />
                <span>Facebook Meta CAPI</span>
              </div>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.12]">
              Transformez chaque commande en{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
                cash réellement encaissé
              </span>{" "}
              en Afrique.
            </h1>

            <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
              Reliez vos boutiques <strong>Shopify</strong>, vos <strong>Closeuses</strong>, vos{" "}
              <strong>Livreurs terrain</strong> et votre <strong>Pixel Meta Conversions API</strong> dans un seul
              cockpit temps réel. Isolez les numéros doublons, verrouillez la caisse avant de payer les commissions et
              laissez la <strong>Vigie IA</strong> traquer le moindre retard.
            </p>

            {/* Carte d'accès / Authentification Direction */}
            <div
              ref={authBoxRef}
              className="rounded-3xl border border-white/15 bg-[#0c1222]/95 p-5 shadow-2xl shadow-brand/15 backdrop-blur-xl"
            >
              {isAuthenticatedPreview ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      ✓ Session Administrateur Active
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Vous consultez l'aperçu public de votre Landing Page Ecom COD.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white shadow-lg shadow-brand/30 hover:bg-brand-hover transition-all"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Ouvrir mon Poste de Pilotage</span>
                  </button>
                </div>
              ) : needsWorkspaceName && createWorkspace ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Bienvenue 👋 — Nommez votre Espace de Travail COD
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Premier passage : créez votre environnement dédié et isolé (équipes, commandes et caisse).
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (workspaceName.trim()) void createWorkspace(workspaceName.trim());
                    }}
                    className="flex flex-col gap-2.5 sm:flex-row"
                  >
                    <input
                      autoFocus
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Ex : Groupe Ecom Afrique / TG Mobile"
                      className="flex-1 rounded-xl border border-white/15 bg-[#070b14] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand"
                    />
                    <button
                      type="submit"
                      disabled={busy || !workspaceName.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/30 hover:bg-brand-hover disabled:opacity-50"
                    >
                      {busy ? "Création..." : "Créer mon espace"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                  {error && <p className="text-xs font-medium text-rose-400">{error}</p>}
                </div>
              ) : linkSent ? (
                <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <Mail className="h-4 w-4" />
                    <span>Lien magique envoyé dans votre boîte mail 📩</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Un lien de connexion sécurisé a été envoyé à <strong className="text-white">{email}</strong>.
                    Ouvrez-le sur cet appareil pour accéder directement à votre Poste de Pilotage — sans mot de passe.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Accès Direction & Création d'Espace (Sans mot de passe)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <Lock className="h-3 w-3" /> Lien Magique Sécurisé
                    </span>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (email.trim() && sendLoginLink) void sendLoginLink(email.trim());
                    }}
                    className="flex flex-col gap-2.5 sm:flex-row"
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="direction@votre-boutique.com"
                      className="flex-1 rounded-xl border border-white/15 bg-[#070b14] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand"
                    />
                    <button
                      type="submit"
                      disabled={busy || !email.trim()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/30 hover:bg-brand-hover disabled:opacity-50 transition-all"
                    >
                      <span>{busy ? "Envoi en cours..." : "Recevoir mon lien d'accès"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                  {error && <p className="text-xs font-medium text-rose-400">{error}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                    <span>✓ Connexion en 1 clic par email • Espace isolé créé automatiquement</span>
                    <button
                      type="button"
                      onClick={() => setLegalModalTab("privacy")}
                      className="text-slate-300 underline underline-offset-2 hover:text-white"
                    >
                      Politique de confidentialité
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Points forts rapides */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-lg font-extrabold text-white">3 Apps</p>
                <p className="text-[11px] text-slate-400">Admin, Closeuse & Livreur</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-lg font-extrabold text-emerald-400">100% Livré</p>
                <p className="text-[11px] text-slate-400">Signal Meta CAPI Purifié</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-mono text-lg font-extrabold text-amber-300">Caisse + IA</p>
                <p className="text-[11px] text-slate-400">Zéro fuite de trésorerie</p>
              </div>
            </div>
          </div>

          {/* Colonne Droite : Scène 3D Interactive avec Perspective */}
          <div
            ref={heroCardRef}
            onMouseMove={handleHeroMove}
            onMouseLeave={() => setHeroTilt({ rx: 6, ry: -8 })}
            className="relative lg:col-span-6"
            style={{ perspective: "1300px" }}
          >
            <div
              className="relative rounded-3xl border border-white/15 bg-[#0c1222] p-3 shadow-[0_25px_70px_-15px_rgba(99,102,241,0.35)] transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${heroTilt.rx}deg) rotateY(${heroTilt.ry}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10">
                <img
                  src="/landing/hero-cod-hub.jpg"
                  alt="Cockpit 3D Ecom COD Afrique"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-transparent opacity-60" />
              </div>

              {/* Badge 3D Flottant Haut-Gauche : Facebook Meta CAPI */}
              <div
                className="hidden sm:flex absolute -left-5 top-6 items-center gap-2.5 rounded-2xl border border-[#1877F2]/50 bg-[#0b1324]/95 px-3.5 py-2.5 shadow-xl backdrop-blur-md"
                style={{ transform: "translateZ(42px)" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1877F2]/20">
                  <FacebookBrandIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                    Facebook Conversions API
                  </p>
                  <p className="text-xs font-bold text-white">Purchase envoyé après Livraison</p>
                </div>
              </div>

              {/* Badge 3D Flottant Haut-Droite : Boutique Shopify */}
              <div
                className="hidden sm:flex absolute -right-4 top-6 items-center gap-2.5 rounded-2xl border border-[#95BF47]/50 bg-[#0b1324]/95 px-3.5 py-2.5 shadow-xl backdrop-blur-md"
                style={{ transform: "translateZ(46px)" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#95BF47]/20">
                  <ShopifyIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    Shopify Webhook
                  </p>
                  <p className="text-xs font-bold text-white">Synchronisé &lt; 400 ms</p>
                </div>
              </div>

              {/* Badge 3D Flottant Bas-Droite : Contrôle Caisse Livreur */}
              <div
                className="hidden sm:flex absolute -right-4 -bottom-5 items-center gap-2.5 rounded-2xl border border-amber-400/40 bg-[#0b1324]/95 px-3.5 py-2.5 shadow-xl backdrop-blur-md"
                style={{ transform: "translateZ(50px)" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                  <Landmark className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    Caisse & Versements Livreurs
                  </p>
                  <p className="text-xs font-bold text-white">Cash vérifié avant paiement prime</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 : SYMBOLE DE L'AFRIQUE EN POINTILLÉS 3D & HUBS MULTI-PAYS */}
      <section id="afrique-reseau" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 max-w-3xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Globe2 className="h-3.5 w-3.5" /> Architecture Pan-Africaine Multi-Devises
          </span>
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Conçu pour la réalité du terrain en Afrique de l'Ouest & Centrale
          </h2>
          <p className="text-sm text-slate-400">
            Survolez ou cliquez sur chaque hub de la carte en pointillés pour explorer le routage multi-pays (XOF, XAF,
            GNF), la normalisation automatique des numéros et le suivi de livraison par capitale.
          </p>
        </div>

        <AfricaNetworkMap3D />
      </section>

      {/* SECTION 3 : LES 3 APPLICATIONS SYNCHRONISÉES & SIMULATEUR DE FLUX 3D */}
      <section id="ecosysteme-3d" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Visuel 3D des 3 appareils */}
          <div className="space-y-4 lg:col-span-5">
            <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#0b101d] p-2.5 shadow-2xl">
              <img
                src="/landing/ecosystem-3-apps.jpg"
                alt="Les 3 applications synchronisées : Admin, Closeuse et Livreur"
                className="w-full rounded-2xl object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                <p className="text-xs font-bold text-indigo-300">1. App Closeuse</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Appels, WhatsApp & Planning</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs font-bold text-emerald-300">2. App Admin</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Direction, Caisse, CAPI & IA</p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-bold text-amber-300">3. App Livreur</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Terrain, Colis & Encaissement</p>
              </div>
            </div>
          </div>

          {/* Simulateur interactif en 4 étapes */}
          <div className="space-y-5 lg:col-span-7">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                Cycle Opérationnel Complet
              </span>
              <h2 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                Du clic publicitaire Facebook jusqu'au versement vérifié en caisse
              </h2>
            </div>

            {/* Sélecteur d'étapes */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WORKFLOW_STEPS.map((s, idx) => {
                const active = activeStep === idx;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      active
                        ? "border-brand bg-brand/15 text-white shadow-lg shadow-brand/20"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold text-brand">ÉTAPE {s.step}</span>
                    <p className="mt-1 truncate text-xs font-semibold">{s.badge}</p>
                  </button>
                );
              })}
            </div>

            {/* Carte détaillée de l'étape active */}
            <div
              className={`rounded-3xl border bg-gradient-to-br p-6 transition-all ${WORKFLOW_STEPS[activeStep].accent}`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs font-semibold">
                  {WORKFLOW_STEPS[activeStep].badge}
                </span>
                <span className="font-mono text-2xl font-black opacity-40">
                  {WORKFLOW_STEPS[activeStep].step}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-bold text-white">{WORKFLOW_STEPS[activeStep].title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-200">
                {WORKFLOW_STEPS[activeStep].desc}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {WORKFLOW_STEPS[activeStep].metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl border border-white/10 bg-[#070b14]/75 p-3 text-center"
                  >
                    <p className="font-mono text-sm sm:text-base font-extrabold text-white">{m.value}</p>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] text-slate-400">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 : CALCULATEUR INTERACTIF D'IMPACT CASH & META ROAS */}
      <section id="simulateur-roi" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#0d1527] via-[#0b101d] to-[#09181b] p-6 sm:p-8 shadow-2xl">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                <BarChart3 className="h-3.5 w-3.5" /> Simulateur Interactif de Trésorerie COD
              </div>
              <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                Combien de chiffre d'affaires récupérez-vous chaque mois ?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                En combinant la prise d'appel rapide (&lt; 15 min), les relances WhatsApp en 1 clic, l'isolation des
                doublons Meta et le contrôle strict des versements livreurs :
              </p>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">Volume mensuel de commandes reçues</span>
                    <span className="font-mono font-bold text-white">{monthlyOrders} commandes / mois</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={50}
                    value={monthlyOrders}
                    onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">Panier moyen par commande (FCFA / XOF)</span>
                    <span className="font-mono font-bold text-white">
                      {avgOrderValue.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={60000}
                    step={1000}
                    value={avgOrderValue}
                    onChange={(e) => setAvgOrderValue(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      Gain de livraisons réussies (Relances IA + WhatsApp + CAPI Livré)
                    </span>
                    <span className="font-mono font-bold text-emerald-400">+{deliveryBoostPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={35}
                    step={1}
                    value={deliveryBoostPct}
                    onChange={(e) => setDeliveryBoostPct(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/30 bg-[#070b14]/90 p-6 text-center space-y-4 lg:col-span-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Cash Supplémentaire Encaissé Estimé
              </p>
              <p className="font-mono text-3xl sm:text-4xl font-black text-white">
                +{extraMonthlyRevenue.toLocaleString("fr-FR")}{" "}
                <span className="text-base font-bold text-emerald-400">FCFA / mois</span>
              </p>
              <p className="text-xs text-slate-400">
                Soit <strong>+{extraDeliveredOrders} colis livrés et encaissés</strong> en plus chaque mois à budget
                publicitaire identique.
              </p>
              <div className="border-t border-white/10 pt-4 text-left space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Zéro commission payée tant que la caisse livreur n'est pas validée</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Doublons isolés en « Accès libre site » (Pixel Meta 100% propre)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={scrollToAuth}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all"
              >
                Activer sur mon Espace Ecom COD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 : CONFIDENTIALITÉ, SÉCURITÉ & INNOVATIONS EXCLUSIVES */}
      <section id="securite-confidentialite" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/35 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              <ShieldCheck className="h-3.5 w-3.5" /> Sécurité, Confidentialité & Conformité Meta / Google
            </span>
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
              Une architecture blindée pour protéger vos données et votre trésorerie
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Politique de Confidentialité</span>
            </button>
            <button
              type="button"
              onClick={() => setLegalModalTab("deletion")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <Trash2 className="h-3.5 w-3.5 text-blue-400" />
              <span>Suppression des Données Meta</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0b101d] p-5 space-y-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <Share2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Pont Meta OAuth Externe (Incognito & Multi-Navigateurs)
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Votre PWA est ouverte sur votre compte Google mais votre Business Manager est sur un navigateur Incognito,
              Brave ou AdsPower ? Générez un lien externe sécurisé à usage unique pour rapatrier vos Pixels en temps
              réel.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b101d] p-5 space-y-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Landmark className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Caisse Livreurs & Déductions Justifiées
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Vérifiez le montant exact encaissé par chaque livreur en fin de journée. Retranchez les imprévus de
              livraison (aller-retour, frais terrain) avec une note justificative obligatoire avant de débloquer sa
              rémunération.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b101d] p-5 space-y-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Vigie IA Omnisciente & Rappels Autonomes
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              L'IA connaît en temps réel l'état des commandes, des délais closeuses, des colis sur le terrain et de la
              caisse. Elle vous notifie automatiquement dès qu'une opération dépasse son délai.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b101d] p-5 space-y-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Cloisonnement Multi-Workspaces & Hachage SHA-256
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Toutes les données personnelles transmises à Meta CAPI sont hachées en SHA-256. Chaque équipe pays
              possède ses propres règles Firestore et ses accès isolés.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b101d] p-5 space-y-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              WhatsApp 1-Clic & Export Numéros sur Durée
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Contactez n'importe quel client sur WhatsApp directement depuis la liste des commandes pour le SAV, et
              exportez l'intégralité de vos numéros qualifiés sur la période de votre choix.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b101d] p-5 space-y-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Bons de Livraison 3D & Double Validation
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Générez des bordereaux de livraison professionnels prêts à imprimer et protégez toutes les décisions
              sensibles (paie, suppressions, statuts) par une double validation.
            </p>
          </div>
        </div>
      </section>

      {/* PIED DE PAGE AVEC LIENS DE CONFIDENTIALITÉ OFFICIELS */}
      <footer className="relative z-10 border-t border-white/10 bg-[#050810] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <img src="/icons/icon-192.png" alt="Ecom COD" className="h-8 w-8 rounded-lg" />
              <div>
                <p className="text-sm font-bold text-white">Ecom COD — Socle Technique Opérationnel</p>
                <p className="text-xs text-slate-500">
                  Pilotage Cash-On-Delivery Pan-Africain • Togo, Bénin, Côte d'Ivoire, Sénégal, Cameroun & International
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setLegalModalTab("privacy")}
                className="hover:text-white transition-colors"
              >
                Politique de Confidentialité
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab("terms")}
                className="hover:text-white transition-colors"
              >
                Conditions d'Utilisation (CGU)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab("deletion")}
                className="hover:text-white transition-colors"
              >
                Suppression des Données (Meta)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab("security")}
                className="hover:text-white transition-colors"
              >
                Architecture & Sécurité
              </button>
            </div>
          </div>
        </div>
      </footer>

      {legalModalTab && (
        <LegalPrivacyModal
          initialTab={legalModalTab}
          onClose={() => setLegalModalTab(null)}
        />
      )}
    </div>
  );
}
