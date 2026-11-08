import { useState } from "react";
import {
  ShieldCheck,
  Shield,
  Truck,
  Zap,
  Flame,
  Award,
  Clock,
  Heart,
  Star,
  Sparkles,
  CheckCircle2,
  Package,
  ThumbsUp,
  DollarSign,
  Gift,
  Tag,
  Smartphone,
  Headphones,
  RotateCcw,
  AlertCircle,
  ShoppingCart,
  Lock,
  MapPin,
  Eye,
  Bell,
  Check,
  UserCheck,
  BatteryCharging,
  HeartPulse,
  PhoneCall,
  Search,
  X,
  BadgePercent,
  TrendingUp,
  Smile,
  Compass,
  Lightbulb,
  CheckSquare,
  Image as ImageIcon,
  Plus,
} from "lucide-react";

export const ICONS_REGISTRY: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Shield,
  Truck,
  Zap,
  Flame,
  Award,
  Clock,
  Heart,
  Star,
  Sparkles,
  CheckCircle2,
  Package,
  ThumbsUp,
  DollarSign,
  Gift,
  Tag,
  Smartphone,
  Headphones,
  RotateCcw,
  AlertCircle,
  ShoppingCart,
  Lock,
  MapPin,
  Eye,
  Bell,
  Check,
  UserCheck,
  BatteryCharging,
  HeartPulse,
  PhoneCall,
  BadgePercent,
  TrendingUp,
  Smile,
  Compass,
  Lightbulb,
  CheckSquare,
};

// Mots-clés de recherche multilingues
const ICON_KEYWORDS: Record<string, string> = {
  ShieldCheck: "securite garantie shield certifie protection check fiable",
  Shield: "bouclier securite protection securise",
  Truck: "livraison camion expédition transport express rapide deliver",
  Zap: "eclair rapide vitesse flash energie puissance zap fast",
  Flame: "feu flamme tendance hot populaire promo urgent",
  Award: "medaille recompense qualite officielle premium certifiee",
  Clock: "horloge montre temps heure 24h rapide chrono",
  Heart: "coeur amour coup de coeur bien-etre sante favori",
  Star: "etoile star avis note qualite 5 etoiles",
  Sparkles: "brillance etoiles magie propre nouveaute",
  CheckCircle2: "valide ok certifie parfait coche",
  Package: "colis carton emballage livraison commande",
  ThumbsUp: "pouce j aime recommande top satisfaction",
  DollarSign: "argent cash paiement economie prix franc cfa",
  Gift: "cadeau bonus gratuit surprise offre",
  Tag: "etiquette promo reduction prix rabais",
  Smartphone: "telephone mobile appel whatsapp contact smartphone",
  Headphones: "casque ecouteurs support sav service client assistance",
  RotateCcw: "retour echange remboursement 30 jours",
  AlertCircle: "attention alerte important avis",
  ShoppingCart: "panier caddie achat commande shop",
  Lock: "cadenas confidentiel securite paiement protege",
  MapPin: "adresse ville position quartier localisation",
  Eye: "vue regard visible transparent direct",
  Bell: "cloche notification rappel alerte",
  Check: "coche oui fait valide",
  UserCheck: "client verifie acheteur temoignage humain",
  BatteryCharging: "batterie autonomie recharge puissance",
  HeartPulse: "cardio pouls sante medical forme",
  PhoneCall: "appel telephoner decrocher contact direct",
  BadgePercent: "pourcentage promo reduction solde -50%",
  TrendingUp: "croissance tendance meilleure vente",
  Smile: "sourire satisfaction joie client content",
  Compass: "boussole orientation partout pays",
  Lightbulb: "ampoule idee innovation malin astuce",
  CheckSquare: "liste a cocher fait conforme",
};

interface IconPickerModalProps {
  currentIcon: string;
  customIconUrl?: string;
  onSelect: (iconName: string, customUrl?: string) => void;
  onClose: () => void;
}

export default function IconPickerModal({
  currentIcon,
  customIconUrl,
  onSelect,
  onClose,
}: IconPickerModalProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"library" | "custom">("library");
  const [customInput, setCustomInput] = useState(customIconUrl || "");

  const filteredIcons = Object.keys(ICONS_REGISTRY).filter((key) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const keywords = ICON_KEYWORDS[key] || "";
    return key.toLowerCase().includes(term) || keywords.toLowerCase().includes(term);
  });

  const handleApplyCustom = () => {
    if (customInput.trim()) {
      onSelect("Custom", customInput.trim());
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              Sélecteur & Personnalisation d'Icône
            </h3>
            <p className="text-xs text-slate-400">
              Choisissez une icône e-commerce haute conversion ou collez la vôtre
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4 border-b border-surface-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "library"
                ? "bg-brand text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-surface"
            }`}
          >
            Bibliothèque d'icônes ({Object.keys(ICONS_REGISTRY).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "custom"
                ? "bg-brand text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-surface"
            }`}
          >
            + Icône personnalisée / Emoji / Image
          </button>
        </div>

        {activeTab === "library" ? (
          <div className="mt-4 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher (ex: livraison, garantie, rapide, argent, avis...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-brand focus:outline-none"
              />
            </div>

            {/* Grid of icons */}
            <div className="grid grid-cols-6 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {filteredIcons.map((iconKey) => {
                const IconComponent = ICONS_REGISTRY[iconKey];
                const isSelected = currentIcon === iconKey && !customIconUrl;
                return (
                  <button
                    key={iconKey}
                    type="button"
                    onClick={() => {
                      onSelect(iconKey, undefined);
                      onClose();
                    }}
                    title={iconKey}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "border-brand bg-brand/15 text-brand shadow-sm scale-105"
                        : "border-surface-border bg-surface text-slate-300 hover:border-slate-500 hover:text-white hover:scale-105"
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-[10px] mt-1 text-slate-400 truncate max-w-full">
                      {iconKey}
                    </span>
                  </button>
                );
              })}
              {filteredIcons.length === 0 && (
                <div className="col-span-6 py-8 text-center text-xs text-slate-500">
                  Aucune icône trouvée pour "{search}". Essayez l'onglet d'icône personnalisée.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-200">
                Lien de votre image d'icône (PNG transparent ou SVG) ou Emoji :
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://exemple.com/icone.png ou un emoji comme ⚡ / 🏆 / 🇸🇳"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="flex-1 rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-brand focus:outline-none"
                />
              </div>

              {/* Aperçu instantané */}
              {customInput && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs text-slate-400">Aperçu en direct :</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 border border-brand/30 text-brand">
                    {customInput.startsWith("http") ? (
                      <img
                        src={customInput}
                        alt="Aperçu icône"
                        className="h-6 w-6 object-contain"
                        onError={(e) => ((e.target as any).style.display = "none")}
                      />
                    ) : (
                      <span className="text-xl">{customInput}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Suggestions rapides d'emojis populaires e-commerce */}
              <div>
                <span className="text-[11px] font-medium text-slate-400 block mb-2">
                  Emojis rapides e-commerce & Afrique :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {["🔥", "⚡", "📦", "🚀", "💎", "🏆", "🔒", "✅", "💰", "👑", "🇸🇳", "🇨🇮", "🇨🇲", "🇲🇱", "🇬🇳", "🇬🇦"].map(
                    (emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCustomInput(emoji)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-surface-border bg-surface-raised hover:border-brand hover:scale-110 text-base transition"
                      >
                        {emoji}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!customInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-brand rounded-xl hover:bg-brand-hover disabled:opacity-50 transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Appliquer cette icône
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
