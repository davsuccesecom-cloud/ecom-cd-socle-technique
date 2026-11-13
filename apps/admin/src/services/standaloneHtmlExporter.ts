import type { ProductPageData, FeatureItem, PricingOffer, CustomerReview, FaqItem, ComparisonRow, GuaranteeItem } from "../types/productBuilder";

export function generateStandaloneHtml(pageData: ProductPageData, waritrackApiEndpoint?: string): string {
  const { theme, tracking, blocks } = pageData;
  const primaryColor = theme.primaryColor || "#16a34a";
  const heroBlock = blocks.find((b) => b.type === "hero" && b.visible);
  const urgencyBlock = blocks.find((b) => b.type === "urgency_bar" && b.visible);
  const headerBlock = blocks.find((b) => b.type === "header" && b.visible);
  const featuresBlock = blocks.find((b) => b.type === "features" && b.visible);
  const offersBlock = blocks.find((b) => b.type === "offers" && b.visible);
  const comparisonBlock = blocks.find((b) => b.type === "comparison" && b.visible);
  const guaranteesBlock = blocks.find((b) => b.type === "guarantees" && b.visible);
  const reviewsBlock = blocks.find((b) => b.type === "reviews" && b.visible);
  const codFormBlock = blocks.find((b) => b.type === "cod_form" && b.visible);
  const whatsappBlock = blocks.find((b) => b.type === "whatsapp_button" && b.visible);
  const faqBlock = blocks.find((b) => b.type === "faq" && b.visible);
  const footerBlock = blocks.find((b) => b.type === "footer" && b.visible);

  const offers: PricingOffer[] = offersBlock?.data?.offers || [
    {
      id: "p1",
      title: "1 Article",
      quantity: 1,
      regularPrice: heroBlock?.data?.regularPrice || 35000,
      promoPrice: heroBlock?.data?.promoPrice || 19500,
      isPopular: true,
    },
  ];

  return `<!DOCTYPE html>
<html lang="fr" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${pageData.productName} — Boutique Officielle</title>
  <meta name="description" content="${heroBlock?.data?.subtitle || pageData.productName}">
  <!-- Tailwind CSS CDN (Ultra-léger & Rapide) -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: '${primaryColor}',
            brandHover: '#15803d',
          }
        }
      }
    }
  </script>
  <style>
    @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
    .animate-marquee-slow { display: inline-block; animation: marquee 25s linear infinite; }
  </style>

  <!-- Meta Pixel Code -->
  ${tracking.metaPixelId ? `
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${tracking.metaPixelId}');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', { content_name: '${pageData.productName.replace(/'/g, "\\'")}', value: ${heroBlock?.data?.promoPrice || 0}, currency: '${theme.currency}' });
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${tracking.metaPixelId}&ev=PageView&noscript=1"/></noscript>
  ` : ""}

  <!-- TikTok Pixel Code -->
  ${tracking.tiktokPixelId ? `
  <script>
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
      ttq.load('${tracking.tiktokPixelId}');
      ttq.page();
    }(window, document, 'ttq');
  </script>
  ` : ""}
</head>
<body class="bg-slate-100 text-slate-900 font-sans antialiased min-h-screen flex justify-center selection:bg-emerald-100 selection:text-emerald-900">
  <div class="w-full max-w-lg bg-white shadow-2xl min-h-screen relative pb-16">

    ${urgencyBlock ? `
    <!-- Urgency Bar -->
    <div class="py-2 px-3 text-center text-xs font-bold tracking-wide text-white flex items-center justify-center gap-2" style="background-color: ${urgencyBlock.data.bgColor || "#dc2626"}; color: ${urgencyBlock.data.textColor || "#ffffff"};">
      <span>⚡</span>
      <span class="truncate">${urgencyBlock.data.marqueeText}</span>
    </div>
    ` : ""}

    ${headerBlock ? `
    <!-- Header -->
    <header class="border-b border-slate-200/80 bg-white/95 px-4 py-3 sticky top-0 z-30 backdrop-blur-md flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="h-8 w-8 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-sm" style="background-color: ${primaryColor}">
          ${(headerBlock.data.brandName || "EC").substring(0, 2).toUpperCase()}
        </div>
        <span class="font-extrabold text-sm tracking-tight text-slate-900">
          ${headerBlock.data.brandName || "Boutique Officielle"}
        </span>
      </div>
      ${headerBlock.data.trustBadgeText ? `
      <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200">
        ✓ ${headerBlock.data.trustBadgeText}
      </span>
      ` : ""}
    </header>
    ` : ""}

    ${heroBlock ? `
    <!-- Hero Section -->
    <section class="p-4 sm:p-6 space-y-4">
      ${heroBlock.data.badge ? `
      <div class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 border border-amber-300">
        <span>🔥</span>
        ${heroBlock.data.badge}
      </div>
      ` : ""}

      <h1 class="text-xl sm:text-2xl font-black tracking-tight text-slate-950 leading-snug">
        ${heroBlock.data.title}
      </h1>

      ${heroBlock.data.subtitle ? `
      <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
        ${heroBlock.data.subtitle}
      </p>
      ` : ""}

      <!-- Étoiles & Note -->
      <div class="flex items-center gap-2 text-xs">
        <div class="flex text-amber-500">★★★★★</div>
        <span class="font-bold text-slate-900">${heroBlock.data.ratingScore || "4.9"} / 5</span>
        <span class="text-slate-500">(${heroBlock.data.ratingCount || "340"} avis vérifiés)</span>
      </div>

      <!-- Image Principale -->
      ${heroBlock.data.images && heroBlock.data.images.length > 0 ? `
      <div class="aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner relative">
        <img id="main-product-img" src="${heroBlock.data.images[0]}" alt="${pageData.productName}" class="h-full w-full object-cover">
        ${heroBlock.data.discountTag ? `
        <span class="absolute top-3 right-3 rounded-xl bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-lg">
          ${heroBlock.data.discountTag}
        </span>
        ` : ""}
      </div>
      ` : ""}

      <!-- Tarifs Hero -->
      <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 flex items-baseline justify-between">
        <div>
          <span class="text-[11px] font-semibold text-slate-500 block">Prix spécial promotionnel :</span>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-black text-emerald-700">
              ${(heroBlock.data.promoPrice || 0).toLocaleString("fr-FR")} ${theme.currency}
            </span>
            ${heroBlock.data.regularPrice > heroBlock.data.promoPrice ? `
            <span class="text-sm font-semibold text-slate-400 line-through">
              ${heroBlock.data.regularPrice.toLocaleString("fr-FR")} ${theme.currency}
            </span>
            ` : ""}
          </div>
        </div>
        <span class="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
          Paiement Réception
        </span>
      </div>

      <button onclick="scrollToForm()" class="w-full rounded-2xl py-3.5 px-4 text-center font-black text-sm text-white shadow-lg transition active:scale-98" style="background-color: ${primaryColor}">
        ${heroBlock.data.ctaButtonText || "COMMANDER · PAIEMENT À LA LIVRAISON"} ➔
      </button>
      ${heroBlock.data.ctaSubtext ? `
      <p class="text-center text-[11px] font-semibold text-slate-500">
        ${heroBlock.data.ctaSubtext}
      </p>
      ` : ""}
    </section>
    ` : ""}

    ${featuresBlock ? `
    <!-- Bénéfices Clés -->
    <section class="p-4 sm:p-6 bg-slate-50 border-y border-slate-200/80 space-y-4">
      <div class="text-center space-y-1">
        <h2 class="text-base font-black text-slate-950">${featuresBlock.data.sectionTitle}</h2>
        ${featuresBlock.data.sectionSubtitle ? `<p class="text-xs text-slate-600">${featuresBlock.data.sectionSubtitle}</p>` : ""}
      </div>

      <div class="space-y-2.5">
        ${(featuresBlock.data.features || []).map((f: FeatureItem) => `
        <div class="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm flex items-start gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm" style="background-color: ${primaryColor}">
            ${f.customIconUrl ? `<img src="${f.customIconUrl}" class="h-5 w-5 object-contain" />` : "✓"}
          </div>
          <div>
            <h3 class="font-extrabold text-xs text-slate-900 leading-snug">${f.title}</h3>
            <p class="text-[11px] text-slate-600 leading-relaxed">${f.description}</p>
          </div>
        </div>
        `).join("")}
      </div>
    </section>
    ` : ""}

    ${offersBlock ? `
    <!-- Packs Promo -->
    <section class="p-4 sm:p-6 space-y-4">
      <div class="text-center space-y-1">
        <h2 class="text-base font-black text-slate-950">${offersBlock.data.sectionTitle}</h2>
        ${offersBlock.data.sectionSubtitle ? `<p class="text-xs text-slate-600">${offersBlock.data.sectionSubtitle}</p>` : ""}
      </div>

      <div class="space-y-2.5" id="offers-container">
        ${offers.map((offer, idx) => `
        <div onclick="selectOffer(${idx}, '${offer.title}', ${offer.quantity}, ${offer.promoPrice})"
             id="offer-card-${idx}"
             class="cursor-pointer rounded-2xl border-2 p-3.5 transition-all relative ${idx === 1 || (offers.length === 1 && idx === 0) ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20" : "border-slate-200 bg-white"}">
          ${offer.badge ? `
          <span class="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm ${offer.isPopular ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-white"}">
            ${offer.badge}
          </span>
          ` : ""}
          <div class="flex items-center justify-between gap-3">
            <div>
              <h4 class="font-extrabold text-xs text-slate-950">${offer.title}</h4>
              <span class="text-[11px] text-slate-500">Quantité : ${offer.quantity} pièce${offer.quantity > 1 ? "s" : ""}</span>
            </div>
            <div class="text-right">
              <span class="font-black text-sm text-emerald-700 block">${offer.promoPrice.toLocaleString("fr-FR")} ${theme.currency}</span>
              ${offer.regularPrice > offer.promoPrice ? `<span class="text-[11px] text-slate-400 line-through">${offer.regularPrice.toLocaleString("fr-FR")} ${theme.currency}</span>` : ""}
            </div>
          </div>
        </div>
        `).join("")}
      </div>
    </section>
    ` : ""}

    ${comparisonBlock ? `
    <!-- Comparatif -->
    <section class="p-4 sm:p-6 bg-slate-50 border-y border-slate-200/80 space-y-4">
      <div class="text-center space-y-1">
        <h2 class="text-base font-black text-slate-950">${comparisonBlock.data.sectionTitle}</h2>
        ${comparisonBlock.data.sectionSubtitle ? `<p class="text-xs text-slate-600">${comparisonBlock.data.sectionSubtitle}</p>` : ""}
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div class="grid grid-cols-3 bg-slate-900 text-white text-[11px] font-black p-2.5 text-center">
          <span class="text-left pl-2">Critères</span>
          <span class="text-emerald-400">Notre Produit</span>
          <span class="text-rose-400">Autres Copies</span>
        </div>
        <div class="divide-y divide-slate-100 text-xs">
          ${(comparisonBlock.data.rows || []).map((row: ComparisonRow) => `
          <div class="grid grid-cols-3 p-3 items-center">
            <span class="font-bold text-slate-800 text-[11px] pr-2">${row.feature}</span>
            <div class="text-center font-semibold text-emerald-700 text-[11px] px-1 flex flex-col items-center">
              <span>✓ ${row.us}</span>
            </div>
            <div class="text-center text-slate-500 text-[11px] px-1 flex flex-col items-center">
              <span>✗ ${row.them}</span>
            </div>
          </div>
          `).join("")}
        </div>
      </div>
    </section>
    ` : ""}

    ${guaranteesBlock ? `
    <!-- Garanties -->
    <section class="p-4 sm:p-6 space-y-3">
      <div class="grid grid-cols-2 gap-2.5">
        ${(guaranteesBlock.data.items || []).map((g: GuaranteeItem) => `
        <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col items-center text-center space-y-1">
          <span class="text-xl">🛡️</span>
          <h4 class="font-extrabold text-xs text-slate-900 leading-tight">${g.title}</h4>
          <p class="text-[10px] text-slate-500 leading-tight">${g.subtitle}</p>
        </div>
        `).join("")}
      </div>
    </section>
    ` : ""}

    ${reviewsBlock ? `
    <!-- Avis Clients -->
    <section class="p-4 sm:p-6 bg-slate-50 border-y border-slate-200/80 space-y-4">
      <div class="text-center space-y-1">
        <h2 class="text-base font-black text-slate-950">${reviewsBlock.data.sectionTitle}</h2>
        ${reviewsBlock.data.sectionSubtitle ? `<p class="text-xs text-slate-600">${reviewsBlock.data.sectionSubtitle}</p>` : ""}
      </div>
      <div class="space-y-3">
        ${(reviewsBlock.data.reviews || []).map((rev: CustomerReview) => `
        <div class="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              ${rev.avatarUrl ? `<img src="${rev.avatarUrl}" class="h-9 w-9 rounded-full object-cover border border-slate-200">` : `<div class="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">${rev.authorName.charAt(0)}</div>`}
              <div>
                <h4 class="font-extrabold text-xs text-slate-900 leading-none">${rev.authorName}</h4>
                <span class="text-[10px] text-slate-500">${rev.location}</span>
              </div>
            </div>
            <span class="text-[10px] text-slate-400">${rev.dateText}</span>
          </div>
          <div class="text-amber-400 text-xs">★★★★★ <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">✓ Achat Vérifié</span></div>
          <p class="text-xs text-slate-700 italic leading-relaxed">"${rev.comment}"</p>
        </div>
        `).join("")}
      </div>
    </section>
    ` : ""}

    ${codFormBlock ? `
    <!-- COD Order Form -->
    <section id="cod-order-form-anchor" class="p-4 sm:p-6 bg-slate-900 text-white scroll-mt-14">
      <div class="rounded-3xl border-2 border-emerald-500/50 bg-slate-950 p-5 shadow-2xl space-y-4">
        <div class="text-center space-y-1">
          <span class="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black tracking-wider text-emerald-400 border border-emerald-500/30 uppercase inline-block">
            ${codFormBlock.data.badgeText || "PAIEMENT À LA LIVRAISON (0 FRANC D'AVANCE)"}
          </span>
          <h3 class="text-lg font-black text-white">${codFormBlock.data.formTitle}</h3>
          ${codFormBlock.data.formSubtitle ? `<p class="text-xs text-slate-400">${codFormBlock.data.formSubtitle}</p>` : ""}
        </div>

        <div class="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-slate-400 block">Offre sélectionnée :</span>
            <span id="selected-offer-summary" class="font-extrabold text-xs text-white">${offers[0]?.title}</span>
          </div>
          <span id="selected-offer-price" class="text-base font-black text-emerald-400">${(offers[0]?.promoPrice || 0).toLocaleString("fr-FR")} ${theme.currency}</span>
        </div>

        <form id="cod-form" onsubmit="handleFormSubmit(event)" class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Votre Nom & Prénom Complet :</label>
            <input type="text" id="clientName" required placeholder="Ex: Moussa Diop ou Aminata Koné" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Numéro WhatsApp (pour la livraison) :</label>
            <div class="flex">
              <span class="inline-flex items-center rounded-l-xl border border-r-0 border-slate-700 bg-slate-800 px-3 text-xs font-mono text-emerald-400">
                ${theme.phonePrefix || "+221"}
              </span>
              <input type="tel" id="clientPhone" required placeholder="Ex: 77 000 00 00" class="w-full rounded-r-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Ville de livraison :</label>
            <select id="clientCity" class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none">
              <option value="">Sélectionnez votre ville...</option>
              ${(codFormBlock.data.cityOptions || "Dakar, Thiès, Mbour, Autre ville").split(",").map((c: string) => `<option value="${c.trim()}">${c.trim()}</option>`).join("")}
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Quartier ou Adresse exacte :</label>
            <input type="text" id="clientAddress" placeholder="Ex: Plateau, près du rond-point..." class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none">
          </div>

          <button type="submit" id="submit-btn" class="w-full rounded-2xl py-3.5 px-4 text-center font-black text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-xl transition active:scale-98 mt-2 flex items-center justify-center gap-2">
            <span>${codFormBlock.data.buttonText || "CONFIRMER MA COMMANDE MAINTENANT"} ➔</span>
          </button>
        </form>

        <div id="order-success-box" class="hidden rounded-2xl bg-emerald-950/90 border border-emerald-500 p-5 text-center space-y-3">
          <div class="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto text-2xl font-bold">✓</div>
          <h4 class="text-base font-black text-white">Commande Validée Avec Succès !</h4>
          <p class="text-xs text-slate-300" id="success-desc">Une conseillère va vous contacter par téléphone d'ici 15 minutes pour convenir de l'heure exacte de livraison.</p>
        </div>
      </div>
    </section>
    ` : ""}

    ${whatsappBlock ? `
    <!-- WhatsApp Direct Button -->
    <section class="p-4 sm:p-6 bg-white text-center">
      <a href="https://wa.me/${whatsappBlock.data.phoneNumber || "221770000000"}?text=${encodeURIComponent(whatsappBlock.data.prefilledMessage || "Bonjour")}" target="_blank" class="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-white font-extrabold text-xs py-3 px-6 shadow-md">
        <span>💬</span>
        <span>${whatsappBlock.data.buttonText || "Commander Par WhatsApp Direct"}</span>
      </a>
    </section>
    ` : ""}

    ${faqBlock ? `
    <!-- FAQ -->
    <section class="p-4 sm:p-6 bg-slate-50 border-t border-slate-200/80 space-y-4">
      <div class="text-center space-y-1">
        <h2 class="text-base font-black text-slate-950">${faqBlock.data.sectionTitle}</h2>
      </div>
      <div class="space-y-2">
        ${(faqBlock.data.faqs || []).map((faq: FaqItem, idx: number) => `
        <details class="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm group">
          <summary class="font-bold text-xs text-slate-900 cursor-pointer list-none flex items-center justify-between">
            <span>${faq.question}</span>
            <span class="text-slate-400 group-open:rotate-180 transition">▼</span>
          </summary>
          <p class="mt-2 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2">${faq.answer}</p>
        </details>
        `).join("")}
      </div>
    </section>
    ` : ""}

    ${footerBlock ? `
    <!-- Footer -->
    <footer class="p-6 bg-slate-900 text-slate-400 text-center text-[10px] space-y-2">
      <p class="font-semibold text-slate-300">${footerBlock.data.copyrightText}</p>
      ${footerBlock.data.disclaimerText ? `<p class="text-slate-500 max-w-md mx-auto">${footerBlock.data.disclaimerText}</p>` : ""}
    </footer>
    ` : ""}

    <!-- Floating Sticky CTA -->
    <div class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 max-w-lg mx-auto">
      <div>
        <span class="text-[10px] text-slate-500 block font-semibold">Offre Flash :</span>
        <span id="sticky-price" class="font-black text-sm text-emerald-700">${(offers[0]?.promoPrice || 0).toLocaleString("fr-FR")} ${theme.currency}</span>
      </div>
      <button onclick="scrollToForm()" class="flex-1 rounded-xl py-2.5 px-4 text-center font-black text-xs text-white shadow-md transition" style="background-color: ${primaryColor}">
        Commander (Paiement Réception)
      </button>
    </div>

  </div>

  <script>
    var currentOffer = ${JSON.stringify(offers[0] || {})};
    var offersList = ${JSON.stringify(offers)};

    function selectOffer(index, title, qty, price) {
      currentOffer = offersList[index] || { title: title, quantity: qty, promoPrice: price };
      document.getElementById('selected-offer-summary').innerText = title + " (" + qty + " pièce" + (qty > 1 ? "s" : "") + ")";
      document.getElementById('selected-offer-price').innerText = price.toLocaleString('fr-FR') + ' ${theme.currency}';
      document.getElementById('sticky-price').innerText = price.toLocaleString('fr-FR') + ' ${theme.currency}';

      for (var i = 0; i < offersList.length; i++) {
        var card = document.getElementById('offer-card-' + i);
        if (card) {
          if (i === index) {
            card.className = "cursor-pointer rounded-2xl border-2 p-3.5 transition-all relative border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20";
          } else {
            card.className = "cursor-pointer rounded-2xl border-2 p-3.5 transition-all relative border-slate-200 bg-white hover:border-slate-300";
          }
        }
      }
      scrollToForm();
    }

    function scrollToForm() {
      var el = document.getElementById('cod-order-form-anchor');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      var name = document.getElementById('clientName').value;
      var phone = document.getElementById('clientPhone').value;
      var city = document.getElementById('clientCity').value;
      var address = document.getElementById('clientAddress').value;

      if (!name || !phone) {
        alert("Veuillez renseigner votre Nom et Numéro WhatsApp.");
        return;
      }

      var btn = document.getElementById('submit-btn');
      btn.innerText = "Validation de la commande...";
      btn.disabled = true;

      // Déclenchement Meta Pixel (Par défaut 'Lead' pour sécuriser le COD contre les faux achats)
      // L'événement officiel 'Purchase' est réservé à l'encaissement réel par le livreur via Meta CAPI
      var eventSubmitName = '${tracking.fireEventOnSubmit || "Lead"}';
      var formEventId = 'lead_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
      if (typeof fbq === 'function') {
        fbq('track', eventSubmitName, {
          content_name: '${pageData.productName.replace(/'/g, "\\'")}',
          value: currentOffer.promoPrice,
          currency: '${theme.currency}'
        }, { eventID: formEventId });
      }

      // Extraction des cookies Meta pour attribution réelle
      var fbpVal = (document.cookie.match(/(^|;\\s*)_fbp=([^;]*)/) || [])[2] || '';
      var fbcVal = (document.cookie.match(/(^|;\\s*)_fbc=([^;]*)/) || [])[2] || '';
      var searchParams = new URLSearchParams(window.location.search);
      var fbclidVal = searchParams.get('fbclid') || '';
      if (!fbcVal && fbclidVal) {
        fbcVal = 'fb.1.' + Date.now() + '.' + fbclidVal;
      }

      // Envoi de la commande vers WariTrack
      var orderPayload = {
        workspaceId: '${pageData.workspaceId}',
        teamId: '${pageData.teamId}',
        clientName: name,
        phone: '${theme.phonePrefix || "+221"}' + phone.replace(/^0+/, ''),
        city: city || 'Dakar',
        addressNote: address,
        product: '${pageData.productName.replace(/'/g, "\\'")}',
        quantity: currentOffer.quantity || 1,
        amount: currentOffer.promoPrice,
        source: 'waripage_landing',
        trafficSource: (fbclidVal || (fbcVal && fbcVal.indexOf('fb.1.') === 0)) ? 'meta_ads' : 'organique',
        fbp: fbpVal,
        fbc: fbcVal,
        fbclid: fbclidVal,
        pageUrl: window.location.href,
        formEventId: formEventId
      };

      ${waritrackApiEndpoint ? `
      fetch('${waritrackApiEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      }).catch(function(err){ console.error(err); });
      ` : ""}

      // Affichage confirmation
      setTimeout(function() {
        document.getElementById('cod-form').classList.add('hidden');
        document.getElementById('order-success-box').classList.remove('hidden');
        document.getElementById('success-desc').innerText = "Merci " + name + " ! Une conseillère va vous contacter par téléphone d'ici 15 minutes pour convenir de l'heure de livraison.";
      }, 600);
    }
  </script>
</body>
</html>`;
}
