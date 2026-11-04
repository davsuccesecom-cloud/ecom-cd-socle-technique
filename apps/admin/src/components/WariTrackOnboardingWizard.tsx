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
  Upload,
  Trash2,
  Info,
  ShieldAlert,
} from "lucide-react";
import { useTheme, ACCENT_PRESETS, type AccentColor } from "../hooks/useTheme";
import { getCountryMeta } from "./CountryMapBackdrop";
import WariTrackLogo from "./WariTrackLogo";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface WariTrackOnboardingWizardProps {
  workspaceId: string;
  adminEmail: string | null;
  onCompleted: (firstTeamId: string) => void;
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

export default function WariTrackOnboardingWizard({
  workspaceId,
  adminEmail,
  onCompleted,
}: WariTrackOnboardingWizardProps) {
  const { accent, setAccent, theme, setTheme } = useTheme();

  // Étape courante (1 à 4)
  // Ordre imposé : 1. Enseigne -> 2. Ambiance -> 3. Apps Employés -> 4. Création Équipe (Obligatoire)
  const [step, setStep] = useState<number>(1);

  // Étape 1 : Profil & Business
  const [brandName, setBrandName] = useState("");
  const [sector, setSector] = useState("cosmetics");
  const [volume, setVolume] = useState("growth");

  // Étape 2 : Environnement & Palette
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(accent);

  // Étape 3 : Marque Blanche Apps Employés (Vraies Icônes ou Vrai Logo)
  const [employeeNamingOption, setEmployeeNamingOption] = useState<"standard" | "action">("standard");
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [logoNotice, setLogoNotice] = useState<string | null>(null);

  // Étape 4 (DERNIÈRE POSITION - IMPÉRATIF COCKPIT) : 1er Marché Pays & Équipe
  const westCountries = AFRICA_COUNTRIES.filter((c) => c.region === "ouest");
  const [country, setCountry] = useState(westCountries[0]?.code || "CI");
  const [teamName, setTeamName] = useState(`Équipe ${westCountries[0]?.name || "Côte d'Ivoire"}`);
  const [remunCloseuse, setRemunCloseuse] = useState("500");
  const [remunLivreur, setRemunLivreur] = useState("1500");
  const [deliveryTarget, setDeliveryTarget] = useState(85);

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setLogoNotice(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Format d'image non reconnu (sélectionnez PNG, JPG ou WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Taille d'image supérieure à 2 Mo. Recommandé : logo carré 512×512 px.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomLogoUrl(reader.result as string);
      setLogoNotice("Logo importé avec succès pour vos applications livreur et closeuse !");
    };
    reader.readAsDataURL(file);
  };

  // Validation finale & enregistrement dans Firestore à l'étape 4
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
          customLogoUrl: customLogoUrl,
          useNativeIcons: !customLogoUrl,
        },
        thresholdAdaptation: {
          autoTuneDeliveryRate: true,
          deliveryRateThreshold: deliveryTarget,
          autoTuneClosingSpeed: true,
          closingDelayMinutes: 30,
          positiveCashProtection: true,
          updatedAt: Date.now(),
        },
        onboardingCompleted: true,
        updatedAt: Date.now(),
      });

      // 2. Création obligatoire de la 1ère équipe locale de livraison
      const teamsCol = collection(db, "workspaces", workspaceId, "teams");
      const teamRef = await addDoc(teamsCol, {
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

  const displayBrand = brandName.trim() || "Ma Boutique";
  const closeuseLabel =
    employeeNamingOption === "standard" ? `${displayBrand} • Closeuse` : `${displayBrand} • Ventes`;
  const livreurLabel =
    employeeNamingOption === "standard" ? `${displayBrand} • Livreur` : `${displayBrand} • Tournées`;

  const STEP_TITLES = [
    "Identité de l'Enseigne",
    "Ambiance Visuelle",
    "Apps Employés",
    "Création de l'Équipe",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Conteneur Principal en Pop-up avec Coins Arrondis et Ombre Douce */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-surface-border bg-surface-raised p-6 sm:p-8 shadow-2xl my-auto">
        
        {/* En-tête Wizard avec Logo Officiel WariTrack, Progression & Étape */}
        <div className="mb-6 border-b border-surface-border pb-5">
          <div className="flex items-center justify-between gap-3">
            <WariTrackLogo size="md" variant="full" roundedBadge subtitle="Configuration Initiale Cockpit" />
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-mono font-bold border ${
                  step === 4
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-500 dark:text-amber-400"
                    : "bg-brand/10 border-brand/20 text-brand"
                }`}
              >
                {step === 4 ? "Étape 4 / 4 · Déploiement Équipe" : `Étape ${step} sur 4`}
              </span>
            </div>
          </div>

          {/* Barre de progression fluide avec libellés */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    i < step
                      ? "bg-brand"
                      : i === step
                      ? "bg-brand ring-2 ring-brand/30"
                      : "bg-surface-border"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-semibold text-slate-500 px-0.5">
              {STEP_TITLES.map((t, idx) => (
                <span
                  key={idx}
                  className={idx + 1 === step ? "text-brand font-bold" : "text-slate-500"}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {logoNotice && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{logoNotice}</span>
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 1 : PROFIL DE L'ENSEIGNE & VOLUMÉTRIE
            ==================================================================== */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand mb-2">
                <Store className="h-3 w-3" /> Identité Opérationnelle
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Bienvenue sur WariTrack
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Configurez l'identité de votre enseigne pour calibrer le poste de pilotage selon votre volume de commandes.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Nom commercial de votre boutique / enseigne e-commerce
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Ex : Kossi Store, Sahel Express, BelleAfrik..."
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Secteur d'activité principal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUSINESS_SECTORS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSector(s.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        sector === s.id
                          ? "border-brand bg-brand-light ring-1 ring-brand"
                          : "border-surface-border bg-surface hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{s.label}</span>
                        {sector === s.id && <Check className="h-3.5 w-3.5 text-brand" />}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Volume mensuel moyen de commandes COD traitées
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MONTHLY_VOLUMES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVolume(v.id)}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        volume === v.id
                          ? "border-brand bg-brand-light ring-1 ring-brand"
                          : "border-surface-border bg-surface hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{v.label}</span>
                        {volume === v.id && <Check className="h-3.5 w-3.5 text-brand" />}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">{v.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 2 : PALETTE & AMBIANCE DU POSTE DE PILOTAGE
            ==================================================================== */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand mb-2">
                <Palette className="h-3 w-3" /> Ambiance Visuelle
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Personnalisez votre Poste de Pilotage
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Sélectionnez votre univers chromatique. Vous pourrez alterner entre mode sombre et clair à tout instant.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Palette d'accentuation (6 univers professionnels)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ACCENT_PRESETS.map((p) => {
                    const isSelected = selectedAccent === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePaletteSelect(p.id)}
                        className={`rounded-2xl border p-3.5 text-left transition ${
                          isSelected
                            ? "border-brand bg-brand-light ring-1 ring-brand shadow-md"
                            : "border-surface-border bg-surface hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="h-4 w-4 rounded-full shadow-sm ring-1 ring-white/20"
                            style={{ backgroundColor: p.swatch }}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{p.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug">{p.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Mode jour / nuit
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`rounded-xl border p-3 text-left transition flex items-center justify-between ${
                      theme === "dark"
                        ? "border-brand bg-brand-light ring-1 ring-brand"
                        : "border-surface-border bg-surface hover:border-slate-500"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">🌙 Mode Nuit (Recommandé)</span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400">Ardoise &amp; contraste élevé</span>
                    </div>
                    {theme === "dark" && <Check className="h-4 w-4 text-brand" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`rounded-xl border p-3 text-left transition flex items-center justify-between ${
                      theme === "light"
                        ? "border-brand bg-brand-light ring-1 ring-brand"
                        : "border-surface-border bg-surface hover:border-slate-500"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">☀️ Mode Jour</span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400">Fond crème / blanc cassé</span>
                    </div>
                    {theme === "light" && <Check className="h-4 w-4 text-brand" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 3 : APPS EMPLOYÉS (VRAIES ICÔNES NATIVES OU LOGO)
            ==================================================================== */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand mb-2">
                <Smartphone className="h-3 w-3" /> Applications Closeuse &amp; Livreur
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Vos applications d'équipe terrain
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Par défaut, vos employés conservent les <strong>vraies icônes natives WariTrack</strong> familières. Vous pouvez également importer votre propre logo.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Option A : Vraies Icônes Natives (Recommandé) */}
              <div
                onClick={() => setCustomLogoUrl(null)}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  !customLogoUrl
                    ? "border-brand bg-brand-light ring-1 ring-brand shadow-sm"
                    : "border-surface-border bg-surface hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <img
                        src="/icons/app-closeuse-native.png"
                        alt="Icône Native Closeuse"
                        className="h-11 w-11 rounded-xl object-cover shadow-md border border-white/10"
                      />
                      <img
                        src="/icons/app-livreur-native.png"
                        alt="Icône Native Livreur"
                        className="h-11 w-11 rounded-xl object-cover shadow-md border border-white/10"
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Icônes Officielles Natives (Recommandé par défaut)
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Conserve les icônes réelles familières du livreur en moto et de la closeuse au casque.
                      </p>
                    </div>
                  </div>
                  {!customLogoUrl && <Check className="h-4 w-4 text-brand shrink-0" />}
                </div>
              </div>

              {/* Option B : Téléversement du Vrai Logo de la Marque */}
              <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-brand" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Ou téléverser le vrai logo de votre marque
                    </h4>
                  </div>
                  {customLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomLogoUrl(null)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" />
                      Revenir aux icônes natives
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-300">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Recommandations Graphiques pour Smartphones</span>
                  </div>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5">
                    <li><strong>Format idéal</strong> : Carré <code>512 × 512 px</code> (ratio 1:1)</li>
                    <li><strong>Fichier</strong> : PNG avec transparence ou JPG / WebP net (max 2 Mo)</li>
                  </ul>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="wizard-logo-upload"
                  />
                  <label
                    htmlFor="wizard-logo-upload"
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-surface-border bg-surface-raised p-4 cursor-pointer hover:border-brand hover:bg-surface-subtle transition"
                  >
                    {customLogoUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={customLogoUrl}
                          alt="Logo entreprise"
                          className="h-12 w-12 rounded-xl object-contain border border-white/20 bg-slate-900 p-1 shadow-md"
                        />
                        <div className="text-left">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">✓ Logo d'entreprise chargé</span>
                          <span className="text-[10px] text-slate-500">Cliquez pour remplacer par une autre image</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                          <Upload className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Sélectionner votre logo (PNG, JPG, WebP)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Glissez-déposez ou cliquez ici pour parcourir
                        </span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Aperçu Réaliste Smartphone */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Aperçu sur l'écran d'accueil du smartphone
                  </span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                    {customLogoUrl ? "Marque Entreprise" : "Icônes Natives"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                  {/* Closeuse Card */}
                  <div className="flex flex-col items-center rounded-2xl border border-surface-border bg-surface p-3 text-center">
                    <div className="relative h-14 w-14 rounded-2xl overflow-hidden shadow-md border border-white/10 bg-slate-900">
                      <img
                        src={customLogoUrl || "/icons/app-closeuse-native.png"}
                        alt="Closeuse"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-2 truncate max-w-[130px] block">
                      {closeuseLabel}
                    </span>
                    <span className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      WhatsApp 1-Clic
                    </span>
                  </div>

                  {/* Livreur Card */}
                  <div className="flex flex-col items-center rounded-2xl border border-surface-border bg-surface p-3 text-center">
                    <div className="relative h-14 w-14 rounded-2xl overflow-hidden shadow-md border border-white/10 bg-slate-900">
                      <img
                        src={customLogoUrl || "/icons/app-livreur-native.png"}
                        alt="Livreur"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-sky-400 ring-2 ring-slate-900" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-2 truncate max-w-[130px] block">
                      {livreurLabel}
                    </span>
                    <span className="text-[9.5px] font-semibold text-sky-600 dark:text-sky-400 mt-0.5">
                      Feuille de Route
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            ÉTAPE 4 (DERNIÈRE POSITION - IMPÉRATIF DU POSTE DE PILOTAGE) :
            CRÉATION DE L'ÉQUIPE LOCALE & 1ER MARCHÉ PAYS
            ==================================================================== */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-500 dark:text-amber-400 mb-2">
                <Globe2 className="h-3 w-3" /> Étape Finale Impérative
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Déployez votre premier marché pays
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Le poste de pilotage requiert au moins un marché pour synchroniser vos commandes, caisses et tournées.
              </p>
            </div>

            {/* Alerte explicative : Sans équipe, rien à faire */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong className="text-slate-900 dark:text-white font-bold">Impératif de mise en service :</strong> Sans marché pays actif, les closeuses et livreurs ne peuvent pas opérer. Cette étape initialise votre équipe et active immédiatement votre Cockpit.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Pays / Territoire d'opération principal
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
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
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  Nom de l'équipe locale
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tarif Livreur par colis livré ({countryMeta.currency})
                  </label>
                  <input
                    type="number"
                    value={remunLivreur}
                    onChange={(e) => setRemunLivreur(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Moyenne terrain : 1 500 à 2 000 {countryMeta.currency}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commission Closeuse par colis livré ({countryMeta.currency})
                  </label>
                  <input
                    type="number"
                    value={remunCloseuse}
                    onChange={(e) => setRemunCloseuse(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Moyenne terrain : 500 à 1 000 {countryMeta.currency}</span>
                </div>
              </div>

              {/* Objectif de Livraison Réelle */}
              <div className="rounded-2xl border border-surface-border bg-surface p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
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
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  WariTrack adapte automatiquement les tournées sans blocage punitif dès que la tournée approche ce seuil.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            PIED DE PAGE AVEC NAVIGATION ÉTAPE PAR ÉTAPE (DÉFILEMENT NATUREL)
            ==================================================================== */}
        <div className="mt-8 flex items-center justify-between border-t border-surface-border pt-6">
          <div className="flex items-center gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-surface-subtle transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </button>
            ) : null}

            {/* Bouton Passer (ne quitte JAMAIS le wizard : il fait simplement défiler vers la question suivante !) */}
            {step < 4 && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline-offset-4 hover:underline transition px-2 py-1"
                title="Passer cette question avec les valeurs recommandées"
              >
                Passer cette question
              </button>
            )}
          </div>

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
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-indigo-600 px-7 py-3 text-sm font-black text-white shadow-xl shadow-brand/30 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
            >
              {loading ? (
                "Déploiement de votre Équipe & Cockpit…"
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Créer mon Équipe &amp; Activer le Cockpit
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
