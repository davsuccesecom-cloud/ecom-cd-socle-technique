import type { CloseuseStatus, LivreurStatus } from "./types";

// Statuts affichés en priorité sur l'écran principal de la closeuse (section 6)
export const CLOSEUSE_PRIORITY_STATUSES: CloseuseStatus[] = [
  "nouveau",
  "programme",
  "en_cours",
  "livre",
];

// Statuts planqués dans le menu ☰ (section 6)
export const CLOSEUSE_SECONDARY_STATUSES: CloseuseStatus[] = [
  "rejete",
  "injoignable",
  "indisponible",
];

export const CLOSEUSE_STATUS_LABELS: Record<CloseuseStatus, string> = {
  nouveau: "Nouveau",
  programme: "Programmé",
  en_cours: "En cours",
  livre: "Livré",
  rejete: "Rejeté",
  injoignable: "Injoignable",
  indisponible: "Indisponible",
};

// Flux à 4 statuts du livreur (section 7)
export const LIVREUR_STATUS_FLOW: LivreurStatus[] = [
  "recu",
  "en_route",
  "livre",
  "injoignable",
];

export const LIVREUR_STATUS_LABELS: Record<LivreurStatus, string> = {
  recu: "Reçu",
  en_route: "En route",
  livre: "Livré",
  injoignable: "Injoignable",
};

// Valeurs attendues dans l'onglet "Statut" du Google Sheet — doivent matcher
// exactement (section 12). Utilisé par le script de sync ET par l'écran
// admin de vérification de correspondance.
export const SHEET_STATUS_VALUES = [
  ...CLOSEUSE_PRIORITY_STATUSES,
  ...CLOSEUSE_SECONDARY_STATUSES,
] as const;

// Limites fixes de la phase actuelle (section 10.0 / section 4)
export const MAX_CLOSEUSES_PER_TEAM = 10;
export const MAX_LIVREURS_PER_TEAM = 10;
export const MAX_SHEETS_PER_TEAM = 5;
export const MAX_TEAMS_PER_WORKSPACE = 20;
export const MAX_SESSIONS_PER_ACCESS_LINK = 2;

// Règles temporelles (section 6 / section 15)
export const REMINDER_DELAY_MINUTES = 20; // 15-20 min, on prend la borne haute
export const ORDER_PURGE_AFTER_DAYS = 3;

// Statuts finaux qui déclenchent la purge (section 15)
export const FINAL_CLOSEUSE_STATUSES: CloseuseStatus[] = ["livre", "rejete", "injoignable"];

// ---------------------------------------------------------------------------
// Pays d'Afrique de l'Ouest (CEDEAO + Mauritanie) — utilisé pour
// Team.defaultCountry (indicatif téléphonique auto) et le sélecteur
// pays/marché de l'onboarding et du dashboard admin.
// ---------------------------------------------------------------------------
export type CountryRegion = "ouest" | "autre";

export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string; // Nom en français
  flag: string; // Emoji drapeau, calculé depuis le code — voir flagEmoji()
  region: CountryRegion;
  capital: string; // Hub logistique / Capitale économique
  currency: string; // Devise nationale / régionale (XOF, XAF, KES, NGN, GHS, etc.)
  dialCode: string; // Indicatif téléphonique international (ex: +228, +254)
}

/**
 * Calcule l'emoji drapeau à partir d'un code pays ISO à 2 lettres, sans
 * dépendre d'aucune image externe : chaque lettre est convertie en son
 * "regional indicator symbol" Unicode correspondant (ex: "T" + "G" → 🇹🇬).
 * Fiable à 100% pour n'importe quel code ISO valide, aucune ressource à
 * charger ni à maintenir.
 */
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

// Tuple: [code, nom, hub/capitale, devise, indicatif]
type CountryTuple = [string, string, string, string, string];

// Pays d'Afrique de l'Ouest (zone CEDEAO + Mauritanie) — priorité d'affichage
// car c'est la zone d'opération principale (Togo, Bénin, Côte d'Ivoire, Sénégal...).
const WEST_AFRICA_DATA: CountryTuple[] = [
  ["BJ", "Bénin", "Cotonou", "XOF", "+229"],
  ["BF", "Burkina Faso", "Ouagadougou", "XOF", "+226"],
  ["CV", "Cap-Vert", "Praia", "CVE", "+238"],
  ["CI", "Côte d'Ivoire", "Abidjan", "XOF", "+225"],
  ["GM", "Gambie", "Banjul", "GMD", "+220"],
  ["GH", "Ghana", "Accra", "GHS", "+233"],
  ["GN", "Guinée", "Conakry", "GNF", "+224"],
  ["GW", "Guinée-Bissau", "Bissau", "XOF", "+245"],
  ["LR", "Liberia", "Monrovia", "LRD", "+231"],
  ["ML", "Mali", "Bamako", "XOF", "+223"],
  ["MR", "Mauritanie", "Nouakchott", "MRU", "+222"],
  ["NE", "Niger", "Niamey", "XOF", "+227"],
  ["NG", "Nigeria", "Lagos / Abuja", "NGN", "+234"],
  ["SN", "Sénégal", "Dakar", "XOF", "+221"],
  ["SL", "Sierra Leone", "Freetown", "SLE", "+232"],
  ["TG", "Togo", "Lomé", "XOF", "+228"],
];

