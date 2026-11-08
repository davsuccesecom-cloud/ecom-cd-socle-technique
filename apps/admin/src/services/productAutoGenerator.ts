import type {
  ProductPageData,
  PageBlock,
  FeatureItem,
  PricingOffer,
  CustomerReview,
  FaqItem,
  ComparisonRow,
  GuaranteeItem,
} from "../types/productBuilder";

export interface AutoGeneratorInput {
  productName: string;
  category: string;
  promoPrice: number;
  regularPrice: number;
  currency: string;
  country: string; // "Sénégal" | "Côte d'Ivoire" | "Cameroun" | "Mali" | "Guinée" | "Gabon" | "RDC" | "Maroc" | "Autre"
  keyBenefits: string;
  targetAudience?: string;
  imageUrl?: string;
  supportPhone?: string;
}

const COUNTRY_CONFIGS: Record<
  string,
  {
    code: string;
    prefix: string;
    defaultCurrency: string;
    cities: string;
    names: { name: string; city: string; avatar: string }[];
  }
> = {
  Sénégal: {
    code: "SN",
    prefix: "+221",
    defaultCurrency: "FCFA",
    cities: "Dakar, Thiès, Mbour, Saint-Louis, Touba, Kaolack, Ziguinchor, Louga, Rufisque",
    names: [
      { name: "Fatou Diakhaté", city: "Dakar, Plateau", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
      { name: "Ibrahima Sarr", city: "Dakar, Almadies", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
      { name: "Aminata Ndiaye", city: "Thiès, Cité Lamy", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
      { name: "Moussa Seck", city: "Mbour, Saly", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
    ],
  },
  "Côte d'Ivoire": {
    code: "CI",
    prefix: "+225",
    defaultCurrency: "FCFA",
    cities: "Abidjan (Cocody, Yopougon, Marcory, Plateau), Bouaké, Yamoussoukro, San-Pédro, Korhogo, Daloa",
    names: [
      { name: "Kouassi Jean-Marc", city: "Abidjan, Cocody Angré", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
      { name: "Aïcha Bamba", city: "Abidjan, Marcory Zone 4", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
      { name: "Stéphane Konan", city: "Yamoussoukro", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
      { name: "Estelle Yao", city: "Abidjan, Riviera Palmeraie", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
    ],
  },
  Cameroun: {
    code: "CM",
    prefix: "+237",
    defaultCurrency: "FCFA",
    cities: "Douala (Akwa, Bonanjo, Bonapriso, Deido), Yaoundé (Bastos, Omnisports), Bafoussam, Kribi, Garoua",
    names: [
      { name: "Christian Mbarga", city: "Douala, Akwa", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
      { name: "Vanessa Fotso", city: "Yaoundé, Bastos", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
      { name: "Serge Kamdem", city: "Douala, Bonapriso", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
      { name: "Carine Ngo", city: "Yaoundé, Biyem-Assi", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" },
    ],
  },
  Mali: {
    code: "ML",
    prefix: "+223",
    defaultCurrency: "FCFA",
    cities: "Bamako (Badalabougou, ACI 2000, Faladié, Hamdallaye), Sikasso, Ségou, Mopti",
    names: [
      { name: "Oumar Traoré", city: "Bamako, ACI 2000", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
      { name: "Mariam Coulibaly", city: "Bamako, Badalabougou", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
      { name: "Souleymane Keita", city: "Ségou", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
    ],
  },
  Guinée: {
    code: "GN",
    prefix: "+224",
    defaultCurrency: "GNF",
    cities: "Conakry (Kaloum, Dixinn, Matam, Ratoma), Kankan, Kindia, Labé",
    names: [
      { name: "Mamadou Diallo", city: "Conakry, Kipé", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
      { name: "Fatoumata Camara", city: "Conakry, Nongo", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
      { name: "Ibrahima Bah", city: "Conakry, Lambanyi", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" },
    ],
  },
  Gabon: {
    code: "GA",
    prefix: "+241",
    defaultCurrency: "FCFA",
    cities: "Libreville (Louis, Akanda, Owendo, Glass), Port-Gentil, Franceville",
    names: [
      { name: "Brice Ondo", city: "Libreville, Akanda", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" },
      { name: "Sylvie Mba", city: "Libreville, Louis", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" },
    ],
  },
};

const DEFAULT_IMAGES_BY_CATEGORY: Record<string, string[]> = {
  "High-Tech & Accessoires": [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80",
  ],
  "Beauté & Bien-être": [
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1512290900672-1f486a48d8a7?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&auto=format&fit=crop&q=80",
  ],
  "Maison & Cuisine": [
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800&auto=format&fit=crop&q=80",
  ],
  "Santé & Forme": [
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
  ],
};

export function generateProductPageAuto(
  input: AutoGeneratorInput,
  workspaceId: string,
  teamId: string = ""
): ProductPageData {
  const countryConf = COUNTRY_CONFIGS[input.country] || COUNTRY_CONFIGS["Sénégal"];
  const currency = input.currency || countryConf.defaultCurrency;
  const pageId = "page_" + Math.random().toString(36).substring(2, 9);
  const slug = input.productName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40) || "produit-" + Math.floor(Math.random() * 1000);

  // Économie calculée
  const diff = Math.max(0, input.regularPrice - input.promoPrice);
  const percentOff = input.regularPrice > 0 ? Math.round((diff / input.regularPrice) * 100) : 40;

  // Images par défaut
  const defaultImages =
    DEFAULT_IMAGES_BY_CATEGORY[input.category] || DEFAULT_IMAGES_BY_CATEGORY.default;
  const images = input.imageUrl && input.imageUrl.trim().startsWith("http")
    ? [input.imageUrl.trim(), ...defaultImages.slice(1)]
    : defaultImages;

  // Calcul des packs groupés
  const duoPromo = Math.round(input.promoPrice * 1.75); // -12.5% sur le 2e
  const duoReg = input.regularPrice * 2;
  const trioPromo = Math.round(input.promoPrice * 2.4); // Très attractif
  const trioReg = input.regularPrice * 3;

  // Extraction ou génération de 4 bénéfices percutants
  const benefitTokens = input.keyBenefits
    ? input.keyBenefits.split(/[,;\n\.]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const featureItems: FeatureItem[] = [
    {
      id: "f1",
      iconName: "Zap",
      title: benefitTokens[0] || "Efficacité Immédiate & Visible",
      description: `Profitez d'un résultat instantané dès la première utilisation sans effort particulier.`,
    },
    {
      id: "f2",
      iconName: "ShieldCheck",
      title: benefitTokens[1] || "Qualité Supérieure Certifiée Durable",
      description: `Conçu avec des matériaux robustes résistants aux conditions climatiques locales et à l'usure intensive.`,
    },
    {
      id: "f3",
      iconName: "Award",
      title: benefitTokens[2] || "Simple, Pratique & Ergonomique",
      description: `Prise en main immédiate en moins de 2 minutes, idéal pour une utilisation quotidienne sans tracas.`,
    },
    {
      id: "f4",
      iconName: "Sparkles",
      title: benefitTokens[3] || "Garantie Totale & Zéro Risque",
      description: `Testez votre article tranquillement à domicile : paiement uniquement après réception et vérification complète du colis.`,
    },
  ];

  // Avis clients crédibles par pays
  const reviews: CustomerReview[] = countryConf.names.map((person, idx) => ({
    id: `rev_${idx + 1}`,
    authorName: person.name,
    location: person.city,
    rating: 5,
    comment:
      idx === 0
        ? `J'avais des doutes au départ, mais le livreur a été très pro. J'ai pu ouvrir le colis et tout tester avant de payer le livreur en liquide. Le produit fonctionne à merveille, rien à dire !`
        : idx === 1
        ? `Produit 100% conforme à la description. J'ai pris le pack de 2 pour profiter de la promo. Livraison rapide le lendemain de ma commande. Merci beaucoup !`
        : `Franchement top ! Très solide et simple d'utilisation. Le service client m'a même appelé pour confirmer mon adresse. Je recommande les yeux fermés.`,
    dateText: `Il y a ${idx * 2 + 1} jours`,
    verified: true,
    avatarUrl: person.avatar,
  }));

  const blocks: PageBlock[] = [
    {
      id: "block_urgency",
      type: "urgency_bar",
      title: "Barre d'Urgence & Offre Flash",
      visible: true,
      data: {
        marqueeText: `⚡ VENTE FLASH SPÉCIALE ${input.country.toUpperCase()} : -${percentOff}% AUJOURD'HUI SEULEMENT · PAIEMENT À LA RÉCEPTION ⚡`,
        countdownMinutes: 35,
        bgColor: "#dc2626",
        textColor: "#ffffff",
      },
    },
    {
      id: "block_header",
      type: "header",
      title: "En-tête & Marque",
      visible: true,
      data: {
        brandName: `${input.productName.split(" ")[0] || "Boutique"} Officiel`,
        logoUrl: "",
        supportPhone: input.supportPhone || "770000000",
        trustBadgeText: "Distributeur Officiel Garanti",
      },
    },
    {
      id: "block_hero",
      type: "hero",
      title: "Section Principale (Hero)",
      visible: true,
      data: {
        badge: `🔥 MEILLEURE VENTE ${input.country.toUpperCase()} · STOCK LIMITÉ`,
        title: `Découvrez Le Véritable ${input.productName}`,
        subtitle: input.targetAudience
          ? `La solution idéale spécialement pensée pour ${input.targetAudience.toLowerCase()}.`
          : `Gagnez du temps, simplifiez votre quotidien et profitez de résultats remarquables sans vous ruiner.`,
        ratingScore: "4.9",
        ratingCount: "420",
        regularPrice: input.regularPrice,
        promoPrice: input.promoPrice,
        discountTag: `ÉCONOMISEZ ${diff.toLocaleString("fr-FR")} ${currency} (-${percentOff}%)`,
        images,
        ctaButtonText: "COMMANDER MAINTENANT · PAIEMENT À LA LIVRAISON",
        ctaSubtext: `🔒 Paiement en main propre · Livraison express 24h-48h partout au pays`,
      },
    },
    {
      id: "block_features",
      type: "features",
      title: "Avantages Clés & Bénéfices",
      visible: true,
      data: {
        sectionTitle: `Pourquoi Choisir Notre ${input.productName} ?`,
        sectionSubtitle: "Tous les atouts qui font de notre modèle la référence absolue sur le marché.",
        features: featureItems,
      },
    },
    {
      id: "block_offers",
      type: "offers",
      title: "Packs Promo & Offres Groupées",
      visible: true,
      data: {
        sectionTitle: "Profitez de Nos Tarifs Dégressifs",
        sectionSubtitle: "Commandez 2 ou 3 articles et économisez encore plus sur votre facture globale !",
        offers: [
          {
            id: "pack_1",
            title: `1x ${input.productName}`,
            badge: "Offre Solo",
            quantity: 1,
            regularPrice: input.regularPrice,
            promoPrice: input.promoPrice,
            isPopular: false,
          },
          {
            id: "pack_2",
            title: `Pack Duo (2x ${input.productName})`,
            badge: `🔥 LE PLUS CHOISI (-${Math.round(((duoReg - duoPromo) / duoReg) * 100)}%)`,
            quantity: 2,
            regularPrice: duoReg,
            promoPrice: duoPromo,
            isPopular: true,
          },
          {
            id: "pack_3",
            title: `Pack Famille (3x ${input.productName})`,
            badge: "MEILLEUR TARIF UNITAIRE",
            quantity: 3,
            regularPrice: trioReg,
            promoPrice: trioPromo,
            isPopular: false,
          },
        ] as PricingOffer[],
      },
    },
    {
      id: "block_comparison",
      type: "comparison",
      title: "Comparatif (Notre Produit vs Autres)",
      visible: true,
      data: {
        sectionTitle: "Attention Aux Contrefaçons Vendues Moins Cher !",
        sectionSubtitle: "Découvrez la différence réelle entre notre modèle officiel garanti et les imitations du marché.",
        rows: [
          {
            id: "c1",
            feature: "Authenticité & Finition",
            us: "Pièces certifiées d'origine haute durabilité",
            them: "Plastique fragile et composants recyclés",
          },
          {
            id: "c2",
            feature: "Performance au quotidien",
            us: "Efficacité maximale testée en laboratoire",
            them: "Résultats décevants dès les premiers jours",
          },
          {
            id: "c3",
            feature: "Sécurité de paiement",
            us: "Paiement en espèces ou Mobile Money À LA LIVRAISON",
            them: "Virement forcé à l'avance sans garantie de recevoir",
          },
          {
            id: "c4",
            feature: "Service après-vente & Échange",
            us: "Garantie 30 jours avec remplacement gratuit",
            them: "Vendeur injoignable après encaissement",
          },
        ] as ComparisonRow[],
      },
    },
    {
      id: "block_guarantees",
      type: "guarantees",
      title: "Garanties & Confiance COD",
      visible: true,
      data: {
        items: [
          {
            id: "g1",
            iconName: "Truck",
            title: "Livraison Rapide 24h à 48h",
            subtitle: "Livré directement à domicile ou au bureau par nos coursiers de confiance.",
          },
          {
            id: "g2",
            iconName: "ShieldCheck",
            title: "Paiement à la Réception",
            subtitle: "Ne payez aucun acompte. Vous contrôlez votre colis avant tout règlement.",
          },
          {
            id: "g3",
            iconName: "RotateCcw",
            title: "Garantie Échange 30 Jours",
            subtitle: "Remplacement immédiat et gratuit en cas de problème technique.",
          },
          {
            id: "g4",
            iconName: "Headphones",
            title: "Assistance Téléphonique 7j/7",
            subtitle: "Une question ? Notre équipe locale est joignable à tout moment sur WhatsApp.",
          },
        ] as GuaranteeItem[],
      },
    },
    {
      id: "block_reviews",
      type: "reviews",
      title: "Avis Clients Vérifiés (Afrique)",
      visible: true,
      data: {
        sectionTitle: `Ils Ont Choisi ${input.productName}`,
        sectionSubtitle: `Découvrez les retours authentiques de clients livrés à travers tout le pays.`,
        reviews,
      },
    },
    {
      id: "block_cod_form",
      type: "cod_form",
      title: "Formulaire de Commande COD Express",
      visible: true,
      data: {
        formTitle: "Passez Votre Commande en 30 Secondes",
        formSubtitle: `Livraison gratuite offerte aujourd'hui partout en ${input.country}.`,
        badgeText: "PAIEMENT À LA LIVRAISON (ESPÈCES OU WAVE / ORANGE MONEY / MTN)",
        buttonText: "VALIDER MA COMMANDE MAINTENANT ➔",
        buttonSubtext: "Nos closeuses vous appelleront dans les 15 minutes pour confirmer l'heure de livraison",
        cityOptions: countryConf.cities,
        askAddressNote: true,
      },
    },
    {
      id: "block_whatsapp_button",
      type: "whatsapp_button",
      title: "Bouton Commande WhatsApp Directe",
      visible: true,
      data: {
        buttonText: "Commander Rapidement Par WhatsApp",
        phoneNumber: (input.supportPhone || "770000000").replace(/\D/g, ""),
        prefilledMessage: `Bonjour, je souhaite commander "${input.productName}" avec paiement à la livraison.`,
      },
    },
    {
      id: "block_faq",
      type: "faq",
      title: "Foire Aux Questions (FAQ)",
      visible: true,
      data: {
        sectionTitle: "Foire Aux Questions",
        sectionSubtitle: "Tout ce qu'il faut savoir avant de valider votre commande.",
        faqs: [
          {
            id: "q1",
            question: "Est-ce que je dois payer avant la livraison ?",
            answer: `Non, absolument pas ! Vous payez 0 franc à l'avance. Le paiement s'effectue directement auprès du livreur au moment où il vous remet le colis en main propre.`,
          },
          {
            id: "q2",
            question: `Quels sont les délais de livraison pour ${input.country} ?`,
            answer: `Pour la capitale et les grandes métropoles, la livraison s'effectue en moins de 24h chrono. Pour les villes secondaires ou provinces, comptez 48h.`,
          },
          {
            id: "q3",
            question: "Que se passe-t-il après avoir rempli le formulaire ?",
            answer: "Dès réception de votre formulaire, une conseillère de notre équipe vous appelle par téléphone ou vous écrit sur WhatsApp pour valider votre adresse exacte et convenir du créneau de livraison qui vous arrange.",
          },
          {
            id: "q4",
            question: "Que faire en cas de problème avec le produit ?",
            answer: "Vous disposez d'une garantie totale de 30 jours. Contactez simplement notre support sur WhatsApp et nous procédons à l'échange immédiat sans frais additionnels.",
          },
        ] as FaqItem[],
      },
    },
    {
      id: "block_sticky_cta",
      type: "sticky_cta",
      title: "Barre Mobile Flottante (Sticky CTA)",
      visible: true,
      data: {
        enabled: true,
        buttonText: "Commander (Paiement Réception)",
        targetBlockId: "block_cod_form",
      },
    },
    {
      id: "block_footer",
      type: "footer",
      title: "Pied de Page",
      visible: true,
      data: {
        copyrightText: `© 2026 ${input.productName.split(" ")[0] || "E-Shop"} Express. Tous droits réservés.`,
        disclaimerText: "Ce site web n'est affilié à aucune régie publicitaire (Meta, Facebook, Instagram, TikTok). Les marques citées appartiennent à leurs propriétaires respectifs.",
      },
    },
  ];

  return {
    id: pageId,
    workspaceId,
    teamId,
    slug,
    productName: input.productName,
    category: input.category,
    published: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    theme: {
      primaryColor: "#16a34a",
      accentColor: "#f59e0b",
      textColor: "#0f172a",
      bgColor: "#ffffff",
      fontFamily: "sans",
      currency,
      countryCode: countryConf.code,
      countryName: input.country,
      phonePrefix: countryConf.prefix,
    },
    tracking: {
      metaPixelId: "",
      tiktokPixelId: "",
      googleTagId: "",
      fireEventOnSubmit: "Purchase",
    },
    blocks,
  };
}
