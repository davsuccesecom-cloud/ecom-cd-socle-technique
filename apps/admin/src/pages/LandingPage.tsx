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

// Les 5 étapes critiques du COD terrain en Afrique
const COD_STAGES = [
  {
    step: "01",
    name: "La commande arrive du site",
    sans: {
      tag: "Faux numéros & Gaspillage Publicitaire",
      desc: "Commandes dispersées sur WhatsApp ou formulaires non filtrés. Les numéros bidons et doublons passent inaperçus, vos publicités continuent d'optimiser sur du vide.",
    },
    avec: {
      tag: "Synchronisation Shopify < 400ms & Filtre Anti-Doublon",
      desc: "Synchronisation instantanée dès la validation du client. Détection automatique des numéros d'Afrique de l'Ouest/Centrale, nettoyage des doublons et exclusion des faux leads.",
    },
  },
  {
    step: "02",
    name: "Confirmer le client par téléphone",
    sans: {
      tag: "Carnet papier & Numéros enregistrés à la main",
      desc: "Vos closeuses passent 2 minutes par client à enregistrer le numéro dans leur smartphone. Les relances sont oubliées, les fiches volantes se perdent.",
    },
    avec: {
      tag: "App Closeuse : WhatsApp & Appel 1-Clic",
      desc: "Cockpit ultra-rapide sur mobile et PC. Un simple clic lance l'appel ou ouvre WhatsApp avec le message de confirmation pré-rempli. Zéro contact à enregistrer manuellement.",
    },
  },
  {
    step: "03",
    name: "Expédier et livrer sur le terrain",
    sans: {
      tag: "Adresses par SMS & Colis introuvables",
      desc: "Adresses dictées vocalement ou par SMS. Aucun moyen de savoir où se trouve le colis. Les clients s'impatientent, annulent à la livraison et le stock devient fantôme.",
    },
    avec: {
      tag: "App Livreur & Bordereau Thermique 80mm",
      desc: "Feuille de route mobile pour chaque coursier avec géolocalisation et bordereau imprimable 80mm / A4. Mise à jour instantanée du statut et preuve de livraison.",
    },
  },
  {
    step: "04",
    name: "Encaisser & Contrôler la Caisse",
    sans: {
      tag: "Écarts de caisse & Calculs approximatifs",
      desc: "Le livreur rend l'argent plusieurs jours après selon son propre carnet. Les dépenses de carburant et les colis retournés ne sont jamais vérifiés, créant un trou de trésorerie.",
    },
    avec: {
      tag: "Pointage Cash Quotidien & Commissions Bloquées",
      desc: "Chaque soir, le cash encaissé est physiquement pointé face au montant strict attendu. Les commissions du livreur ne sont débloquées qu'après validation du montant en caisse.",
    },
  },
  {
    step: "05",
    name: "Faire les comptes & Nourrir l'IA Meta",
    sans: {
      tag: "Bénéfice au pifomètre & Pixel Meta faussé",
      desc: "Le Pixel Facebook reçoit un événement 'Achat' dès la commande du formulaire, alors que 45% des clients ne paient jamais. Vous brûlez votre budget sur de faux profils.",
    },
    avec: {
      tag: "Signal Meta CAPI 'Purchase' 100% Livré & Encaissé",
      desc: "L'événement Purchase n'est envoyé à Meta qu'une fois le colis remis et le cash pointé en caisse. Vos algorithmes Meta ciblent exclusivement des acheteurs solvables.",
    },
  },
];

