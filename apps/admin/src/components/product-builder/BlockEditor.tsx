import { useState } from "react";
import type {
  PageBlock,
  FeatureItem,
  PricingOffer,
  CustomerReview,
  FaqItem,
  ComparisonRow,
  GuaranteeItem,
  ThemeConfig,
} from "../../types/productBuilder";
import IconPickerModal, { ICONS_REGISTRY } from "./IconPickerModal";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Smile,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Settings2,
} from "lucide-react";

interface BlockEditorProps {
  block: PageBlock;
  theme: ThemeConfig;
  onChange: (updatedBlock: PageBlock) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function BlockEditor({
  block,
  theme,
  onChange,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: BlockEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingIconTarget, setEditingIconTarget] = useState<{
    type: "feature" | "guarantee";
    itemId: string;
    currentIcon: string;
    customUrl?: string;
  } | null>(null);

  const updateData = (patch: Record<string, any>) => {
    onChange({
      ...block,
      data: {
        ...block.data,
        ...patch,
      },
    });
  };

  const toggleVisibility = () => {
    onChange({
      ...block,
      visible: !block.visible,
    });
  };

  const renderIconBadge = (iconName: string, customUrl?: string, onClick?: () => void) => {
    const IconComp = ICONS_REGISTRY[iconName] || ICONS_REGISTRY.ShieldCheck;
    return (
      <button
        type="button"
        onClick={onClick}
        title="Cliquer pour changer l'icône"
        className="group relative flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border bg-surface text-brand hover:border-brand hover:scale-105 transition"
      >
        {customUrl ? (
          customUrl.startsWith("http") ? (
            <img src={customUrl} alt="Icon" className="h-5 w-5 object-contain" />
          ) : (
            <span className="text-base">{customUrl}</span>
          )
        ) : (
          <IconComp className="h-5 w-5" />
        )}
        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[9px] text-slate-950 font-bold opacity-0 group-hover:opacity-100 transition">
          ✎
        </span>
      </button>
    );
  };

  return (
    <div
      className={`rounded-2xl border transition-all ${
        block.visible
          ? "border-surface-border bg-surface-raised shadow-sm"
          : "border-surface-border/40 bg-surface/50 opacity-60"
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between p-3.5 select-none">
        <div
          className="flex items-center gap-2.5 flex-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface border border-surface-border text-xs font-bold text-slate-300">
            {block.type.substring(0, 2).toUpperCase()}
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-200">{block.title}</h4>
            <span className="text-[10px] text-slate-500 font-mono">
              Type: {block.type}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {canMoveUp && onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              title="Monter"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
          {canMoveDown && onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              title="Descendre"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleVisibility}
            title={block.visible ? "Masquer ce bloc" : "Afficher ce bloc"}
            className={`p-1 rounded-lg transition ${
              block.visible ? "text-slate-400 hover:text-white" : "text-amber-400"
            }`}
          >
            {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition ml-1"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Block Editor Content */}
      {isExpanded && (
        <div className="border-t border-surface-border p-4 space-y-4 text-xs animate-in slide-in-from-top-1 duration-150">
          {/* 1. URGENCY BAR */}
          {block.type === "urgency_bar" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Texte du bandeau défilant (Marquee) :
                </label>
                <textarea
                  rows={2}
                  value={block.data.marqueeText || ""}
                  onChange={(e) => updateData({ marqueeText: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Chrono compte à rebours (minutes) :
                  </label>
                  <input
                    type="number"
                    value={block.data.countdownMinutes || 45}
                    onChange={(e) =>
                      updateData({ countdownMinutes: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Couleur de fond :
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={block.data.bgColor || "#dc2626"}
                      onChange={(e) => updateData({ bgColor: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">
                      {block.data.bgColor || "#dc2626"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. HEADER */}
          {block.type === "header" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Nom de votre Boutique / Marque :
                </label>
                <input
                  type="text"
                  value={block.data.brandName || ""}
                  onChange={(e) => updateData({ brandName: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Badge de confiance En-tête :
                  </label>
                  <input
                    type="text"
                    value={block.data.trustBadgeText || ""}
                    onChange={(e) => updateData({ trustBadgeText: e.target.value })}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Téléphone WhatsApp Support :
                  </label>
                  <input
                    type="text"
                    value={block.data.supportPhone || ""}
                    onChange={(e) => updateData({ supportPhone: e.target.value })}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. HERO SECTION */}
          {block.type === "hero" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Badge Accroche (Haut de page) :
                </label>
                <input
                  type="text"
                  value={block.data.badge || ""}
                  onChange={(e) => updateData({ badge: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titre Principal du Produit :
                </label>
                <input
                  type="text"
                  value={block.data.title || ""}
                  onChange={(e) => updateData({ title: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-bold text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Sous-titre / Promesse de vente :
                </label>
                <textarea
                  rows={2}
                  value={block.data.subtitle || ""}
                  onChange={(e) => updateData({ subtitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>

              {/* Tarification */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface border border-surface-border">
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                    Prix Promo Vente ({theme.currency}) :
                  </label>
                  <input
                    type="number"
                    value={block.data.promoPrice || 0}
                    onChange={(e) =>
                      updateData({ promoPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-emerald-500/30 bg-surface-raised px-3 py-1.5 text-xs font-bold text-emerald-400 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Prix Barré d'Origine ({theme.currency}) :
                  </label>
                  <input
                    type="number"
                    value={block.data.regularPrice || 0}
                    onChange={(e) =>
                      updateData({ regularPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-1.5 text-xs text-slate-400 line-through focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Images URLs */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Liens des images du carrousel (1 par ligne) :
                </label>
                <textarea
                  rows={3}
                  value={(block.data.images || []).join("\n")}
                  onChange={(e) =>
                    updateData({
                      images: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full font-mono rounded-xl border border-surface-border bg-surface px-3 py-2 text-[11px] text-slate-300 focus:border-brand focus:outline-none"
                />
              </div>

              {/* Bouton CTA */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Texte du Bouton d'Action Principal :
                </label>
                <input
                  type="text"
                  value={block.data.ctaButtonText || ""}
                  onChange={(e) => updateData({ ctaButtonText: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 4. FEATURES & ICONS */}
          {block.type === "features" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titre de la section Bénéfices :
                </label>
                <input
                  type="text"
                  value={block.data.sectionTitle || ""}
                  onChange={(e) => updateData({ sectionTitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">
                    Cartes de bénéfices & Icônes :
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const current = (block.data.features || []) as FeatureItem[];
                      updateData({
                        features: [
                          ...current,
                          {
                            id: "f_" + Math.random().toString(36).substring(2, 6),
                            iconName: "Sparkles",
                            title: "Nouvel avantage client",
                            description: "Détaillez ici la valeur apportée par le produit.",
                          },
                        ],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter un avantage
                  </button>
                </div>

                {(block.data.features || []).map((feat: FeatureItem, index: number) => (
                  <div
                    key={feat.id || index}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-surface-border bg-surface"
                  >
                    {/* Icon selector button */}
                    {renderIconBadge(feat.iconName, feat.customIconUrl, () => {
                      setEditingIconTarget({
                        type: "feature",
                        itemId: feat.id,
                        currentIcon: feat.iconName,
                        customUrl: feat.customIconUrl,
                      });
                    })}

                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) => {
                          const updated = [...(block.data.features || [])];
                          updated[index] = { ...feat, title: e.target.value };
                          updateData({ features: updated });
                        }}
                        placeholder="Titre de l'avantage"
                        className="w-full font-bold text-xs bg-transparent border-b border-surface-border/60 pb-1 text-slate-200 focus:border-brand focus:outline-none"
                      />
                      <textarea
                        rows={2}
                        value={feat.description}
                        onChange={(e) => {
                          const updated = [...(block.data.features || [])];
                          updated[index] = { ...feat, description: e.target.value };
                          updateData({ features: updated });
                        }}
                        placeholder="Description..."
                        className="w-full text-[11px] bg-transparent text-slate-300 focus:outline-none resize-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = (block.data.features || []).filter(
                          (_: any, i: number) => i !== index
                        );
                        updateData({ features: updated });
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. PRICING OFFERS (PACKS) */}
          {block.type === "offers" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titre de la section Packs :
                </label>
                <input
                  type="text"
                  value={block.data.sectionTitle || ""}
                  onChange={(e) => updateData({ sectionTitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">
                    Offres packagées :
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const current = (block.data.offers || []) as PricingOffer[];
                      updateData({
                        offers: [
                          ...current,
                          {
                            id: "pack_" + Math.random().toString(36).substring(2, 6),
                            title: `Pack Spécial`,
                            badge: "Offre Spéciale",
                            quantity: current.length + 1,
                            regularPrice: 50000,
                            promoPrice: 30000,
                            isPopular: false,
                          },
                        ],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter un pack
                  </button>
                </div>

                {(block.data.offers || []).map((offer: PricingOffer, index: number) => (
                  <div
                    key={offer.id || index}
                    className="p-3 rounded-xl border border-surface-border bg-surface space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={offer.title}
                        onChange={(e) => {
                          const updated = [...(block.data.offers || [])];
                          updated[index] = { ...offer, title: e.target.value };
                          updateData({ offers: updated });
                        }}
                        placeholder="Nom du pack"
                        className="font-bold text-xs bg-transparent text-slate-200 flex-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (block.data.offers || []).filter(
                            (_: any, i: number) => i !== index
                          );
                          updateData({ offers: updated });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Quantité</span>
                        <input
                          type="number"
                          value={offer.quantity}
                          onChange={(e) => {
                            const updated = [...(block.data.offers || [])];
                            updated[index] = {
                              ...offer,
                              quantity: Number(e.target.value),
                            };
                            updateData({ offers: updated });
                          }}
                          className="w-full rounded-lg border border-surface-border bg-surface-raised px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 block">
                          Prix Promo ({theme.currency})
                        </span>
                        <input
                          type="number"
                          value={offer.promoPrice}
                          onChange={(e) => {
                            const updated = [...(block.data.offers || [])];
                            updated[index] = {
                              ...offer,
                              promoPrice: Number(e.target.value),
                            };
                            updateData({ offers: updated });
                          }}
                          className="w-full rounded-lg border border-emerald-500/30 bg-surface-raised px-2 py-1 text-xs font-bold text-emerald-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          Prix Barré ({theme.currency})
                        </span>
                        <input
                          type="number"
                          value={offer.regularPrice}
                          onChange={(e) => {
                            const updated = [...(block.data.offers || [])];
                            updated[index] = {
                              ...offer,
                              regularPrice: Number(e.target.value),
                            };
                            updateData({ offers: updated });
                          }}
                          className="w-full rounded-lg border border-surface-border bg-surface-raised px-2 py-1 text-xs text-slate-400 line-through focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <input
                        type="text"
                        value={offer.badge || ""}
                        onChange={(e) => {
                          const updated = [...(block.data.offers || [])];
                          updated[index] = { ...offer, badge: e.target.value };
                          updateData({ offers: updated });
                        }}
                        placeholder="Badge (ex: Plus populaire, -60%)"
                        className="text-[11px] bg-transparent text-amber-400 placeholder:text-slate-600 focus:outline-none"
                      />
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(offer.isPopular)}
                          onChange={(e) => {
                            const updated = (block.data.offers || []).map(
                              (o: PricingOffer, i: number) => ({
                                ...o,
                                isPopular: i === index ? e.target.checked : false,
                              })
                            );
                            updateData({ offers: updated });
                          }}
                          className="rounded border-surface-border text-brand focus:ring-0"
                        />
                        Mettre en vedette
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. COMPARISON TABLE */}
          {block.type === "comparison" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titre du comparatif :
                </label>
                <input
                  type="text"
                  value={block.data.sectionTitle || ""}
                  onChange={(e) => updateData({ sectionTitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">
                    Lignes de comparaison :
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const current = (block.data.rows || []) as ComparisonRow[];
                      updateData({
                        rows: [
                          ...current,
                          {
                            id: "row_" + Math.random().toString(36).substring(2, 6),
                            feature: "Nouvelle caractéristique",
                            us: "Notre avantage certifié",
                            them: "Défaut des copies",
                          },
                        ],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une ligne
                  </button>
                </div>

                {(block.data.rows || []).map((row: ComparisonRow, index: number) => (
                  <div
                    key={row.id || index}
                    className="p-2.5 rounded-xl border border-surface-border bg-surface space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={row.feature}
                        onChange={(e) => {
                          const updated = [...(block.data.rows || [])];
                          updated[index] = { ...row, feature: e.target.value };
                          updateData({ rows: updated });
                        }}
                        placeholder="Caractéristique comparée"
                        className="font-bold text-xs bg-transparent text-slate-200 flex-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (block.data.rows || []).filter(
                            (_: any, i: number) => i !== index
                          );
                          updateData({ rows: updated });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-emerald-400 block font-semibold">
                          Notre Produit (Avantage)
                        </span>
                        <input
                          type="text"
                          value={row.us}
                          onChange={(e) => {
                            const updated = [...(block.data.rows || [])];
                            updated[index] = { ...row, us: e.target.value };
                            updateData({ rows: updated });
                          }}
                          className="w-full rounded-lg border border-emerald-500/30 bg-surface-raised px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 block font-semibold">
                          Autres / Copies (Défaut)
                        </span>
                        <input
                          type="text"
                          value={row.them}
                          onChange={(e) => {
                            const updated = [...(block.data.rows || [])];
                            updated[index] = { ...row, them: e.target.value };
                            updateData({ rows: updated });
                          }}
                          className="w-full rounded-lg border border-rose-500/30 bg-surface-raised px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. CUSTOMER REVIEWS */}
          {block.type === "reviews" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titre de la section Avis :
                </label>
                <input
                  type="text"
                  value={block.data.sectionTitle || ""}
                  onChange={(e) => updateData({ sectionTitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">
                    Avis clients :
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const current = (block.data.reviews || []) as CustomerReview[];
                      updateData({
                        reviews: [
                          ...current,
                          {
                            id: "rev_" + Math.random().toString(36).substring(2, 6),
                            authorName: "Nouveau Client",
                            location: `${theme.countryName || "Dakar"}`,
                            rating: 5,
                            comment: "Très satisfait du produit et de la livraison express !",
                            dateText: "Il y a 1 jour",
                            verified: true,
                            avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
                          },
                        ],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter un avis
                  </button>
                </div>

                {(block.data.reviews || []).map((rev: CustomerReview, index: number) => (
                  <div
                    key={rev.id || index}
                    className="p-3 rounded-xl border border-surface-border bg-surface space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={rev.authorName}
                          onChange={(e) => {
                            const updated = [...(block.data.reviews || [])];
                            updated[index] = { ...rev, authorName: e.target.value };
                            updateData({ reviews: updated });
                          }}
                          placeholder="Nom client"
                          className="font-bold text-xs bg-transparent text-slate-200 focus:outline-none"
                        />
                        <span className="text-slate-500">·</span>
                        <input
                          type="text"
                          value={rev.location}
                          onChange={(e) => {
                            const updated = [...(block.data.reviews || [])];
                            updated[index] = { ...rev, location: e.target.value };
                            updateData({ reviews: updated });
                          }}
                          placeholder="Ville, Quartier"
                          className="text-[11px] bg-transparent text-slate-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (block.data.reviews || []).filter(
                            (_: any, i: number) => i !== index
                          );
                          updateData({ reviews: updated });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={rev.comment}
                      onChange={(e) => {
                        const updated = [...(block.data.reviews || [])];
                        updated[index] = { ...rev, comment: e.target.value };
                        updateData({ reviews: updated });
                      }}
                      placeholder="Commentaire de l'acheteur..."
                      className="w-full rounded-lg border border-surface-border bg-surface-raised p-2 text-xs text-slate-300 focus:outline-none"
                    />

                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1 text-amber-400 font-bold">
                        <span>★ 5/5</span>
                        <span className="text-emerald-400 text-[10px] ml-2">✓ Acheteur Vérifié</span>
                      </div>
                      <input
                        type="text"
                        value={rev.avatarUrl || ""}
                        onChange={(e) => {
                          const updated = [...(block.data.reviews || [])];
                          updated[index] = { ...rev, avatarUrl: e.target.value };
                          updateData({ reviews: updated });
                        }}
                        placeholder="URL Photo (optionnelle)"
                        className="text-[10px] text-slate-400 font-mono bg-transparent border-b border-surface-border max-w-[160px] focus:outline-none truncate"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. GUARANTEES & ICONS */}
          {block.type === "guarantees" && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-300 block">
                Piliers de garantie & réassurance :
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(block.data.items || []).map((item: GuaranteeItem, index: number) => (
                  <div
                    key={item.id || index}
                    className="p-2.5 rounded-xl border border-surface-border bg-surface flex items-start gap-2"
                  >
                    {renderIconBadge(item.iconName, item.customIconUrl, () => {
                      setEditingIconTarget({
                        type: "guarantee",
                        itemId: item.id,
                        currentIcon: item.iconName,
                        customUrl: item.customIconUrl,
                      });
                    })}
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const updated = [...(block.data.items || [])];
                          updated[index] = { ...item, title: e.target.value };
                          updateData({ items: updated });
                        }}
                        placeholder="Titre"
                        className="w-full text-xs font-bold bg-transparent text-slate-200 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={item.subtitle}
                        onChange={(e) => {
                          const updated = [...(block.data.items || [])];
                          updated[index] = { ...item, subtitle: e.target.value };
                          updateData({ items: updated });
                        }}
                        placeholder="Sous-titre"
                        className="w-full text-[10px] bg-transparent text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. COD FORM SETTINGS */}
          {block.type === "cod_form" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titre du Formulaire :
                </label>
                <input
                  type="text"
                  value={block.data.formTitle || ""}
                  onChange={(e) => updateData({ formTitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Sous-titre d'avertissement / réassurance :
                </label>
                <input
                  type="text"
                  value={block.data.formSubtitle || ""}
                  onChange={(e) => updateData({ formSubtitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Texte du Bouton de Validation COD :
                </label>
                <input
                  type="text"
                  value={block.data.buttonText || ""}
                  onChange={(e) => updateData({ buttonText: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-bold text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Villes suggérées dans la liste déroulante (séparées par des virgules) :
                </label>
                <input
                  type="text"
                  value={block.data.cityOptions || ""}
                  onChange={(e) => updateData({ cityOptions: e.target.value })}
                  placeholder="Dakar, Thiès, Mbour..."
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 10. WHATSAPP BUTTON */}
          {block.type === "whatsapp_button" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Texte du bouton WhatsApp :
                </label>
                <input
                  type="text"
                  value={block.data.buttonText || ""}
                  onChange={(e) => updateData({ buttonText: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Numéro WhatsApp (avec indicatif sans +) :
                  </label>
                  <input
                    type="text"
                    value={block.data.phoneNumber || ""}
                    onChange={(e) => updateData({ phoneNumber: e.target.value })}
                    placeholder="221770000000"
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Message prérempli WhatsApp :
                  </label>
                  <input
                    type="text"
                    value={block.data.prefilledMessage || ""}
                    onChange={(e) => updateData({ prefilledMessage: e.target.value })}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 11. FAQ ACCORDION */}
          {block.type === "faq" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titre de la section FAQ :
                </label>
                <input
                  type="text"
                  value={block.data.sectionTitle || ""}
                  onChange={(e) => updateData({ sectionTitle: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">
                    Questions & Réponses :
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const current = (block.data.faqs || []) as FaqItem[];
                      updateData({
                        faqs: [
                          ...current,
                          {
                            id: "faq_" + Math.random().toString(36).substring(2, 6),
                            question: "Nouvelle question fréquente ?",
                            answer: "Réponse détaillée...",
                          },
                        ],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une question
                  </button>
                </div>

                {(block.data.faqs || []).map((faq: FaqItem, index: number) => (
                  <div
                    key={faq.id || index}
                    className="p-2.5 rounded-xl border border-surface-border bg-surface space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => {
                          const updated = [...(block.data.faqs || [])];
                          updated[index] = { ...faq, question: e.target.value };
                          updateData({ faqs: updated });
                        }}
                        placeholder="Question posée"
                        className="font-bold text-xs bg-transparent text-slate-200 flex-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (block.data.faqs || []).filter(
                            (_: any, i: number) => i !== index
                          );
                          updateData({ faqs: updated });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => {
                        const updated = [...(block.data.faqs || [])];
                        updated[index] = { ...faq, answer: e.target.value };
                        updateData({ faqs: updated });
                      }}
                      placeholder="Réponse apportée..."
                      className="w-full text-xs rounded-lg border border-surface-border bg-surface-raised p-2 text-slate-300 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12. FOOTER */}
          {block.type === "footer" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Mention Copyright :
                </label>
                <input
                  type="text"
                  value={block.data.copyrightText || ""}
                  onChange={(e) => updateData({ copyrightText: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Avertissement légal Meta / TikTok :
                </label>
                <textarea
                  rows={2}
                  value={block.data.disclaimerText || ""}
                  onChange={(e) => updateData({ disclaimerText: e.target.value })}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Sélecteur d'icône */}
      {editingIconTarget && (
        <IconPickerModal
          currentIcon={editingIconTarget.currentIcon}
          customIconUrl={editingIconTarget.customUrl}
          onSelect={(newIcon, customUrl) => {
            if (editingIconTarget.type === "feature") {
              const updated = (block.data.features || []).map((f: FeatureItem) => {
                if (f.id === editingIconTarget.itemId) {
                  return { ...f, iconName: newIcon, customIconUrl: customUrl };
                }
                return f;
              });
              updateData({ features: updated });
            } else if (editingIconTarget.type === "guarantee") {
              const updated = (block.data.items || []).map((g: GuaranteeItem) => {
                if (g.id === editingIconTarget.itemId) {
                  return { ...g, iconName: newIcon, customIconUrl: customUrl };
                }
                return g;
              });
              updateData({ items: updated });
            }
            setEditingIconTarget(null);
          }}
          onClose={() => setEditingIconTarget(null)}
        />
      )}
    </div>
  );
}
