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
  Package,
  Layers,
  Palette,
} from "lucide-react";
import { DEFAULT_EMPLOYEE_BADGES } from "./WariTrackOnboardingWizard";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface WhiteLabelSettingsProps {
  workspaceId: string;
}

export default function WhiteLabelSettings({ workspaceId }: WhiteLabelSettingsProps) {
  const [brandName, setBrandName] = useState("");
  const [namingOption, setNamingOption] = useState<"standard" | "action" | "custom">("standard");
  const [customCloseuseTitle, setCustomCloseuseTitle] = useState("");
  const [customLivreurTitle, setCustomLivreurTitle] = useState("");
  const [selectedBadge, setSelectedBadge] = useState("default_native");
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [closeuseColor, setCloseuseColor] = useState("#10B981");
  const [livreurColor, setLivreurColor] = useState("#06B6D4");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setSelectedBadge(wl.badgeId || "default_native");
          setCustomLogoUrl(wl.customLogoUrl || null);
          if (wl.closeuseColor) setCloseuseColor(wl.closeuseColor);
          if (wl.livreurColor) setLivreurColor(wl.livreurColor);
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

  const activeBadgeObj =
    DEFAULT_EMPLOYEE_BADGES.find((b) => b.id === selectedBadge) || DEFAULT_EMPLOYEE_BADGES[0];

  // Sauvegarde
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
        "whiteLabel.badgeId": selectedBadge,
        "whiteLabel.customLogoUrl": customLogoUrl,
        "whiteLabel.closeuseColor": closeuseColor,
        "whiteLabel.livreurColor": livreurColor,
        "whiteLabel.updatedAt": Date.now(),
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

  // Upload simulé logo (ou data URL)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Chargement des paramètres de marque blanche…
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
              Cette option permet de personnaliser <strong>exclusivement les applications mobiles de vos employés</strong> (Closeuse et Livreur). Le Cockpit Admin reste le socle central WariTrack. Par défaut, les icônes officielles familières restent actives tant que vous ne définissez pas de logo propre.
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
                Enregistrer la Marque
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonne Gauche : Formulaire de Configuration */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. Nom commercial de la marque */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Identité de l'Enseigne
            </h4>
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Nom de votre marque (affiché à vos employés)
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
                Format de nom sous l'icône du smartphone
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

          {/* 2. Choix de l'Insigne ou Upload Logo */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Insigne Graphique de vos Employés
            </h4>

            {/* Badges par défaut */}
            <div>
              <span className="block text-xs font-semibold text-slate-200 mb-2">
                A. Choisir un insigne officiel par défaut
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DEFAULT_EMPLOYEE_BADGES.map((b) => {
                  const isSelected = selectedBadge === b.id && !customLogoUrl;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBadge(b.id);
                        setCustomLogoUrl(null);
                      }}
                      className={`rounded-xl border p-3 flex flex-col items-center text-center transition ${
                        isSelected
                          ? "border-brand bg-brand-light shadow-md ring-1 ring-brand"
                          : "border-surface-border bg-surface hover:border-slate-600"
                      }`}
                    >
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm mb-2 shadow"
                        style={{ backgroundColor: b.bg, color: b.color, borderColor: b.color, borderWidth: 1 }}
                      >
                        {displayBrand[0]?.toUpperCase() || "W"}
                      </div>
                      <span className="text-[11px] font-bold text-slate-100 leading-tight">{b.label}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{b.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ou Upload de Logo propre */}
            <div className="pt-2 border-t border-surface-border">
              <span className="block text-xs font-semibold text-slate-200 mb-2">
                B. Ou téléverser le logo de votre entreprise (PNG / JPG)
              </span>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-dashed border-surface-border bg-surface px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-brand hover:text-white transition">
                  <Upload className="h-4 w-4 text-brand" />
                  Sélectionner une image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>

                {customLogoUrl && (
                  <div className="flex items-center gap-2.5">
                    <img
                      src={customLogoUrl}
                      alt="Logo personnalisé"
                      className="h-9 w-9 rounded-lg object-cover border border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomLogoUrl(null)}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Colonne Droite : Simulateur Écran Smartphone Live */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="rounded-3xl bg-[#07090e] border-4 border-slate-800 p-5 shadow-2xl relative max-w-xs mx-auto">
            {/* Barre de status téléphone */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-4 pb-2 border-b border-slate-800 font-mono">
              <span>09:41</span>
              <div className="flex items-center gap-1">
                <span>5G</span>
                <span className="w-4 h-2 border border-slate-500 rounded-sm inline-block"></span>
              </div>
            </div>

            <div className="text-center py-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Écran d'Accueil de l'Employé
              </span>
              <span className="text-[9px] text-slate-500">Aperçu en temps réel</span>
            </div>

            {/* Grille d'icônes simulée sur le téléphone */}
            <div className="grid grid-cols-2 gap-4 my-6">
              
              {/* Icône App Closeuse */}
              <div className="flex flex-col items-center text-center group cursor-default">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center p-2.5 shadow-xl relative overflow-hidden border"
                  style={{
                    backgroundColor: activeBadgeObj.bg,
                    borderColor: activeBadgeObj.color,
                  }}
                >
                  {customLogoUrl ? (
                    <img src={customLogoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="font-black text-xl" style={{ color: activeBadgeObj.color }}>
                      {displayBrand[0]?.toUpperCase() || "W"}
                    </span>
                  )}
                  {/* Petit badge vert closeuse */}
                  <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900"></span>
                </div>
                <span className="text-[11px] font-bold text-slate-100 mt-2 block truncate max-w-[110px]">
                  {closeuseTitle}
                </span>
                <span className="text-[9px] text-emerald-400 font-mono">WhatsApp 1-Clic</span>
              </div>

              {/* Icône App Livreur */}
              <div className="flex flex-col items-center text-center group cursor-default">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center p-2.5 shadow-xl relative overflow-hidden border"
                  style={{
                    backgroundColor: activeBadgeObj.bg,
                    borderColor: activeBadgeObj.color,
                  }}
                >
                  {customLogoUrl ? (
                    <img src={customLogoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="font-black text-xl" style={{ color: activeBadgeObj.color }}>
                      {displayBrand[0]?.toUpperCase() || "W"}
                    </span>
                  )}
                  {/* Petit badge bleu livreur */}
                  <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-sky-400 border border-slate-900"></span>
                </div>
                <span className="text-[11px] font-bold text-slate-100 mt-2 block truncate max-w-[110px]">
                  {livreurTitle}
                </span>
                <span className="text-[9px] text-sky-400 font-mono">Feuille de Route</span>
              </div>

            </div>

            {/* Note discrète */}
            <div className="pt-3 border-t border-slate-800/80 text-center">
              <span className="text-[9px] text-slate-500 font-mono">
                Propulsé par le socle WariTrack OS
              </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
