import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";
import {
  Store,
  Palette,
  Globe2,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Package,
  Layers,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useTheme, ACCENT_PRESETS, type AccentColor } from "../hooks/useTheme";
import CountryMapBackdrop, { getCountryMeta } from "./CountryMapBackdrop";
import WariTrackLogo from "./WariTrackLogo";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface WariTrackOnboardingWizardProps {
  workspaceId: string;
  adminEmail: string | null;
  onCompleted: (firstTeamId: string) => void;
  onSkip?: () => void;
}

const BUSINESS_SECTORS = [
  { id: "cosmetics", label: "Beauté & Cosmétique", desc: "Soins, crèmes, sérums, blanchiment" },
  { id: "tech", label: "Tech, Gadgets & Électronique", desc: "Montres, écouteurs, accessoires auto" },
  { id: "health", label: "Santé & Bien-être", desc: "Thés minceur, compléments, massage" },
  { id: "fashion", label: "Mode, Sacs & Chaussures", desc: "Prêt-à-porter, sneakers, bijoux" },
  { id: "general", label: "Boutique Multi-Produits", desc: "Catalogue généraliste test & scale" },
];

const MONTHLY_VOLUMES = [
  { id: "starter", label: "50 à 250 colis / mois", desc: "Démarrage & validation d'offres" },
  { id: "growth", label: "250 à 1 000 colis / mois", desc: "Phase de scale avec 1 ou 2 livreurs" },
  { id: "scale", label: "1 000 à 3 000 colis / mois", desc: "Équipe closeuses + stock multi-pays" },
  { id: "enterprise", label: "Plus de 3 000 colis / mois", desc: "Gros volume, multi-boutiques Shopify" },
];

export const DEFAULT_EMPLOYEE_BADGES = [
  {
    id: "emerald_pulse",
    label: "Wari Émeraude & Or",
    desc: "Cash & Prospérité",
    color: "#10B981",
    bg: "#081510",
  },
  {
    id: "cyan_radar",
    label: "Colis Radar Cyan",
    desc: "Tracking & Vitesse",
    color: "#06B6D4",
    bg: "#07121E",
  },
  {
    id: "indigo_vault",
    label: "Bouclier Saphir",
    desc: "Sécurité & Rapprochement",
    color: "#6366F1",
    bg: "#090C15",
  },
  {
    id: "cacao_gold",
    label: "Terre d'Afrique & Cuivre",
    desc: "Chaleur & Proximité",
    color: "#D4874D",
    bg: "#18110C",
  },
];

