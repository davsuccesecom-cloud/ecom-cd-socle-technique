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
  Layers,
  ChevronRight,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import AfricaNetworkMap3D from "../components/AfricaNetworkMap3D";
import LegalPrivacyModal, { type LegalTab } from "../components/LegalPrivacyModal";
import WhatsAppIcon from "../components/WhatsAppIcon";

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
    badge: "Shopify & Webhook",
    title: "Ingestion Instantanée & Isolation des Doublons",
    desc: "Chaque commande passée sur vos boutiques Shopify arrive en moins de 400 millisecondes. Elle est automatiquement attribuée à l'équipe pays par son indicatif téléphonique (+228, +229, +225, etc.) et synchronisée sur Google Sheets. Si le numéro a déjà commandé, il est immédiatement balisé « Accès libre site » et exclu du Pixel Meta pour ne jamais gaspiller votre budget pub.",
    metrics: [
      { label: "Latence Webhook", value: "< 400 ms" },
      { label: "Doublons Isolés", value: "100% Automatique" },
      { label: "Routage Pays", value: "Multi-Marchés" },
    ],
    accent: "from-indigo-500/20 via-blue-500/10 to-transparent border-indigo-500/40 text-indigo-300",
  },
  {
    step: "02",
    badge: "App Closeuse",
    title: "Confirmation d'Appel, Relance WhatsApp & Calendrier",
    desc: "Vos closeuses reçoivent une alerte sonore et visuelle dès qu'une commande est reçue. En un clic, elles lancent l'appel ou ouvrent une conversation WhatsApp avec message pré-rempli (nom du client, produit et montant exact). Elles planifient la livraison, gèrent les reprogrammations et assignent le livreur de la zone.",
    metrics: [
      { label: "Prise en charge cible", value: "< 15 min" },
      { label: "WhatsApp Direct", value: "1-Clic Pré-rempli" },
      { label: "Attribution", value: "Round-Robin Équitable" },
    ],
    accent: "from-purple-500/20 via-indigo-500/10 to-transparent border-purple-500/40 text-purple-300",
  },
  {
    step: "03",
    badge: "App Livreur & Bon 3D",
    title: "Tournée Terrain, Bordereau 3D & Encaissement Réel",
    desc: "Imprimez des bordereaux de livraison 3D officiels avec QR Code. Sur son application mobile dédiée, le livreur voit ses colis classés par quartier. Il passe la commande en « En route » dès le départ, puis valide « Livré » uniquement une fois l'argent liquide ou Mobile Money reçu en main propre.",
    metrics: [
      { label: "Bordereau 3D", value: "Prêt à Imprimer" },
      { label: "Statut Colis", value: "En Route / Livré" },
      { label: "Retard > 4h", value: "Alerte Vigie IA" },
    ],
    accent: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/40 text-emerald-300",
  },
  {
    step: "04",
    badge: "Caisse & Meta CAPI",
    title: "Contrôle Caisse du Soir, Paie & Signal Meta Purchase Pur",
    desc: "Fin de journée : dans « Caisse & Versements Livreurs », vous comparez le montant brut attendu et le cash versé. Déduisez les imprévus (carburant, retours) avec une note justificative obligatoire avant de valider. La commission du livreur est alors débloquée, et l'événement Purchase est envoyé à Meta.",
    metrics: [
      { label: "Signal Meta CAPI", value: "100% Livré Réel" },
      { label: "Verrouillage Paie", value: "Après Validation Caisse" },
      { label: "Pont OAuth", value: "Incognito / Autre Nav" },
    ],
    accent: "from-amber-500/20 via-emerald-500/10 to-transparent border-amber-500/40 text-amber-300",
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

  // Simulateur interactif de rentabilité
  const [monthlyOrders, setMonthlyOrders] = useState(600);
  const [avgOrderValue, setAvgOrderValue] = useState(18000);
  const [deliveryBoostPct, setDeliveryBoostPct] = useState(18);

  const authBoxRef = useRef<HTMLDivElement | null>(null);

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
      {/* Bandeau d'aperçu pour administrateur connecté */}
      {isAuthenticatedPreview && (
        <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/30 bg-indigo-950/95 px-4 py-2 text-xs font-medium text-indigo-200 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Mode Aperçu Vitrine (Connecté avec vos droits Administrateur)</span>
          </div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 px-3 py-1 text-xs font-bold text-white shadow transition"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Retour à mon Dashboard</span>
          </button>
        </div>
      )}

      {/* Halo immersif supérieur */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[640px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(99,102,241,0.28),rgba(16,185,129,0.12),transparent)]" />

      {/* 1. BARRE DE NAVIGATION GLASSMORPHIC */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b14]/80 backdrop-blur-2xl">
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
              Sécurité & CAPI
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
            {isAuthenticatedPreview && onBackToDashboard ? (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition-all"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Poste de Pilotage</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={scrollToAuth}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-brand to-indigo-600 hover:opacity-95 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-brand/30 transition-all"
              >
                <span>Accès Direction</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION : VALEUR + AUTH RAPIDE + 3D SHOWCASE */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:pt-16">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Colonne Gauche : Titre + Connecteurs + Formulaire d'accès */}
          <div className="space-y-6 lg:col-span-6">
            {/* Badges Connecteurs Officiels */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Socle COD Tout-En-Un</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#95BF47]/40 bg-[#95BF47]/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShopifyIcon className="h-4 w-4" />
                <span>Shopify Instantané</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1877F2]/40 bg-[#1877F2]/15 px-3 py-1 text-xs font-semibold text-blue-300">
                <FacebookBrandIcon className="h-4 w-4" />
                <span>Facebook Meta CAPI</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <WhatsAppIcon size={16} />
                <span>WhatsApp 1-Clic</span>
              </span>
            </div>

            {/* Titre Principal Haute Typographie */}
            <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.15] sm:leading-[1.08] break-words">
              Transformez chaque commande en{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                cash réellement encaissé
              </span>{" "}
              en Afrique.
            </h1>

            <p className="text-sm sm:text-base leading-relaxed text-slate-300 max-w-xl">
              Reliez vos boutiques <strong>Shopify</strong>, vos <strong>Closeuses</strong>, vos{" "}
              <strong>Livreurs terrain</strong> et votre <strong>Pixel Meta CAPI</strong> dans un seul cockpit. Isolez
              les doublons en « Accès libre site », contrôlez la caisse avant de payer les primes et laissez la{" "}
              <strong>Vigie IA</strong> surveiller vos opérations 24h/24.
            </p>

            {/* Boîte d'Authentification / Accès Rapide Direction */}
            <div
              ref={authBoxRef}
              className="rounded-3xl border border-white/15 bg-gradient-to-b from-[#0f172a]/95 via-[#0c1222]/95 to-[#080d1a]/95 p-5 sm:p-6 shadow-2xl shadow-indigo-500/15 backdrop-blur-2xl"
            >
              {isAuthenticatedPreview ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Session Administrateur Active
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Vous consultez la vitrine publique officielle de votre espace Ecom COD.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 hover:opacity-95 transition-all"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Retour au Poste de Pilotage</span>
                  </button>
                </div>
              ) : needsWorkspaceName && createWorkspace ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span>Bienvenue 👋 — Donnez un nom à votre Espace de Travail</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Votre espace hermétique est créé immédiatement avec vos équipes, devises et rôles dédiés.
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
                      placeholder="Ex : Ecom Afrique Holding / TG Distribution"
                      className="flex-1 rounded-xl border border-white/15 bg-[#070b14] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand"
                    />
                    <button
                      type="submit"
                      disabled={busy || !workspaceName.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-brand to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/30 hover:opacity-95 disabled:opacity-50"
                    >
                      {busy ? "Création..." : "Créer mon espace"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                  {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
                </div>
              ) : linkSent ? (
                <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                    <Mail className="h-4 w-4" />
                    <span>Lien magique envoyé avec succès 📩</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Un lien sécurisé sans mot de passe a été envoyé à <strong className="text-white">{email}</strong>.
                    Cliquez dessus depuis cet appareil pour ouvrir directement votre Poste de Pilotage.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-brand" />
                      <span>Accès Direction & Démarrage Gratuit</span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400">Zéro mot de passe</span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (email.trim() && sendLoginLink) void sendLoginLink(email.trim());
                    }}
                    className="flex flex-col gap-2.5 sm:flex-row"
                  >
                    <div className="relative flex-1">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre-email@boutique.com"
                        className="w-full rounded-xl border border-white/15 bg-[#070b14] pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/30 transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !email.trim()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-brand to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/30 hover:opacity-95 disabled:opacity-50 transition-all"
                    >
                      <span>{busy ? "Envoi..." : "Recevoir mon lien d'accès"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400 border-t border-white/5">
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Connexion 1-clic par email • Espace isolé automatique
                    </span>
                    <button
                      type="button"
                      onClick={() => setLegalModalTab("privacy")}
                      className="text-slate-300 underline underline-offset-2 hover:text-white"
                    >
                      Charte de Confidentialité
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3 Cartes de Réassurance Supérieures */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-3.5">
                <p className="font-mono text-base sm:text-lg font-extrabold text-white">3 Apps</p>
                <p className="text-[11px] text-slate-400 font-medium">Admin, Closeuse & Livreur</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-3.5">
                <p className="font-mono text-base sm:text-lg font-extrabold text-emerald-400">100% Livré</p>
                <p className="text-[11px] text-slate-400 font-medium">Signal CAPI Purifié</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-3.5">
                <p className="font-mono text-base sm:text-lg font-extrabold text-amber-300">Caisse + IA</p>
                <p className="text-[11px] text-slate-400 font-medium">Zéro perte de cash</p>
              </div>
            </div>
          </div>

          {/* Colonne Droite : Showcase 3D Cadre Pro avec Badges Flottants Harmonisés */}
          <div className="relative lg:col-span-6">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              {/* Cadre principal de l'image 3D */}
              <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-[#0c1222] p-2.5 shadow-[0_25px_80px_-15px_rgba(99,102,241,0.35)]">
                <img
                  src="/landing/hero-cod-hub.jpg"
                  alt="Poste de Commandement 3D Ecom COD"
                  className="w-full rounded-2xl object-cover shadow-2xl"
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-[#070b14]/70 via-transparent to-transparent" />
              </div>

              {/* Badge 1 : Meta CAPI Purchase Post-Livraison (Haut Gauche) */}
              <div className="hidden sm:flex absolute -left-4 -top-4 items-center gap-2.5 rounded-2xl border border-white/20 bg-[#0c1324]/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                  <FacebookBrandIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                    Meta Conversions API
                  </p>
                  <p className="text-xs font-bold text-white">Purchase envoyé après Livraison</p>
                </div>
              </div>

              {/* Badge 2 : Shopify Webhooks (Haut Droite) */}
              <div className="hidden sm:flex absolute -right-3 -top-4 items-center gap-2.5 rounded-2xl border border-white/20 bg-[#0c1324]/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#95BF47]/20">
                  <ShopifyIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Shopify Webhooks
                  </p>
                  <p className="text-xs font-bold text-white">Routage instantané &lt; 400 ms</p>
                </div>
              </div>

              {/* Badge 3 : Caisse Livreurs Vérifiée (Bas Droite) */}
              <div className="hidden sm:flex absolute -right-3 -bottom-4 items-center gap-2.5 rounded-2xl border border-white/20 bg-[#0c1324]/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                  <Landmark className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Caisse Livreurs
                  </p>
                  <p className="text-xs font-bold text-white">Cash vérifié avant validation prime</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECTION AFRIQUE EN POINTILLÉS 3D */}
      <section id="afrique-reseau" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-3xl space-y-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Globe2 className="h-3.5 w-3.5" /> Architecture Pan-Africaine Multi-Devises
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Conçu pour la réalité du terrain en Afrique de l'Ouest & Centrale
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Chaque marché fonctionne en silo étanche : devises locales (XOF, XAF, GNF), indicatifs téléphoniques
            automatisés, calcul de paie par zone et Pixel Meta dédié.
          </p>
        </div>

        <AfricaNetworkMap3D />
      </section>

      {/* 4. SECTION LES 3 APPLICATIONS & WORKFLOW INTERACTIF */}
      <section id="ecosysteme-3d" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Visuel 3D des 3 Apps */}
          <div className="space-y-4 lg:col-span-5">
            <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#0b101d] p-3 shadow-2xl">
              <img
                src="/landing/ecosystem-3-apps.jpg"
                alt="Les 3 applications synchronisées : Admin, Closeuse et Livreur"
                className="w-full rounded-2xl object-cover shadow-lg"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3 sm:gap-2.5">
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                <p className="text-xs font-bold text-indigo-300">1. App Closeuse</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Appels & WhatsApp</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs font-bold text-emerald-300">2. App Admin</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Caisse, CAPI & IA</p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs font-bold text-amber-300">3. App Livreur</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Terrain & Colis</p>
              </div>
            </div>
          </div>

          {/* Workflow Interactif 4 Étapes */}
          <div className="space-y-6 lg:col-span-7">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                Cycle Opérationnel Complet
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Du clic publicitaire Facebook jusqu'au versement vérifié en caisse
              </h2>
            </div>

            {/* Onglets des 4 Étapes */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WORKFLOW_STEPS.map((s, idx) => {
                const active = activeStep === idx;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className={`rounded-2xl border p-3.5 text-left transition-all ${
                      active
                        ? "border-brand bg-brand/20 text-white shadow-lg shadow-brand/25 scale-[1.02]"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold text-brand">ÉTAPE {s.step}</span>
                    <p className="mt-1 truncate text-xs font-semibold text-white">{s.badge}</p>
                  </button>
                );
              })}
            </div>

            {/* Détail de l'Étape Active */}
            <div
              className={`rounded-3xl border bg-gradient-to-br p-6 sm:p-7 shadow-xl transition-all ${WORKFLOW_STEPS[activeStep].accent}`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold text-white">
                  {WORKFLOW_STEPS[activeStep].badge}
                </span>
                <span className="font-mono text-3xl font-black text-white/30">
                  {WORKFLOW_STEPS[activeStep].step}
                </span>
              </div>

              <h3 className="mt-4 text-xl sm:text-2xl font-bold text-white tracking-tight">
                {WORKFLOW_STEPS[activeStep].title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-200">
                {WORKFLOW_STEPS[activeStep].desc}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {WORKFLOW_STEPS[activeStep].metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl border border-white/10 bg-[#070b14]/80 p-3.5 text-center shadow-inner"
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

      {/* 5. CALCULATEUR INTERACTIF DE TRÉSORERIE */}
      <section id="simulateur-roi" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#0c1426] via-[#090e1c] to-[#071317] p-6 sm:p-10 shadow-2xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                <BarChart3 className="h-3.5 w-3.5" /> Simulateur Dynamique de Rentabilité COD
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Combien de cash supplémentaire allez-vous encaisser chaque mois ?
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Ajustez votre volume et votre panier moyen. En combinant l'appel ultra-rapide (&lt; 15 min), le message
                WhatsApp 1-clic et l'envoi de l'événement Purchase Meta uniquement après livraison réelle :
              </p>

              <div className="space-y-5 pt-2">
                <div>
                  <div className="mb-2 flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Volume mensuel de commandes reçues</span>
                    <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                      {monthlyOrders} commandes / mois
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={50}
                    value={monthlyOrders}
                    onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Panier moyen par commande (FCFA / XOF)</span>
                    <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
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

                <div>
                  <div className="mb-2 flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">
                      Gain de livraisons effectives (Relances IA + WhatsApp + Signal Meta Propre)
                    </span>
                    <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
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
            </div>

            <div className="rounded-3xl border border-emerald-500/40 bg-[#070b14]/95 p-6 sm:p-8 text-center space-y-5 lg:col-span-5 shadow-2xl shadow-emerald-500/10">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Cash Net Supplémentaire Estimé
              </p>
              <p className="font-mono text-3xl sm:text-5xl font-black text-white tracking-tight">
                +{extraMonthlyRevenue.toLocaleString("fr-FR")}{" "}
                <span className="text-base font-bold text-emerald-400 block sm:inline">FCFA / mois</span>
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Représente <strong>+{extraDeliveredOrders} colis livrés et encaissés</strong> de plus chaque mois sans
                dépenser 1 franc de plus en publicité.
              </p>

              <div className="border-t border-white/10 pt-4 text-left space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Aucune commission versée tant que le cash n'est pas pointé en caisse</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Isolation des doublons (aucun faux achat transmis à votre Pixel Facebook)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={scrollToAuth}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 py-3.5 text-xs font-bold text-white shadow-xl shadow-emerald-500/30 transition-all"
              >
                Activer ce modèle sur mon Espace Ecom COD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION SÉCURITÉ, META CAPI & INNOVATIONS TECHNIQUES */}
      <section id="securite-confidentialite" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Sécurité, Confidentialité & Conformité
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Une architecture pensée pour protéger vos bénéfices et vos données
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLegalModalTab("privacy")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-all"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Politique de Confidentialité</span>
            </button>
            <button
              type="button"
              onClick={() => setLegalModalTab("deletion")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5 text-blue-400" />
              <span>Suppression des Données Meta</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-[#0b101d] p-6 space-y-3 hover:border-blue-500/40 transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
              <Share2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Pont Meta OAuth Externe (Incognito / Autre Navigateur)
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Générez un lien à usage unique valable 15 minutes. Connectez votre Facebook dans un navigateur Incognito,
              Brave ou AdsPower : vos comptes publicitaires et Pixels remontent directement dans votre PWA principale.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b101d] p-6 space-y-3 hover:border-amber-500/40 transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <Landmark className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Caisse Livreurs & Déductions Justificatives
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Pointez chaque franc encaissé par livreur en fin de journée. Déduisez les imprévus de livraison
              (carburant, aller-retour supplémentaire) avec une note justificative obligatoire avant de valider la paie.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b101d] p-6 space-y-3 hover:border-emerald-500/40 transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Vigie IA & Alertes Autonomes de Retard
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              L'IA surveille les commandes non appelées après 15 minutes, les livraisons programmées dont l'heure est
              dépassée, les colis en route depuis plus de 4 heures et le cash non versé en caisse.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b101d] p-6 space-y-3 hover:border-purple-500/40 transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-400">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Hachage SHA-256 & Isolation Multi-Workspaces
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Toutes les données personnelles transmises à l'API Graph Meta sont systématiquement hachées en SHA-256.
              Chaque équipe pays possède ses propres règles de sécurité Firestore hermétiques.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b101d] p-6 space-y-3 hover:border-teal-500/40 transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              WhatsApp SAV & Export Téléphonique sur Durée
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Écrivez directement aux clients pour le service après-vente grâce au bouton WhatsApp officiel, et exportez
              vos listes complètes de numéros qualifiés en CSV sur la période de votre choix.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b101d] p-6 space-y-3 hover:border-rose-500/40 transition-all">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Bons de Livraison 3D & Double Validation
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Imprimez des bordereaux professionnels avec coordonnées complètes et mentions personnalisées. Toute
              décision sensible (suppression, modification de commission) passe par une double revalidation.
            </p>
          </div>
        </div>
      </section>

      {/* 7. PIED DE PAGE OFFICIEL AVEC TOUS LES LIENS DE CONFORMITÉ */}
      <footer className="relative z-10 border-t border-white/10 bg-[#050810] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="flex items-center gap-3.5">
              <img src="/icons/icon-192.png" alt="Ecom COD" className="h-9 w-9 rounded-xl shadow-md" />
              <div>
                <p className="text-sm font-bold text-white">Ecom COD — Socle Technique Opérationnel</p>
                <p className="text-xs text-slate-500">
                  Pilotage Cash-On-Delivery Pan-Africain • Togo, Bénin, Côte d'Ivoire, Sénégal, Cameroun & International
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-400">
              <button
                type="button"
                onClick={() => setLegalModalTab("privacy")}
                className="hover:text-white transition-colors"
              >
                Politique de Confidentialité
              </button>
              <span className="text-slate-700">•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab("terms")}
                className="hover:text-white transition-colors"
              >
                Conditions d'Utilisation (CGU)
              </button>
              <span className="text-slate-700">•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab("deletion")}
                className="hover:text-white transition-colors"
              >
                Suppression des Données (Meta)
              </button>
              <span className="text-slate-700">•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab("security")}
                className="hover:text-white transition-colors"
              >
                Architecture & Sécurité
              </button>
            </div>
          </div>

          <div className="mt-8 border-t border-white/5 pt-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
            <span>© 2026 Ecom COD Inc. Tous droits réservés.</span>
            <span>Conforme aux standards Meta Graph API v19.0 & RGPD</span>
          </div>
        </div>
      </footer>

      {/* Modale Légale / Confidentialité */}
      {legalModalTab && (
        <LegalPrivacyModal
          initialTab={legalModalTab}
          onClose={() => setLegalModalTab(null)}
        />
      )}
    </div>
  );
}
