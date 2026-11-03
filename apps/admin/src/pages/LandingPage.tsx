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
  Users,
  CheckCircle,
} from "lucide-react";
import AfricaNetworkMap3D from "../components/AfricaNetworkMap3D";
import LegalPrivacyModal, { type LegalTab } from "../components/LegalPrivacyModal";
import WhatsAppIcon from "../components/WhatsAppIcon";
import WariTrackLogo from "../components/WariTrackLogo";
import WhatsNewModal from "../components/WhatsNewModal";

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
    image: "/landing/preview-dashboard.png?v=3",
    headline: "Cockpit de pilotage unifié multi-marchés",
    sub: "Chiffre d'affaires encaissé, taux de confirmation, volume en cours et livraisons par livreur consolidés en direct.",
  },
  {
    id: "closeuse",
    label: "App Closeuse (WhatsApp 1-Clic)",
    icon: Smartphone,
    badge: "Mobile PWA",
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
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<"avec" | "sans">("avec");
  const [activeShowcaseIndex, setActiveShowcaseIndex] = useState(0);

  // Simulateur interactif de rentabilité
  const [monthlyOrders, setMonthlyOrders] = useState(600);
  const [avgOrderValue, setAvgOrderValue] = useState(18000);
  const [deliveryBoostPct, setDeliveryBoostPct] = useState(18);

  // Garantit que la vitrine reste en mode sombre pur même si l'ancien compte avait enregistré un thème clair
  useEffect(() => {
    const root = document.documentElement;
    const hadLight = root.classList.contains("light");
    root.classList.add("landing-active");
    root.classList.add("dark");
    if (hadLight) {
      root.classList.remove("light");
    }
    return () => {
      root.classList.remove("landing-active");
      if (hadLight) {
        root.classList.add("light");
        root.classList.remove("dark");
      }
    };
  }, []);

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
    <div className="min-h-screen bg-[#050814] text-slate-100 selection:bg-indigo-500 selection:text-white overflow-x-hidden font-sans">
      {/* 1. BARRE DE NAVIGATION GLASSMORPHIC SOMBRE */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050814]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <WariTrackLogo size="lg" variant="full" roundedBadge subtitle="Cash & Logistics OS" />
            <button
              type="button"
              onClick={() => setShowWhatsNew(true)}
              className="rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-bold text-sky-300 hover:bg-sky-500/30 transition cursor-pointer hidden sm:inline-flex items-center gap-1"
              title="Consulter les nouveautés de la mise à jour v3.2"
            >
              <Sparkles className="h-3 w-3 text-sky-400" />
              <span>v3.2</span>
            </button>
          </div>

          <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-200 md:flex">
            <a href="#fonctionnalites" className="hover:text-white transition-colors">
              Fonctionnalités
            </a>
            <a href="#showcase-logiciel" className="hover:text-white transition-colors">
              Démonstration
            </a>
            <a href="#pourquoi-nous" className="hover:text-white transition-colors">
              Pourquoi Nous
            </a>
            <a href="#comparatif-cod" className="hover:text-white transition-colors">
              Comparatif
            </a>
            <a href="#simulateur-roi" className="hover:text-white transition-colors">
              Simulateur
            </a>
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="text-slate-300 hover:text-indigo-300 transition-colors"
            >
              Conformité RGPD
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openAuth}
              className="hidden sm:inline-block text-xs font-bold text-slate-200 hover:text-white transition"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={openAuth}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:opacity-95 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition-all"
            >
              <span>{isAuthenticatedPreview ? "Poste Direction" : "Commencer"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO PRINCIPAL AÉRÉ (STRUCTURE TASKGO EN THÈME NOIR PROFOND) */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 text-center">
        {/* Halo Néon Bleu & Lavande Royal dans l'obscurité */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(ellipse_75%_50%_at_50%_-10%,rgba(99,102,241,0.28),rgba(147,51,234,0.15),transparent)]" />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          {/* Badge Pill supérieur */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 shadow-sm backdrop-blur-md mb-6">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>Système d'Exploitation E-Commerce COD Afrique</span>
          </div>

          {/* Titre 2 lignes TaskGo en typographie sans-serif propre */}
          <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] sm:leading-[1.10]">
            Simplifiez Votre E-Commerce COD <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">
              Boostez Vos Encaissements
            </span>
          </h1>

          {/* Sous-titre aéré avec haute lisibilité garantie */}
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-100 font-normal">
            Gérez vos commandes, vos closeuses WhatsApp, vos livreurs et vos caisses de A à Z en toute simplicité.
            Fini les fiches perdues, les contestations de livraison et les écarts de trésorerie.
          </p>

          {/* Boutons d'Action Arrondis (Pills TaskGo) */}
          <div className="mx-auto mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={openAuth}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:opacity-95 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/30 transition-all"
            >
              <span>Commencer Gratuitement</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <a
              href="#showcase-logiciel"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 hover:bg-white/15 px-6 py-3.5 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition-all"
            >
              <span>Explorer la Démo</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          {/* 4 Badges Flottants TaskGo (Version Sombre) */}
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-2.5 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 backdrop-blur-md">
              <Bot className="h-3.5 w-3.5 text-purple-400" /> Analyste Direction IA
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
              <PhoneCall className="h-3.5 w-3.5 text-emerald-400" /> Closeuse WhatsApp 1-Clic
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300 backdrop-blur-md">
              <Truck className="h-3.5 w-3.5 text-blue-400" /> Livreur Terrain & Bordereau
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
              <Zap className="h-3.5 w-3.5 text-indigo-400" /> Flux Shopify & Meta CAPI
            </span>
          </div>

          {/* 3. SHOWCASE LOGICIEL PRINCIPAL EN CADRE VITRÉ SOMBRE (STRUCTURE TASKGO) */}
          <div id="showcase-logiciel" className="relative mx-auto mt-12 max-w-5xl text-left">
            {/* Lueur arrière */}
            <div className="absolute inset-x-8 top-10 h-72 rounded-full bg-gradient-to-r from-indigo-600/30 via-purple-600/20 to-emerald-500/20 blur-3xl opacity-75 pointer-events-none" />

            <div className="relative rounded-3xl border border-white/15 bg-gradient-to-b from-[#0c1426] via-[#080d1a] to-[#050814] p-3 sm:p-5 shadow-2xl shadow-indigo-500/15 backdrop-blur-2xl">
              {/* Barre supérieure style fenêtre TaskGo */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
                {/* 3 Dots macOS */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>

                {/* Onglets sélecteurs */}
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
                        <Icon className={`h-3.5 w-3.5 ${active ? "text-indigo-400" : "text-slate-400"}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Production Réelle</span>
                </div>
              </div>

              {/* Légende du module actif */}
              <div className="mb-3 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{currentTab.headline}</span>
                    <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                      {currentTab.badge}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">{currentTab.sub}</p>
                </div>
                <button
                  type="button"
                  onClick={openAuth}
                  className="self-start sm:self-auto inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 mt-1 sm:mt-0"
                >
                  <span>Tester dans votre boutique</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Capture réelle plein cadre avec fond contrasté */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#020409] flex items-center justify-center shadow-inner">
                <img
                  src={currentTab.image}
                  alt={currentTab.label}
                  loading="eager"
                  decoding="sync"
                  className="w-full h-auto object-contain max-h-[600px] transition-opacity duration-300 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* 4. BANDEAU DES LOGOS PARTENAIRES & INTÉGRATIONS OFFICIELLES */}
          <div className="mx-auto mt-16 max-w-4xl border-t border-white/10 pt-8">
            <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-4">
              Connecté nativement aux piliers de votre écosystème
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0a101f] px-4 py-2 text-xs font-bold text-slate-200 shadow-sm">
                <ShopifyIcon className="h-4 w-4" />
                <span>Shopify (Webhooks &lt; 400 ms)</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0a101f] px-4 py-2 text-xs font-bold text-slate-200 shadow-sm">
                <FacebookBrandIcon className="h-4 w-4" />
                <span>Meta Conversions API (CAPI)</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0a101f] px-4 py-2 text-xs font-bold text-slate-200 shadow-sm">
                <WhatsAppIcon size={18} />
                <span>WhatsApp Business Direct</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION BENTO GRID DES FONCTIONNALITÉS (TASKGO EN SOMBRE) */}
      <section id="fonctionnalites" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
            <Layers className="h-3.5 w-3.5" /> Fonctionnalités Clés
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Débloquez Tout le Potentiel du COD <br className="hidden sm:inline" />
            Avec Nos Outils Avancés
          </h2>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-slate-400">
            Chaque module résout un goulot d'étranglement concret rencontré au quotidien par les gérants de boutiques.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Card 1 : App Closeuse */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 sm:p-7 shadow-xl md:col-span-6 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">App Closeuse 1-Clic WhatsApp</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                L'appel et le message WhatsApp partent en un seul clic sans enregistrer le numéro. Vos closeuses disposent de l'historique complet pour convertir les indécis.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Détection instantanée des doublons & numéros invalides</span>
            </div>
          </div>

          {/* Card 2 : App Livreur */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 sm:p-7 shadow-xl md:col-span-6 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">App Livreur & Bordereau d'Expédition</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                Vos livreurs terrain reçoivent leur feuille de route, scannent les statuts en direct et éditent des bordereaux d'expédition clairs. Finies les contestations de livraison.
              </p>
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-300 font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
              <span>Bordereaux thermiques & A4 prêts à imprimer</span>
            </div>
          </div>

          {/* Card 3 : Caisse Sécurisée */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 sm:p-7 shadow-xl md:col-span-5 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Caisse & Paie au Réel</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                La prime du livreur reste bloquée tant que le montant brut encaissé n'a pas été physiquement pointé et validé.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Verrouillage anti-perte de cash</span>
            </div>
          </div>

          {/* Card 4 (Grande) : Vigie IA 24/7 */}
          <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-[#0e172e] to-[#070b14] p-6 sm:p-7 shadow-xl shadow-indigo-500/10 md:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Bot className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-300">
                Surveillance Continue
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Vigie IA 24/7 & Alertes Proactives</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                L'IA analyse vos flux toutes les 15 minutes : elle alerte sur les commandes non appelées, repère les colis en route depuis plus de 4 heures et rédige vos plans d'action.
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

      {/* 6. SECTION STATISTIQUES SOMBRES ÉPURÉES (STRUCTURE TASKGO) */}
      <section id="pourquoi-nous" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" /> Performance Mesurable
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Pourquoi les Équipes Choisissent Ecom COD
          </h2>
          <p className="mx-auto max-w-xl text-xs sm:text-sm text-slate-400">
            Conçu pour maximiser vos livraisons effectives et sécuriser chaque franc de cash.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Card Stat 1 */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-bl-3xl" />
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">+18%</p>
            <p className="text-xs font-bold text-indigo-400">Livraisons Réelles</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Relances rapides et bordereaux d'expédition clairs.
            </p>
          </div>

          {/* Card Stat 2 */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-500/20 to-transparent rounded-bl-3xl" />
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">&lt; 15 min</p>
            <p className="text-xs font-bold text-purple-400">Premier Appel</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Bouton WhatsApp 1-clic direct sans enregistrer le numéro.
            </p>
          </div>

          {/* Card Stat 3 */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-bl-3xl" />
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">0 FCFA</p>
            <p className="text-xs font-bold text-emerald-400">Écart Toléré</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Pointage strict face au montant attendu avant paiement.
            </p>
          </div>

          {/* Card Stat 4 */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c1426] to-[#070b14] p-6 shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-500/20 to-transparent rounded-bl-3xl" />
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">100%</p>
            <p className="text-xs font-bold text-blue-400">Signal Meta CAPI</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Événement envoyé uniquement après encaissement effectif.
            </p>
          </div>
        </div>
      </section>

      {/* 7. SECTION DÉMARRAGE EN 3 ÉTAPES (TASKGO EN SOMBRE) */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
            <Zap className="h-3.5 w-3.5" /> Démarrage Simple
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Prêt à Encaisser en 3 Étapes Simples
          </h2>
          <p className="mx-auto max-w-xl text-xs sm:text-sm text-slate-400">
            Déploiement immédiat. Vos équipes se connectent directement depuis leur smartphone.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center">
          {/* Colonne Gauche : Mini Visual Mockup */}
          <div className="md:col-span-6 rounded-3xl border border-white/10 bg-[#090e1c] p-4 sm:p-6 shadow-xl">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="text-[11px] font-bold text-slate-400 ml-2">Espace de Travail Ecom COD</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950 overflow-hidden shadow-inner">
              <img
                src="/landing/preview-closeuse.png"
                alt="App Closeuse Onboarding"
                className="w-full object-cover max-h-[340px]"
              />
            </div>
          </div>

          {/* Colonne Droite : 3 Cartes Étape Empilées */}
          <div className="md:col-span-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0c1426] p-5 shadow-sm hover:border-white/20 transition-all flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-sm">
                01
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Configuration Rapide en 1 Clic</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Connexion instantanée via Google, Facebook ou par email magique sans mot de passe. Votre base de données étanche est créée immédiatement.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c1426] p-5 shadow-sm hover:border-white/20 transition-all flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-black text-white shadow-sm">
                02
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Connectez Shopify & Votre Équipe</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Collez vos webhooks Shopify et créez les comptes de vos closeuses et livreurs. Ils accèdent instantanément à leur interface dédiée.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c1426] p-5 shadow-sm hover:border-white/20 transition-all flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white shadow-sm">
                03
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Suivez les Livraisons & Encaissez</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Pilotez les appels, validez le pointage de caisse chaque soir et observez vos profits nets augmenter sans stress.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. GRAND COMPARATIF : SANS VS AVEC ECOM COD */}
      <section id="comparatif-cod" className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
            <Zap className="h-3.5 w-3.5" /> La Fin du Bricolage
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Vendre, c'est facile. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-rose-400 to-indigo-400 bg-clip-text text-transparent">
              Tout le reste vous fait perdre votre trésorerie.
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-slate-400">
            Une vente en paiement à la livraison traverse 5 étapes clés. Basculez pour voir comment Ecom COD transforme les fuites d'argent en machine prédictive.
          </p>

          {/* Toggle Switch Sans vs Avec */}
          <div className="inline-flex items-center rounded-full border border-white/10 bg-[#090e1c] p-1.5 shadow-sm mt-6">
            <button
              type="button"
              onClick={() => setComparisonMode("sans")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                comparisonMode === "sans"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <XCircle className="h-4 w-4 text-rose-400" />
              <span>Sans Ecom COD (Le calvaire)</span>
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode("avec")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                comparisonMode === "avec"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-white" />
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
                    ? "border-indigo-500/30 bg-[#0c1426] hover:border-indigo-400/50 shadow-xs"
                    : "border-rose-500/20 bg-rose-950/20 hover:border-rose-400/30"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                      isAvec ? "bg-indigo-600 text-white" : "bg-rose-500/20 text-rose-300"
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
                      ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300"
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

      {/* 9. SECTION SIMULATEUR DE RENTABILITÉ CASH (SOMBRE ÉLÉVÉ) */}
      <section id="simulateur-roi" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-white/10 bg-[#080d1a] p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Simulateur Dynamique de Rentabilité COD
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Combien de cash supplémentaire allez-vous encaisser chaque mois ?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
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
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
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
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Gain de livraisons effectives (Relances IA + WhatsApp + Signal Meta Propre)</span>
                  <span className="font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
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
                  className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-[#0e1628] to-[#080d1a] p-6 sm:p-8 text-center space-y-5 lg:col-span-5 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Cash Net Supplémentaire Estimé
              </p>
              <p className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                +{extraMonthlyRevenue.toLocaleString("fr-FR")}{" "}
                <span className="text-base font-bold text-indigo-400 block sm:inline">FCFA / mois</span>
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Représente <strong>+{extraDeliveredOrders} colis livrés et encaissés</strong> de plus chaque mois sans dépenser 1 franc de plus en publicité.
              </p>
              <button
                type="button"
                onClick={openAuth}
                className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 py-3.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all"
              >
                Activer ce modèle sur mon Espace
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 10. SECTION RÉSEAU AFRIQUE INTERACTIF */}
      <section id="afrique-reseau" className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-3xl space-y-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
            <Globe2 className="h-3.5 w-3.5" /> Architecture Pan-Africaine Multi-Devises
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Conçu pour la réalité du terrain en Afrique de l'Ouest & Centrale
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Chaque marché fonctionne en silo étanche : devises locales (XOF, XAF, GNF), indicatifs téléphoniques automatisés, calcul de paie par zone et Pixel Meta dédié.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#080d1a] p-3 sm:p-5 shadow-xl overflow-hidden">
          <AfricaNetworkMap3D />
        </div>
      </section>

      {/* 11. PIED DE PAGE & LIENS CONFORMITÉ RGPD / META */}
      <footer className="border-t border-white/10 bg-[#040711] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <WariTrackLogo size="md" variant="full" roundedBadge subtitle="Pan-African Cash & Logistics OS" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 font-medium">
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="hover:text-indigo-300 transition-colors"
            >
              Politique de Confidentialité
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("terms")}
              className="hover:text-indigo-300 transition-colors"
            >
              Conditions d'Utilisation (CGU)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("deletion")}
              className="hover:text-indigo-300 transition-colors"
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

        <div className="mx-auto mt-8 max-w-7xl border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} Ecom COD Inc. Tous droits réservés.</p>
          <p>Conforme aux standards Meta Graph API v19.0 & RGPD</p>
        </div>
      </footer>

      {/* POP-UP / MODALE DE CONNEXION UNIVERSELLE (THÈME SOMBRE HAUT DE GAMME) */}
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
            className="relative w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-b from-[#0e1628] via-[#090e1c] to-[#050814] p-6 sm:p-7 shadow-2xl shadow-indigo-500/25"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            {needsWorkspaceName ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
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
                    className="w-full rounded-xl border border-white/15 bg-[#050814] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={busy || !workspaceName.trim()}
                    className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-xs font-bold text-white shadow hover:opacity-95 disabled:opacity-50"
                  >
                    {busy ? "Création..." : "Finaliser mon Espace"}
                  </button>
                </form>
                {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
              </div>
            ) : linkSent ? (
              <div className="space-y-3 py-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
                  className="mt-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Compris
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-b border-white/10 pb-3">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Lock className="h-4 w-4 text-indigo-400" />
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
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25 px-4 py-3 text-xs font-semibold text-blue-200 shadow-sm transition-all disabled:opacity-50"
                  >
                    <FacebookBrandIcon className="h-4 w-4" />
                    <span>Continuer avec Facebook</span>
                  </button>
                </div>

                <div className="relative flex items-center justify-center py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <span className="relative bg-[#090e1c] px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400">
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
                      className="w-full rounded-xl border border-white/15 bg-[#050814] pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !email.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 transition-all"
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

      {/* Modal Notes de Version & Mises à Jour v3.2 */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
      />
    </div>
  );
}
