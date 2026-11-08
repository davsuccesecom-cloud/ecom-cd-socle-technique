import * as crypto from "crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface MetaCapiConfig {
  enabled: boolean;
  pixelId: string;
  accessToken: string;
  currency?: string;
  testEventCode?: string;
}

export interface MetaOrderData {
  id: string;
  sourceRowId?: string;
  orderNumber?: string;
  clientName?: string;
  clientPhoneFormatted?: string;
  clientPhoneRaw?: string;
  city?: string;
  country?: string;
  product?: string;
  quantity?: number;
  amount: number;
  // Tracking réel enrichi (fbp, fbc, IP, UA, URL, Shop)
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  browserIp?: string;
  userAgent?: string;
  pageUrl?: string;
  shopDomain?: string;
  temperature?: "hot" | "medium" | "cold";
}

function sha256(str: string): string {
  if (!str) return "";
  return crypto
    .createHash("sha256")
    .update(str.trim().toLowerCase())
    .digest("hex");
}

/**
 * Dictionnaire complet des 54 pays africains (ISO 3166-1 alpha-2 en minuscules)
 * Prend en charge les variantes avec/sans accents, français et anglais.
 */
export const ALL_54_AFRICAN_COUNTRIES_MAP: Record<string, string> = {
  // 1. Afrique de l'Ouest (16 pays)
  "bénin": "bj", "benin": "bj",
  "burkina faso": "bf", "burkina": "bf",
  "cap-vert": "cv", "cape verde": "cv", "cabo verde": "cv",
  "côte d'ivoire": "ci", "cote d'ivoire": "ci", "ivory coast": "ci",
  "gambie": "gm", "gambia": "gm",
  "ghana": "gh",
  "guinée": "gn", "guinee": "gn", "guinea": "gn",
  "guinée-bissau": "gw", "guinee-bissau": "gw", "guinea-bissau": "gw",
  "liberia": "lr", "libéria": "lr",
  "mali": "ml",
  "mauritanie": "mr", "mauritania": "mr",
  "niger": "ne",
  "nigeria": "ng", "nigéria": "ng",
  "sénégal": "sn", "senegal": "sn",
  "sierra leone": "sl",
  "togo": "tg",

  // 2. Afrique Centrale (9 pays)
  "cameroun": "cm", "cameroon": "cm",
  "centrafrique": "cf", "république centrafricaine": "cf", "republique centrafricaine": "cf", "central african republic": "cf",
  "tchad": "td", "chad": "td",
  "congo": "cg", "congo-brazzaville": "cg", "congo brazzaville": "cg",
  "rdc": "cd", "congo rdc": "cd", "congo (rdc)": "cd", "congo-kinshasa": "cd", "democratic republic of the congo": "cd",
  "guinée équatoriale": "gq", "guinee equatoriale": "gq", "equatorial guinea": "gq",
  "gabon": "ga",
  "sao tomé-et-principe": "st", "sao tome-et-principe": "st", "sao tome and principe": "st",
  "burundi": "bi",

  // 3. Afrique du Nord (6 pays)
  "algérie": "dz", "algerie": "dz", "algeria": "dz",
  "égypte": "eg", "egypte": "eg", "egypt": "eg",
  "libye": "ly", "libya": "ly",
  "maroc": "ma", "morocco": "ma",
  "soudan": "sd", "sudan": "sd",
  "tunisie": "tn", "tunisia": "tn",

  // 4. Afrique de l'Est (14 pays)
  "comores": "km", "comoros": "km",
  "djibouti": "dj",
  "érythrée": "er", "erythree": "er", "eritrea": "er",
  "éthiopie": "et", "ethiopie": "et", "ethiopia": "et",
  "kenya": "ke",
  "madagascar": "mg",
  "malawi": "mw",
  "maurice": "mu", "mauritius": "mu",
  "ouganda": "ug", "uganda": "ug",
  "rwanda": "rw",
  "seychelles": "sc",
  "somalie": "so", "somalia": "so",
  "soudan du sud": "ss", "south sudan": "ss",
  "tanzanie": "tz", "tanzania": "tz",

  // 5. Afrique Australe (9 pays)
  "afrique du sud": "za", "south africa": "za",
  "angola": "ao",
  "botswana": "bw",
  "eswatini": "sz", "swaziland": "sz",
  "lesotho": "ls",
  "mozambique": "mz",
  "namibie": "na", "namibia": "na",
  "zambie": "zm", "zambia": "zm",
  "zimbabwe": "zw",
};

