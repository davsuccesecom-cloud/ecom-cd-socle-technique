// Types pour le créateur de pages produits COD (WariPage Studio)

export type BlockType =
  | "urgency_bar"
  | "header"
  | "hero"
  | "features"
  | "media_showcase"
  | "offers"
  | "comparison"
  | "reviews"
  | "guarantees"
  | "faq"
  | "cod_form"
  | "whatsapp_button"
  | "sticky_cta"
  | "footer";

export interface FeatureItem {
  id: string;
  iconName: string; // Lucide icon name or 'custom'
  customIconUrl?: string;
  title: string;
  description: string;
}

export interface PricingOffer {
  id: string;
  title: string; // ex: "1 Pièce (Découverte)"
  badge?: string; // ex: "Le plus populaire"
  quantity: number;
  regularPrice: number;
  promoPrice: number;
  isPopular?: boolean;
}

export interface CustomerReview {
  id: string;
  authorName: string; // ex: "Fatou Diop"
  location: string; // ex: "Dakar, Sénégal"
  rating: number; // 1 à 5
  comment: string;
  dateText: string;
  verified: boolean;
  avatarUrl?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ComparisonRow {
  id: string;
  feature: string;
  us: string; // Ce que notre produit offre
  them: string; // Ce que les contrefaçons offrent
}

export interface GuaranteeItem {
  id: string;
  iconName: string;
  customIconUrl?: string;
  title: string;
  subtitle: string;
}

export interface PageBlock {
  id: string;
  type: BlockType;
  title: string;
  visible: boolean;
  data: Record<string, any>;
}

export interface ThemeConfig {
  primaryColor: string; // Couleur dominante d'action (ex: "#16a34a" vert conversion ou "#ea580c" orange feu)
  accentColor: string; // Couleur secondaire / badge (ex: "#eab308" or)
  textColor: string;
  bgColor: string;
  fontFamily: "sans" | "serif" | "display";
  currency: string; // "FCFA", "GNF", "MAD", "DZD", "EUR"
  countryCode: string; // "SN", "CI", "CM", "ML", "GN", etc.
  countryName: string;
  phonePrefix: string; // "+221", "+225", "+237", etc.
}

export interface TrackingConfig {
  metaPixelId?: string;
  tiktokPixelId?: string;
  googleTagId?: string;
  fireEventOnSubmit: "Purchase" | "Lead";
  customHeadScript?: string;
}

export interface ProductPageData {
  id: string;
  workspaceId: string;
  teamId: string; // Marché WariTrack lié (Sénégal, Côte d'Ivoire, etc.)
  slug: string;
  productName: string;
  category: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
  theme: ThemeConfig;
  tracking: TrackingConfig;
  blocks: PageBlock[];
}

// Données types de départ préremplies avec un copywriting COD africain redoutable
export function createDefaultProductPage(workspaceId: string, teamId: string = ""): ProductPageData {
  const pageId = "page_" + Math.random().toString(36).substring(2, 9);
  return {
    id: pageId,
    workspaceId,
    teamId,
    slug: "montre-ultra-max-pro",
    productName: "Montre Connectée Ultra Max Pro 2026",
    category: "High-Tech & Accessoires",
    published: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    theme: {
      primaryColor: "#16a34a", // Vert vif confiance / conversion
      accentColor: "#f59e0b", // Jaune or
      textColor: "#0f172a",
      bgColor: "#ffffff",
      fontFamily: "sans",
      currency: "FCFA",
      countryCode: "SN",
      countryName: "Sénégal",
      phonePrefix: "+221",
    },
    tracking: {
      metaPixelId: "",
      tiktokPixelId: "",
      googleTagId: "",
      fireEventOnSubmit: "Purchase",
    },
    blocks: [
      {
        id: "block_urgency",
        type: "urgency_bar",
        title: "Barre d'Urgence & Offre Flash",
        visible: true,
        data: {
          marqueeText: "⚡ VENTE FLASH SPÉCIALE : -50% AUJOURD'HUI · PAIEMENT À LA LIVRAISON APRÈS VÉRIFICATION DU COLIS ⚡",
          countdownMinutes: 45,
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
          brandName: "E-Boutique Express Afrique",
          logoUrl: "",
          supportPhone: "770000000",
          trustBadgeText: "Distributeur Officiel Agréé",
        },
      },
      {
        id: "block_hero",
        type: "hero",
        title: "Section Principale (Hero)",
        visible: true,
        data: {
          badge: "🔥 MEILLEURE VENTE 2026 · STOCK LIMITÉ EN AFRIQUE",
          title: "Simplifiez Votre Vie Avec La Nouvelle Montre Ultra Max Pro",
          subtitle: "Passez vos appels directement au poignet, suivez votre santé en direct et profitez d'une batterie monstre de 7 jours sans recharge.",
          ratingScore: "4.9",
          ratingCount: "348",
          regularPrice: 35000,
          promoPrice: 19500,
          discountTag: "ÉCONOMISEZ 15 500 FCFA (-45%)",
          images: [
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80",
          ],
          ctaButtonText: "COMMANDER MAINTENANT · PAIEMENT À LA LIVRAISON",
          ctaSubtext: "🔒 Paiement après vérification · Livraison rapide 24h-48h",
        },
      },
      {
        id: "block_features",
        type: "features",
        title: "Avantages Clés & Bénéfices",
        visible: true,
        data: {
          sectionTitle: "Pourquoi Tout Le Monde S'arrache Cette Montre ?",
          sectionSubtitle: "Conçue pour durer, résister à la chaleur et vous accompagner au quotidien.",
          features: [
            {
              id: "f1",
              iconName: "PhoneCall",
              title: "Appels Bluetooth Clairs & Sans Écho",
              description: "Décrochez et parlez en conduisant ou au travail grâce au haut-parleur haute fidélité intégré.",
            },
            {
              id: "f2",
              iconName: "BatteryCharging",
              title: "Autonomie Record de 7 Jours",
              description: "Plus besoin de charger tous les soirs. Une seule charge rapide vous offre une semaine complète d'utilisation.",
            },
            {
              id: "f3",
              iconName: "HeartPulse",
              title: "Suivi Cardiaque & Tension en Direct",
              description: "Surveillez votre rythme cardiaque, votre oxygène sanguin et la qualité de votre sommeil jour et nuit.",
            },
            {
              id: "f4",
              iconName: "ShieldCheck",
              title: "Écran Saphir Anti-Rayures & Étanche",
              description: "Résiste à la pluie, à la transpiration et aux chocs du quotidien sans aucune rayure.",
            },
          ] as FeatureItem[],
        },
      },
      {
        id: "block_offers",
        type: "offers",
        title: "Packs Promo & Offres Groupées",
        visible: true,
        data: {
          sectionTitle: "Choisissez Votre Pack Économique",
          sectionSubtitle: "Profitez d'une réduction supplémentaire en commandant pour vous et vos proches aujourd'hui.",
          offers: [
            {
              id: "pack_1",
              title: "Pack Découverte (1 Montre)",
              badge: "Classique",
              quantity: 1,
              regularPrice: 35000,
              promoPrice: 19500,
              isPopular: false,
            },
            {
              id: "pack_2",
              title: "Pack Duo (2 Montres - Pour Couple ou Ami)",
              badge: "🔥 LE PLUS POPULAIRE (-60%)",
              quantity: 2,
              regularPrice: 70000,
              promoPrice: 32000,
              isPopular: true,
            },
            {
              id: "pack_3",
              title: "Pack Famille (3 Montres)",
              badge: "MEILLEUR PRIX UNITAIRE",
              quantity: 3,
              regularPrice: 105000,
              promoPrice: 45000,
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
          sectionTitle: "Ne Vous Faites Plus Avoir Par Les Imitations !",
          sectionSubtitle: "Voici pourquoi notre modèle officiel Ultra Max Pro surpasse les copies vendues au marché.",
          rows: [
            {
              id: "c1",
              feature: "Qualité d'appel & Micro",
              us: "Micro antibruit HD certifié",
              them: "Son étouffé et grésillements",
            },
            {
              id: "c2",
              feature: "Autonomie réelle de batterie",
              us: "5 à 7 jours en usage intensif",
              them: "Se décharge en moins de 12 heures",
            },
            {
              id: "c3",
              feature: "Résistance à l'eau",
              us: "Norme IP68 immersion complète",
              them: "Prend l'eau à la première goutte",
            },
            {
              id: "c4",
              feature: "Garantie & Paiement",
              us: "Paiement à la livraison après test",
              them: "Paiement forcé d'avance sans recours",
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
              title: "Livraison Express 24h-48h",
              subtitle: "Colis acheminé à votre porte ou bureau en toute discrétion.",
            },
            {
              id: "g2",
              iconName: "ShieldCheck",
              title: "Paiement à la Réception",
              subtitle: "Vous ouvrez, vous vérifiez votre colis avant de régler en espèces ou Mobile Money.",
            },
            {
              id: "g3",
              iconName: "RotateCcw",
              title: "Garantie Satisfait ou Échangé",
              subtitle: "30 jours d'échange immédiat sans discussion en cas de moindre souci technique.",
            },
            {
              id: "g4",
              iconName: "Headphones",
              title: "Assistance Client 7j/7",
              subtitle: "Nos conseillers locaux vous répondent sur WhatsApp à tout moment.",
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
          sectionTitle: "Ce Que Disent Nos Clients Satisfaits",
          sectionSubtitle: "Plus de 1 200 clients livrés avec succès à travers tout le pays.",
          reviews: [
            {
              id: "r1",
              authorName: "Moussa Diakhaté",
              location: "Dakar, Plateau",
              rating: 5,
              comment: "Franchement j'avais des doutes au départ car il y a trop d'arnaques en ligne. Mais le livreur est venu, j'ai allumé la montre, testé les appels avant de payer. La qualité est magnifique, batterie au top !",
              dateText: "Il y a 2 jours",
              verified: true,
              avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            },
            {
              id: "r2",
              authorName: "Aminata Traoré",
              location: "Abidjan, Cocody",
              rating: 5,
              comment: "J'ai pris le pack duo pour mon mari et moi. Très classe au poignet, les notifications WhatsApp et appels passent nickel. Reçu en moins de 24h. Je recommande à 100% !",
              dateText: "Il y a 4 jours",
              verified: true,
              avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            },
            {
              id: "r3",
              authorName: "Christian Mbarga",
              location: "Douala, Akwa",
              rating: 5,
              comment: "Le haut-parleur est très puissant, j'arrive à décrocher en pleine circulation à moto. Produit 100% conforme à la vidéo. Merci pour le professionnalisme !",
              dateText: "La semaine dernière",
              verified: true,
              avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
            },
          ] as CustomerReview[],
        },
      },
      {
        id: "block_cod_form",
        type: "cod_form",
        title: "Formulaire de Commande COD Express",
        visible: true,
        data: {
          formTitle: "Remplissez Ce Formulaire Pour Être Livré",
          formSubtitle: "⚠️ Merci de ne commander que si vous êtes disponible avec la somme prête pour la livraison.",
          badgeText: "PAIEMENT À LA LIVRAISON (CASH OU WAVE / ORANGE MONEY)",
          buttonText: "CONFIRMER MA COMMANDE MAINTENANT ➔",
          buttonSubtext: "Livraison gratuite offerte aujourd'hui seulement",
          cityOptions: "Dakar, Thiès, Mbour, Saint-Louis, Touba, Kaolack, Ziguinchor, Autre ville",
          askAddressNote: true,
        },
      },
      {
        id: "block_whatsapp_button",
        type: "whatsapp_button",
        title: "Bouton Commande WhatsApp Directe",
        visible: true,
        data: {
          buttonText: "Commander Directement Par WhatsApp",
          phoneNumber: "221770000000",
          prefilledMessage: "Bonjour, je souhaite commander la Montre Ultra Max Pro avec paiement à la livraison.",
        },
      },
      {
        id: "block_faq",
        type: "faq",
        title: "Foire Aux Questions (FAQ)",
        visible: true,
        data: {
          sectionTitle: "Questions Fréquemment Posées",
          sectionSubtitle: "Toutes les réponses à vos questions avant de commander.",
          faqs: [
            {
              id: "q1",
              question: "Quand et comment vais-je payer ma commande ?",
              answer: "Vous ne payez RIEN à l'avance. Vous réglez uniquement le livreur en espèces ou via Mobile Money (Wave, Orange Money, Moov, MTN) après avoir reçu et vérifié votre colis en main propre.",
            },
            {
              id: "q2",
              question: "Quels sont les délais de livraison ?",
              answer: "Pour les grandes villes (Dakar, Abidjan, Douala, Bamako...), la livraison s'effectue en 24h chrono. Pour les autres régions, comptez 48h maximum.",
            },
            {
              id: "q3",
              question: "Que faire si le produit ne correspond pas ou a un souci ?",
              answer: "Vous bénéficiez d'une garantie échange de 30 jours. Si le produit présente le moindre défaut, nous vous renvoyons un nouvel article neuf gratuitement sans discussion.",
            },
            {
              id: "q4",
              question: "La montre est-elle compatible avec iPhone et Android ?",
              answer: "Oui, à 100%. Elle se connecte en quelques secondes via Bluetooth à tous les téléphones (Samsung, iPhone, Tecno, Infinix, Xiaomi, Huawei, etc.).",
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
          copyrightText: "© 2026 E-Boutique Express. Tous droits réservés.",
          disclaimerText: "Ce site ne fait pas partie du site web de Meta, Facebook Inc., ou TikTok. De plus, ce site n'est PAS approuvé par Facebook ou TikTok de quelque manière que ce soit.",
        },
      },
    ],
  };
}
