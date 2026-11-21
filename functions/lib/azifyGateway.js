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
exports.azifyGateway = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
function getDb() {
    return admin.firestore();
}
function setCorsHeaders(req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Azify-Verify-Token, X-Azify-Signature, X-WariTrack-Signature");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
}
function parseJsonBody(req) {
    if (!req)
        return {};
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) {
        return req.body;
    }
    if (typeof req.body === "string" && req.body.trim()) {
        try {
            const p = JSON.parse(req.body);
            if (p && typeof p === "object")
                return p;
        }
        catch { }
    }
    if (req.body && Buffer.isBuffer(req.body)) {
        try {
            const text = req.body.toString("utf8").trim();
            if (text) {
                const p = JSON.parse(text);
                if (p && typeof p === "object")
                    return p;
            }
        }
        catch { }
    }
    if (req.rawBody) {
        try {
            const text = req.rawBody.toString("utf8").trim();
            if (text) {
                const p = JSON.parse(text);
                if (p && typeof p === "object")
                    return p;
            }
        }
        catch { }
    }
    return req.body || {};
}
/**
 * Passerelle d'API Cloud Fonction Azify <-> WariTrack
 * Région: us-central1 (haute disponibilité réseau avec Vercel)
 *
 * Fournit l'authentification et les échanges de données sécurisés :
 * 1. GET  /teams   : Récupération des équipes disponibles WariTrack pour assignation dans Azify
 * 2. POST /pair    : Handshake d'appairage sécurisé (Boutique Azify <-> Équipe WariTrack)
 * 3. GET  /status  : Contrôle de santé et télémétrie en temps réel
 * 4. POST /webhook : Ingestion directe de commandes COD depuis Azify
 */
