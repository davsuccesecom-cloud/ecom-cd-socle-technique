import { useState, useEffect } from "react";
import type {
  ProductPageData,
  FeatureItem,
  PricingOffer,
  CustomerReview,
  FaqItem,
  ComparisonRow,
  GuaranteeItem,
} from "../../types/productBuilder";
import { ICONS_REGISTRY } from "./IconPickerModal";
import {
  Star,
  Check,
  X,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  Smartphone,
  Monitor,
} from "lucide-react";

interface LivePreviewProps {
  pageData: ProductPageData;
  isPublic?: boolean;
  onSubmitOrder?: (orderPayload: {
    clientName: string;
    phone: string;
    city: string;
    addressNote: string;
    product: string;
    quantity: number;
    amount: number;
    offerTitle: string;
  }) => Promise<{ success: boolean; orderId?: string; message?: string }>;
}

export default function LivePreview({
  pageData,
  isPublic = false,
  onSubmitOrder,
}: LivePreviewProps) {
  const [deviceMode, setDeviceMode] = useState<"mobile" | "desktop">("mobile");
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(1); // Par défaut le pack Duo / populaire
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  // Formulaire COD
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [addressNote, setAddressNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<boolean | null>(null);

  const { theme, blocks } = pageData;
  const primaryColor = theme.primaryColor || "#16a34a";

  // Extraction des données blocs
  const heroBlock = blocks.find((b) => b.type === "hero" && b.visible);
  const offersBlock = blocks.find((b) => b.type === "offers" && b.visible);
  const offers: PricingOffer[] = offersBlock?.data?.offers || [
    {
      id: "p1",
      title: "1 Article",
      quantity: 1,
      regularPrice: heroBlock?.data?.regularPrice || 35000,
      promoPrice: heroBlock?.data?.promoPrice || 19500,
    },
  ];

  const currentOffer = offers[selectedOfferIndex] || offers[0];

  const renderIcon = (iconName: string, customUrl?: string, className = "h-5 w-5") => {
    if (customUrl) {
      if (customUrl.startsWith("http")) {
        return <img src={customUrl} alt="Icon" className={`${className} object-contain`} />;
      }
      return <span className="text-lg leading-none">{customUrl}</span>;
    }
    const Comp = ICONS_REGISTRY[iconName] || ICONS_REGISTRY.ShieldCheck;
    return <Comp className={className} />;
  };

  const scrollToForm = () => {
    const el = document.getElementById("cod-order-form-anchor");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !phone.trim()) {
      alert("Veuillez renseigner votre Nom et Numéro de téléphone WhatsApp.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmitOrder) {
        const res = await onSubmitOrder({
          clientName: clientName.trim(),
          phone: phone.trim(),
          city: city.trim() || "Dakar",
          addressNote: addressNote.trim(),
          product: pageData.productName,
          quantity: currentOffer?.quantity || 1,
          amount: currentOffer?.promoPrice || heroBlock?.data?.promoPrice || 19500,
          offerTitle: currentOffer?.title || "Offre standard",
        });
        if (res.success) {
          setOrderSuccess(true);
        } else {
          alert(res.message || "Erreur lors de l'enregistrement de la commande.");
        }
      } else {
        // Mode Simulation Studio
        await new Promise((r) => setTimeout(r, 800));
        setOrderSuccess(true);
      }
    } catch (err: any) {
      alert("Erreur de connexion : " + (err?.message || "inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageContent = (
    <div
      className="w-full bg-white text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900"
      style={{
        backgroundColor: theme.bgColor || "#ffffff",
        color: theme.textColor || "#0f172a",
      }}
    >
      {/* 1. URGENCY BAR */}
      {blocks
        .filter((b) => b.type === "urgency_bar" && b.visible)
        .map((b) => (
          <div
            key={b.id}
            className="py-2 px-3 text-center text-xs font-bold tracking-wide overflow-hidden shadow-sm flex items-center justify-center gap-2"
            style={{
              backgroundColor: b.data.bgColor || "#dc2626",
              color: b.data.textColor || "#ffffff",
            }}
          >
            <Clock className="h-3.5 w-3.5 animate-pulse shrink-0" />
            <span className="truncate">{b.data.marqueeText}</span>
          </div>
        ))}

      {/* 2. HEADER */}
      {blocks
        .filter((b) => b.type === "header" && b.visible)
        .map((b) => (
          <header
            key={b.id}
            className="border-b border-slate-200/80 bg-white/95 px-4 py-3 sticky top-0 z-30 backdrop-blur-md flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {b.data.brandName?.substring(0, 2).toUpperCase() || "EC"}
              </div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900">
                {b.data.brandName || "Boutique Officielle"}
              </span>
            </div>
            {b.data.trustBadgeText && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                {b.data.trustBadgeText}
              </span>
            )}
          </header>
        ))}

      {/* 3. HERO SECTION */}
      {blocks
        .filter((b) => b.type === "hero" && b.visible)
        .map((b) => {
          const images = b.data.images || [];
          return (
            <section key={b.id} className="p-4 sm:p-6 space-y-4">
              {/* Badge Stock / Vente */}
              {b.data.badge && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 border border-amber-300">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  {b.data.badge}
                </div>
              )}

              {/* Titre & Promesse */}
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 leading-snug">
                {b.data.title}
              </h1>

              {b.data.subtitle && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {b.data.subtitle}
                </p>
              )}

              {/* Note étoiles */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 stroke-amber-400" />
                  ))}
                </div>
                <span className="font-bold text-slate-900">
                  {b.data.ratingScore || "4.9"} / 5
                </span>
                <span className="text-slate-500">
                  ({b.data.ratingCount || "340"} avis vérifiés)
                </span>
              </div>

              {/* Galerie photo */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <div className="aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner relative">
                    <img
                      src={images[activeImageIndex] || images[0]}
                      alt="Produit"
                      className="h-full w-full object-cover transition-all duration-300"
                    />
                    {b.data.discountTag && (
                      <span className="absolute top-3 right-3 rounded-xl bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-lg">
                        {b.data.discountTag}
                      </span>
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {images.map((imgUrl: string, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={`h-14 w-14 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                            activeImageIndex === idx
                              ? "border-emerald-600 ring-2 ring-emerald-500/30 scale-95"
                              : "border-slate-200 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tarifs */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Prix promotionnel spécial :
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-700">
                      {(b.data.promoPrice || 0).toLocaleString("fr-FR")} {theme.currency}
                    </span>
                    {b.data.regularPrice > b.data.promoPrice && (
                      <span className="text-sm font-semibold text-slate-400 line-through">
                        {b.data.regularPrice.toLocaleString("fr-FR")} {theme.currency}
                      </span>
                    )}
                  </div>
                </div>
                <span className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                  Paiement Réception
                </span>
              </div>

              {/* Bouton d'ancrage rapide vers le formulaire */}
              <button
                type="button"
                onClick={scrollToForm}
                className="w-full rounded-2xl py-3.5 px-4 text-center font-black text-sm text-white shadow-lg shadow-emerald-700/25 transition-all transform active:scale-98 hover:brightness-105 flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                <span>{b.data.ctaButtonText || "COMMANDER · PAIEMENT LIVRAISON"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              {b.data.ctaSubtext && (
                <p className="text-center text-[11px] font-semibold text-slate-500">
                  {b.data.ctaSubtext}
                </p>
              )}
            </section>
          );
        })}

      {/* 4. FEATURES & ICONS */}
      {blocks
        .filter((b) => b.type === "features" && b.visible)
        .map((b) => (
          <section key={b.id} className="p-4 sm:p-6 bg-slate-50 border-y border-slate-200/80 space-y-4">
            <div className="text-center max-w-sm mx-auto space-y-1">
              <h2 className="text-base sm:text-lg font-black text-slate-950">
                {b.data.sectionTitle}
              </h2>
              {b.data.sectionSubtitle && (
                <p className="text-xs text-slate-600">{b.data.sectionSubtitle}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(b.data.features || []).map((feat: FeatureItem) => (
                <div
                  key={feat.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm flex items-start gap-3"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {renderIcon(feat.iconName, feat.customIconUrl, "h-5 w-5")}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-xs text-slate-900 leading-snug">
                      {feat.title}
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

      {/* 5. PRICING OFFERS (PACKS) */}
      {blocks
        .filter((b) => b.type === "offers" && b.visible)
        .map((b) => (
          <section key={b.id} className="p-4 sm:p-6 space-y-4">
            <div className="text-center max-w-sm mx-auto space-y-1">
              <h2 className="text-base sm:text-lg font-black text-slate-950">
                {b.data.sectionTitle}
              </h2>
              {b.data.sectionSubtitle && (
                <p className="text-xs text-slate-600">{b.data.sectionSubtitle}</p>
              )}
            </div>

            <div className="space-y-2.5">
              {(b.data.offers || []).map((offer: PricingOffer, idx: number) => {
                const isSelected = selectedOfferIndex === idx;
                return (
                  <div
                    key={offer.id || idx}
                    onClick={() => {
                      setSelectedOfferIndex(idx);
                      scrollToForm();
                    }}
                    className={`cursor-pointer rounded-2xl border-2 p-3.5 transition-all relative ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    {offer.badge && (
                      <span
                        className={`absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm ${
                          offer.isPopular
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {offer.badge}
                      </span>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-600"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-950">
                            {offer.title}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            Quantité : {offer.quantity} pièce{offer.quantity > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-700 block">
                          {offer.promoPrice.toLocaleString("fr-FR")} {theme.currency}
                        </span>
                        {offer.regularPrice > offer.promoPrice && (
                          <span className="text-[11px] text-slate-400 line-through">
                            {offer.regularPrice.toLocaleString("fr-FR")} {theme.currency}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

      {/* 6. COMPARISON TABLE */}
      {blocks
        .filter((b) => b.type === "comparison" && b.visible)
        .map((b) => (
          <section key={b.id} className="p-4 sm:p-6 bg-slate-50 border-y border-slate-200/80 space-y-4">
            <div className="text-center max-w-sm mx-auto space-y-1">
              <h2 className="text-base sm:text-lg font-black text-slate-950">
                {b.data.sectionTitle}
              </h2>
              {b.data.sectionSubtitle && (
                <p className="text-xs text-slate-600">{b.data.sectionSubtitle}</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="grid grid-cols-3 bg-slate-900 text-white text-[11px] font-black p-2.5 text-center">
                <span className="text-left pl-2">Critères</span>
                <span className="text-emerald-400">Notre Produit</span>
                <span className="text-rose-400">Autres Copies</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(b.data.rows || []).map((row: ComparisonRow) => (
                  <div key={row.id} className="grid grid-cols-3 p-3 items-center">
                    <span className="font-bold text-slate-800 text-[11px] pr-2">
                      {row.feature}
                    </span>
                    <div className="text-center font-semibold text-emerald-700 text-[11px] px-1 flex flex-col items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>{row.us}</span>
                    </div>
                    <div className="text-center text-slate-500 text-[11px] px-1 flex flex-col items-center gap-1">
                      <X className="h-4 w-4 text-rose-500" />
                      <span>{row.them}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

      {/* 7. GUARANTEES */}
      {blocks
        .filter((b) => b.type === "guarantees" && b.visible)
        .map((b) => (
          <section key={b.id} className="p-4 sm:p-6 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {(b.data.items || []).map((item: GuaranteeItem) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col items-center text-center space-y-1.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {renderIcon(item.iconName, item.customIconUrl, "h-5 w-5")}
                  </div>
                  <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {item.subtitle}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

      {/* 8. CUSTOMER REVIEWS */}
      {blocks
        .filter((b) => b.type === "reviews" && b.visible)
        .map((b) => (
          <section key={b.id} className="p-4 sm:p-6 bg-slate-50 border-y border-slate-200/80 space-y-4">
            <div className="text-center max-w-sm mx-auto space-y-1">
              <h2 className="text-base sm:text-lg font-black text-slate-950">
                {b.data.sectionTitle}
              </h2>
              {b.data.sectionSubtitle && (
                <p className="text-xs text-slate-600">{b.data.sectionSubtitle}</p>
              )}
            </div>

            <div className="space-y-3">
              {(b.data.reviews || []).map((rev: CustomerReview) => (
                <div
                  key={rev.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {rev.avatarUrl ? (
                        <img
                          src={rev.avatarUrl}
                          alt={rev.authorName}
                          className="h-9 w-9 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
                          {rev.authorName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900 leading-none">
                          {rev.authorName}
                        </h4>
                        <span className="text-[10px] text-slate-500">{rev.location}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">{rev.dateText}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex text-amber-400">
                      {[...Array(rev.rating || 5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 stroke-amber-400" />
                      ))}
                    </div>
                    {rev.verified && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        ✓ Achat Vérifié
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

      {/* 9. COD EXPRESS FORM (THE CORE ENGINE) */}
      {blocks
        .filter((b) => b.type === "cod_form" && b.visible)
        .map((b) => (
          <section
            key={b.id}
            id="cod-order-form-anchor"
            className="p-4 sm:p-6 bg-slate-900 text-white scroll-mt-14"
          >
            <div className="rounded-3xl border-2 border-emerald-500/50 bg-slate-950 p-5 shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black tracking-wider text-emerald-400 border border-emerald-500/30 uppercase inline-block">
                  {b.data.badgeText || "PAIEMENT À LA LIVRAISON (0 FRANC D'AVANCE)"}
                </span>
                <h3 className="text-lg font-black text-white">{b.data.formTitle}</h3>
                {b.data.formSubtitle && (
                  <p className="text-xs text-slate-400">{b.data.formSubtitle}</p>
                )}
              </div>

              {/* Récapitulatif de l'offre choisie */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Offre sélectionnée :</span>
                  <span className="font-extrabold text-xs text-white">
                    {currentOffer?.title} ({currentOffer?.quantity} pièce{currentOffer?.quantity > 1 ? "s" : ""})
                  </span>
                </div>
                <span className="text-base font-black text-emerald-400">
                  {currentOffer?.promoPrice.toLocaleString("fr-FR")} {theme.currency}
                </span>
              </div>

              {orderSuccess ? (
                <div className="rounded-2xl bg-emerald-950/80 border border-emerald-500/60 p-5 text-center space-y-3 animate-in fade-in duration-300">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h4 className="text-base font-black text-white">
                    Commande Enregistrée Avec Succès !
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Merci <b>{clientName}</b> ! Notre conseillère client va vous contacter
                    par téléphone au <b>{phone}</b> d'ici 15 minutes pour confirmer votre adresse et le créneau de livraison.
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-400">
                    💰 Préparez le montant exact à la livraison :{" "}
                    <b>{currentOffer?.promoPrice.toLocaleString("fr-FR")} {theme.currency}</b>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Votre Nom & Prénom Complet :
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Ibrahima Diop ou Aminata Koné"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Numéro de Téléphone (WhatsApp actif) :
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-700 bg-slate-800 px-3 text-xs font-mono text-emerald-400">
                        {theme.phonePrefix || "+221"}
                      </span>
                      <input
                        type="tel"
                        required
                        placeholder="Ex: 77 123 45 67"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-r-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Ville ou Région de livraison :
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">Sélectionnez votre ville...</option>
                      {(b.data.cityOptions || "Dakar, Thiès, Mbour, Autre ville")
                        .split(",")
                        .map((c: string) => (
                          <option key={c.trim()} value={c.trim()}>
                            {c.trim()}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Quartier ou Adresse de livraison :
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Plateau, près de la pharmacie..."
                      value={addressNote}
                      onChange={(e) => setAddressNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl py-3.5 px-4 text-center font-black text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-xl shadow-emerald-500/25 transition-all transform active:scale-98 disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span>Validation en cours...</span>
                    ) : (
                      <>
                        <span>{b.data.buttonText || "CONFIRMER MA COMMANDE MAINTENANT"}</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {b.data.buttonSubtext && (
                    <p className="text-center text-[10px] text-slate-400">
                      {b.data.buttonSubtext}
                    </p>
                  )}
                </form>
              )}
            </div>
          </section>
        ))}

      {/* 10. WHATSAPP BUTTON */}
      {blocks
        .filter((b) => b.type === "whatsapp_button" && b.visible)
        .map((b) => (
          <section key={b.id} className="p-4 sm:p-6 bg-white text-center">
            <a
              href={`https://wa.me/${b.data.phoneNumber || "221770000000"}?text=${encodeURIComponent(
                b.data.prefilledMessage || "Bonjour"
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs sm:text-sm py-3 px-6 shadow-md transition"
            >
              <Smartphone className="h-4 w-4" />
              <span>{b.data.buttonText || "Commander Directement Par WhatsApp"}</span>
            </a>
          </section>
        ))}

      {/* 11. FAQ ACCORDION */}
      {blocks
        .filter((b) => b.type === "faq" && b.visible)
        .map((b) => (
          <section key={b.id} className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200/80 space-y-4">
            <div className="text-center max-w-sm mx-auto space-y-1">
              <h2 className="text-base sm:text-lg font-black text-slate-950">
                {b.data.sectionTitle}
              </h2>
              {b.data.sectionSubtitle && (
                <p className="text-xs text-slate-600">{b.data.sectionSubtitle}</p>
              )}
            </div>

            <div className="space-y-2">
              {(b.data.faqs || []).map((faq: FaqItem, idx: number) => {
                const isOpen = expandedFaqIndex === idx;
                return (
                  <div
                    key={faq.id || idx}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaqIndex(isOpen ? null : idx)}
                      className="w-full p-3.5 text-left font-bold text-xs text-slate-900 flex items-center justify-between gap-2"
                    >
                      <span>{faq.question}</span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

      {/* 12. FOOTER */}
      {blocks
        .filter((b) => b.type === "footer" && b.visible)
        .map((b) => (
          <footer
            key={b.id}
            className="p-6 bg-slate-900 text-slate-400 text-center text-[10px] space-y-2"
          >
            <p className="font-semibold text-slate-300">{b.data.copyrightText}</p>
            {b.data.disclaimerText && (
              <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                {b.data.disclaimerText}
              </p>
            )}
          </footer>
        ))}

      {/* 13. STICKY CTA MOBILE */}
      {blocks
        .filter((b) => b.type === "sticky_cta" && b.visible && b.data.enabled)
        .map((b) => (
          <div
            key={b.id}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 max-w-lg mx-auto"
          >
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">
                Offre Flash :
              </span>
              <span className="font-black text-sm text-emerald-700">
                {currentOffer?.promoPrice.toLocaleString("fr-FR")} {theme.currency}
              </span>
            </div>
            <button
              type="button"
              onClick={scrollToForm}
              className="flex-1 rounded-xl py-2.5 px-4 text-center font-black text-xs text-white shadow-md transition"
              style={{ backgroundColor: primaryColor }}
            >
              {b.data.buttonText || "Commander (Paiement Réception)"}
            </button>
          </div>
        ))}
    </div>
  );

  // Si on est en mode public direct (sur le web)
  if (isPublic) {
    return (
      <div className="min-h-screen bg-slate-100 flex justify-center">
        <div className="w-full max-w-lg bg-white shadow-xl min-h-screen">
          {pageContent}
        </div>
      </div>
    );
  }

  // Si on est dans le Studio (Panneau d'administration)
  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Switcher Mobile / Desktop */}
      <div className="flex items-center justify-between bg-surface-raised border border-surface-border rounded-xl px-3 py-2">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          Aperçu Visuel Temps Réel
        </span>
        <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-surface-border">
          <button
            type="button"
            onClick={() => setDeviceMode("mobile")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
              deviceMode === "mobile"
                ? "bg-brand text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Smartphone Mobile (95% du trafic)
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode("desktop")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
              deviceMode === "desktop"
                ? "bg-brand text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Écran Ordinateur
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 flex justify-center items-start overflow-y-auto max-h-[750px] p-2 bg-surface/40 rounded-2xl border border-surface-border">
        {deviceMode === "mobile" ? (
          <div className="w-[380px] rounded-[38px] border-[8px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden relative">
            {/* Speaker & camera notch */}
            <div className="absolute top-0 inset-x-0 h-5 bg-slate-800 z-50 flex items-center justify-center">
              <div className="h-3 w-28 bg-slate-950 rounded-b-xl" />
            </div>
            {/* Screen content */}
            <div className="overflow-y-auto max-h-[680px] pt-4 pb-14 bg-white">
              {pageContent}
            </div>
            {/* Home indicator bar */}
            <div className="absolute bottom-1 inset-x-0 h-4 bg-slate-800 z-50 flex items-center justify-center">
              <div className="h-1 w-24 bg-slate-600 rounded-full" />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-white shadow-2xl overflow-y-auto max-h-[700px]">
            {pageContent}
          </div>
        )}
      </div>
    </div>
  );
}
