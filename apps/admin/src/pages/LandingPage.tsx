import { useState, useEffect } from "react";
import {
  ShieldCheck,
  PhoneCall,
  Landmark,
  Bot,
  ArrowRight,
  CheckCircle2,
  Lock,
  Globe2,
  Trash2,
  Mail,
  Check,
  Layers,
  SlidersHorizontal,
  XCircle,
  Truck,
  Zap,
  X,
  ExternalLink,
  Laptop,
  Smartphone,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import AfricaNetworkMap3D from "../components/AfricaNetworkMap3D";
import LegalPrivacyModal, { type LegalTab } from "../components/LegalPrivacyModal";
import WhatsAppIcon from "../components/WhatsAppIcon";

interface LandingPageProps {
  sendLoginLink?: (email: string) => Promise<void>;
  signInWithGoogle?: () => Promise<void>;
  signInWithFacebook?: () => Promise<void>;
  createWorkspace?: (name: string) => Promise<boolean>;
  needsWorkspaceName?: boolean;
  linkSent?: boolean;
  busy?: boolean;
  error?: string | null;
  isAuthenticatedPreview?: boolean;
  onBackToDashboard?: () => void;
}

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function FacebookBrandIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function ShopifyIcon({ className = "h-4 w-4" }: { className?: string }) {
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
        d="M13.882 10.974c-.033-.186-.24-.308-.426-.275-.187.033-1.34 1.09-2.52 1.345-.788.17-1.196-.24-1.285-.826-.145-.964.733-1.888 1.954-2.072 1.222-.185 2.19.467 2.336 1.43.02.135.14.225.27.205.13-.02.22-.14.2-.275-.185-1.223-1.385-2.046-2.92-1.813-1.536.232-2.625 1.4-2.44 2.622.115.76.62 1.3 1.56 1.137 1.334-.23 2.63-1.332 2.67-1.38.08-.09.07-.12.01-.17z"
      />
    </svg>
  );
}

// Les 5 étapes critiques du COD
const COD_STAGES = [
  {
    step: "01",
    name: "La commande arrive",
    sans: {
      tag: "Éparpillé & Faux Achats",
      desc: "Commandes dispersées sur WhatsApp ou formulaires sans filtre. Les doublons et faux numéros passent inaperçus, gaspillant votre budget publicitaire.",
    },
    avec: {
      tag: "Ingestion < 400 ms & Purifiée",
      desc: "Synchronisation instantanée depuis Shopify. Les doublons et anciens clients sont balisés en « Accès libre site » et exclus du Pixel Meta pour protéger votre budget.",
    },
  },
  {
    step: "02",
    name: "Confirmer le client",
    sans: {
      tag: "À la main & Oublis",
      desc: "Les closeuses appellent au hasard depuis leurs téléphones personnels. Les clients indécis ne sont pas relancés et les fiches d'appels sont vite égarées.",
    },
    avec: {
      tag: "App Closeuse 1-Clic WhatsApp",
      desc: "Cockpit dédié avec bouton WhatsApp officiel 1-clic, historiques complets, scripts de qualification et relances IA autonomes en temps réel.",
    },
  },
  {
    step: "03",
    name: "Expédier & Livrer",
    sans: {
      tag: "Par SMS & Litiges",
      desc: "Adresses dictées par message au livreur. Aucun suivi en direct : les colis traînent en route, les clients annulent et le stock devient fantôme.",
    },
    avec: {
      tag: "App Livreur & Bordereau 3D",
      desc: "App livreur terrain avec bordereau 3D prêt à imprimer. Statut temps réel, localisation et alerte prompte de la Vigie IA dès qu'un colis a +4h de retard.",
    },
  },
  {
    step: "04",
    name: "Encaisser & Contrôler la Caisse",
    sans: {
      tag: "De mémoire & Écarts de caisse",
      desc: "Le livreur rend l'argent plusieurs jours après selon ses calculs. Les imprévus et les commissions sont payés à l'aveugle, générant des fuites de trésorerie.",
    },
    avec: {
      tag: "Pointage Strict & Versement Justifié",
      desc: "Chaque soir, le cash est physiquement pointé face au montant attendu. Toute déduction (carburant, retour) exige un justificatif avant de valider la paie.",
    },
  },
  {
    step: "05",
    name: "Faire les comptes & Ads Meta",
    sans: {
      tag: "Cahier & Pixel pollué",
      desc: "Bénéfice deviné au pifomètre sur un cahier. Le Pixel Facebook est optimisé sur des faux achats, envoyant des publicités vers des clients qui ne paient jamais.",
    },
    avec: {
      tag: "Signal Purchase 100% Livré & Marge Réelle",
      desc: "L'événement Purchase Meta CAPI est envoyé UNIQUEMENT après versement effectif en caisse. Calcul exact de la rentabilité nette par pays et par produit.",
    },
  },
];

