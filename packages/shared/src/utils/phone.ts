import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Formate un numéro de téléphone brut venant du Sheet, en le complétant
 * automatiquement avec l'indicatif du pays par défaut de l'équipe si besoin.
 * Voir architecture section 9.
 *
 * - Si le numéro a déjà un indicatif (+228..., +221...) → détecté tel quel.
 * - Sinon → complété avec defaultCountry.
 *
 * Retourne null si le numéro est invalide même après complétion (à signaler
 * côté admin plutôt que de planter la synchro).
 */
export function formatClientPhone(
  rawPhone: string,
  defaultCountry: CountryCode
): string | null {
  const cleaned = rawPhone.trim();
  if (!cleaned) return null;

  const phoneNumber = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!phoneNumber || !phoneNumber.isValid()) return null;

  return phoneNumber.number; // format E.164, ex: "+22890123456"
}

/**
 * Construit le lien tel: cliquable pour le bouton "Appeler" (closeuse/livreur).
 * Le navigateur ouvre l'app téléphone native avec le numéro déjà tapé —
 * une pression manuelle reste nécessaire pour lancer l'appel (limite
 * navigateur, pas un choix produit — voir échange avec l'utilisateur).
 */
export function buildTelLink(formattedPhone: string): string {
  return `tel:${formattedPhone}`;
}

export const AFRICAN_DIAL_CODES: Record<string, string> = {
  // Afrique de l'Ouest
  BJ: "229", // Bénin
  BF: "226", // Burkina Faso
  CV: "238", // Cap-Vert
  CI: "225", // Côte d'Ivoire
  GM: "220", // Gambie
  GH: "233", // Ghana
  GN: "224", // Guinée
  GW: "245", // Guinée-Bissau
  LR: "231", // Liberia
  ML: "223", // Mali
  MR: "222", // Mauritanie
  NE: "227", // Niger
  NG: "234", // Nigeria
  SN: "221", // Sénégal
  SL: "232", // Sierra Leone
  TG: "228", // Togo

  // Autres marchés africains
  ZA: "27",  // Afrique du Sud
  DZ: "213", // Algérie
  AO: "244", // Angola
  BW: "267", // Botswana
  BI: "257", // Burundi
  CM: "237", // Cameroun
  CF: "236", // Centrafrique
  KM: "269", // Comores
  CG: "242", // Congo
  CD: "243", // Congo (RDC)
  DJ: "253", // Djibouti
  EG: "20",  // Égypte
  ER: "291", // Érythrée
  SZ: "268", // Eswatini
  ET: "251", // Éthiopie
  GA: "241", // Gabon
  GQ: "240", // Guinée équatoriale
  KE: "254", // Kenya
  LS: "266", // Lesotho
  LY: "218", // Libye
  MG: "261", // Madagascar
  MW: "265", // Malawi
  MA: "212", // Maroc
  MU: "230", // Maurice
  MZ: "258", // Mozambique
  NA: "264", // Namibie
  UG: "256", // Ouganda
  RW: "250", // Rwanda
  ST: "239", // Sao Tomé-et-Principe
  SC: "248", // Seychelles
  SO: "252", // Somalie
  SD: "249", // Soudan
  SS: "211", // Soudan du Sud
  TZ: "255", // Tanzanie
  TD: "235", // Tchad
  TN: "216", // Tunisie
  ZM: "260", // Zambie
  ZW: "263", // Zimbabwe
};

const ALL_AFRICAN_PREFIXES = Array.from(new Set(Object.values(AFRICAN_DIAL_CODES))).sort(
  (a, b) => b.length - a.length
);

/**
 * Nettoie et normalise intelligemment un numéro d'Afrique de l'Ouest/Centrale.
 * Évite les doublons d'indicatif (ex: "+228 22966860045" -> "+22966860045")
 * et ajoute l'indicatif par défaut uniquement s'il n'est pas déjà présent.
 */
export function cleanAfricanPhone(raw: string, defaultCountry = "TG"): string {
  const s = String(raw || "").trim();
  if (!s || s === "Non renseigné") return "";

  // Extraction des chiffres
  let digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";

  // Si commence par 00, on le retire
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Détection d'un double indicatif involontaire (ex: 228 + 22966860045)
  for (const p1 of ALL_AFRICAN_PREFIXES) {
    if (digits.startsWith(p1)) {
      const sub = digits.slice(p1.length);
      for (const p2 of ALL_AFRICAN_PREFIXES) {
        if (sub.startsWith(p2) && sub.length >= 8 + p2.length) {
          return `+${sub}`;
        }
      }
    }
  }

  // Si le numéro commence déjà par un indicatif africain reconnu
  for (const p of ALL_AFRICAN_PREFIXES) {
    if (digits.startsWith(p) && digits.length >= 8 + p.length) {
      return `+${digits}`;
    }
  }

  // Sinon, on applique l'indicatif par défaut de l'équipe
  const defaultDial = AFRICAN_DIAL_CODES[defaultCountry.toUpperCase()] || "228";
  return `+${defaultDial}${digits}`;
}

