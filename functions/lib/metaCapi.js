"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCurrency = normalizeCurrency;
exports.normalizeCountryCode = normalizeCountryCode;
exports.cleanPhoneForMeta = cleanPhoneForMeta;
exports.formatFbc = formatFbc;
exports.sendMetaPurchaseEvent = sendMetaPurchaseEvent;
exports.sendMetaConfirmedEvent = sendMetaConfirmedEvent;
const crypto = __importStar(require("crypto"));
const libphonenumber_js_1 = require("libphonenumber-js");
function sha256(str) {
    if (!str)
        return "";
    return crypto
        .createHash("sha256")
        .update(str.trim().toLowerCase())
        .digest("hex");
}
/**
 * Normalise les devises pour l'API Meta (norme ISO 4217 en majuscules).
 * Élimine l'erreur 400 Graph API sur les variantes "FCFA" / "CFA" très courantes en Afrique.
 */
function normalizeCurrency(rawCurrency) {
    if (!rawCurrency)
        return "XOF";
    const c = rawCurrency.trim().toUpperCase();
    if (c === "FCFA" || c === "CFA" || c === "F CFA" || c === "F-CFA" || c === "XOF")
        return "XOF";
    if (c === "XAF")
        return "XAF";
    if (c === "GNF")
        return "GNF";
    if (c === "CDF")
        return "CDF";
    if (c === "EUR")
        return "EUR";
    if (c === "USD")
        return "USD";
    return c;
}
/**
 * Normalise le code pays en ISO 3166-1 alpha-2 en minuscules (spécification Meta CAPI).
 * Évite le rejet ou l'échec de hachage lorsque le nom du pays est saisi en français ou en majuscules.
 */
function normalizeCountryCode(country) {
    if (!country)
        return "";
    const trimmed = country.trim().toLowerCase();
    if (trimmed.length === 2)
        return trimmed;
    const map = {
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
function cleanPhoneForMeta(phone, defaultCountry) {
    if (!phone)
        return "";
    const cleaned = phone.replace(/[^\d+]/g, "");
    const normCountry = normalizeCountryCode(defaultCountry);
    const countryCodeUpper = normCountry ? normCountry.toUpperCase() : undefined;
    try {
        const parsed = (0, libphonenumber_js_1.parsePhoneNumberFromString)(cleaned, countryCodeUpper);
        if (parsed && parsed.isValid()) {
            return parsed.format("E.164").replace("+", "");
        }
    }
    catch { }
    // Repli intelligent : suppression du '+' et des '00'
    let digits = cleaned.replace(/^\+/, "").replace(/^00/, "");
    // Si le numéro a été saisi sans indicatif pays avec un '0' initial
    const countryPrefixes = {
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
function cleanTextForMeta(text) {
    if (!text)
        return "";
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}
function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "" };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
/**
 * Valide et structure le cookie fbc au format officiel Meta (fb.1.<timestamp>.<fbclid>).
 */
function formatFbc(fbc, fbclid) {
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
function buildUserData(order) {
    const { firstName, lastName } = splitName(order.clientName || "");
    const fnClean = cleanTextForMeta(firstName);
    const lnClean = cleanTextForMeta(lastName);
    const ctClean = cleanTextForMeta(order.city || "");
    const countryCode = normalizeCountryCode(order.country);
    const phone = cleanPhoneForMeta(order.clientPhoneFormatted || order.clientPhoneRaw || "", order.country);
    const userData = {};
    if (phone)
        userData.ph = [sha256(phone)];
    if (fnClean)
        userData.fn = [sha256(fnClean)];
    if (lnClean)
        userData.ln = [sha256(lnClean)];
    if (ctClean)
        userData.ct = [sha256(ctClean)];
    if (countryCode)
        userData.country = [sha256(countryCode)];
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
function resolveEventSourceUrl(order) {
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
async function sendMetaPurchaseEvent(config, order) {
    if (!config.enabled || !config.pixelId || !config.accessToken) {
        return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
    }
    const currency = normalizeCurrency(config.currency);
    const cleanOrderRef = (order.orderNumber || order.sourceRowId || order.id).replace(/[^a-zA-Z0-9_-]/g, "");
    const eventId = `${cleanOrderRef}_purchase`;
    const userData = buildUserData(order);
    const actionSource = (order.fbp || order.fbc || order.browserIp || order.pageUrl || order.userAgent) ? "website" : "other";
    const eventPayload = {
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
async function sendMetaConfirmedEvent(config, order) {
    if (!config.enabled || !config.pixelId || !config.accessToken) {
        return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
    }
    const currency = normalizeCurrency(config.currency);
    const cleanOrderRef = (order.orderNumber || order.sourceRowId || order.id).replace(/[^a-zA-Z0-9_-]/g, "");
    const eventId = `${cleanOrderRef}_confirmed`;
    const userData = buildUserData(order);
    const actionSource = (order.fbp || order.fbc || order.browserIp || order.pageUrl || order.userAgent) ? "website" : "other";
    const eventPayload = {
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
async function executeMetaApiCall(config, eventPayload, label) {
    const body = {
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Exception Meta CAPI ${label}:`, msg);
        return { success: false, error: msg };
    }
}