/**
 * Indicatifs téléphoniques internationaux officiels des 54 pays africains (sans '+').
 * Conforme aux exigences de hachage SHA-256 Meta CAPI (E.164 sans symbole '+').
 */
export const ALL_54_AFRICAN_DIAL_CODES: Record<string, string> = {
  // Afrique de l'Ouest
  bj: "229", bf: "226", cv: "238", ci: "225", gm: "220",
  gh: "233", gn: "224", gw: "245", lr: "231", ml: "223",
  mr: "222", ne: "227", ng: "234", sn: "221", sl: "232", tg: "228",

  // Afrique Centrale
  cm: "237", cf: "236", td: "235", cg: "242", cd: "243",
  gq: "240", ga: "241", st: "239", bi: "257",

  // Afrique du Nord
  dz: "213", eg: "20", ly: "218", ma: "212", sd: "249", tn: "216",

  // Afrique de l'Est
  km: "269", dj: "253", er: "291", et: "251", ke: "254",
  mg: "261", mw: "265", mu: "230", ug: "256", rw: "250",
  sc: "248", so: "252", ss: "211", tz: "255",

  // Afrique Australe
  za: "27", ao: "244", bw: "267", sz: "268", ls: "266",
  mz: "258", na: "264", zm: "260", zw: "263",
};

/**
 * Devises officielles des 54 pays africains (norme ISO 4217 acceptée par Meta).
 */
export const AFRICAN_CURRENCIES: Record<string, string> = {
  // Francs CFA
  bj: "XOF", bf: "XOF", ci: "XOF", gw: "XOF", ml: "XOF", ne: "XOF", sn: "XOF", tg: "XOF",
  cm: "XAF", cf: "XAF", td: "XAF", cg: "XAF", gq: "XAF", ga: "XAF",
  // Autres devises africaines
  ng: "NGN", // Nigeria
  gh: "GHS", // Ghana
  ke: "KES", // Kenya
  cd: "CDF", // RDC
  gn: "GNF", // Guinée
  ma: "MAD", // Maroc
  dz: "DZD", // Algérie
  tn: "TND", // Tunisie
  eg: "EGP", // Égypte
  za: "ZAR", // Afrique du Sud
  rw: "RWF", // Rwanda
  ug: "UGX", // Ouganda
  tz: "TZS", // Tanzanie
  et: "ETB", // Éthiopie
  mz: "MZN", // Mozambique
  ao: "AOA", // Angola
  mr: "MRU", // Mauritanie
  gm: "GMD", // Gambie
  sl: "SLE", // Sierra Leone
  lr: "LRD", // Liberia
  cv: "CVE", // Cap-Vert
  bi: "BIF", // Burundi
  mg: "MGA", // Madagascar
  mw: "MWK", // Malawi
  mu: "MUR", // Maurice
  sc: "SCR", // Seychelles
  dj: "DJF", // Djibouti
  km: "KMF", // Comores
  bw: "BWP", // Botswana
  sz: "SZL", // Eswatini
  ls: "LSL", // Lesotho
  so: "SOS", // Somalie
  sd: "SDG", // Soudan
  ss: "SSP", // Soudan du Sud
  er: "ERN", // Érythrée
  st: "STN", // Sao Tomé
  zm: "ZMW", // Zambie
  zw: "USD", // Zimbabwe
};

/**
 * Normalise les devises pour l'API Meta (norme ISO 4217 en majuscules).
 * Élimine l'erreur 400 Graph API sur les variantes "FCFA" / "CFA" très courantes en Afrique.
 */
export function normalizeCurrency(rawCurrency?: string, country?: string): string {
  const normC = normalizeCountryCode(country);
  if (!rawCurrency) {
    return AFRICAN_CURRENCIES[normC] || "XOF";
  }
  const c = rawCurrency.trim().toUpperCase();
  if (c === "FCFA" || c === "CFA" || c === "F CFA" || c === "F-CFA") {
    const cemac = ["cm", "cf", "td", "cg", "ga", "gq"];
    return cemac.includes(normC) ? "XAF" : "XOF";
  }
  return c;
}