// Reste du continent africain, ordre alphabétique avec hubs, devises et indicatifs vérifiés.
const OTHER_AFRICA_DATA: CountryTuple[] = [
  ["ZA", "Afrique du Sud", "Johannesbourg / Pretoria", "ZAR", "+27"],
  ["DZ", "Algérie", "Alger", "DZD", "+213"],
  ["AO", "Angola", "Luanda", "AOA", "+244"],
  ["BW", "Botswana", "Gaborone", "BWP", "+267"],
  ["BI", "Burundi", "Bujumbura / Gitega", "BIF", "+257"],
  ["CM", "Cameroun", "Douala / Yaoundé", "XAF", "+237"],
  ["CF", "République centrafricaine", "Bangui", "XAF", "+236"],
  ["KM", "Comores", "Moroni", "KMF", "+269"],
  ["CG", "Congo", "Brazzaville", "XAF", "+242"],
  ["CD", "Congo (RDC)", "Kinshasa", "CDF", "+243"],
  ["DJ", "Djibouti", "Djibouti", "DJF", "+253"],
  ["EG", "Égypte", "Le Caire", "EGP", "+20"],
  ["ER", "Érythrée", "Asmara", "ERN", "+291"],
  ["SZ", "Eswatini", "Mbabane", "SZL", "+268"],
  ["ET", "Éthiopie", "Addis-Abeba", "ETB", "+251"],
  ["GA", "Gabon", "Libreville", "XAF", "+241"],
  ["GQ", "Guinée équatoriale", "Malabo", "XAF", "+240"],
  ["KE", "Kenya", "Nairobi", "KES", "+254"],
  ["LS", "Lesotho", "Maseru", "LSL", "+266"],
  ["LY", "Libye", "Tripoli", "LYD", "+218"],
  ["MG", "Madagascar", "Antananarivo", "MGA", "+261"],
  ["MW", "Malawi", "Lilongwe", "MWK", "+265"],
  ["MA", "Maroc", "Casablanca / Rabat", "MAD", "+212"],
  ["MU", "Maurice", "Port-Louis", "MUR", "+230"],
  ["MZ", "Mozambique", "Maputo", "MZN", "+258"],
  ["NA", "Namibie", "Windhoek", "NAD", "+264"],
  ["UG", "Ouganda", "Kampala", "UGX", "+256"],
  ["RW", "Rwanda", "Kigali", "RWF", "+250"],
  ["ST", "Sao Tomé-et-Principe", "São Tomé", "STN", "+239"],
  ["SC", "Seychelles", "Victoria", "SCR", "+248"],
  ["SO", "Somalie", "Mogadiscio", "SOS", "+252"],
  ["SD", "Soudan", "Khartoum", "SDG", "+249"],
  ["SS", "Soudan du Sud", "Juba", "SSP", "+211"],
  ["TZ", "Tanzanie", "Dar es Salaam / Dodoma", "TZS", "+255"],
  ["TD", "Tchad", "N'Djaména", "XAF", "+235"],
  ["TN", "Tunisie", "Tunis", "TND", "+216"],
  ["ZM", "Zambie", "Lusaka", "ZMW", "+260"],
  ["ZW", "Zimbabwe", "Harare", "USD", "+263"],
];

export const AFRICA_COUNTRIES: Country[] = [
  ...WEST_AFRICA_DATA.map(([code, name, capital, currency, dialCode]) => ({
    code,
    name,
    flag: flagEmoji(code),
    region: "ouest" as const,
    capital,
    currency,
    dialCode,
  })),
  ...OTHER_AFRICA_DATA.map(([code, name, capital, currency, dialCode]) => ({
    code,
    name,
    flag: flagEmoji(code),
    region: "autre" as const,
    capital,
    currency,
    dialCode,
  })),
];

/**
 * Alias conservé pour compatibilité — CreateTeamForm.tsx et Dashboard.tsx
 * importent aujourd'hui `WEST_AFRICA_COUNTRIES` depuis @ecomcod/shared.
 * Malgré le nom, cette constante couvre maintenant les 54 pays d'Afrique
 * (voir AFRICA_COUNTRIES ci-dessus, seule source de vérité). Migrer les
 * imports vers AFRICA_COUNTRIES progressivement, sans urgence.
 */
export const WEST_AFRICA_COUNTRIES = AFRICA_COUNTRIES;
