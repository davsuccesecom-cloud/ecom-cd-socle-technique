import { useState } from "react";
import type { AutoGeneratorInput } from "../../services/productAutoGenerator";
import { Sparkles, X, Wand2, ArrowRight, Zap, Globe, DollarSign } from "lucide-react";

interface AutoGeneratorModalProps {
  initialCountry?: string;
  initialCurrency?: string;
  onGenerate: (input: AutoGeneratorInput) => void;
  onClose: () => void;
}

export default function AutoGeneratorModal({
  initialCountry = "Sénégal",
  initialCurrency = "FCFA",
  onGenerate,
  onClose,
}: AutoGeneratorModalProps) {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("High-Tech & Accessoires");
  const [country, setCountry] = useState(initialCountry);
  const [currency, setCurrency] = useState(initialCurrency);
  const [promoPrice, setPromoPrice] = useState(19500);
  const [regularPrice, setRegularPrice] = useState(35000);
  const [keyBenefits, setKeyBenefits] = useState(
    "Appels Bluetooth clairs, batterie 7 jours, étanche IP68, suivi santé complet"
  );
  const [targetAudience, setTargetAudience] = useState(
    "Tous ceux qui veulent rester joignables et suivre leur forme sans recharger tous les soirs"
  );
  const [imageUrl, setImageUrl] = useState("");
  const [supportPhone, setSupportPhone] = useState("770000000");

  const categories = [
    "High-Tech & Accessoires",
    "Beauté & Bien-être",
    "Maison & Cuisine",
    "Santé & Forme",
    "Mode & Chaussures",
    "Auto & Moto",
    "Autre",
  ];

  const countries = [
    "Sénégal",
    "Côte d'Ivoire",
    "Cameroun",
    "Mali",
    "Guinée",
    "Gabon",
    "RDC",
  ];

  const handleCountryChange = (c: string) => {
    setCountry(c);
    if (c === "Guinée") setCurrency("GNF");
    else setCurrency("FCFA");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      alert("Veuillez saisir au moins le nom du produit.");
      return;
    }

    onGenerate({
      productName: productName.trim(),
      category,
      country,
      currency,
      promoPrice: Number(promoPrice),
      regularPrice: Number(regularPrice),
      keyBenefits: keyBenefits.trim(),
      targetAudience: targetAudience.trim(),
      imageUrl: imageUrl.trim(),
      supportPhone: supportPhone.trim(),
    });
    onClose();
  };

  // Exemples rapides préremplis (Templates 1-clic)
  const applyPreset = (presetType: "hightech" | "beaute" | "maison") => {
    if (presetType === "hightech") {
      setProductName("Montre Connectée Ultra Max Pro 2026");
      setCategory("High-Tech & Accessoires");
      setPromoPrice(19500);
      setRegularPrice(35000);
      setKeyBenefits("Décrochez au volant, batterie 7 jours, écran saphir anti-rayures, suivi cardio");
      setTargetAudience("Les automobilistes et personnes actives qui veulent rester joignables en sécurité");
    } else if (presetType === "beaute") {
      setProductName("Épilateur Laser Cristal MagicSkin");
      setCategory("Beauté & Bien-être");
      setPromoPrice(15000);
      setRegularPrice(28000);
      setKeyBenefits("Sans douleur, peau ultra lisse 4 semaines, ralentit la repousse, réutilisable 3 ans");
      setTargetAudience("Toutes les femmes qui en ont marre des rasoirs et des boutons de repousse");
    } else if (presetType === "maison") {
      setProductName("Défroisseur Vapeur Express Sans Fil");
      setCategory("Maison & Cuisine");
      setPromoPrice(22000);
      setRegularPrice(39000);
      setKeyBenefits("Défroisse en 30 secondes chrono, compact voyage, élimine 99% des odeurs, zéro brûlure");
      setTargetAudience("Ceux qui voyagent souvent et veulent des vêtements impeccables sans fer à repasser lourd");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand/15 text-brand border border-brand/30 flex items-center justify-center">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Générateur Automatique de Page Produit
                <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-black text-brand uppercase">
                  Mode Éclair
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Générez tous les blocs (copywriting COD, packs, avis clients, FAQ) en 1 clic
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Exemples rapides 1-clic */}
        <div className="my-3.5 p-3 rounded-xl bg-surface border border-surface-border">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
            ⚡ Remplir avec un exemple à fort succès COD :
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset("hightech")}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-raised border border-surface-border text-slate-200 hover:border-brand hover:text-brand transition"
            >
              ⌚ Montre Connectée
            </button>
            <button
              type="button"
              onClick={() => applyPreset("beaute")}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-raised border border-surface-border text-slate-200 hover:border-brand hover:text-brand transition"
            >
              ✨ Épilateur Beauté
            </button>
            <button
              type="button"
              onClick={() => applyPreset("maison")}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-raised border border-surface-border text-slate-200 hover:border-brand hover:text-brand transition"
            >
              👔 Défroisseur Express
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nom du produit */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">
              Nom du Produit (Ce que vous vendez) :
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Montre Connectée Ultra Max Pro 2026"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Niche / Catégorie */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Catégorie :
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 focus:border-brand focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Pays Cible */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Marché Cible (Afrique) :
              </label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 focus:border-brand focus:outline-none"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tarification */}
          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-surface border border-surface-border">
            <div>
              <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                Prix Promo de Vente :
              </label>
              <input
                type="number"
                required
                value={promoPrice}
                onChange={(e) => setPromoPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-emerald-500/30 bg-surface-raised px-2.5 py-1.5 text-xs font-bold text-emerald-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Prix Régulier (Barré) :
              </label>
              <input
                type="number"
                required
                value={regularPrice}
                onChange={(e) => setRegularPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-xs text-slate-400 line-through focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Devise :
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Bénéfices clés */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Bénéfices clés & Arguments forts (séparés par des virgules) :
            </label>
            <textarea
              rows={2}
              value={keyBenefits}
              onChange={(e) => setKeyBenefits(e.target.value)}
              placeholder="Ex: Sans douleur, résultat en 10 minutes, résiste à l'eau, garantie 30 jours..."
              className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 focus:border-brand focus:outline-none"
            />
          </div>

          {/* Public cible / Problème */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Public cible / Problème résolu :
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Ex: Pour les femmes qui ont des rougeurs après rasage..."
              className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Image URL */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Lien Image Principale (optionnel) :
              </label>
              <input
                type="text"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-brand focus:outline-none"
              />
            </div>
            {/* Téléphone WhatsApp */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Numéro WhatsApp Boutique :
              </label>
              <input
                type="text"
                placeholder="770000000"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-brand-hover shadow-lg shadow-brand/20 transition active:scale-98"
            >
              <Sparkles className="h-4 w-4" />
              <span>Générer et Remplir Toute La Page</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
