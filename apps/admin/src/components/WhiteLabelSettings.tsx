import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import {
  Smartphone,
  Sparkles,
  Upload,
  CheckCircle2,
  Save,
  Check,
  ShieldCheck,
  TrendingUp,
  Sliders,
  Trash2,
  Info,
  AlertTriangle,
  RefreshCw,
  PhoneCall,
  Truck,
} from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface WhiteLabelSettingsProps {
  workspaceId: string;
}

export default function WhiteLabelSettings({ workspaceId }: WhiteLabelSettingsProps) {
  const [brandName, setBrandName] = useState("");
  const [namingOption, setNamingOption] = useState<"standard" | "action" | "custom">("standard");
  const [customCloseuseTitle, setCustomCloseuseTitle] = useState("");
  const [customLivreurTitle, setCustomLivreurTitle] = useState("");
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

  // Règles d'adaptation automatique en cas de chute de seuil (Auto-Tuning)
  const [autoTuneDeliveryRate, setAutoTuneDeliveryRate] = useState(true);
  const [deliveryRateThreshold, setDeliveryRateThreshold] = useState("75");
  const [autoTuneClosingSpeed, setAutoTuneClosingSpeed] = useState(true);
  const [closingDelayMinutes, setClosingDelayMinutes] = useState("30");
  const [positiveCashProtection, setPositiveCashProtection] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Chargement des réglages existants
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const db = getDb();
        const snap = await getDoc(doc(db, "workspaces", workspaceId));
        if (snap.exists()) {
          const data = snap.data();
          const wl = data.whiteLabel || {};
          setBrandName(wl.brandName || data.name || "");
          setNamingOption(wl.namingOption || "standard");
          setCustomCloseuseTitle(wl.customCloseuseTitle || "");
          setCustomLivreurTitle(wl.customLivreurTitle || "");
          setCustomLogoUrl(wl.customLogoUrl || null);

          // Seuils & Adaptation automatique
          const ad = data.thresholdAdaptation || {};
          if (typeof ad.autoTuneDeliveryRate === "boolean") setAutoTuneDeliveryRate(ad.autoTuneDeliveryRate);
          if (ad.deliveryRateThreshold) setDeliveryRateThreshold(String(ad.deliveryRateThreshold));
          if (typeof ad.autoTuneClosingSpeed === "boolean") setAutoTuneClosingSpeed(ad.autoTuneClosingSpeed);
          if (ad.closingDelayMinutes) setClosingDelayMinutes(String(ad.closingDelayMinutes));
          if (typeof ad.positiveCashProtection === "boolean") setPositiveCashProtection(ad.positiveCashProtection);
        }
      } catch (err) {
        console.error("Erreur chargement marque blanche:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [workspaceId]);

  // Titres calculés en direct pour le simulateur
  const displayBrand = brandName.trim() || "Ma Boutique";
  const closeuseTitle =
    namingOption === "custom" && customCloseuseTitle.trim()
      ? customCloseuseTitle.trim()
      : namingOption === "action"
      ? `${displayBrand} • Ventes`
      : `${displayBrand} • Closeuse`;

  const livreurTitle =
    namingOption === "custom" && customLivreurTitle.trim()
      ? customLivreurTitle.trim()
      : namingOption === "action"
      ? `${displayBrand} • Tournées`
      : `${displayBrand} • Livreur`;

  // Gestion positive de l'upload d'image avec vérification stricte
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUploadNotice(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validation positive du format
    if (!file.type.startsWith("image/")) {
      setError("Format non pris en charge. Veuillez sélectionner une image au format PNG, JPG ou WebP.");
      return;
    }

    // 2. Validation positive de la taille (max 2 Mo)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image trop volumineuse (taille max : 2 Mo). Privilégiez un logo carré 512×512 px optimisé pour une installation rapide sur les smartphones de vos équipes.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomLogoUrl(reader.result as string);
      setUploadNotice("Logo personnalisé chargé avec succès ! Vous pouvez observer le rendu direct sur les deux smartphones à droite.");
    };
    reader.onerror = () => {
      setError("Erreur lors de la lecture du fichier. Vos icônes par défaut restent actives sans interruption.");
    };
    reader.readAsDataURL(file);
  };

  const handleResetToNative = () => {
    setCustomLogoUrl(null);
    setUploadNotice("Icônes d'origine de l'application Closeuse et Livreur rétablies par défaut.");
  };

  // Sauvegarde globale
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedSuccess(false);
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId), {
        "whiteLabel.brandName": displayBrand,
        "whiteLabel.namingOption": namingOption,
        "whiteLabel.customCloseuseTitle": customCloseuseTitle.trim(),
        "whiteLabel.customLivreurTitle": customLivreurTitle.trim(),
        "whiteLabel.closeuseTitle": closeuseTitle,
        "whiteLabel.livreurTitle": livreurTitle,
        "whiteLabel.customLogoUrl": customLogoUrl,
        "whiteLabel.useNativeIcons": !customLogoUrl,
        "whiteLabel.updatedAt": Date.now(),

        // Règles d'adaptation automatique en cas de chute de seuils
        "thresholdAdaptation.autoTuneDeliveryRate": autoTuneDeliveryRate,
        "thresholdAdaptation.deliveryRateThreshold": Number(deliveryRateThreshold) || 75,
        "thresholdAdaptation.autoTuneClosingSpeed": autoTuneClosingSpeed,
        "thresholdAdaptation.closingDelayMinutes": Number(closingDelayMinutes) || 30,
        "thresholdAdaptation.positiveCashProtection": positiveCashProtection,
        "thresholdAdaptation.updatedAt": Date.now(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Chargement des paramètres…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                <Sparkles className="h-3 w-3" /> Apps Employés Uniquement
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-300">
                ⭐ Option Plan Pro &amp; Entreprise
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              Personnalisation des Applications Closeuse &amp; Livreur
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-xl">
              Vos employés (Closeuse et Livreur) conservent <strong>par défaut leurs vraies icônes natives familières</strong>. Vous pouvez également importer le véritable logo de votre boutique pour afficher votre propre marque sur l'écran d'accueil de leurs téléphones.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand/20 hover:opacity-95 transition disabled:opacity-50 shrink-0"
          >
            {saving ? (
              "Enregistrement…"
            ) : savedSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                Enregistré !
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enregistrer la Configuration
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {uploadNotice && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{uploadNotice}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonne Gauche : Formulaire de Configuration */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. Nom commercial de la boutique */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Identité de l'Enseigne
            </h4>
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Nom de votre boutique / marque (affiché à vos employés)
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Ex : BelleAfrik, Kossi Store, Sahel Express..."
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2">
                Format du libellé sous l'icône du smartphone
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setNamingOption("standard")}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    namingOption === "standard"
                      ? "border-brand bg-brand-light shadow-sm"
                      : "border-surface-border bg-surface hover:border-slate-600"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-100 block">Rôles Directs</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {displayBrand} • Closeuse<br/>{displayBrand} • Livreur
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNamingOption("action")}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    namingOption === "action"
                      ? "border-brand bg-brand-light shadow-sm"
                      : "border-surface-border bg-surface hover:border-slate-600"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-100 block">Missions Métier</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {displayBrand} • Ventes<br/>{displayBrand} • Tournées
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNamingOption("custom")}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    namingOption === "custom"
                      ? "border-brand bg-brand-light shadow-sm"
                      : "border-surface-border bg-surface hover:border-slate-600"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-100 block">100% Sur-mesure</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Personnalisation libre</span>
                </button>
              </div>
            </div>

            {namingOption === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Titre App Closeuse
                  </label>
                  <input
                    type="text"
                    value={customCloseuseTitle}
                    onChange={(e) => setCustomCloseuseTitle(e.target.value)}
                    placeholder="Ex: Mon Equipe Ventes"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Titre App Livreur
                  </label>
                  <input
                    type="text"
                    value={customLivreurTitle}
                    onChange={(e) => setCustomLivreurTitle(e.target.value)}
                    placeholder="Ex: Dispatch Dakar"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Icônes Réelles Natives ou Vrai Logo Entreprise (Pas de faux modèles T) */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Visuels des Applications Employés
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {customLogoUrl ? "Logo Entreprise actif" : "Icônes d'origine actives"}
              </span>
            </div>

            {/* Option A : Icônes d'origine réelles */}
            <div
              onClick={handleResetToNative}
              className={`cursor-pointer rounded-2xl border p-4 transition ${
                !customLogoUrl
                  ? "border-brand bg-brand-light ring-1 ring-brand"
                  : "border-surface-border bg-surface hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <img
                      src="/icons/app-closeuse-native.png"
                      alt="Closeuse Native"
                      className="h-10 w-10 rounded-xl object-cover shadow-sm border border-white/10"
                    />
                    <img
                      src="/icons/app-livreur-native.png"
                      alt="Livreur Native"
                      className="h-10 w-10 rounded-xl object-cover shadow-sm border border-white/10"
                    />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-100">
                      Icônes Officielles Natives (Recommandé par défaut)
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Conserve les vraies icônes natives familières de la Closeuse et du Livreur.
                    </p>
                  </div>
                </div>
                {!customLogoUrl && <Check className="h-4 w-4 text-brand shrink-0" />}
              </div>
            </div>

            {/* Option B : Téléversement du Vrai Logo de l'Entreprise */}
            <div className="rounded-2xl border border-surface-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-brand" />
                  <h5 className="text-xs font-bold text-slate-100">
                    Ou Téléverser le Vrai Logo de votre Entreprise
                  </h5>
                </div>
                {customLogoUrl && (
                  <button
                    type="button"
                    onClick={handleResetToNative}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:underline"
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer le logo
                  </button>
                )}
              </div>

              {/* Instructions techniques précises */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Recommandations Graphiques pour Smartphones</span>
                </div>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5 pt-1">
                  <li><strong>Format idéal</strong> : Carré <code>512 × 512 px</code> (ratio 1:1)</li>
                  <li><strong>Type de fichier</strong> : PNG avec fond transparent ou JPG / WebP haute résolution</li>
                  <li><strong>Taille maximale</strong> : Moins de 2 Mo pour un chargement instantané sans consommer la data mobile des livreurs</li>
                </ul>
              </div>

              {/* Zone d'upload réelle */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload-input"
                />
                <label
                  htmlFor="logo-upload-input"
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-surface-border bg-surface-raised p-5 cursor-pointer hover:border-brand hover:bg-surface-subtle transition"
                >
                  {customLogoUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={customLogoUrl}
                        alt="Logo personnalisé"
                        className="h-12 w-12 rounded-xl object-contain border border-white/20 bg-slate-900 p-1 shadow-md"
                      />
                      <div className="text-left">
                        <span className="text-xs font-bold text-emerald-400 block">
                          ✓ Logo d'entreprise chargé
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Cliquez pour remplacer par une autre image
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <Upload className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-200">
                        Sélectionner le logo de votre entreprise (PNG, JPG, WebP)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Glissez-déposez ou cliquez ici pour parcourir vos fichiers
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* 3. Gestion Positive des Erreurs & Adaptation Automatique en Cas de Chute de Seuil */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                    3. Adaptation Automatique en Cas de Chute de Seuil
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Gestion positive et constructive : WariTrack ajuste les flux sans bloquer vos opérations.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Auto-Tuning Actif
              </span>
            </div>

            <div className="space-y-3 pt-1">
              
              {/* Règle 1 : Taux de livraison */}
              <div className="rounded-xl border border-surface-border bg-surface p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-100">
                      Adaptation si Taux de Livraison &lt; {deliveryRateThreshold}%
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoTuneDeliveryRate}
                    onChange={(e) => setAutoTuneDeliveryRate(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Si le taux de livraison de la tournée chute sous {deliveryRateThreshold}%, WariTrack réorganise automatiquement les créneaux restants sur les heures de disponibilité confirmée des clients et alerte avec des conseils positifs plutôt que des blocages punitifs.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Seuil d'alerte :</span>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={deliveryRateThreshold}
                    onChange={(e) => setDeliveryRateThreshold(e.target.value)}
                    className="w-16 rounded-lg border border-surface-border bg-surface-raised px-2 py-1 text-xs text-slate-100 outline-none font-bold text-center"
                  />
                  <span className="text-[10px] text-slate-400">% de succès minimum</span>
                </div>
              </div>

              {/* Règle 2 : Délais de confirmation WhatsApp */}
              <div className="rounded-xl border border-surface-border bg-surface p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-100">
                      Redistribution des Appels si Attente &gt; {closingDelayMinutes} min
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoTuneClosingSpeed}
                    onChange={(e) => setAutoTuneClosingSpeed(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  En cas d'engorgement d'une closeuse (commandes non appelées depuis plus de {closingDelayMinutes} minutes), les nouvelles commandes entrantes sont automatiquement réparties vers les collaboratrices libres pour maximiser le taux de confirmation à chaud.
                </p>
              </div>

              {/* Règle 3 : Sécurisation Caisse Positive */}
              <div className="rounded-xl border border-surface-border bg-surface p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-100">
                      Pointage Caisse Constructif &amp; Anti-Litige
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={positiveCashProtection}
                    onChange={(e) => setPositiveCashProtection(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  En cas d'écart de caisse en fin de tournée, la prime est suspendue avec bienveillance en statut « En attente de pointage physique » sans bloquer les autres tournées du livreur, avec réconciliation immédiate en 1 clic dès validation de l'enveloppe.
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* Colonne Droite : Simulateur Smartphone en Direct */}
        <div className="lg:col-span-5 sticky top-6 space-y-3">
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-brand" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Simulateur d'Écran d'Accueil
                </h4>
              </div>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                Aperçu Réel
              </span>
            </div>

            {/* Cadre Smartphone Réaliste */}
            <div className="mx-auto max-w-[280px] rounded-[36px] border-[6px] border-slate-800 bg-[#07090E] p-4 shadow-2xl relative overflow-hidden text-center text-white min-h-[380px] flex flex-col justify-between">
              
              {/* Barre de statut du smartphone */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-0.5 mb-6">
                <span className="font-semibold">09:41</span>
                <div className="h-3 w-16 bg-slate-900 rounded-full mx-auto" />
                <span className="font-semibold">5G</span>
              </div>

              {/* Titre aperçu */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Écran d'accueil de vos employés
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  Raccourcis PWA installés
                </p>
              </div>

              {/* Les 2 Vraies Icônes sur l'écran du smartphone */}
              <div className="grid grid-cols-2 gap-4 my-6">
                
                {/* Icône Closeuse */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg relative border border-white/10 bg-slate-900 overflow-hidden">
                    {customLogoUrl ? (
                      <img
                        src={customLogoUrl}
                        alt="Logo Personnalisé Closeuse"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src="/icons/app-closeuse-native.png"
                        alt="Icône Closeuse d'Origine"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-100 mt-2 truncate max-w-[110px] block">
                    {closeuseTitle}
                  </span>
                  <span className="text-[8.5px] text-emerald-400 font-semibold block">
                    WhatsApp 1-Clic
                  </span>
                </div>

                {/* Icône Livreur */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg relative border border-white/10 bg-slate-900 overflow-hidden">
                    {customLogoUrl ? (
                      <img
                        src={customLogoUrl}
                        alt="Logo Personnalisé Livreur"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src="/icons/app-livreur-native.png"
                        alt="Icône Livreur d'Origine"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-sky-400 ring-2 ring-slate-900" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-100 mt-2 truncate max-w-[110px] block">
                    {livreurTitle}
                  </span>
                  <span className="text-[8.5px] text-sky-400 font-semibold block">
                    Feuille de Route
                  </span>
                </div>

              </div>

              {/* Bas du smartphone avec dock */}
              <div className="pt-4 border-t border-white/5 text-[9px] text-slate-500">
                Propulsé de manière transparente par le moteur WariTrack OS
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
