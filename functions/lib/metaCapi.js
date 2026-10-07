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
exports.sendMetaPurchaseEvent = sendMetaPurchaseEvent;
exports.sendMetaConfirmedEvent = sendMetaConfirmedEvent;
const crypto = __importStar(require("crypto"));
function sha256(str) {
    if (!str)
        return "";
    return crypto
        .createHash("sha256")
        .update(str.trim().toLowerCase())
        .digest("hex");
}
function cleanPhoneForMeta(phone) {
    if (!phone)
        return "";
    return phone.replace(/[^\d]/g, "");
}
function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "" };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
function buildUserData(order) {
    const { firstName, lastName } = splitName(order.clientName || "");
    const phone = cleanPhoneForMeta(order.clientPhoneFormatted || order.clientPhoneRaw || "");
    const userData = {};
    if (phone)
        userData.ph = [sha256(phone)];
    if (firstName)
        userData.fn = [sha256(firstName)];
    if (lastName)
        userData.ln = [sha256(lastName)];
    if (order.city)
        userData.ct = [sha256(order.city)];
    if (order.country)
        userData.country = [sha256(order.country)];
    // Identifiant externe stable
    userData.external_id = [sha256(order.orderNumber || order.id)];
    // Signaux réels du navigateur (en clair selon spécification Meta CAPI)
    if (order.fbp)
        userData.fbp = order.fbp;
    if (order.fbc)
        userData.fbc = order.fbc;
    if (order.browserIp)
        userData.client_ip_address = order.browserIp;
    if (order.userAgent)
        userData.client_user_agent = order.userAgent;
    return userData;
}
/**
 * Envoi de l'événement "Purchase" lors de la livraison réelle encaissée par le livreur
 */
async function sendMetaPurchaseEvent(config, order) {
    if (!config.enabled || !config.pixelId || !config.accessToken) {
        return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
    }
    const currency = (config.currency || "XOF").toUpperCase();
    const eventId = `${order.orderNumber || order.sourceRowId || order.id}_purchase`;
    const userData = buildUserData(order);
    const actionSource = (order.fbp || order.fbc || order.browserIp) ? "website" : "physical_store";
    const eventPayload = {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: order.pageUrl || "https://easysell.app",
        action_source: actionSource,
        user_data: userData,
        custom_data: {
            currency,
            value: order.amount,
            content_name: order.product || "Produit",
            lead_quality: order.temperature || "medium",
            contents: [
                {
                    id: order.product || "produit_cod",
                    quantity: order.quantity || 1,
                    item_price: order.quantity && order.quantity > 0 ? order.amount / order.quantity : order.amount,
                },
            ],
        },
    };
    return executeMetaApiCall(config, eventPayload, `Purchase (${order.id})`);
}
/**
 * Envoi de l'événement personnalisé "CommandeConfirmee" lors de la confirmation par la closeuse
 */
async function sendMetaConfirmedEvent(config, order) {
    if (!config.enabled || !config.pixelId || !config.accessToken) {
        return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
    }
    const currency = (config.currency || "XOF").toUpperCase();
    const eventId = `${order.orderNumber || order.sourceRowId || order.id}_confirmed`;
    const userData = buildUserData(order);
    const actionSource = (order.fbp || order.fbc || order.browserIp) ? "website" : "physical_store";
    const eventPayload = {
        event_name: "CommandeConfirmee",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: order.pageUrl || "https://easysell.app",
        action_source: actionSource,
        user_data: userData,
        custom_data: {
            currency,
            value: order.amount,
            content_name: order.product || "Produit",
            lead_quality: order.temperature || "hot",
        },
    };
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