// Onglets de démonstration réelle du logiciel
const SHOWCASE_TABS = [
  {
    id: "dashboard",
    label: "Tableau de Bord (Direction)",
    icon: Laptop,
    badge: "Temps Réel",
    image: "/landing/preview-dashboard.png",
    headline: "Cockpit de pilotage unifié multi-marchés",
    sub: "Chiffre d'affaires encaissé, taux de confirmation, volume en cours et livraisons par livreur consolidés en direct.",
  },
  {
    id: "closeuse",
    label: "App Closeuse (WhatsApp 1-Clic)",
    icon: Smartphone,
    badge: "Mobile & PWA",
    image: "/landing/preview-closeuse.png",
    headline: "Appel & WhatsApp immédiat sans enregistrer le contact",
    sub: "Fini la perte de temps. Un clic suffit pour appeler ou envoyer le message WhatsApp pré-rempli au client.",
  },
  {
    id: "ai",
    label: "Analyste Direction (Vigie IA)",
    icon: Bot,
    badge: "Intelligence COD",
    image: "/landing/preview-ai.png",
    headline: "Audit opérationnel et courbes de performance automatiques",
    sub: "L'IA analyse vos points forts, identifie les goulots d'étranglement de closing et rédige vos plans d'action.",
  },
  {
    id: "shopify",
    label: "Flux Shopify & Routage Pays",
    icon: Zap,
    badge: "Zéro Latence",
    image: "/landing/preview-shopify.png",
    headline: "Routage étanche par pays et enrichissement Meta CAPI",
    sub: "Chaque commande reçue au Togo, Bénin ou Côte d'Ivoire est isolée vers l'équipe locale dédiée.",
  },
];

