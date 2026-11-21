export interface AfricanCountryInfo {
  name: string;
  flag: string;
  currency: string;
  dialCode: string;
}

export const AFRICAN_COUNTRIES: Record<string, AfricanCountryInfo> = {
  TG: { name: "Togo", flag: "🇹🇬", currency: "XOF", dialCode: "+228" },
  CI: { name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF", dialCode: "+225" },
  BJ: { name: "Bénin", flag: "🇧🇯", currency: "XOF", dialCode: "+229" },
  SN: { name: "Sénégal", flag: "🇸🇳", currency: "XOF", dialCode: "+221" },
  BF: { name: "Burkina Faso", flag: "🇧🇫", currency: "XOF", dialCode: "+226" },
  ML: { name: "Mali", flag: "🇲🇱", currency: "XOF", dialCode: "+223" },
  NE: { name: "Niger", flag: "🇳🇪", currency: "XOF", dialCode: "+227" },
  GN: { name: "Guinée", flag: "🇬🇳", currency: "GNF", dialCode: "+224" },
  CM: { name: "Cameroun", flag: "🇨🇲", currency: "XAF", dialCode: "+237" },
  GA: { name: "Gabon", flag: "🇬🇦", currency: "XAF", dialCode: "+241" },
  CD: { name: "Congo (RDC)", flag: "🇨🇩", currency: "USD", dialCode: "+243" },
  CG: { name: "Congo", flag: "🇨🇬", currency: "XAF", dialCode: "+242" },
};

export function getCountryLabel(code?: string): string {
  if (!code) return "Marché";
  const clean = code.trim().toUpperCase();
  const c = AFRICAN_COUNTRIES[clean];
  return c ? `${c.flag} ${c.name}` : clean;
}

export function getCountryFlag(code?: string): string {
  if (!code) return "🌍";
  const clean = code.trim().toUpperCase();
  return AFRICAN_COUNTRIES[clean]?.flag || "🌍";
}