exports.azifyGateway = (0, https_1.onRequest)({
    region: "us-central1",
    cors: true,
    invoker: "public",
}, async (req, res) => {
    if (setCorsHeaders(req, res))
        return;
    const path = req.path.replace(/^\/api\/azify/, "").replace(/^\/azifyGateway/, "").replace(/\/$/, "");
    const db = getDb();
    // 1. Diagnostics / Ping
    if (req.method === "GET" && (path === "" || path === "/ping" || path === "/health")) {
        res.status(200).json({
            success: true,
            service: "waritrack-azify-gateway",
            version: "2.0.0",
            timestamp: Date.now(),
            documentation: "https://waritrack.com/docs/integrations/azify",
        });
        return;
    }
    // 2. GET /teams : Liste des équipes WariTrack pour sélection dans Azify
    if (req.method === "GET" && (path === "/teams" || path.endsWith("/teams"))) {
        const verifyToken = String(req.headers["x-azify-verify-token"] ||
            req.query.verifyToken ||
            req.query.ecomcod_verify ||
            "").trim();
        const workspaceIdParam = String(req.query.workspaceId || "").trim();
        let targetWorkspaceId = workspaceIdParam;
        // Si le workspace n'est pas fourni, résolution par verifyToken
        if (!targetWorkspaceId && verifyToken) {
            try {
                const connSnap = await db
                    .collectionGroup("shopifyConnections")
                    .where("verifyToken", "==", verifyToken)
                    .limit(1)
                    .get();
                if (!connSnap.empty) {
                    targetWorkspaceId = connSnap.docs[0].data().workspaceId;
                }
            }
            catch (err) {
                console.warn("azifyGateway teams lookup error:", err);
            }
        }
        if (!targetWorkspaceId) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Paramètre verifyToken ou workspaceId requis pour lister les équipes.",
            });
            return;
        }
        try {
            const teamsSnap = await db
                .collection("workspaces")
                .doc(targetWorkspaceId)
                .collection("teams")
                .get();
            const teamsList = teamsSnap.docs.map((docSnap) => {
                const d = docSnap.data();
                return {
                    id: docSnap.id,
                    name: d.name || "Équipe sans nom",
                    country: d.country || "TG",
                    currency: d.currency || "XOF",
                    membersCount: Array.isArray(d.members) ? d.members.length : 0,
                    active: d.active !== false,
                };
            });
            res.status(200).json({
                success: true,
                workspaceId: targetWorkspaceId,
                teams: teamsList,
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway getTeams error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // 3. POST /pair : Appairage sécurisé Azify <-> WariTrack
    if (req.method === "POST" && (path === "/pair" || path.endsWith("/pair"))) {
        try {
            const body = parseJsonBody(req);
            const { storeId, storeName, slug, shopDomain, customDomain, verifyToken, ownerTeamId, defaultCountry, countryRoutes, accountEmail, workspaceId, } = body;
            if (!shopDomain || !verifyToken) {
                res.status(400).json({
                    error: "Bad Request",
                    message: "shopDomain et verifyToken sont requis pour l'appairage.",
                });
                return;
            }
            let targetWorkspaceId = workspaceId;
            // Si le workspaceId n'est pas fourni, trouver ou déduire via token existant
            if (!targetWorkspaceId) {
                const tokenSnap = await db
                    .collectionGroup("shopifyConnections")
                    .where("verifyToken", "==", verifyToken)
                    .limit(1)
                    .get();
                if (!tokenSnap.empty) {
                    targetWorkspaceId = tokenSnap.docs[0].data().workspaceId;
                }
            }
            if (!targetWorkspaceId) {
                res.status(400).json({
                    error: "Workspace Required",
                    message: "workspaceId manquant ou introuvable. Veuillez initier l'appairage depuis WariTrack.",
                });
                return;
            }
            const cleanDomain = String(shopDomain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
            const connId = cleanDomain.replace(/[^a-z0-9]/gi, "_");
            const connRef = db.collection("workspaces").doc(targetWorkspaceId).collection("shopifyConnections").doc(connId);
            const existing = await connRef.get();
            const domainsList = Array.from(new Set([
                cleanDomain,
                ...(customDomain ? [String(customDomain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")] : []),
                ...(existing.exists && Array.isArray(existing.data()?.domains) ? existing.data().domains : []),
            ]));
            const connData = {
                shopDomain: cleanDomain,
                shopName: storeName || slug || cleanDomain,
                customDomain: customDomain ? String(customDomain).trim().toLowerCase() : (existing.data()?.customDomain || null),
                domains: domainsList,
                sourcePlatform: "azify",
                azifyStoreId: storeId || connId,
                azifyStoreSlug: slug || null,
                azifyAccountEmail: accountEmail || null,
                verifyToken: verifyToken,
                ownerTeamId: ownerTeamId || existing.data()?.ownerTeamId || null,
                defaultCountry: defaultCountry || "TG",
                countryRoutes: Array.isArray(countryRoutes) ? countryRoutes : (existing.data()?.countryRoutes || []),
                status: "active",
                workspaceId: targetWorkspaceId,
                webhookVerifiedAt: Date.now(),
                updatedAt: Date.now(),
                createdAt: existing.exists ? (existing.data()?.createdAt || Date.now()) : Date.now(),
            };
            await connRef.set(connData, { merge: true });
            res.status(200).json({
                success: true,
                paired: true,
                workspaceId: targetWorkspaceId,
                storeDomain: cleanDomain,
                ownerTeamId: connData.ownerTeamId,
                webhookUrl: "https://shopifywebhook-7sfexpcitq-uc.a.run.app",
                trackerUrl: "https://tracksession-7sfexpcitq-uc.a.run.app",
                message: "Appairage Azify <-> WariTrack réussi. Synchronisation bidirectionnelle active.",
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway pair error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // 4. GET /status : Télémétrie et état de synchronisation
    if (req.method === "GET" && (path === "/status" || path.endsWith("/status"))) {
        const verifyToken = String(req.headers["x-azify-verify-token"] || req.query.verifyToken || "").trim();
        const shopDomain = String(req.query.shopDomain || "").trim().toLowerCase();
        if (!verifyToken && !shopDomain) {
            res.status(400).json({ error: "verifyToken ou shopDomain requis." });
            return;
        }
        try {
            let connDoc = null;
            if (verifyToken) {
                const snap = await db.collectionGroup("shopifyConnections").where("verifyToken", "==", verifyToken).limit(1).get();
                if (!snap.empty)
                    connDoc = snap.docs[0];
            }
            if (!connDoc && shopDomain) {
                const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                const connId = cleanDomain.replace(/[^a-z0-9]/gi, "_");
                const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", cleanDomain).limit(1).get();
                if (!snap.empty)
                    connDoc = snap.docs[0];
            }
            if (!connDoc) {
                res.status(404).json({ connected: false, message: "Aucune boutique Azify associée." });
                return;
            }
            const data = connDoc.data();
            res.status(200).json({
                connected: data.status === "active",
                status: data.status,
                shopName: data.shopName,
                shopDomain: data.shopDomain,
                ownerTeamId: data.ownerTeamId,
                lastOrderAt: data.lastOrderAt || null,
                ordersCount: data.ordersCount || 0,
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway status error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // 5. POST /push/subscribe : Inscription Push des visiteurs / acheteurs Marketplace
    if (req.method === "POST" && (path === "/push/subscribe" || path.endsWith("/push/subscribe"))) {
        try {
            const body = parseJsonBody(req);
            const { token, shopDomain, azifyStoreId, country, clientName, clientPhone, clientEmail, cart, tags, userAgent, } = body;
            if (!token || typeof token !== "string" || token.trim().length < 10) {
                res.status(400).json({ error: "FCM registration token valide requis." });
                return;
            }
            const verifyToken = String(req.headers["x-azify-verify-token"] || body.verifyToken || "").trim();
            let targetWorkspaceId = String(body.workspaceId || "").trim();
            // Resolution du workspaceId
            if (!targetWorkspaceId && (verifyToken || shopDomain)) {
                let connDoc = null;
                if (verifyToken) {
                    const snap = await db.collectionGroup("shopifyConnections").where("verifyToken", "==", verifyToken).limit(1).get();
                    if (!snap.empty)
                        connDoc = snap.docs[0];
                }
                if (!connDoc && shopDomain) {
                    const cleanDomain = String(shopDomain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                    const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", cleanDomain).limit(1).get();
                    if (!snap.empty)
                        connDoc = snap.docs[0];
                }
                if (connDoc) {
                    targetWorkspaceId = connDoc.data().workspaceId || "";
                }
            }
            if (!targetWorkspaceId) {
                const wsSnap = await db.collection("workspaces").limit(1).get();
                if (!wsSnap.empty) {
                    targetWorkspaceId = wsSnap.docs[0].id;
                }
            }
            if (!targetWorkspaceId) {
                res.status(404).json({ error: "Workspace introuvable pour cette boutique." });
                return;
            }
            const subscriberId = crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
            const subRef = db.collection("workspaces").doc(targetWorkspaceId).collection("marketplaceSubscribers").doc(subscriberId);
            const existing = await subRef.get();
            const cleanCountry = (country || "TG").trim().toUpperCase();
            const now = Date.now();
            const subscriberData = {
                id: subscriberId,
                token: token.trim(),
                workspaceId: targetWorkspaceId,
                shopDomain: shopDomain ? String(shopDomain).toLowerCase().trim() : (existing.data()?.shopDomain || null),
                azifyStoreId: azifyStoreId || existing.data()?.azifyStoreId || null,
                country: cleanCountry,
                clientName: clientName || existing.data()?.clientName || null,
                clientPhone: clientPhone || existing.data()?.clientPhone || null,
                clientEmail: clientEmail || existing.data()?.clientEmail || null,
                userAgent: userAgent || req.headers["user-agent"] || null,
                tags: Array.isArray(tags) ? tags : (existing.data()?.tags || ["marketplace_optin"]),
                lastSeenAt: now,
                updatedAt: now,
                createdAt: existing.exists ? (existing.data()?.createdAt || now) : now,
            };
            if (cart && typeof cart === "object") {
                subscriberData.cart = {
                    product: String(cart.product || "Panier en cours"),
                    amount: Number(cart.amount || 0),
                    quantity: Number(cart.quantity || 1),
                    productImageUrl: cart.productImageUrl || null,
                    checkoutUrl: cart.checkoutUrl || null,
                    status: cart.status || "active",
                    updatedAt: now,
                };
                if (cart.status === "abandoned") {
                    subscriberData.cartAbandonedAt = now;
                    subscriberData.cartRecoverySent = false;
                }
            }
            await subRef.set(subscriberData, { merge: true });
            res.status(200).json({
                success: true,
                subscriberId,
                country: cleanCountry,
                message: "Abonne Push Marketplace enregistre avec succes.",
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway push subscribe error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // 6. POST /cart/activity : Suivi temps reel des ajouts au panier & detection d'abandon
    if (req.method === "POST" && (path === "/cart/activity" || path.endsWith("/cart/activity"))) {
        try {
            const body = parseJsonBody(req);
            const { token, subscriberId: incomingSubId, shopDomain, product, amount, quantity, productImageUrl, checkoutUrl, status, clientPhone, clientName, } = body;
            const subId = incomingSubId || (token ? crypto.createHash("sha256").update(token).digest("hex").slice(0, 32) : null);
            const verifyToken = String(req.headers["x-azify-verify-token"] || body.verifyToken || "").trim();
            let targetWorkspaceId = String(body.workspaceId || "").trim();
            if (!targetWorkspaceId && (verifyToken || shopDomain)) {
                let connDoc = null;
                if (verifyToken) {
                    const snap = await db.collectionGroup("shopifyConnections").where("verifyToken", "==", verifyToken).limit(1).get();
                    if (!snap.empty)
                        connDoc = snap.docs[0];
                }
                if (!connDoc && shopDomain) {
                    const cleanDomain = String(shopDomain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                    const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", cleanDomain).limit(1).get();
                    if (!snap.empty)
                        connDoc = snap.docs[0];
                }
                if (connDoc) {
                    targetWorkspaceId = connDoc.data().workspaceId || "";
                }
            }
            if (!targetWorkspaceId) {
                const wsSnap = await db.collection("workspaces").limit(1).get();
                if (!wsSnap.empty)
                    targetWorkspaceId = wsSnap.docs[0].id;
            }
            if (!targetWorkspaceId || !subId) {
                res.status(400).json({ error: "workspaceId et (token ou subscriberId) requis." });
                return;
            }
            const subRef = db.collection("workspaces").doc(targetWorkspaceId).collection("marketplaceSubscribers").doc(subId);
            const now = Date.now();
            const effectiveStatus = status === "converted" ? "converted" : status === "abandoned" ? "abandoned" : "active";
            const updateData = {
                "cart.product": product || "Produit Marketplace",
                "cart.amount": Number(amount || 0),
                "cart.quantity": Number(quantity || 1),
                "cart.productImageUrl": productImageUrl || null,
                "cart.checkoutUrl": checkoutUrl || null,
                "cart.status": effectiveStatus,
                "cart.updatedAt": now,
                lastSeenAt: now,
            };
            if (clientPhone)
                updateData.clientPhone = clientPhone;
            if (clientName)
                updateData.clientName = clientName;
            if (effectiveStatus === "abandoned") {
                updateData.cartAbandonedAt = now;
                updateData.cartRecoverySent = false;
            }
            else if (effectiveStatus === "converted") {
                updateData.cartConvertedAt = now;
                updateData.cartRecoverySent = true;
            }
            await subRef.set(updateData, { merge: true });
            res.status(200).json({
                success: true,
                subscriberId: subId,
                cartStatus: effectiveStatus,
                message: "Activite panier enregistree.",
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway cart activity error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // 7. GET /marketplace/stats : Statistiques des abonnes et paniers
    if (req.method === "GET" && (path === "/marketplace/stats" || path.endsWith("/marketplace/stats"))) {
        try {
            const workspaceIdParam = String(req.query.workspaceId || "").trim();
            let targetWorkspaceId = workspaceIdParam;
            if (!targetWorkspaceId) {
                const wsSnap = await db.collection("workspaces").limit(1).get();
                if (!wsSnap.empty)
                    targetWorkspaceId = wsSnap.docs[0].id;
            }
            if (!targetWorkspaceId) {
                res.status(404).json({ error: "Workspace introuvable." });
                return;
            }
            const subsSnap = await db.collection("workspaces").doc(targetWorkspaceId).collection("marketplaceSubscribers").get();
            const totalSubscribers = subsSnap.size;
            let abandonedCartsCount = 0;
            let recoveredCount = 0;
            subsSnap.docs.forEach((doc) => {
                const d = doc.data();
                if (d.cart?.status === "abandoned" && !d.cartRecoverySent) {
                    abandonedCartsCount++;
                }
                if (d.cart?.status === "converted" && d.cartRecoverySent) {
                    recoveredCount++;
                }
            });
            res.status(200).json({
                success: true,
                workspaceId: targetWorkspaceId,
                totalSubscribers,
                abandonedCartsCount,
                recoveredCount,
                timestamp: Date.now(),
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway stats error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // Route non reconnue
    res.status(404).json({ error: "Not Found", path });
});
