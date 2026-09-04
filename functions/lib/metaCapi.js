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
    // Meta attend un numéro au format E.164 sans espaces, tirets ou signe +
    return phone.replace(/[^\d]/g, "");
}
function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "" };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
async function sendMetaPurchaseEvent(config, order) {
    if (!config.enabled || !config.pixelId || !config.accessToken) {
        return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
    }
    const { firstName, lastName } = splitName(order.clientName || "");
    const phone = cleanPhoneForMeta(order.clientPhoneFormatted || order.clientPhoneRaw || "");
    const currency = (config.currency || "XOF").toUpperCase();
    const eventId = order.orderNumber || order.sourceRowId || order.id;
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
    const eventPayload = {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: "https://easysell.app",
        action_source: "physical_store",
        user_data: userData,
        custom_data: {
            currency,
            value: order.amount,
            content_name: order.product || "Produit",
            contents: [
                {
                    id: order.product || "produit_cod",
                    quantity: order.quantity || 1,
                    item_price: order.quantity && order.quantity > 0 ? order.amount / order.quantity : order.amount,
                },
            ],
        },
    };
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
            console.error("Erreur Meta CAPI :", JSON.stringify(resJson));
            return { success: false, error: JSON.stringify(resJson) };
        }
        console.log(`Meta CAPI succès pour commande ${order.id} :`, JSON.stringify(resJson));
        return { success: true, data: resJson };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Exception Meta CAPI :", msg);
        return { success: false, error: msg };
    }
}
