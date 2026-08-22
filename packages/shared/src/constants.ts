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

// Pays d'Afrique de l'Ouest (zone CEDEAO + Mauritanie) — priorité d'affichage
// car c'est la zone d'opération principale (Togo, Sénégal, Côte d'Ivoire...).
const WEST_AFRICA_CODES: Array<[string, string]> = [
  ["BJ", "Bénin"],
  ["BF", "Burkina Faso"],
  ["CV", "Cap-Vert"],
  ["CI", "Côte d'Ivoire"],
  ["GM", "Gambie"],
  ["GH", "Ghana"],
  ["GN", "Guinée"],
  ["GW", "Guinée-Bissau"],
  ["LR", "Liberia"],
  ["ML", "Mali"],
  ["MR", "Mauritanie"],
  ["NE", "Niger"],
  ["NG", "Nigeria"],
  ["SN", "Sénégal"],
  ["SL", "Sierra Leone"],
  ["TG", "Togo"],
];

// Reste du continent africain, ordre alphabétique.
const OTHER_AFRICA_CODES: Array<[string, string]> = [
  ["ZA", "Afrique du Sud"],
  ["DZ", "Algérie"],
  ["AO", "Angola"],
  ["BW", "Botswana"],
  ["BI", "Burundi"],
  ["CM", "Cameroun"],
  ["CF", "République centrafricaine"],
  ["KM", "Comores"],
  ["CG", "Congo"],
  ["CD", "Congo (RDC)"],
  ["DJ", "Djibouti"],
  ["EG", "Égypte"],
  ["ER", "Érythrée"],
  ["SZ", "Eswatini"],
  ["ET", "Éthiopie"],
  ["GA", "Gabon"],
  ["GQ", "Guinée équatoriale"],
  ["KE", "Kenya"],
  ["LS", "Lesotho"],
  ["LY", "Libye"],
  ["MG", "Madagascar"],
  ["MW", "Malawi"],
  ["MA", "Maroc"],
  ["MU", "Maurice"],
  ["MZ", "Mozambique"],
  ["NA", "Namibie"],
  ["UG", "Ouganda"],
  ["RW", "Rwanda"],
  ["ST", "Sao Tomé-et-Principe"],
  ["SC", "Seychelles"],
  ["SO", "Somalie"],
  ["SD", "Soudan"],
  ["SS", "Soudan du Sud"],
  ["TZ", "Tanzanie"],
  ["TD", "Tchad"],
  ["TN", "Tunisie"],
  ["ZM", "Zambie"],
  ["ZW", "Zimbabwe"],
];

export const AFRICA_COUNTRIES: Country[] = [
  ...WEST_AFRICA_CODES.map(([code, name]) => ({ code, name, flag: flagEmoji(code), region: "ouest" as const })),
  ...OTHER_AFRICA_CODES.map(([code, name]) => ({ code, name, flag: flagEmoji(code), region: "autre" as const })),
];

/**
 * Alias conservé pour compatibilité — CreateTeamForm.tsx et Dashboard.tsx
 * importent aujourd'hui `WEST_AFRICA_COUNTRIES` depuis @ecomcod/shared.
 * Malgré le nom, cette constante couvre maintenant les 54 pays d'Afrique
 * (voir AFRICA_COUNTRIES ci-dessus, seule source de vérité). Migrer les
 * imports vers AFRICA_COUNTRIES progressivement, sans urgence.
 */
export const WEST_AFRICA_COUNTRIES = AFRICA_COUNTRIES;