// Onglets de démonstration réelle du logiciel
const SHOWCASE_TABS = [
  {
    id: "dashboard",
    label: "Cockpit Direction",
    icon: Laptop,
    badge: "Direct Terrain",
    image: "/landing/preview-dashboard.png?v=3",
    headline: "Cockpit de pilotage unifié multi-marchés",
    sub: "Chiffre d'affaires encaissé, taux de confirmation, volume en cours et livraisons par livreur consolidés en direct sans délai.",
  },
  {
    id: "closeuse",
    label: "App Closeuse (1-Clic)",
    icon: Smartphone,
    badge: "Mobile PWA",
    image: "/landing/preview-closeuse.png",
    headline: "Appel & WhatsApp immédiat sans enregistrer le contact",
    sub: "Gain de temps massif pour votre équipe d'appel. Un clic suffit pour appeler ou envoyer le message WhatsApp pré-rempli au client.",
  },
  {
    id: "ai",
    label: "Vigie IA 24/7",
    icon: Bot,
    badge: "Intelligence Terrain",
    image: "/landing/preview-ai.png",
    headline: "Audit opérationnel et alertes proactives automatiques",
    sub: "L'IA surveille vos commandes en continu, détecte les colis bloqués depuis plus de 4 heures et rédige vos plans d'action quotidiens.",
  },
  {
    id: "shopify",
    label: "Flux Shopify & Multi-Pays",
    icon: Zap,
    badge: "Webhooks < 400ms",
    image: "/landing/preview-shopify.png",
    headline: "Routage étanche par pays et synchronisation Meta CAPI",
    sub: "Chaque commande reçue en Côte d'Ivoire, au Sénégal, au Bénin ou au Togo est automatiquement assignée à l'équipe locale dédiée.",
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

  // Force le thème sombre minéral sur la page vitrine
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

  // Ouvre automatiquement la modale si nécessaire
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
    <div className="min-h-screen bg-[#060911] text-slate-100 selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden font-sans">
      {/* 1. BARRE DE NAVIGATION ÉPURÉE & HAUT CONTRASTE */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#060911]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <WariTrackLogo size="lg" variant="full" roundedBadge subtitle="Cash & Logistics OS" />
            <button
              type="button"
              onClick={() => setShowWhatsNew(true)}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer hidden sm:inline-flex items-center gap-1.5"
              title="Consulter les nouveautés de la version v3.2"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>v3.2 Production</span>
            </button>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-semibold text-slate-300 md:flex">
            <a href="#fonctionnalites" className="hover:text-white transition-colors">
              Fonctionnalités
            </a>
            <a href="#showcase-logiciel" className="hover:text-white transition-colors">
              Démonstration
            </a>
            <a href="#pourquoi-nous" className="hover:text-white transition-colors">
              Performance Terrain
            </a>
            <a href="#comparatif-cod" className="hover:text-white transition-colors">
              Sans vs Avec WariTrack
            </a>
            <a href="#simulateur-roi" className="hover:text-white transition-colors">
              Simulateur de Cash
            </a>
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Sécurité & RGPD
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openAuth}
              className="hidden sm:inline-flex items-center justify-center text-xs font-bold text-slate-300 hover:text-white transition px-3 py-2 cursor-pointer"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={openAuth}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 text-xs shadow-md shadow-emerald-500/15 transition active:scale-[0.98] cursor-pointer"
            >
              <span>{isAuthenticatedPreview ? "Poste Direction" : "Démarrer Maintenant"}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-950" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO PRINCIPAL AÉRÉ & HAUT CONTRASTE (SANS DÉGRADÉ VIOLET NI HALO FLOU) */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24 text-center border-b border-slate-800/80">
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
          {/* Badge Catégorie Métier Net */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-[#0c1222] px-4 py-1.5 text-xs font-semibold text-slate-300 mb-6 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="tracking-wide">SYSTÈME D'EXPLOITATION CASH ON DELIVERY AFRIQUE</span>
          </div>

          {/* Titre franc, percutant et lisible */}
          <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
            Chaque soir, sachez exactement où est <br className="hidden sm:inline" />
            <span className="text-emerald-400">chaque franc CFA encaissé.</span>
          </h1>

          {/* Sous-titre orienté terrain & soulagement opérationnel */}
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300 font-normal">
            Fini les fiches d'appels perdues, les contestations de livraison et les écarts de caisse en fin de journée.
            WariTrack connecte vos commandes Shopify en temps réel, équipe vos closeuses du WhatsApp 1-clic et verrouille le cash de vos livreurs.
          </p>

          {/* Boutons d'Action Massifs (Hauteur 48px Tactile Mobile) */}
          <div className="mx-auto mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={openAuth}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm px-7 py-3.5 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition cursor-pointer"
            >
              <span>Créer mon Espace Gratuit</span>
              <ArrowRight className="h-4 w-4 text-slate-950" />
            </button>

            <a
              href="#showcase-logiciel"
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-6 py-3.5 shadow-sm active:scale-[0.98] transition cursor-pointer"
            >
              <span>Explorer la Démonstration</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </a>
          </div>

          {/* 4 Piliers Concrets du Logiciel */}
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-2.5 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-slate-200">
              <PhoneCall className="h-3.5 w-3.5 text-emerald-400" /> Closeuse WhatsApp 1-Clic
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-slate-200">
              <Truck className="h-3.5 w-3.5 text-sky-400" /> Livreur Terrain & Bordereau 80mm
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-slate-200">
              <Landmark className="h-3.5 w-3.5 text-amber-400" /> Pointage Strict de Caisse
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-slate-200">
              <Zap className="h-3.5 w-3.5 text-indigo-400" /> Shopify & Signal Meta 100% Livré
            </span>
          </div>

          {/* 3. SHOWCASE LOGICIEL : CADRE NET & CONTRASTÉ */}
          <div id="showcase-logiciel" className="relative mx-auto mt-14 max-w-5xl text-left">
            <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-3 sm:p-5 shadow-2xl">
              {/* Barre supérieure style système de cockpit */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
                {/* 3 Dots de contrôle */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
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
                        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-slate-900"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${active ? "text-emerald-400" : "text-slate-400"}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-medium">Direct Terrain</span>
                </div>
              </div>

              {/* Titre du module actif */}
              <div className="mb-3 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{currentTab.headline}</span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 border border-slate-700">
                      {currentTab.badge}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">{currentTab.sub}</p>
                </div>
                <button
                  type="button"
                  onClick={openAuth}
                  className="self-start sm:self-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 mt-1 sm:mt-0 cursor-pointer"
                >
                  <span>Tester sur votre boutique</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Capture nette haute définition avec cadre solide */}
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#050810] flex items-center justify-center">
                <img
                  src={currentTab.image}
                  alt={currentTab.label}
                  loading="eager"
                  decoding="sync"
                  className="w-full h-auto object-contain max-h-[600px] transition-opacity duration-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* 4. BANDEAU DES INTÉGRATIONS OFFICIELLES */}
          <div className="mx-auto mt-14 max-w-4xl border-t border-slate-800/80 pt-8">
            <p className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-4">
              Connecté nativement aux piliers de votre chaîne e-commerce
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0B0F19] px-4 py-2.5 text-xs font-bold text-slate-200 shadow-sm">
                <ShopifyIcon className="h-4 w-4" />
                <span>Shopify Webhooks &lt; 400ms</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0B0F19] px-4 py-2.5 text-xs font-bold text-slate-200 shadow-sm">
                <FacebookBrandIcon className="h-4 w-4" />
                <span>Meta Conversions API (CAPI)</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0B0F19] px-4 py-2.5 text-xs font-bold text-slate-200 shadow-sm">
                <WhatsAppIcon size={18} />
                <span>WhatsApp Business Direct 1-Clic</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION BENTO GRID DES FONCTIONNALITÉS ESSENTIELLES */}
      <section id="fonctionnalites" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
            <Layers className="h-3.5 w-3.5 text-emerald-400" /> Les 4 Piliers Métier
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Débloquez la Pleine Puissance de Votre Opération COD
          </h2>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-slate-400">
            Chaque module a été pensé sur le terrain pour résoudre les fuites de marge, les lenteurs d'appel et les contestations de livraison.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Card 1 : App Closeuse */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-7 shadow-sm md:col-span-6 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">App Closeuse 1-Clic WhatsApp</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                Vos opératrices appellent et envoient le message WhatsApp pré-rempli sans perdre de temps à taper le numéro dans leur téléphone. L'historique des appels garantit une relance infaillible des clients hésitants.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Filtre automatique des faux numéros et des commandes doublons</span>
            </div>
          </div>

          {/* Card 2 : App Livreur & Bordereau */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-7 shadow-sm md:col-span-6 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">App Livreur & Bordereau Thermique 80mm</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                Chaque coursier reçoit sa feuille de route sur smartphone et peut imprimer ses bordereaux d'expédition en format thermique 80mm ou A4. Le statut passe en livré dès remise du colis.
              </p>
            </div>
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-300 font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-sky-400 shrink-0" />
              <span>Bordereaux conformes avec montant exact à percevoir</span>
            </div>
          </div>

          {/* Card 3 : Caisse Sécurisée */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-7 shadow-sm md:col-span-5 space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Caisse & Paie au Réel Encaissé</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                La rémunération et les primes des livreurs restent bloquées tant que le cash physique n'a pas été pointé face au montant attendu de la tournée.
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Zéro tolérance pour les écarts de trésorerie</span>
            </div>
          </div>

          {/* Card 4 : Vigie IA 24/7 */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-7 shadow-sm md:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                <Bot className="h-5 w-5" />
              </div>
              <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-300">
                Surveillance Active
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Vigie IA 24/7 & Alertes Terrain Proactives</h3>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-300">
                L'analyste IA examine vos flux opérationnels en continu : il alerte sur les commandes non appelées après 15 minutes, repère les colis en route depuis plus de 4 heures et identifie les anomalies.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="rounded-lg border border-slate-800 bg-[#060911] p-2.5 text-slate-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                <span>Alerte Colis Bloqué &gt; 4h</span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#060911] p-2.5 text-slate-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                <span>Relances Clients Autonomes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION STATISTIQUES TERRAIN SOMBRES & HAUT CONTRASTE */}
      <section id="pourquoi-nous" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 border-t border-slate-800/80">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Impact Chiffré Immédiat
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            La Rigueur Opérationnelle Qui Protège Votre Trésorerie
          </h2>
          <p className="mx-auto max-w-xl text-xs sm:text-sm text-slate-400">
            Conçu pour maximiser votre taux de livraison effectif et sécuriser chaque franc de cash dès le premier mois.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Stat 1 */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 shadow-sm space-y-2">
            <p className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight tabular-nums">+18%</p>
            <p className="text-xs font-bold text-white">Livraisons Effectives</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Moins d'annulations grâce au premier appel ultra-rapide.
            </p>
          </div>

          {/* Stat 2 */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 shadow-sm space-y-2">
            <p className="text-3xl sm:text-4xl font-black text-sky-400 tracking-tight tabular-nums">&lt; 15 min</p>
            <p className="text-xs font-bold text-white">Délai Premier Appel</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Bouton WhatsApp 1-clic direct sans manipulation de répertoire.
            </p>
          </div>

          {/* Stat 3 */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 shadow-sm space-y-2">
            <p className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight tabular-nums">0 FCFA</p>
            <p className="text-xs font-bold text-white">Écart de Caisse Toléré</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Pointage strict des espèces avant déblocage de paie.
            </p>
          </div>

          {/* Stat 4 */}
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 shadow-sm space-y-2">
            <p className="text-3xl sm:text-4xl font-black text-indigo-400 tracking-tight tabular-nums">100%</p>
            <p className="text-xs font-bold text-white">Précision Meta CAPI</p>
            <p className="text-[11px] text-slate-400 leading-tight">
              Signal d'achat transmis uniquement après encaissement réel.
            </p>
          </div>
        </div>
      </section>

      {/* 7. SECTION DÉPLOIEMENT EN 3 ÉTAPES */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
            <Zap className="h-3.5 w-3.5 text-emerald-400" /> Prise en Main Immédiate
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Opérationnel en 3 Étapes Simples
          </h2>
          <p className="mx-auto max-w-xl text-xs sm:text-sm text-slate-400">
            Zéro installation complexe. Vos équipes se connectent directement depuis leur smartphone.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center">
          {/* Colonne Gauche : Mini Mockup */}
          <div className="md:col-span-6 rounded-2xl border border-slate-800 bg-[#0B0F19] p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="text-[11px] font-bold text-slate-400 ml-2">Espace Opérationnel WariTrack</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#050810] overflow-hidden">
              <img
                src="/landing/preview-closeuse.png"
                alt="App Closeuse Onboarding"
                className="w-full object-cover max-h-[340px]"
              />
            </div>
          </div>

          {/* Colonne Droite : 3 Cartes Étape */}
          <div className="md:col-span-6 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-5 shadow-sm hover:border-slate-700 transition flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-sm font-black text-slate-950">
                01
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Connexion Rapide sans Mot de Passe</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Connexion instantanée via Google, Facebook ou lien magique par email. Votre base de données étanche et sécurisée est prête immédiatement.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-5 shadow-sm hover:border-slate-700 transition flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-sm font-black text-white">
                02
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Liez Votre Shopify & Vos Équipes</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Collez votre webhook Shopify et créez les accès dédiés pour vos closeuses et vos livreurs. Chaque membre accède uniquement à son interface.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-5 shadow-sm hover:border-slate-700 transition flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white">
                03
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Pilotez les Livraisons & Encaissez</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Suivez les appels en temps réel, vérifiez le pointage de caisse chaque soir et constatez la croissance nette de votre marge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. GRAND COMPARATIF TERRAIN : SANS VS AVEC WARITRACK */}
      <section id="comparatif-cod" className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 border-t border-slate-800/80">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
            <Zap className="h-3.5 w-3.5 text-emerald-400" /> La Réalité du Terrain COD
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Vendre, c'est facile. <br className="hidden sm:inline" />
            <span className="text-rose-400">Le désordre opérationnel détruit vos bénéfices.</span>
          </h2>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-slate-400">
            Une vente en paiement à la livraison traverse 5 étapes clés. Comparez ce qui se passe sans outil structuré face à la méthode rigoureuse WariTrack :
          </p>

          {/* Toggle Switch Sans vs Avec */}
          <div className="inline-flex items-center rounded-xl border border-slate-800 bg-[#0B0F19] p-1.5 shadow-sm mt-6">
            <button
              type="button"
              onClick={() => setComparisonMode("sans")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                comparisonMode === "sans"
                  ? "bg-rose-950/60 text-rose-300 border border-rose-800/80"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <XCircle className="h-4 w-4 text-rose-400" />
              <span>Sans WariTrack (Le calvaire)</span>
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode("avec")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                comparisonMode === "avec"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-slate-950" />
              <span>Avec WariTrack (Le cockpit)</span>
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
                className={`rounded-xl border p-4 sm:p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isAvec
                    ? "border-emerald-500/30 bg-[#0B0F19] hover:border-emerald-500/50 shadow-xs"
                    : "border-rose-900/40 bg-rose-950/20 hover:border-rose-800/50"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      isAvec ? "bg-emerald-500 text-slate-950" : "bg-rose-500/20 text-rose-300"
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
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                    isAvec
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {current.tag}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. SECTION SIMULATEUR DE RENTABILITÉ CASH (SANS DÉGRADÉ VIOLET) */}
      <section id="simulateur-roi" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-10 shadow-2xl">
          <div className="mb-8 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
              <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" /> Simulateur Dynamique de Rentabilité COD
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Combien de cash supplémentaire allez-vous encaisser chaque mois ?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Ajustez vos volumes. Grâce au premier appel WhatsApp immédiat, à la feuille de route livreur et au signal Meta CAPI envoyé uniquement sur commande livrée :
            </p>
          </div>

          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Volume mensuel de commandes reçues</span>
                  <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-md tabular-nums border border-slate-700">
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
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Panier moyen par commande (FCFA / XOF)</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 tabular-nums">
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
                  <span className="text-slate-300">Gain de livraisons effectives (Relances + Bordereaux + Meta Propre)</span>
                  <span className="font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20 tabular-nums">
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
                  className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-[#060911] p-6 sm:p-8 text-center space-y-5 lg:col-span-5 shadow-lg">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Cash Net Supplémentaire Estimé
              </p>
              <p className="text-3xl sm:text-5xl font-black text-white tracking-tight tabular-nums">
                +{extraMonthlyRevenue.toLocaleString("fr-FR")}{" "}
                <span className="text-base font-bold text-emerald-400 block sm:inline">FCFA / mois</span>
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Représente <strong className="text-white tabular-nums">+{extraDeliveredOrders} colis livrés et encaissés</strong> de plus chaque mois sans dépenser un franc supplémentaire en publicité.
              </p>
              <button
                type="button"
                onClick={openAuth}
                className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition cursor-pointer"
              >
                Activer ce modèle sur mon Espace
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 10. SECTION RÉSEAU AFRIQUE INTERACTIF */}
      <section id="afrique-reseau" className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 border-t border-slate-800/80">
        <div className="mb-8 max-w-3xl space-y-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
            <Globe2 className="h-3.5 w-3.5 text-emerald-400" /> Architecture Multi-Pays & Multi-Devises
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Conçu pour la Réalité du Terrain en Afrique de l'Ouest & Centrale
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Chaque marché fonctionne en silo étanche : devises locales (XOF, XAF, GNF), indicatifs téléphoniques automatisés, calcul de paie par zone et Pixel Meta dédié.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-3 sm:p-5 shadow-xl overflow-hidden">
          <AfricaNetworkMap3D />
        </div>
      </section>

      {/* 11. PIED DE PAGE & LIENS CONFORMITÉ RGPD / META */}
      <footer className="border-t border-slate-800 bg-[#04060d] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <WariTrackLogo size="md" variant="full" roundedBadge subtitle="Pan-African Cash & Logistics OS" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 font-medium">
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Politique de Confidentialité
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("terms")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Conditions d'Utilisation (CGU)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("deletion")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Suppression des Données (Meta)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalModalTab("security")}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Architecture & Sécurité
            </button>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-7xl border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} WariTrack Technologies. Tous droits réservés.</p>
          <p>Conforme aux standards Meta Graph API v19.0 & Normes RGPD</p>
        </div>
      </footer>

      {/* POP-UP / MODALE DE CONNEXION UNIVERSELLE (THÈME SOMBRE MINÉRAL HAUT DE GAMME) */}
      {authModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!busy && !needsWorkspaceName) setAuthModalOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-400 hover:text-white transition cursor-pointer"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            {needsWorkspaceName ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
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
                    className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#060911] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={busy || !workspaceName.trim()}
                    className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? "Initialisation..." : "Finaliser mon Espace"}
                  </button>
                </form>
                {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
              </div>
            ) : linkSent ? (
              <div className="space-y-3 py-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">Lien d'accès envoyé avec succès</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Un lien sécurisé sans mot de passe a été envoyé à <strong className="text-white">{email}</strong>.
                  Cliquez dessus depuis cet appareil ou votre smartphone pour ouvrir directement votre Poste de Pilotage.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="mt-2 min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
                >
                  Compris
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-400" />
                    <span>Connexion Sécurisée WariTrack</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Accédez à votre espace en 1 clic. Aucun mot de passe complexe à mémoriser.
                  </p>
                </div>

                {/* Boutons Sociaux Rapides (Google & Facebook) */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => signInWithGoogle && signInWithGoogle()}
                    disabled={busy}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 px-4 py-3 text-xs font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    <GoogleIcon className="h-4 w-4" />
                    <span>Continuer avec Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => signInWithFacebook && signInWithFacebook()}
                    disabled={busy}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25 px-4 py-3 text-xs font-semibold text-blue-200 shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    <FacebookBrandIcon className="h-4 w-4" />
                    <span>Continuer avec Facebook</span>
                  </button>
                </div>

                <div className="relative flex items-center justify-center py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <span className="relative bg-[#0B0F19] px-3 text-[10px] uppercase font-bold tracking-wider text-slate-500">
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
                      className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#060911] pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !email.trim()}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 text-xs sm:text-sm shadow-md shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 transition cursor-pointer"
                  >
                    <span>{busy ? "Envoi du lien..." : "Recevoir mon lien d'accès"}</span>
                    <ArrowRight className="h-4 w-4 text-slate-950" />
                  </button>
                </form>

                {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

                <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-800/80 space-y-1">
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
                    className="text-slate-400 hover:text-white underline underline-offset-2 cursor-pointer"
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