export default function WariTrackOnboardingWizard({
  workspaceId,
  adminEmail,
  onCompleted,
  onSkip,
}: WariTrackOnboardingWizardProps) {
  const { accent, setAccent, theme, setTheme } = useTheme();

  // Étape courante (1 à 4)
  const [step, setStep] = useState<number>(1);

  // Étape 1 : Profil & Business
  const [brandName, setBrandName] = useState("");
  const [sector, setSector] = useState("cosmetics");
  const [volume, setVolume] = useState("growth");

  // Étape 2 : Environnement & Palette
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(accent);

  // Étape 3 : 1er Marché Pays
  const westCountries = AFRICA_COUNTRIES.filter((c) => c.region === "ouest");
  const [country, setCountry] = useState(westCountries[0].code);
  const [teamName, setTeamName] = useState(`Équipe ${westCountries[0].name}`);
  const [remunCloseuse, setRemunCloseuse] = useState("500");
  const [remunLivreur, setRemunLivreur] = useState("1500");
  const [deliveryTarget, setDeliveryTarget] = useState(85);

  // Étape 4 : Marque Blanche Apps Employés
  const [employeeNamingOption, setEmployeeNamingOption] = useState<"standard" | "action">("standard");
  const [selectedBadge, setSelectedBadge] = useState("emerald_pulse");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countryMeta = getCountryMeta(country);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    const cObj = AFRICA_COUNTRIES.find((c) => c.code === code);
    if (cObj && (!teamName || teamName.startsWith("Équipe "))) {
      setTeamName(`Équipe ${cObj.name}`);
    }
  };

  const handlePaletteSelect = (newAccent: AccentColor) => {
    setSelectedAccent(newAccent);
    setAccent(newAccent);
  };

  // Validation finale & enregistrement dans Firestore
  const handleFinalize = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getDb();
      const finalBrand = brandName.trim() || "Ma Marque";

      // 1. Mise à jour du workspace (Profil, White-label, Personnalisation)
      const workspaceRef = doc(db, "workspaces", workspaceId);
      await updateDoc(workspaceRef, {
        name: finalBrand,
        businessSector: sector,
        monthlyVolume: volume,
        accent: selectedAccent,
        deliveryTarget,
        whiteLabel: {
          brandName: finalBrand,
          namingOption: employeeNamingOption,
          closeuseTitle:
            employeeNamingOption === "standard"
              ? `${finalBrand} • Closeuse`
              : `${finalBrand} • Ventes`,
          livreurTitle:
            employeeNamingOption === "standard"
              ? `${finalBrand} • Livreur`
              : `${finalBrand} • Tournées`,
          badgeId: selectedBadge,
        },
        onboardingCompleted: true,
        updatedAt: Date.now(),
      });

      // 2. Création de la première équipe marché pays
      const teamRef = await addDoc(collection(db, "workspaces", workspaceId, "teams"), {
        workspaceId,
        name: teamName.trim() || `Équipe ${countryMeta.name}`,
        sheetIds: [],
        defaultCountry: country,
        currency: countryMeta.currency,
        remunerationCloseusePerOrder: Number(remunCloseuse) || 500,
        remunerationLivreurPerOrder: Number(remunLivreur) || 1500,
        maxClosseuses: 15,
        maxLivreurs: 20,
        reminderWindowStart: "07:00",
        reminderWindowEnd: "22:00",
        overloadAlertThreshold: 25,
        digestIntervalMinutes: 120,
        createdAt: Date.now(),
      });

      onCompleted(teamRef.id);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-2xl py-6 sm:py-10">
      {/* Conteneur Principal façon Shopify Plus */}
      <div className="relative overflow-hidden rounded-3xl border border-surface-border bg-surface-raised p-6 sm:p-10 shadow-2xl">
        
        {/* En-tête Wizard avec Logo Officiel WariTrack & Progression */}
        <div className="mb-8 border-b border-surface-border pb-6">
          <div className="flex items-center justify-between">
            <WariTrackLogo size="md" variant="full" subtitle="Configuration Initiale Cockpit" />
            <span className="text-xs font-mono font-bold text-brand">
              Étape {step} sur 4
            </span>
          </div>

          {/* Barre de progression fluide */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < step
                    ? "bg-brand"
                    : i === step
                    ? "bg-brand animate-pulse"
                    : "bg-surface-border"
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 1 : PROFIL & AMBITION BUSINESS
            ==================================================================== */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand mb-2">
                <Sparkles className="h-3 w-3" /> Personnalisation de votre expérience
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                Parlez-nous de votre boutique e-commerce
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                WariTrack calibre vos seuils d'alertes, ratios de caisse et commissions selon votre secteur.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Nom commercial de votre marque / enseigne
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Ex : BelleAfrik, Kossi Store, Sahel Express..."
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Votre secteur principal de vente
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BUSINESS_SECTORS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSector(s.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        sector === s.id
                          ? "border-brand bg-brand-light shadow-sm"
                          : "border-surface-border bg-surface hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100">{s.label}</span>
                        {sector === s.id && <Check className="h-3.5 w-3.5 text-brand" />}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-tight">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Volume de commandes COD mensuel estimé
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MONTHLY_VOLUMES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVolume(v.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        volume === v.id
                          ? "border-brand bg-brand-light shadow-sm"
                          : "border-surface-border bg-surface hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100">{v.label}</span>
                        {volume === v.id && <Check className="h-3.5 w-3.5 text-brand" />}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-tight">{v.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 2 : ENVIRONNEMENT & PALETTE SIGNATURE
            ==================================================================== */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand mb-2">
                <Palette className="h-3 w-3" /> Ambiance de Travail
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                Personnalisez la couleur de votre Cockpit
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                La palette choisie s'applique immédiatement en direct sur votre interface et colore le logo WariTrack.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = selectedAccent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePaletteSelect(preset.id)}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-brand bg-brand-light shadow-md ring-1 ring-brand"
                        : "border-surface-border bg-surface hover:border-slate-600"
                    }`}
                  >
                    <span
                      className="mt-0.5 h-6 w-6 shrink-0 rounded-lg shadow-sm border border-white/20"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100">{preset.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand" />}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                        {preset.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Aperçu Dynamique de la Palette */}
            <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <WariTrackLogo size="sm" variant="icon" />
                <div>
                  <span className="text-xs font-bold text-slate-100 block">
                    Aperçu du Logo & des Cartes en direct
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Palette active : {ACCENT_PRESETS.find((p) => p.id === selectedAccent)?.label}
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand text-white shadow-sm">
                Bouton Signature
              </span>
            </div>
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 3 : 1ER MARCHÉ PAYS & OBJECTIF
            ==================================================================== */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand mb-2">
                <Globe2 className="h-3 w-3" /> Territoire de Livraison
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                Déployez votre premier marché pays
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Vous pourrez ajouter autant de pays supplémentaires que vous souhaitez par la suite.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Pays / Marché principal
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-brand"
                >
                  <optgroup label="Afrique de l'Ouest (UEMOA)">
                    {AFRICA_COUNTRIES.filter((c) => c.region === "ouest").map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({getCountryMeta(c.code).currency})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Afrique Centrale & Autres">
                    {AFRICA_COUNTRIES.filter((c) => c.region !== "ouest").map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({getCountryMeta(c.code).currency})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Nom de l'équipe locale
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tarif Livreur par colis livré ({countryMeta.currency})
                  </label>
                  <input
                    type="number"
                    value={remunLivreur}
                    onChange={(e) => setRemunLivreur(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm font-mono text-slate-100 outline-none focus:border-brand"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Moyenne terrain : 1 500 à 2 000 FCFA</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Commission Closeuse par colis livré ({countryMeta.currency})
                  </label>
                  <input
                    type="number"
                    value={remunCloseuse}
                    onChange={(e) => setRemunCloseuse(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm font-mono text-slate-100 outline-none focus:border-brand"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Moyenne terrain : 500 à 1 000 FCFA</span>
                </div>
              </div>

              {/* Objectif de Livraison Réelle */}
              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Objectif de Taux de Livraison Cible
                  </span>
                  <span className="font-mono font-bold text-brand text-sm">{deliveryTarget} %</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={deliveryTarget}
                  onChange={(e) => setDeliveryTarget(Number(e.target.value))}
                  className="mt-3 w-full accent-brand cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  WariTrack déclenchera des alertes intelligentes dès que le taux de livraison de la tournée passe sous ce seuil.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 4 : MARQUE BLANCHE APPS EMPLOYÉS
            ==================================================================== */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand mb-2">
                <Smartphone className="h-3 w-3" /> Fierté d'Entreprise
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                Personnalisez les applications de votre équipe
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Sur le smartphone de vos livreurs et closeuses, l'application portera le nom et le badge de votre enseigne.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Format de Nommage affiché sous l'icône smartphone
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEmployeeNamingOption("standard")}
                    className={`rounded-xl border p-3 text-left transition ${
                      employeeNamingOption === "standard"
                        ? "border-brand bg-brand-light shadow-sm"
                        : "border-surface-border bg-surface hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">Rôles Directs (Recommandé)</span>
                      {employeeNamingOption === "standard" && <Check className="h-3.5 w-3.5 text-brand" />}
                    </div>
                    <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-300">
                      <p>📱 {brandName.trim() || "Ma Marque"} • Closeuse</p>
                      <p>🛵 {brandName.trim() || "Ma Marque"} • Livreur</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmployeeNamingOption("action")}
                    className={`rounded-xl border p-3 text-left transition ${
                      employeeNamingOption === "action"
                        ? "border-brand bg-brand-light shadow-sm"
                        : "border-surface-border bg-surface hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">Missions Métier</span>
                      {employeeNamingOption === "action" && <Check className="h-3.5 w-3.5 text-brand" />}
                    </div>
                    <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-300">
                      <p>📱 {brandName.trim() || "Ma Marque"} • Ventes</p>
                      <p>🛵 {brandName.trim() || "Ma Marque"} • Tournées</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-2">
                  Insigne officiel par défaut pour vos employés
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {DEFAULT_EMPLOYEE_BADGES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBadge(b.id)}
                      className={`rounded-xl border p-3 flex flex-col items-center text-center transition ${
                        selectedBadge === b.id
                          ? "border-brand bg-brand-light shadow-md ring-1 ring-brand"
                          : "border-surface-border bg-surface hover:border-slate-600"
                      }`}
                    >
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm mb-2 shadow"
                        style={{ backgroundColor: b.bg, color: b.color, borderColor: b.color, borderWidth: 1 }}
                      >
                        {(brandName.trim() || "W")[0]?.toUpperCase()}
                      </div>
                      <span className="text-[11px] font-bold text-slate-100 leading-tight">{b.label}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{b.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            PIED DE PAGE AVEC NAVIGATION
            ==================================================================== */}
        <div className="mt-8 flex items-center justify-between border-t border-surface-border pt-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-surface-subtle transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand/20 hover:opacity-95 transition"
            >
              Étape suivante
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-3 text-sm font-black text-white shadow-xl shadow-brand/30 hover:opacity-95 transition disabled:opacity-50"
            >
              {loading ? (
                "Déploiement de votre Cockpit…"
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Activer mon Cockpit WariTrack
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
