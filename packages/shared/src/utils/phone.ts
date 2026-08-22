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