/**
 * Normalise le code pays en ISO 3166-1 alpha-2 en minuscules (spécification Meta CAPI).
 * Couvre l'intégralité des 54 pays africains.
 */
export function normalizeCountryCode(country?: string): string {
  if (!country) return "";
  const trimmed = country.trim().toLowerCase();
  if (trimmed.length === 2) return trimmed;
  return ALL_54_AFRICAN_COUNTRIES_MAP[trimmed] || (trimmed.length === 2 ? trimmed : "");
}

/**
 * Nettoyage et formatage strict du téléphone pour Meta CAPI (E.164 sans symbole '+').
 * Couvre l'intégralité des 54 indicatifs nationaux africains.
 */
export function cleanPhoneForMeta(phone: string, defaultCountry?: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "");

  const normCountry = normalizeCountryCode(defaultCountry);
  const countryCodeUpper = normCountry ? (normCountry.toUpperCase() as any) : undefined;

  try {
    const parsed = parsePhoneNumberFromString(cleaned, countryCodeUpper);
    if (parsed && parsed.isValid()) {
      return parsed.format("E.164").replace("+", "");
    }
  } catch {}

  // Repli intelligent : suppression du '+' et des '00'
  let digits = cleaned.replace(/^\+/, "").replace(/^00/, "");

  const prefix = ALL_54_AFRICAN_DIAL_CODES[normCountry];
  if (prefix && !digits.startsWith(prefix)) {
    digits = prefix + digits.replace(/^0+/, "");
  }

  return digits;
}

/**
 * Nettoie les noms/prénoms et villes selon les exigences Meta :
 * Minuscules, sans accents ni ponctuation, uniquement lettres a-z.
 */
function cleanTextForMeta(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Valide et structure le cookie fbc au format officiel Meta (fb.1.<timestamp>.<fbclid>).
 */
export function formatFbc(fbc?: string, fbclid?: string): string | undefined {
  if (fbc && typeof fbc === "string") {
    const trimmed = fbc.trim();
    if (trimmed.startsWith("fb.1.") || trimmed.startsWith("fb.")) {
      return trimmed;
    }
    // Si fbc est passé comme simple valeur fbclid
    if (trimmed.length > 10) {
      return `fb.1.${Date.now()}.${trimmed}`;
    }
  }
  if (fbclid && typeof fbclid === "string" && fbclid.trim()) {
    return `fb.1.${Date.now()}.${fbclid.trim()}`;
  }
  return undefined;
}

function buildUserData(order: MetaOrderData): Record<string, unknown> {
  const { firstName, lastName } = splitName(order.clientName || "");
  const fnClean = cleanTextForMeta(firstName);
  const lnClean = cleanTextForMeta(lastName);
  const ctClean = cleanTextForMeta(order.city || "");
  const countryCode = normalizeCountryCode(order.country);
  const phone = cleanPhoneForMeta(order.clientPhoneFormatted || order.clientPhoneRaw || "", order.country);

  const userData: Record<string, unknown> = {};
  if (phone) userData.ph = [sha256(phone)];
  if (fnClean) userData.fn = [sha256(fnClean)];
  if (lnClean) userData.ln = [sha256(lnClean)];
  if (ctClean) userData.ct = [sha256(ctClean)];
  if (countryCode) userData.country = [sha256(countryCode)];

  // Identifiant externe stable et assaini (sans doubles dièses)
  const cleanOrderRef = (order.orderNumber || order.sourceRowId || order.id).replace(/[^a-zA-Z0-9_-]/g, "");
  userData.external_id = [sha256(cleanOrderRef)];

  // Signaux réels du navigateur (en clair selon spécification Meta CAPI)
  if (order.fbp && typeof order.fbp === "string" && order.fbp.startsWith("fb.")) {
    userData.fbp = order.fbp.trim();
  }

  const validFbc = formatFbc(order.fbc, order.fbclid);
  if (validFbc) {
    userData.fbc = validFbc;
  }

  if (order.browserIp && typeof order.browserIp === "string") {
    userData.client_ip_address = order.browserIp.trim();
  }

  if (order.userAgent && typeof order.userAgent === "string") {
    userData.client_user_agent = order.userAgent.trim();
  }

  return userData;
}

/**
 * Détermine l'URL de source d'événement vérifiée pour éviter l'alerte AEM (Domain Mismatch).
 * Ne JAMAIS renvoyer vers un domaine tiers hardcodé comme 'easysell.app'.
 */
function resolveEventSourceUrl(order: MetaOrderData): string | undefined {
  if (order.pageUrl && order.pageUrl.startsWith("http")) {
    return order.pageUrl.trim();
  }
  if (order.shopDomain && order.shopDomain.trim()) {
    const d = order.shopDomain.trim();
    return d.startsWith("http") ? d : `https://${d}`;
  }
  return undefined;
}

/**
 * Envoi de l'événement "Purchase" lors de la livraison réelle encaissée par le livreur.
 * Déclenché UNIQUEMENT lorsque le colis est remis au client et l'argent collecté.
 */
export async function sendMetaPurchaseEvent(
  config: MetaCapiConfig,
  order: MetaOrderData
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!config.enabled || !config.pixelId || !config.accessToken) {
    return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
  }

  const currency = normalizeCurrency(config.currency, order.country);
  const cleanOrderRef = (order.orderNumber || order.sourceRowId || order.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const eventId = `${cleanOrderRef}_purchase`;
  const userData = buildUserData(order);
  const actionSource = (order.fbp || order.fbc || order.browserIp || order.pageUrl || order.userAgent) ? "website" : "other";

  const eventPayload: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: actionSource,
    user_data: userData,
    custom_data: {
      currency,
      value: order.amount,
      content_name: order.product || "Produit COD",
      lead_quality: order.temperature || "medium",
      contents: [
        {
          id: cleanTextForMeta(order.product || "produit_cod") || "produit_cod",
          quantity: order.quantity || 1,
          item_price: order.quantity && order.quantity > 0 ? order.amount / order.quantity : order.amount,
        },
      ],
    },
  };

  const eventSourceUrl = resolveEventSourceUrl(order);
  if (eventSourceUrl) {
    eventPayload.event_source_url = eventSourceUrl;
  }

  return executeMetaApiCall(config, eventPayload, `Purchase (${order.id})`);
}