/**
 * Nettoie le numéro de commande en supprimant les doublons de préfixe ##
 * ex: "##1001" -> "1001", "#1001" -> "1001"
 */
export function cleanOrderNumber(orderNumber?: string | null): string {
  return String(orderNumber || "").trim().replace(/^#+/, "");
}

/**
 * Nettoie le titre du produit pour enlever les préfixes de quantité redondants
 * ex: "1x Exemple de produit" -> "Exemple de produit"
 */
export function cleanProductTitle(product?: string | null): string {
  const p = String(product || "").trim();
  return p.replace(/^\d+x\s*/i, "").trim() || "votre article";
}

/**
 * Construit un script WhatsApp SAV / Suivi ultra-professionnel, humain et contextualisé.
 * Élimine les bugs de double ## et les messages tronqués.
 */
export function buildSavWhatsAppMessage(
  order: {
    clientName: string;
    product?: string | null;
    quantity?: number | null;
    amount?: number | null;
    city?: string | null;
    orderNumber?: string | null;
    statutCloseuse?: string | null;
    statutLivreur?: string | null;
    isDuplicatePhone?: boolean | null;
    shopifyData?: { orderNumber?: string | null; locationHint?: string | null } | null;
  },
  team?: { name?: string; currency?: string; printReceiptConfig?: { companyName?: string } } | null,
  mode?: "auto" | "sav" | "relance" | "confirmation" | "doublon"
): string {
  const company = team?.printReceiptConfig?.companyName || team?.name || "la boutique";
  const currency = team?.currency || "FCFA";
  const rawNum = order.shopifyData?.orderNumber || order.orderNumber;
  const numClean = cleanOrderNumber(rawNum);
  const refStr = numClean ? ` #${numClean}` : "";
  const prodClean = cleanProductTitle(order.product);
  const qtyStr = order.quantity && order.quantity > 1 ? ` (${order.quantity} pièces)` : "";
  const amountStr = (order.amount || 0).toLocaleString("fr-FR");
  const destCity = order.city || order.shopifyData?.locationHint || "votre quartier";

  const isLivre = order.statutCloseuse === "livre" || order.statutLivreur === "livre";
  const isRelance =
    order.statutCloseuse === "injoignable" ||
    order.statutCloseuse === "rejete" ||
    order.statutLivreur === "injoignable";
  const isDoublon = Boolean(order.isDuplicatePhone);

  const selectedMode =
    mode && mode !== "auto"
      ? mode
      : isDoublon
      ? "doublon"
      : isLivre
      ? "sav"
      : isRelance
      ? "relance"
      : "confirmation";

  if (selectedMode === "sav") {
    return (
      `Bonjour ${order.clientName}, c'est le Service Après-Vente de ${company} suite à la livraison de votre commande${refStr} (${prodClean}${qtyStr}).\n\n` +
      `Votre colis vous a bien été remis. Êtes-vous bien satisfait de votre produit ? ` +
      `Nous restons à votre entière disposition ici sur WhatsApp si vous avez la moindre question ou besoin d'assistance pour son utilisation !`
    );
  }

  if (selectedMode === "relance") {
    return (
      `Bonjour ${order.clientName}, c'est le service client de ${company}.\n\n` +
      `Notre livreur a tenté de vous joindre pour vous remettre votre commande${refStr} (${prodClean} — ${amountStr} ${currency}), mais n'a pas réussi à vous joindre.\n\n` +
      `Êtes-vous disponible aujourd'hui ou demain pour que nous vous reconduisions votre livraison en main propre ?`
    );
  }

  if (selectedMode === "doublon") {
    return (
      `Bonjour ${order.clientName}, nous avons bien reçu votre commande${refStr} de ${prodClean} (${amountStr} ${currency}).\n\n` +
      `Comme votre numéro a été enregistré deux fois sur notre site, nous souhaitions vérifier avec vous avant expédition : ` +
      `souhaitez-vous recevoir 1 seul produit ou bien plusieurs pièces pour votre livraison ?`
    );
  }

  // Confirmation / Nouveau / En cours
  return (
    `Bonjour ${order.clientName}, c'est ${company} concernant votre commande${refStr} de ${prodClean}${qtyStr} pour un montant de ${amountStr} ${currency}.\n\n` +
    `Pour préparer au mieux votre livraison à ${destCity}, à quel moment de la journée seriez-vous disponible pour recevoir notre coursier ?`
  );
}

/**
 * Construit le lien wa.me cliquable pour contacter le client sur WhatsApp avec un message pré-rempli.
 */
export function buildWhatsAppLink(formattedPhone: string, message?: string): string {
  const sanitized = cleanAfricanPhone(formattedPhone);
  const digitsOnly = sanitized.replace(/[^\d]/g, "") || formattedPhone.replace(/[^\d]/g, "");
  const encodedMsg = message ? encodeURIComponent(message) : "";
  return `https://wa.me/${digitsOnly}${encodedMsg ? `?text=${encodedMsg}` : ""}`;
}

