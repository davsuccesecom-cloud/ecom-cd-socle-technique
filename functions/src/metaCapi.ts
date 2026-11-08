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
 * Normalise les devises pour l'API Meta (norme ISO 4217 en majuscules).
 * Élimine l'erreur 400 Graph API sur les variantes "FCFA" / "CFA" très courantes en Afrique.
 */
export function normalizeCurrency(rawCurrency?: string): string {
  if (!rawCurrency) return "XOF";
  const c = rawCurrency.trim().toUpperCase();
  if (c === "FCFA" || c === "CFA" || c === "F CFA" || c === "F-CFA" || c === "XOF") return "XOF";
  if (c === "XAF") return "XAF";
  if (c === "GNF") return "GNF";
  if (c === "CDF") return "CDF";
  if (c === "EUR") return "EUR";
  if (c === "USD") return "USD";
  return c;
}

/**
 * Normalise le code pays en ISO 3166-1 alpha-2 en minuscules (spécification Meta CAPI).
 * Évite le rejet ou l'échec de hachage lorsque le nom du pays est saisi en français ou en majuscules.
 */
export function normalizeCountryCode(country?: string): string {
  if (!country) return "";
  const trimmed = country.trim().toLowerCase();
  if (trimmed.length === 2) return trimmed;

  const map: Record<string, string> = {
    "sénégal": "sn",
    "senegal": "sn",
    "côte d'ivoire": "ci",
    "cote d'ivoire": "ci",
    "ivory coast": "ci",
    "togo": "tg",
    "bénin": "bj",
    "benin": "bj",
    "mali": "ml",
    "burkina faso": "bf",
    "burkina": "bf",
    "cameroun": "cm",
    "cameroon": "cm",
    "rdc": "cd",
    "congo": "cg",
    "guinée": "gn",
    "guinee": "gn",
    "guinea": "gn",
    "niger": "ne",
    "gabon": "ga",
    "france": "fr",
  };
  return map[trimmed] || (trimmed.length === 2 ? trimmed : "");
}

/**
 * Nettoyage et formatage strict du téléphone pour Meta CAPI (E.164 sans symbole '+').
 * Meta exige l'indicatif pays + numéro sans espace ni zéro initial local.
 * Sans indicatif pays, le hash SHA-256 ne correspondra JAMAIS aux profils Facebook.
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

  // Si le numéro a été saisi sans indicatif pays avec un '0' initial
  const countryPrefixes: Record<string, string> = {
    sn: "221",
    ci: "225",
    tg: "228",
    bj: "229",
    ml: "223",
    bf: "226",
    cm: "237",
    cd: "243",
    gn: "224",
    ne: "227",
    ga: "241",
    cg: "242",
  };

  const prefix = countryPrefixes[normCountry];
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

  const currency = normalizeCurrency(config.currency);
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

  const currency = normalizeCurrency(config.currency);
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