/**
 * Envoi de l'événement personnalisé "CommandeConfirmee" lors de la confirmation par la closeuse.
 */
export async function sendMetaConfirmedEvent(
  config: MetaCapiConfig,
  order: MetaOrderData
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!config.enabled || !config.pixelId || !config.accessToken) {
    return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
  }

  const currency = normalizeCurrency(config.currency, order.country);
  const cleanOrderRef = (order.orderNumber || order.sourceRowId || order.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const eventId = `${cleanOrderRef}_confirmed`;
  const userData = buildUserData(order);
  const actionSource = (order.fbp || order.fbc || order.browserIp || order.pageUrl || order.userAgent) ? "website" : "other";

  const eventPayload: Record<string, unknown> = {
    event_name: "CommandeConfirmee",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: actionSource,
    user_data: userData,
    custom_data: {
      currency,
      value: order.amount,
      content_name: order.product || "Produit COD",
      lead_quality: order.temperature || "hot",
    },
  };

  const eventSourceUrl = resolveEventSourceUrl(order);
  if (eventSourceUrl) {
    eventPayload.event_source_url = eventSourceUrl;
  }

  return executeMetaApiCall(config, eventPayload, `CommandeConfirmee (${order.id})`);
}

async function executeMetaApiCall(
  config: MetaCapiConfig,
  eventPayload: Record<string, unknown>,
  label: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const body: Record<string, unknown> = {
    data: [eventPayload],
  };

  if (config.testEventCode && config.testEventCode.trim()) {
    body.test_event_code = config.testEventCode.trim();
  }

  const url = `https://graph.facebook.com/v19.0/${config.pixelId.trim()}/events?access_token=${encodeURIComponent(config.accessToken.trim())}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const resJson = await response.json();
    if (!response.ok) {
      console.error(`Erreur Meta CAPI ${label}:`, JSON.stringify(resJson));
      return { success: false, error: JSON.stringify(resJson) };
    }

    console.log(`Meta CAPI succès pour ${label}:`, JSON.stringify(resJson));
    return { success: true, data: resJson };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Exception Meta CAPI ${label}:`, msg);
    return { success: false, error: msg };
  }
}