export default function LandingPage({
  sendLoginLink,
  signInWithGoogle,
  signInWithFacebook,
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
  const [authModalOpen, setAuthModalOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("auth") === "1";
    }
    return false;
  });
  const [legalModalTab, setLegalModalTab] = useState<LegalTab | null>(null);
  const [comparisonMode, setComparisonMode] = useState<"avec" | "sans">("avec");
  const [activeShowcaseIndex, setActiveShowcaseIndex] = useState(0);

  // Simulateur interactif de rentabilité
  const [monthlyOrders, setMonthlyOrders] = useState(600);
  const [avgOrderValue, setAvgOrderValue] = useState(18000);
  const [deliveryBoostPct, setDeliveryBoostPct] = useState(18);

  // Ouvre automatiquement la modale si l'utilisateur doit nommer son workspace ou si un lien a été envoyé
  useEffect(() => {
    if (needsWorkspaceName || linkSent || error) {
      setAuthModalOpen(true);
    }
  }, [needsWorkspaceName, linkSent, error]);

  const openAuth = () => {
    if (isAuthenticatedPreview && onBackToDashboard) {
      onBackToDashboard();
      return;
    }
    setAuthModalOpen(true);
  };

  const extraDeliveredOrders = Math.round((monthlyOrders * deliveryBoostPct) / 100);
  const extraMonthlyRevenue = extraDeliveredOrders * avgOrderValue;
  const currentTab = SHOWCASE_TABS[activeShowcaseIndex];

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 selection:bg-brand selection:text-white overflow-x-hidden font-sans">
      {/* Halo immersif supérieur (Style Typewise Neon Blue Spotlight) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[680px] bg-[radial-gradient(ellipse_75%_50%_at_50%_-10%,rgba(59,130,246,0.32),rgba(16,185,129,0.14),transparent)]" />

      {/* 1. BARRE DE NAVIGATION GLASSMORPHIC */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050814]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 shadow-md">
              <img src="/icons/icon-192.png" alt="Ecom COD" className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">Ecom COD</span>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  v3.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Système d'Exploitation E-Commerce COD Pan-Africain
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-semibold text-slate-300 md:flex">
            <a href="#showcase-logiciel" className="hover:text-white transition-colors">
              Logiciel en Direct
            </a>
            <a href="#comparatif-cod" className="hover:text-white transition-colors">
              Comparatif
            </a>
            <a href="#bento-fonctionnalites" className="hover:text-white transition-colors">
              Fonctionnalités
            </a>
            <a href="#afrique-reseau" className="hover:text-white transition-colors">
              Réseau Afrique
            </a>
            <a href="#simulateur-roi" className="hover:text-white transition-colors">
              Simulateur
            </a>
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="text-slate-400 hover:text-emerald-300 transition-colors"
            >
              Conformité RGPD
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openAuth}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-brand to-indigo-600 hover:opacity-95 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-lg shadow-brand/30 transition-all"
            >
              <span>{isAuthenticatedPreview ? "Poste de Pilotage" : "Commencer gratuitement"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO PRINCIPAL CENTRÉ HAUTE TYPOGRAPHIE (STYLE TYPEWISE & EASYAFRIK) */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-12 pb-14 sm:px-6 lg:pt-20 text-center">
        {/* Pill Badge Centré */}
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 backdrop-blur-md shadow-sm mb-6">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Système d'Exploitation E-Commerce COD Afrique</span>
        </div>

        {/* Titre Principal Haute Typographie Centré (sans font-mono) */}
        <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12] sm:leading-[1.08] break-words">
          Votre e-commerce COD en Afrique.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            Tout au même endroit.
          </span>
        </h1>

        {/* Sous-titre percutant axé douleurs réelles */}
        <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-300">
          Comptabilité, caisse livreurs, closeuses, boutiques <strong>Shopify</strong> et signal <strong>Meta CAPI</strong> :
          tout ce qui fait tourner votre business dans un seul cockpit étanche, au lieu d'un cahier de notes, d'un fichier Excel perdu et de dix groupes WhatsApp.
        </p>

        {/* Deux Boutons d'Action Principaux */}
        <div className="mx-auto mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={openAuth}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-500/25 hover:opacity-95 transition-all"
          >
            <span>Commencer gratuitement</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <a
            href="#showcase-logiciel"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 px-6 py-3.5 text-sm font-semibold text-slate-200 transition-all"
          >
            <span>Explorer le logiciel en direct</span>
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        {/* Social Proof Row */}
        <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
          <div className="flex -space-x-2 overflow-hidden">
            <span className="inline-block h-6 w-6 rounded-full border-2 border-[#050814] bg-emerald-500 text-[9px] font-black text-white flex items-center justify-center">
              TG
            </span>
            <span className="inline-block h-6 w-6 rounded-full border-2 border-[#050814] bg-indigo-500 text-[9px] font-black text-white flex items-center justify-center">
              CI
            </span>
            <span className="inline-block h-6 w-6 rounded-full border-2 border-[#050814] bg-teal-500 text-[9px] font-black text-white flex items-center justify-center">
              BJ
            </span>
            <span className="inline-block h-6 w-6 rounded-full border-2 border-[#050814] bg-amber-500 text-[9px] font-black text-white flex items-center justify-center">
              SN
            </span>
            <span className="inline-block h-6 w-6 rounded-full border-2 border-[#050814] bg-rose-500 text-[9px] font-black text-white flex items-center justify-center">
              CM
            </span>
          </div>
          <span>
            Rejoint par <strong className="text-white">+120 boutiques actives</strong> au Togo, Bénin, Côte d'Ivoire, Sénégal et Cameroun
          </span>
        </div>

        {/* 3. SHOWCASE LOGICIEL INTERACTIF EN DIRECT (À LA PLACE DU GROS FORMULAIRE) */}
        <div id="showcase-logiciel" className="relative mx-auto mt-12 max-w-5xl text-left">
          {/* Lueur arrière */}
          <div className="absolute inset-x-8 top-10 h-80 rounded-full bg-gradient-to-r from-blue-600/30 via-indigo-500/25 to-emerald-500/25 blur-3xl opacity-75 pointer-events-none" />

          {/* Cadre de l'appareil professionnel */}
          <div className="relative rounded-3xl border border-white/20 bg-gradient-to-b from-[#0e1628]/95 via-[#090e1c]/95 to-[#060a14]/95 p-3 sm:p-5 shadow-2xl shadow-indigo-500/20 backdrop-blur-2xl">
            {/* Barre d'onglets réels du logiciel */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-4">
              <div className="flex flex-wrap gap-1.5">
                {SHOWCASE_TABS.map((tab, idx) => {
                  const active = idx === activeShowcaseIndex;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveShowcaseIndex(idx)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                        active
                          ? "bg-white/15 text-white border border-white/25 shadow-md"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${active ? "text-emerald-400" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Interface de production réelle</span>
              </div>
            </div>

            {/* Légende active */}
            <div className="mb-3 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{currentTab.headline}</span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                    {currentTab.badge}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">{currentTab.sub}</p>
              </div>
              <button
                type="button"
                onClick={openAuth}
                className="self-start sm:self-auto inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-hover mt-1 sm:mt-0"
              >
                <span>Tester dans votre boutique</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Capture réelle en plein cadre */}
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#050814] shadow-inner">
              <img
                src={currentTab.image}
                alt={currentTab.label}
                className="w-full object-cover object-top max-h-[520px] transition-opacity duration-300"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050814]/40 via-transparent to-transparent" />
            </div>
          </div>
        </div>

        {/* CONNECTEURS OFFICIELS (UNIQUEMENT LES VRAIS : SHOPIFY, META CAPI, WHATSAPP) */}
        <div className="mx-auto mt-14 max-w-3xl border-t border-b border-white/10 py-5">
          <p className="text-[11px] uppercase font-bold tracking-widest text-slate-400 mb-3">
            Intégrations officielles natives
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2.5">
              <ShopifyIcon className="h-5 w-5" />
              <span>Shopify (Webhooks &lt; 400 ms)</span>
            </span>
            <span className="flex items-center gap-2.5">
              <FacebookBrandIcon className="h-5 w-5" />
              <span>Facebook Meta Conversions API (CAPI)</span>
            </span>
            <span className="flex items-center gap-2.5">
              <WhatsAppIcon size={20} />
              <span>WhatsApp Business (Contact 1-Clic)</span>
            </span>
          </div>
        </div>
      </section>

      {/* 4. SECTION GRAND COMPARATIF : SANS VS AVEC ECOM COD (INSPIRÉ D'EASYAFRIK) */}
      <section id="comparatif-cod" className="relative z-10 mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Zap className="h-3.5 w-3.5" /> La Fin du Bricolage
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Vendre, c'est facile.{" "}
            <span className="bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
              Tout le reste vous fait perdre votre trésorerie.
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-slate-300">
            Une vente en paiement à la livraison (COD) traverse 5 étapes clés. Basculez pour voir comment Ecom COD transforme les fuites d'argent en machine prédictive.
          </p>

          {/* Toggle Switch Sans vs Avec */}
          <div className="inline-flex items-center rounded-2xl border border-white/15 bg-[#090e1c] p-1.5 shadow-xl mt-6">
            <button
              type="button"
              onClick={() => setComparisonMode("sans")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                comparisonMode === "sans"
                  ? "bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <XCircle className="h-4 w-4 text-rose-400" />
              <span>Sans Ecom COD (Le calvaire)</span>
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode("avec")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                comparisonMode === "avec"
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Avec Ecom COD (Le cockpit)</span>
            </button>
          </div>
        </div>

        {/* Liste des 5 Étapes Comparatives */}
        <div className="space-y-3.5">
          {COD_STAGES.map((s) => {
            const isAvec = comparisonMode === "avec";
            const current = isAvec ? s.avec : s.sans;
            return (
              <div
                key={s.step}
                className={`rounded-2xl border p-4 sm:p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isAvec
                    ? "border-emerald-500/30 bg-emerald-950/15 hover:border-emerald-500/50"
                    : "border-rose-500/20 bg-rose-950/10 hover:border-rose-500/40"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                      isAvec ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {s.step}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{s.name}</h3>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{current.desc}</p>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${
                    isAvec
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                      : "border-rose-500/40 bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {current.tag}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. SECTION BENTO GRID FONCTIONNALITÉS (STYLE TASKGO) */}
      <section id="bento-fonctionnalites" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <Layers className="h-3.5 w-3.5" /> Architecture Tout-En-Un
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Conçu pour la réalité brute du terrain africain
          </h2>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-slate-300">
            Chaque module a été éprouvé auprès de livreurs à moto, de closeuses à domicile et de gérants de boutiques.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Bento Card 1 : App Closeuse WhatsApp */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 shadow-xl md:col-span-6 space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">1. App Closeuse 1-Clic WhatsApp</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                L'appel et le message WhatsApp partent en un seul clic sans enregistrer le numéro. Vos closeuses disposent de l'historique complet pour convertir les indécis.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300 font-semibold">
              Détection instantanée des doublons & numéros invalides
            </div>
          </div>

          {/* Bento Card 2 : App Livreur & Bordereau 3D */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 shadow-xl md:col-span-6 space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">2. App Livreur & Bordereau 3D</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                Vos livreurs terrain reçoivent leur feuille de route, scannent les statuts en direct et éditent des bordereaux d'expédition clairs. Finies les contestations de livraison.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300 font-semibold">
              Bordereaux thermiques & A4 prêts à imprimer
            </div>
          </div>

          {/* Bento Card 3 : Caisse Sécurisée & Paie au Réel */}
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 shadow-xl md:col-span-5 space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">3. Caisse & Paie au Réel</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                La prime du livreur reste bloquée tant que le montant brut encaissé n'a pas été physiquement pointé et validé.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 font-bold">
              Verrouillage anti-perte de cash
            </div>
          </div>

          {/* Bento Card 4 (Grande) : Vigie IA 24/7 & Alertes Proactives */}
          <div className="rounded-3xl border border-brand/30 bg-gradient-to-b from-[#0e172e] to-[#070b14] p-6 shadow-xl shadow-brand/15 md:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/20 text-brand">
                <Bot className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
                Surveillance Continue
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">4. Vigie IA 24/7 & Alertes Proactives</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                L'IA analyse vos flux toutes les 15 minutes : elle alerte sur les commandes non appelées, repère les colis en route depuis plus de 4 heures et rédige des rappels opérationnels personnalisés directement dans son éditeur.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-2.5 text-slate-300">
                Alerte Retard &gt; 4h
              </div>
              <div className="rounded-xl border border-white/10 bg-[#050814]/80 p-2.5 text-slate-300">
                Rappels Autonomes IA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION 4 STATISTIQUES CLÉS HAUT DE GAMME (SANS COULEURS DÉPAREILLÉES) */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0b1220]/90 to-[#070b14]/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-center">
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">+18%</p>
              <p className="text-xs text-slate-400 font-semibold">Taux de livraison effectif</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">&lt; 15 min</p>
              <p className="text-xs text-slate-400 font-semibold">Premier contact closeuse</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">0 FCFA</p>
              <p className="text-xs text-slate-400 font-semibold">Écart de caisse toléré</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">100%</p>
              <p className="text-xs text-slate-400 font-semibold">Signal Meta CAPI Livré</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECTION RÉSEAU AFRIQUE EN POINTILLÉS 3D */}
      <section id="afrique-reseau" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-3xl space-y-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Globe2 className="h-3.5 w-3.5" /> Architecture Pan-Africaine Multi-Devises
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Conçu pour la réalité du terrain en Afrique de l'Ouest & Centrale
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Chaque marché fonctionne en silo étanche : devises locales (XOF, XAF, GNF), indicatifs téléphoniques automatisés, calcul de paie par zone et Pixel Meta dédié.
          </p>
        </div>

        <AfricaNetworkMap3D />
      </section>

      {/* 8. SECTION SIMULATEUR DE RENTABILITÉ CASH (SANS FONT-MONO) */}
      <section id="simulateur-roi" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0d1527]/95 to-[#070b14]/95 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl">
          <div className="mb-8 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Simulateur Dynamique de Rentabilité COD
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Combien de cash supplémentaire allez-vous encaisser chaque mois ?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Ajustez votre volume et votre panier moyen. En combinant l'appel ultra-rapide, le bouton WhatsApp 1-clic et l'envoi de l'événement Purchase Meta uniquement après livraison réelle :
            </p>
          </div>

          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Volume mensuel de commandes reçues</span>
                  <span className="font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg">
                    {monthlyOrders} commandes / mois
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={3000}
                  step={50}
                  value={monthlyOrders}
                  onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Panier moyen par commande (FCFA / XOF)</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
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
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Gain de livraisons effectives (Relances IA + WhatsApp + Signal Meta Propre)</span>
                  <span className="font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    +{deliveryBoostPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={35}
                  step={1}
                  value={deliveryBoostPct}
                  onChange={(e) => setDeliveryBoostPct(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/40 bg-[#070b14]/95 p-6 sm:p-8 text-center space-y-5 lg:col-span-5 shadow-2xl shadow-emerald-500/10">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Cash Net Supplémentaire Estimé
              </p>
              <p className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                +{extraMonthlyRevenue.toLocaleString("fr-FR")}{" "}
                <span className="text-base font-bold text-emerald-400 block sm:inline">FCFA / mois</span>
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Représente <strong>+{extraDeliveredOrders} colis livrés et encaissés</strong> de plus chaque mois sans dépenser 1 franc de plus en publicité.
              </p>
              <button
                type="button"
                onClick={openAuth}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 py-3.5 text-xs font-bold text-white shadow-xl shadow-emerald-500/30 transition-all"
              >
                Activer ce modèle sur mon Espace Ecom COD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. SECTION DÉMARRER EN 3 ÉTAPES (STYLE TASKGO) */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <Zap className="h-3.5 w-3.5" /> Démarrage Express
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Prêt à encaisser en 3 étapes simples
          </h2>
          <p className="mx-auto max-w-xl text-xs sm:text-sm text-slate-300">
            Aucune installation lourde. Vos closeuses et vos livreurs se connectent depuis leur navigateur ou leur téléphone.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/15 bg-[#090f1e]/90 p-6 space-y-3 shadow-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/20 text-sm font-black text-indigo-300">
              01
            </span>
            <h3 className="text-base font-bold text-white">Connectez votre compte</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              En 1 clic via Google, Facebook ou par email magique. Votre espace de travail sécurisé est instantanément déployé.
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-[#090f1e]/90 p-6 space-y-3 shadow-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-sm font-black text-emerald-300">
              02
            </span>
            <h3 className="text-base font-bold text-white">Reliez Shopify & Votre Équipe</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Collez vos webhooks Shopify et créez les accès de vos closeuses et livreurs. Leurs applications dédiées sont opérationnelles.
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-[#090f1e]/90 p-6 space-y-3 shadow-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-sm font-black text-amber-300">
              03
            </span>
            <h3 className="text-base font-bold text-white">Pilotez & Encaissez au Réel</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Suivez les appels, contrôlez les pointages de caisse en fin de journée et laissez l'IA vous alerter sur chaque anomalie.
            </p>
          </div>
        </div>
      </section>

      {/* 10. PIED DE PAGE & LIENS CONFORMITÉ RGPD / META */}
      <footer className="relative z-10 border-t border-white/10 bg-[#050814] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-indigo-500/20 to-emerald-500/20">
              <img src="/icons/icon-192.png" alt="Ecom COD" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Ecom COD — Socle Technique Opérationnel</p>
              <p className="text-[11px] text-slate-400">
                Pilotage Cash-On-Delivery Pan-Africain • Togo, Bénin, Côte d'Ivoire, Sénégal, Cameroun & International
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="hover:text-emerald-300 transition-colors"
            >
              Politique de Confidentialité
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("terms")}
              className="hover:text-emerald-300 transition-colors"
            >
              Conditions d'Utilisation (CGU)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("deletion")}
              className="hover:text-blue-300 transition-colors"
            >
              Suppression des Données (Meta)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("security")}
              className="hover:text-indigo-300 transition-colors"
            >
              Architecture & Sécurité
            </button>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-7xl border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <p>© {new Date().getFullYear()} Ecom COD Inc. Tous droits réservés.</p>
          <p>Conforme aux standards Meta Graph API v19.0 & RGPD</p>
        </div>
      </footer>

      {/* POP-UP / MODALE DE CONNEXION UNIVERSELLE (DÉCLENCHÉE PAR LE BOUTON) */}
      {authModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => {
            if (!busy && !needsWorkspaceName) setAuthModalOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-white/20 bg-gradient-to-b from-[#0f172a] via-[#0c1222] to-[#070b14] p-6 sm:p-7 shadow-2xl shadow-indigo-500/25"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            {needsWorkspaceName ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <Sparkles className="h-4 w-4" />
                  <span>Bienvenue ! Nommez votre espace</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Votre compte est authentifié. Indiquez le nom de votre boutique ou entreprise COD pour initialiser votre base étanche :
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (workspaceName.trim() && createWorkspace) void createWorkspace(workspaceName.trim());
                  }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Ex: Lomé Express Shop, Dakar Bio..."
                    className="w-full rounded-xl border border-white/15 bg-[#050814] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand"
                  />
                  <button
                    type="submit"
                    disabled={busy || !workspaceName.trim()}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs font-bold text-white shadow hover:opacity-95 disabled:opacity-50"
                  >
                    {busy ? "Création..." : "Finaliser mon Espace"}
                  </button>
                </form>
                {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
              </div>
            ) : linkSent ? (
              <div className="space-y-3 py-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">Lien magique envoyé avec succès</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Un lien sécurisé sans mot de passe a été envoyé à <strong className="text-white">{email}</strong>.
                  Cliquez dessus depuis cet appareil ou votre smartphone pour ouvrir directement votre Poste de Pilotage.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="mt-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Compris
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-3">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Lock className="h-4 w-4 text-brand" />
                    <span>Connexion & Démarrage Gratuit</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Accédez à votre espace en 1 clic. Aucun mot de passe à retenir.
                  </p>
                </div>

                {/* Boutons Sociaux Rapides (Google & Facebook) */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => signInWithGoogle && signInWithGoogle()}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-3 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
                  >
                    <GoogleIcon className="h-4 w-4" />
                    <span>Continuer avec Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => signInWithFacebook && signInWithFacebook()}
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 px-4 py-3 text-xs font-semibold text-blue-200 shadow-sm transition-all disabled:opacity-50"
                  >
                    <FacebookBrandIcon className="h-4 w-4" />
                    <span>Continuer avec Facebook</span>
                  </button>
                </div>

                <div className="relative flex items-center justify-center py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <span className="relative bg-[#0c1222] px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Ou par email direct
                  </span>
                </div>

                {/* Formulaire Email Magic Link */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (email.trim() && sendLoginLink) void sendLoginLink(email.trim());
                  }}
                  className="space-y-2.5"
                >
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre-email@boutique.com"
                      required
                      className="w-full rounded-xl border border-white/15 bg-[#050814] pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !email.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-brand to-indigo-600 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-brand/30 hover:opacity-95 disabled:opacity-50 transition-all"
                  >
                    <span>{busy ? "Envoi du lien..." : "Recevoir mon lien d'accès"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

                <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-white/5 space-y-1">
                  <p className="flex items-center justify-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                    Compatible tous appareils (PC, iPhone, Android, PWA)
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalOpen(false);
                      setLegalModalTab("privacy");
                    }}
                    className="text-slate-400 hover:text-white underline underline-offset-2"
                  >
                    Charte de Confidentialité & Sécurité
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Juridique & Confidentialité */}
      {legalModalTab && (
        <LegalPrivacyModal
          initialTab={legalModalTab}
          onClose={() => setLegalModalTab(null)}
        />
      )}
    </div>
  );
}
