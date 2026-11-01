/**
 * Silhouettes géographiques minimalistes et apaisées (monochromes, faible opacité)
 * pour illustrer les marchés COD (Togo, Bénin, Côte d'Ivoire, Sénégal, Burkina Faso,
 * Cameroun, Mali, etc.) sans surcharger l'interface.
 */

interface CountryMeta {
  code: string;
  name: string;
  capital: string;
  currency: string;
  dialCode: string;
  /** Coordonnée relative (0-100) de la capitale sur le tracé 100x100 */
  hub: { x: number; y: number };
  /** Tracé SVG stylisé dans une viewBox 0 0 100 100 */
  path: string;
}

export const COUNTRY_DIRECTORY: Record<string, CountryMeta> = {
  TG: {
    code: "TG",
    name: "Togo",
    capital: "Lomé",
    currency: "XOF",
    dialCode: "+228",
    hub: { x: 52, y: 88 },
    path: "M42 8 L56 10 L60 28 L57 48 L61 68 L58 90 L44 92 L43 70 L39 46 L41 24 Z",
  },
  BJ: {
    code: "BJ",
    name: "Bénin",
    capital: "Cotonou",
    currency: "XOF",
    dialCode: "+229",
    hub: { x: 54, y: 88 },
    path: "M36 10 L66 12 L72 28 L62 46 L59 68 L58 90 L44 90 L43 66 L38 42 L32 24 Z",
  },
  CI: {
    code: "CI",
    name: "Côte d'Ivoire",
    capital: "Abidjan",
    currency: "XOF",
    dialCode: "+225",
    hub: { x: 64, y: 84 },
    path: "M22 18 L54 14 L78 22 L82 52 L76 84 L48 88 L20 82 L16 50 Z",
  },
  SN: {
    code: "SN",
    name: "Sénégal",
    capital: "Dakar",
    currency: "XOF",
    dialCode: "+221",
    hub: { x: 16, y: 52 },
    path: "M24 22 L68 20 L84 36 L82 68 L48 76 L20 72 L12 52 L22 40 Z",
  },
  BF: {
    code: "BF",
    name: "Burkina Faso",
    capital: "Ouagadougou",
    currency: "XOF",
    dialCode: "+226",
    hub: { x: 50, y: 54 },
    path: "M26 24 L68 18 L86 38 L78 66 L52 78 L20 74 L14 48 Z",
  },
  ML: {
    code: "ML",
    name: "Mali",
    capital: "Bamako",
    currency: "XOF",
    dialCode: "+223",
    hub: { x: 34, y: 76 },
    path: "M38 12 L82 14 L86 48 L62 58 L48 84 L18 82 L14 58 L36 44 Z",
  },
  CM: {
    code: "CM",
    name: "Cameroun",
    capital: "Douala / Yaoundé",
    currency: "XAF",
    dialCode: "+237",
    hub: { x: 36, y: 74 },
    path: "M54 10 L66 18 L64 42 L78 62 L74 88 L32 88 L22 68 L36 44 L46 22 Z",
  },
  GN: {
    code: "GN",
    name: "Guinée",
    capital: "Conakry",
    currency: "GNF",
    dialCode: "+224",
    hub: { x: 18, y: 66 },
    path: "M20 36 L58 28 L84 44 L78 78 L54 74 L32 68 L14 68 Z",
  },
  NE: {
    code: "NE",
    name: "Niger",
    capital: "Niamey",
    currency: "XOF",
    dialCode: "+227",
    hub: { x: 22, y: 76 },
    path: "M36 16 L84 18 L88 58 L54 76 L16 80 L14 58 L32 42 Z",
  },
  GA: {
    code: "GA",
    name: "Gabon",
    capital: "Libreville",
    currency: "XAF",
    dialCode: "+241",
    hub: { x: 26, y: 36 },
    path: "M26 18 L72 20 L80 54 L64 86 L34 84 L18 54 Z",
  },
};

export function getCountryInfo(code?: string | null): CountryMeta {
  const key = (code || "TG").toUpperCase().trim();
  return (
    COUNTRY_DIRECTORY[key] ?? {
      code: key || "TG",
      name: key || "Marché COD",
      capital: "Hub Logistique",
      currency: "XOF",
      dialCode: "+228",
      hub: { x: 50, y: 65 },
      path: "M24 20 L76 20 L82 54 L68 84 L30 82 L18 52 Z",
    }
  );
}

export const getCountryMeta = getCountryInfo;

export default function CountryMapBackdrop({
  countryCode,
  className = "",
}: {
  countryCode?: string | null;
  className?: string;
}) {
  const info = getCountryInfo(countryCode);

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`pointer-events-none absolute -right-2 -top-2 h-28 w-28 select-none text-slate-400 ${className}`}
    >
      {/* Grille topographique discrète */}
      <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="2 3" />
      <line x1="0" y1="60" x2="100" y2="60" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="2 3" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="2 3" />

      {/* Silhouette du pays */}
      <path
        d={info.path}
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Point du hub logistique / capitale */}
      <circle cx={info.hub.x} cy={info.hub.y} r="5.5" fill="var(--brand)" fillOpacity="0.18" />
      <circle cx={info.hub.x} cy={info.hub.y} r="2.2" fill="var(--brand)" />
    </svg>
  );
}
