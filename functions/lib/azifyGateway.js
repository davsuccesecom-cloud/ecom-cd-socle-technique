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
exports.extractMapAndLocation = extractMapAndLocation;
exports.stripGpsRaw = stripGpsRaw;
exports.cleanProductTitleRaw = cleanProductTitleRaw;
exports.extractNotesAndAddress = extractNotesAndAddress;
exports.calculateOrderPricing = calculateOrderPricing;
exports.extractQuantityAndItems = extractQuantityAndItems;
const shopifyTracking_1 = require("./shopifyTracking");
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
/**
 * Extrait et valide les données de géolocalisation et carte réelle (Google Maps / GPS)
 */
function extractMapAndLocation(root) {
    let mapUrl = String(root.mapUrl ||
        root.mapsUrl ||
        root.googleMapsUrl ||
        root.mapLink ||
        root.locationUrl ||
        root.gpsLink ||
        root.map_url ||
        root.location_url ||
        (root.geo && (root.geo.mapUrl || root.geo.url)) ||
        "").trim() || null;
    let latRaw = root.latitude ??
        root.lat ??
        (root.geo && (root.geo.latitude ?? root.geo.lat)) ??
        (root.coordinates && typeof root.coordinates === "object" && !Array.isArray(root.coordinates)
            ? (root.coordinates.lat ?? root.coordinates.latitude)
            : null);
    let lngRaw = root.longitude ??
        root.lng ??
        root.lon ??
        (root.geo && (root.geo.longitude ?? root.geo.lng ?? root.geo.lon)) ??
        (root.coordinates && typeof root.coordinates === "object" && !Array.isArray(root.coordinates)
            ? (root.coordinates.lng ?? root.coordinates.longitude)
            : null);
    if (root.coordinates && typeof root.coordinates === "string") {
        const parts = root.coordinates.split(",").map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            latRaw = parts[0];
            lngRaw = parts[1];
        }
    }
    else if (Array.isArray(root.coordinates) && root.coordinates.length >= 2) {
        const p0 = parseFloat(root.coordinates[0]);
        const p1 = parseFloat(root.coordinates[1]);
        if (!isNaN(p0) && !isNaN(p1)) {
            latRaw = p0;
            lngRaw = p1;
        }
    }
    const latitude = typeof latRaw === "number" && !isNaN(latRaw) ? latRaw : (latRaw ? parseFloat(latRaw) : null);
    const longitude = typeof lngRaw === "number" && !isNaN(lngRaw) ? lngRaw : (lngRaw ? parseFloat(lngRaw) : null);
    let gpsCoordinates = null;
    if (latitude !== null && !isNaN(latitude) && longitude !== null && !isNaN(longitude)) {
        gpsCoordinates = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        if (!mapUrl) {
            mapUrl = `https://www.google.com/maps?q=${gpsCoordinates}`;
        }
    }
    if (!mapUrl) {
        const rawSearch = `${root.address || ""} ${root.street || ""} ${root.addressNote || ""} ${root.city || ""}`;
        const matchUrl = rawSearch.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps\S*|maps\.google\.com\S*|maps\.app\.goo\.gl\S*)/i);
        if (matchUrl) {
            mapUrl = matchUrl[0].replace(/[\]\)\s,;]+$/, "");
        }
    }
    if (!gpsCoordinates && mapUrl) {
        const coordsMatch = mapUrl.match(/([+-]?\d+\.\d+)\s*,\s*([+-]?\d+\.\d+)/);
        if (coordsMatch) {
            gpsCoordinates = `${coordsMatch[1]},${coordsMatch[2]}`;
        }
    }
    const mapAddress = String(root.mapAddress ||
        root.addressMap ||
        root.locationName ||
        root.geoAddress ||
        (root.geo && root.geo.address) ||
        "").trim() || null;
    return {
        mapUrl,
        googleMapsUrl: mapUrl,
        gpsCoordinates,
        latitude: latitude !== null && !isNaN(latitude) ? latitude : null,
        longitude: longitude !== null && !isNaN(longitude) ? longitude : null,
        mapAddress,
    };
}
/**
 * Extrait distinctement l'adresse physique et les remarques/instructions de livraison
 */
function stripGpsRaw(text) {
    if (!text)
        return "";
    return text
        .replace(/\[\s*GPS\s*:[^\]]*\]/gi, "")
        .replace(/\(\s*GPS\s*:[^)]*\)/gi, "")
        .replace(/GPS\s*:\s*https?:\/\/\S+/gi, "")
        .replace(/https?:\/\/(?:www\.)?(?:google\.com\/maps\S*|maps\.google\.com\S*|maps\.app\.goo\.gl\S*)/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s*[-–—,]\s*$/, "")
        .replace(/^\s*[-–—,]\s*/, "")
        .trim();
}
function cleanProductTitleRaw(product) {
    let p = String(product || "").trim();
    while (/^\d+\s*x\s+/i.test(p)) {
        p = p.replace(/^\d+\s*x\s+/i, "").trim();
    }
    return p || "Produit Azify COD";
}
function extractNotesAndAddress(root) {
    const address = String(root.address ||
        root.adresse ||
        root.street ||
        root.quartier ||
        root.commune ||
        root.rue ||
        root.location ||
        "").trim();
    const notes = String(root.note ||
        root.notes ||
        root.clientNote ||
        root.orderNote ||
        root.instructions ||
        root.instruction ||
        root.remarques ||
        root.remarque ||
        root.message ||
        root.livraisonInstructions ||
        "").trim();
    let addressNote = "";
    if (address && notes) {
        addressNote = `${address} — (${notes})`;
    }
    else if (address) {
        addressNote = address;
    }
    else if (notes) {
        addressNote = notes;
    }
    else {
        addressNote = String(root.addressNote || root.deliveryNote || "").trim();
    }
    return {
        address,
        notes,
        addressNote,
    };
}
/**
 * Calcule immédiatement et rigoureusement le montant COD net avec prise en compte des codes promos
 */
function calculateOrderPricing(root) {
    const promoCodeRaw = String(root.promoCode ||
        root.couponCode ||
        root.codePromo ||
        root.discountCode ||
        root.coupon ||
        "").trim().toUpperCase();
    const promoCode = promoCodeRaw || null;
    let discountAmount = Number(root.discountAmount ||
        root.discount ||
        root.reduction ||
        root.couponAmount ||
        0);
    if (isNaN(discountAmount) || discountAmount < 0)
        discountAmount = 0;
    let discountPercent = Number(root.discountPercent ||
        root.discountPercentage ||
        root.discountRate ||
        root.reductionPourcentage ||
        0) || null;
    let originalAmount = Number(root.originalAmount ||
        root.subtotal ||
        root.prixInitial ||
        root.totalBeforeDiscount ||
        root.subtotalPrice ||
        root.subtotal_price ||
        0);
    if (isNaN(originalAmount) || originalAmount < 0)
        originalAmount = 0;
    let rawAmount = Number(root.amount ||
        root.totalPrice ||
        root.total_price ||
        root.total ||
        0);
    if (isNaN(rawAmount) || rawAmount < 0)
        rawAmount = 0;
    // Calcul immédiat si code promo présent
    if (promoCode) {
        // Si pourcentage fourni
        if (discountPercent && discountPercent > 0 && discountPercent <= 100) {
            if (originalAmount <= 0 && rawAmount > 0) {
                originalAmount = rawAmount;
            }
            if (originalAmount > 0) {
                discountAmount = Math.round((originalAmount * discountPercent) / 100);
                const netAmount = Math.max(0, originalAmount - discountAmount);
                return {
                    amount: netAmount,
                    originalAmount,
                    promoCode,
                    discountAmount,
                    discountPercent,
                };
            }
        }
        // Si remise forfaitaire en valeur monétaire
        if (discountAmount > 0) {
            if (originalAmount > 0) {
                const netAmount = Math.max(0, originalAmount - discountAmount);
                return {
                    amount: netAmount,
                    originalAmount,
                    promoCode,
                    discountAmount,
                    discountPercent: null,
                };
            }
            else if (rawAmount > 0) {
                if (root.alreadyDiscounted || root.isDiscountApplied === true) {
                    return {
                        amount: rawAmount,
                        originalAmount: rawAmount + discountAmount,
                        promoCode,
                        discountAmount,
                        discountPercent: null,
                    };
                }
                else {
                    // Calcul immédiat exigé par l'utilisateur
                    const netAmount = Math.max(0, rawAmount - discountAmount);
                    return {
                        amount: netAmount,
                        originalAmount: rawAmount,
                        promoCode,
                        discountAmount,
                        discountPercent: null,
                    };
                }
            }
        }
        // Si Azify a fourni originalAmount et un rawAmount déjà réduit
        if (originalAmount > 0 && rawAmount > 0 && originalAmount > rawAmount) {
            discountAmount = originalAmount - rawAmount;
            return {
                amount: rawAmount,
                originalAmount,
                promoCode,
                discountAmount,
                discountPercent: null,
            };
        }
    }
    // Aucun code promo ou aucun rabais applicable
    const finalAmount = rawAmount > 0 ? rawAmount : originalAmount;
    return {
        amount: finalAmount,
        originalAmount: finalAmount,
        promoCode,
        discountAmount: 0,
        discountPercent: null,
    };
}
/**
 * Extrait les quantités, packs et détail des articles
 */
function extractQuantityAndItems(root) {
    const itemsList = [];
    const rawItems = Array.isArray(root.items)
        ? root.items
        : Array.isArray(root.line_items)
            ? root.line_items
            : Array.isArray(root.products)
                ? root.products
                : [];
    let itemsQtySum = 0;
    for (const it of rawItems) {
        const q = Math.max(1, Number(it.quantity || it.qty || 1));
        itemsQtySum += q;
        itemsList.push({
            product: String(it.title || it.name || it.product || it.productTitle || "Produit").trim(),
            quantity: q,
            price: Number(it.price || it.unitPrice || 0) || undefined,
        });
    }
    let qty = Number(root.quantity || root.qty || 0);
    // Détection des packs dans les libellés (ex: "Pack 2 pièces", "Lot de 3")
    if (!qty && root.pack) {
        if (typeof root.pack === "number" && root.pack > 0) {
            qty = root.pack;
        }
        else {
            const match = String(root.pack).match(/(\d+)/);
            if (match)
                qty = parseInt(match[1], 10);
        }
    }
    if (!qty && itemsQtySum > 0) {
        qty = itemsQtySum;
    }
    if (!qty) {
        const prodStr = String(root.product || root.productTitle || "");
        const match = prodStr.match(/(?:pack|lot|pack\s*de)\s*(\d+)/i);
        if (match) {
            qty = parseInt(match[1], 10);
        }
    }
    return {
        quantity: Math.max(1, qty || 1),
        items: itemsList,
    };
}
exports.azifyGateway = (0, https_1.onRequest)({
    region: "us-central1",
    cors: true,
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
                countryRoutes: (function () {
                    let finalRoutes = {};
                    const existingRoutes = existing.data()?.countryRoutes;
                    if (existingRoutes && typeof existingRoutes === "object" && !Array.isArray(existingRoutes)) {
                        finalRoutes = { ...existingRoutes };
                    }
                    else if (Array.isArray(existingRoutes)) {
                        existingRoutes.forEach((r) => {
                            if (r?.countryCode)
                                finalRoutes[r.countryCode.toUpperCase()] = r;
                        });
                    }
                    if (countryRoutes && typeof countryRoutes === "object" && !Array.isArray(countryRoutes)) {
                        finalRoutes = { ...finalRoutes, ...countryRoutes };
                    }
                    else if (Array.isArray(countryRoutes)) {
                        countryRoutes.forEach((r) => {
                            if (r?.countryCode)
                                finalRoutes[r.countryCode.toUpperCase()] = r;
                        });
                    }
                    return finalRoutes;
                })(),
                status: "active",
                workspaceId: targetWorkspaceId,
                webhookVerifiedAt: Date.now(),
                updatedAt: Date.now(),
                createdAt: existing.exists ? (existing.data()?.createdAt || Date.now()) : Date.now(),
            };
            await connRef.set(connData, { merge: true });
            const apiKey = connData.verifyToken || `az_sec_${crypto.randomBytes(16).toString("hex")}`;
            try {
                await connRef.update({ apiKey });
            }
            catch { }
            res.status(200).json({
                success: true,
                paired: true,
                workspaceId: targetWorkspaceId,
                storeDomain: cleanDomain,
                ownerTeamId: connData.ownerTeamId,
                // API DIRECTE AZIFY HAUTE PERFORMANCE (INGESTION SYNCHRONE TEMPS RÉEL)
                apiUrl: "https://azifygateway-7sfexpcitq-uc.a.run.app/orders",
                apiKey,
                endpoints: {
                    createOrder: "https://azifygateway-7sfexpcitq-uc.a.run.app/orders",
                    batchOrders: "https://azifygateway-7sfexpcitq-uc.a.run.app/orders/batch",
                    getOrderStatus: "https://azifygateway-7sfexpcitq-uc.a.run.app/orders",
                    teams: "https://azifygateway-7sfexpcitq-uc.a.run.app/teams",
                },
                trackerUrl: "https://tracksession-7sfexpcitq-uc.a.run.app",
                message: "Appairage API Directe Azify <-> WariTrack réussi. Ingestion synchrone temps réel active.",
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
    // =========================================================================
    // 4bis. API DIRECTE HAUTE PERFORMANCE AZIFY (INGESTION COD SYNCHRONE & STATUTS)
    // =========================================================================
    // A. GET /orders ou /orders/:id : Consultation temps réel du statut d'une commande
    if (req.method === "GET" && (path === "/orders" || path.startsWith("/orders/") || path.startsWith("/order/"))) {
        try {
            const orderIdParam = path.replace(/^\/orders?\/?/, "").trim() || String(req.query.id || req.query.orderId || "").trim();
            const verifyToken = String(req.headers["x-azify-verify-token"] || req.headers["x-azify-api-key"] || req.query.verifyToken || req.query.apiKey || "").trim();
            const shopDomain = String(req.headers["x-azify-shop-domain"] || req.query.shopDomain || "").trim().toLowerCase();
            let targetWorkspaceId = String(req.query.workspaceId || "").trim();
            if (!targetWorkspaceId && (verifyToken || shopDomain)) {
                let cDoc = null;
                if (verifyToken) {
                    const snap = await db.collectionGroup("shopifyConnections").where("verifyToken", "==", verifyToken).limit(1).get();
                    if (!snap.empty)
                        cDoc = snap.docs[0];
                }
                if (!cDoc && shopDomain) {
                    const clean = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                    const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", clean).limit(1).get();
                    if (!snap.empty)
                        cDoc = snap.docs[0];
                }
                if (cDoc)
                    targetWorkspaceId = cDoc.data()?.workspaceId || "";
            }
            if (!targetWorkspaceId) {
                const wsSnap = await db.collection("workspaces").limit(1).get();
                if (!wsSnap.empty)
                    targetWorkspaceId = wsSnap.docs[0].id;
            }
            if (!targetWorkspaceId || !orderIdParam) {
                res.status(400).json({ error: "orderId et workspaceId requis." });
                return;
            }
            const cleanId = orderIdParam.replace(/^#/, "");
            const orderSnap = await db.collection("workspaces").doc(targetWorkspaceId).collection("orders").doc(cleanId).get();
            if (!orderSnap.exists) {
                res.status(404).json({ error: "Commande introuvable", orderId: cleanId });
                return;
            }
            const o = orderSnap.data() || {};
            res.status(200).json({
                success: true,
                orderId: cleanId,
                orderNumber: o.orderNumber || `#${cleanId}`,
                teamId: o.teamId,
                teamName: o.teamName,
                clientName: o.clientName,
                amount: o.amount,
                product: o.product,
                statutCloseuse: o.statutCloseuse,
                statutLivreur: o.statutLivreur,
                delivered: Boolean(o.statutLivreur === "livre" || o.statutCloseuse === "livre"),
                timestamps: o.timestamps || {},
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway getOrder error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // B. POST /orders/batch : Ingestion en masse ultra-rapide (bulk orders)
    if (req.method === "POST" && (path === "/orders/batch" || path.endsWith("/orders/batch"))) {
        const startTime = Date.now();
        try {
            const body = parseJsonBody(req);
            const ordersList = Array.isArray(body.orders) ? body.orders : Array.isArray(body.items) ? body.items : [];
            if (ordersList.length === 0) {
                res.status(400).json({ error: "Tableau 'orders' vide ou manquant." });
                return;
            }
            const authHeader = String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
            const verifyToken = String(req.headers["x-azify-verify-token"] || req.headers["x-azify-api-key"] || authHeader || body.apiKey || body.verifyToken || "").trim();
            const shopDomain = String(req.headers["x-azify-shop-domain"] || body.shopDomain || body.storeDomain || "").trim().toLowerCase();
            let targetWorkspaceId = String(body.workspaceId || "").trim();
            let connDoc = null;
            if (verifyToken) {
                const snap = await db.collectionGroup("shopifyConnections").where("verifyToken", "==", verifyToken).limit(1).get();
                if (!snap.empty)
                    connDoc = snap.docs[0];
            }
            if (!connDoc && shopDomain) {
                const clean = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", clean).limit(1).get();
                if (!snap.empty)
                    connDoc = snap.docs[0];
            }
            if (connDoc)
                targetWorkspaceId = connDoc.data()?.workspaceId || targetWorkspaceId;
            if (!targetWorkspaceId) {
                const wsSnap = await db.collection("workspaces").limit(1).get();
                if (!wsSnap.empty)
                    targetWorkspaceId = wsSnap.docs[0].id;
            }
            if (!targetWorkspaceId) {
                res.status(404).json({ error: "Workspace introuvable." });
                return;
            }
            const connData = connDoc?.data() || {};
            const teamsSnap = await db.collection("workspaces").doc(targetWorkspaceId).collection("teams").get();
            const teamsList = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const batch = db.batch();
            const results = [];
            const now = Date.now();
            for (const item of ordersList.slice(0, 100)) {
                const rawOrderId = String(item.id ?? item.orderId ?? item.order_id ?? item._id ?? item.orderNumber ?? `az_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
                const orderId = rawOrderId.replace(/^#/, "");
                const rawPhone = String(item.clientPhone || item.phone || item.tel || "");
                const city = String(item.city || item.ville || "");
                const countryCode = (0, shopifyTracking_1.detectAfricanCountry)({
                    phone: rawPhone,
                    countryCode: item.countryCode || item.country,
                    city,
                    defaultCountry: connData.defaultCountry || "TG",
                });
                let assignedTeamId = "";
                let assignedTeamName = "";
                // Routage par countryRoutes
                if (connData.countryRoutes && typeof connData.countryRoutes === "object" && !Array.isArray(connData.countryRoutes)) {
                    const r = connData.countryRoutes[countryCode];
                    if (r && r.status === "active" && r.assignedTeamId) {
                        assignedTeamId = r.assignedTeamId;
                        assignedTeamName = r.assignedTeamName || "";
                    }
                }
                if (!assignedTeamId) {
                    const matched = teamsList.find(t => t.defaultCountry === countryCode);
                    if (matched) {
                        assignedTeamId = matched.id;
                        assignedTeamName = matched.name || `Équipe ${countryCode}`;
                    }
                }
                if (!assignedTeamId && connData.ownerTeamId) {
                    assignedTeamId = connData.ownerTeamId;
                    assignedTeamName = connData.ownerTeamName || "";
                }
                if (!assignedTeamId && teamsList.length > 0) {
                    const first = teamsList[0];
                    assignedTeamId = first.id;
                    assignedTeamName = first.name || "";
                }
                const mapInfo = extractMapAndLocation(item);
                const notesInfo = extractNotesAndAddress(item);
                const pricingInfo = calculateOrderPricing(item);
                const qtyInfo = extractQuantityAndItems(item);
                const fbclid = String(item.fbclid || item.tracking?.fbclid || "").trim();
                const fbp = String(item.fbp || item._fbp || item.tracking?.fbp || "").trim();
                const fbc = String(item.fbc || item._fbc || item.tracking?.fbc || (fbclid ? `fb.1.${now}.${fbclid}` : "")).trim();
                const clientIp = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || item.ip || item.browserIp || "").split(",")[0].trim();
                const userAgent = String(req.headers["user-agent"] || item.userAgent || "").trim();
                const isMetaAds = Boolean(fbclid || fbc || item.trafficSource === "meta_ads" || item.source === "facebook" || item.source === "instagram");
                const orderRef = db.collection("workspaces").doc(targetWorkspaceId).collection("orders").doc(orderId);
                const orderDoc = {
                    id: orderId,
                    workspaceId: targetWorkspaceId,
                    teamId: assignedTeamId,
                    teamName: assignedTeamName,
                    sheetId: "",
                    sourceRowId: `azify_${orderId}`,
                    sourceType: "azify_api",
                    protocol: "direct_rest_api",
                    shopifyOrderId: orderId,
                    clientName: String(item.clientName || item.name || "Client Azify").trim(),
                    clientPhoneRaw: rawPhone,
                    clientPhoneFormatted: rawPhone || "Non renseigné",
                    city,
                    address: notesInfo.address || undefined,
                    notes: notesInfo.notes || undefined,
                    addressNote: stripGpsRaw(notesInfo.addressNote),
                    product: cleanProductTitleRaw(item.product || item.productTitle),
                    quantity: qtyInfo.quantity,
                    amount: pricingInfo.amount,
                    originalAmount: pricingInfo.originalAmount,
                    promoCode: pricingInfo.promoCode,
                    discountAmount: pricingInfo.discountAmount,
                    discountPercent: pricingInfo.discountPercent,
                    mapUrl: mapInfo.mapUrl,
                    googleMapsUrl: mapInfo.googleMapsUrl,
                    gpsCoordinates: mapInfo.gpsCoordinates,
                    latitude: mapInfo.latitude,
                    longitude: mapInfo.longitude,
                    mapAddress: mapInfo.mapAddress,
                    orderNumber: item.orderNumber ? `#${String(item.orderNumber).replace(/^#/, "")}` : `#${orderId}`,
                    sourcePlatform: "azify",
                    azifyStoreId: connData.azifyStoreId || null,
                    closeuseId: null,
                    livreurId: null,
                    statutCloseuse: "nouveau",
                    statutLivreur: null,
                    temperature: "hot",
                    trafficSource: isMetaAds ? "meta_ads" : "organique",
                    capiIsolated: !isMetaAds,
                    browserIp: clientIp || null,
                    userAgent: userAgent || null,
                    shopifyData: {
                        fbp: fbp || null,
                        fbc: fbc || null,
                        fbclid: fbclid || null,
                        browserIp: clientIp || null,
                        browserUserAgent: userAgent || null,
                        pageUrl: item.pageUrl || item.referrer || null,
                        shopDomain: connData.shopDomain || item.shopDomain || "boutique.azify.store",
                    },
                    timestamps: { received: now },
                    capiSent: false,
                    purgeAt: null,
                };
                if (qtyInfo.items.length > 0) {
                    orderDoc.items = qtyInfo.items;
                }
                batch.set(orderRef, orderDoc, { merge: true });
                results.push({ orderId, teamId: assignedTeamId, teamName: assignedTeamName, countryCode });
            }
            await batch.commit();
            if (connDoc) {
                try {
                    await connDoc.ref.update({
                        status: "active",
                        lastOrderAt: now,
                        ordersCount: admin.firestore.FieldValue.increment(results.length),
                    });
                }
                catch { }
            }
            res.status(200).json({
                success: true,
                batchCount: results.length,
                orders: results,
                executionTimeMs: Date.now() - startTime,
                message: `${results.length} commande(s) Azify ingérée(s) et routée(s) avec succès via l'API Directe.`,
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway batch orders error:", err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
            return;
        }
    }
    // C. POST /orders, /order, /webhook ou root : Ingestion directe haute performance d'une commande COD
    if (req.method === "POST" &&
        (path === "" ||
            path === "/" ||
            path === "/orders" ||
            path === "/order" ||
            path === "/webhook" ||
            path.endsWith("/orders") ||
            path.endsWith("/order") ||
            path.endsWith("/webhook") ||
            (!path.startsWith("/push") && !path.startsWith("/cart")))) {
        const startTime = Date.now();
        try {
            const body = parseJsonBody(req);
            const root = (body.order && typeof body.order === "object")
                ? body.order
                : (body.data && typeof body.data === "object")
                    ? body.data
                    : body;
            const authHeader = String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
            const verifyToken = String(req.headers["x-azify-verify-token"] || req.headers["x-azify-api-key"] || authHeader || root.verifyToken || root.apiKey || body.verifyToken || body.apiKey || "").trim();
            const shopDomain = String(req.headers["x-azify-shop-domain"] || req.query.shopDomain || root.shopDomain || root.storeDomain || body.shopDomain || "").trim().toLowerCase();
            let targetWorkspaceId = String(body.workspaceId || root.workspaceId || "").trim();
            let connDoc = null;
            if (verifyToken) {
                const snap = await db.collectionGroup("shopifyConnections").where("verifyToken", "==", verifyToken).limit(1).get();
                if (!snap.empty)
                    connDoc = snap.docs[0];
            }
            if (!connDoc && shopDomain) {
                const clean = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", clean).limit(1).get();
                if (!snap.empty)
                    connDoc = snap.docs[0];
            }
            if (connDoc) {
                targetWorkspaceId = connDoc.data()?.workspaceId || targetWorkspaceId;
            }
            if (!targetWorkspaceId) {
                const wsSnap = await db.collection("workspaces").limit(1).get();
                if (!wsSnap.empty)
                    targetWorkspaceId = wsSnap.docs[0].id;
            }
            if (!targetWorkspaceId) {
                res.status(404).json({ error: "Workspace introuvable pour cette boutique." });
                return;
            }
            const rawOrderId = String(root.id ??
                root.orderId ??
                root.order_id ??
                root._id ??
                root.orderNumber ??
                root.order_number ??
                root.reference ??
                `az_${Date.now()}`);
            const orderId = rawOrderId.replace(/^#/, "");
            const orderNumber = root.orderNumber ? (String(root.orderNumber).startsWith("#") ? String(root.orderNumber) : `#${root.orderNumber}`) : `#${orderId}`;
            // Idempotence : si la commande existe déjà, renvoyer immédiatement confirmation sans doublonner
            const existingOrderRef = db.collection("workspaces").doc(targetWorkspaceId).collection("orders").doc(orderId);
            const existingSnap = await existingOrderRef.get();
            if (existingSnap.exists) {
                const existingData = existingSnap.data() || {};
                res.status(200).json({
                    success: true,
                    orderId,
                    status: "already_exists",
                    idempotent: true,
                    assignedTeamId: existingData.teamId,
                    assignedTeamName: existingData.teamName,
                    executionTimeMs: Date.now() - startTime,
                    message: "Commande déjà enregistrée (idempotence validée).",
                });
                return;
            }
            const connData = connDoc?.data() || {};
            const rawPhone = String(root.clientPhone || root.phone || root.tel || root.telephone || root.whatsapp || "");
            const city = String(root.city || root.ville || root.commune || "");
            const countryCandidate = String(root.countryCode || root.country || root.pays || connData.defaultCountry || "TG");
            const countryCode = (0, shopifyTracking_1.detectAfricanCountry)({
                phone: rawPhone,
                countryCode: countryCandidate,
                country: countryCandidate,
                city,
                defaultCountry: connData.defaultCountry || "TG",
            });
            // Routage multi-pays haute précision vers l'équipe locale
            let targetRoute = null;
            if (connData.countryRoutes && typeof connData.countryRoutes === "object" && !Array.isArray(connData.countryRoutes)) {
                targetRoute = connData.countryRoutes[countryCode];
            }
            else if (Array.isArray(connData.countryRoutes)) {
                targetRoute = connData.countryRoutes.find((r) => String(r?.countryCode || r?.country || "").toUpperCase() === countryCode);
            }
            let assignedTeamId = (targetRoute && targetRoute.status === "active" && targetRoute.assignedTeamId)
                ? targetRoute.assignedTeamId
                : "";
            let assignedTeamName = targetRoute?.assignedTeamName || "";
            let isUnrouted = false;
            // 1. Chercher automatiquement l'équipe du même pays dans le workspace
            if (!assignedTeamId) {
                const cTeamSnap = await db.collection("workspaces").doc(targetWorkspaceId).collection("teams").where("defaultCountry", "==", countryCode).limit(1).get();
                if (!cTeamSnap.empty) {
                    assignedTeamId = cTeamSnap.docs[0].id;
                    assignedTeamName = cTeamSnap.docs[0].data()?.name || `Équipe ${countryCode}`;
                }
            }
            // 2. Équipe propriétaire
            if (!assignedTeamId && connData.ownerTeamId) {
                assignedTeamId = connData.ownerTeamId;
                assignedTeamName = connData.ownerTeamName || "";
                isUnrouted = true;
            }
            // 3. Première équipe active du workspace
            if (!assignedTeamId) {
                const allTeamsSnap = await db.collection("workspaces").doc(targetWorkspaceId).collection("teams").limit(5).get();
                if (!allTeamsSnap.empty) {
                    const activeTeam = allTeamsSnap.docs.find((d) => d.data()?.active !== false) || allTeamsSnap.docs[0];
                    assignedTeamId = activeTeam.id;
                    assignedTeamName = activeTeam.data()?.name || "";
                    isUnrouted = true;
                }
            }
            const mapInfo = extractMapAndLocation(root);
            const notesInfo = extractNotesAndAddress(root);
            const pricingInfo = calculateOrderPricing(root);
            const qtyInfo = extractQuantityAndItems(root);
            const fbclid = String(root.fbclid || root.tracking?.fbclid || "").trim();
            const fbp = String(root.fbp || root._fbp || root.tracking?.fbp || "").trim();
            const fbc = String(root.fbc || root._fbc || root.tracking?.fbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : "")).trim();
            const clientIp = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || root.ip || root.browserIp || "").split(",")[0].trim();
            const userAgent = String(req.headers["user-agent"] || root.userAgent || "").trim();
            const isMetaAds = Boolean(fbclid || fbc || root.trafficSource === "meta_ads" || root.source === "facebook" || root.source === "instagram");
            const now = Date.now();
            const orderDoc = {
                id: orderId,
                workspaceId: targetWorkspaceId,
                teamId: assignedTeamId || "",
                teamName: assignedTeamName || connData.ownerTeamName || "",
                sheetId: "",
                sourceRowId: `azify_${orderId}`,
                sourceType: "azify_api",
                protocol: "direct_rest_api",
                shopifyOrderId: orderId,
                clientName: String(root.clientName || root.name || root.customerName || "Client Azify").trim(),
                clientPhoneRaw: rawPhone,
                clientPhoneFormatted: rawPhone || "Non renseigné",
                city,
                address: notesInfo.address || undefined,
                notes: notesInfo.notes || undefined,
                addressNote: stripGpsRaw(notesInfo.addressNote),
                product: cleanProductTitleRaw(root.product || root.productTitle),
                productImageUrl: root.productImageUrl || root.image || null,
                quantity: qtyInfo.quantity,
                amount: pricingInfo.amount,
                originalAmount: pricingInfo.originalAmount,
                promoCode: pricingInfo.promoCode,
                discountAmount: pricingInfo.discountAmount,
                discountPercent: pricingInfo.discountPercent,
                mapUrl: mapInfo.mapUrl,
                googleMapsUrl: mapInfo.googleMapsUrl,
                gpsCoordinates: mapInfo.gpsCoordinates,
                latitude: mapInfo.latitude,
                longitude: mapInfo.longitude,
                mapAddress: mapInfo.mapAddress,
                orderNumber,
                sourcePlatform: "azify",
                azifyStoreId: connData.azifyStoreId || root.storeId || null,
                azifyStoreName: connData.shopName || root.storeName || "Azify Studio",
                clientLanguage: root.clientLanguage || root.language || root.langue || null,
                closeuseId: null,
                livreurId: null,
                statutCloseuse: "nouveau",
                statutLivreur: null,
                statutAdminOverride: null,
                callInProgress: null,
                reminderAt: null,
                temperature: "hot",
                trafficSource: isMetaAds ? "meta_ads" : "organique",
                capiIsolated: !isMetaAds,
                browserIp: clientIp || null,
                userAgent: userAgent || null,
                shopifyData: {
                    fbp: fbp || null,
                    fbc: fbc || null,
                    fbclid: fbclid || null,
                    browserIp: clientIp || null,
                    browserUserAgent: userAgent || null,
                    pageUrl: root.pageUrl || root.referrer || null,
                    shopDomain: connData.shopDomain || root.shopDomain || "boutique.azify.store",
                },
                timestamps: {
                    received: now,
                    assignedToCloseuse: null,
                    assignedToLivreur: null,
                    closeuseDecidedAt: null,
                    livreurRespondedAt: null,
                    delivered: null,
                },
                capiSent: false,
                purgeAt: null,
                isUnrouted: Boolean(isUnrouted),
            };
            if (qtyInfo.items.length > 0) {
                orderDoc.items = qtyInfo.items;
            }
            await existingOrderRef.set(orderDoc);
            if (connDoc) {
                try {
                    await connDoc.ref.update({
                        status: "active",
                        lastOrderAt: now,
                        ordersCount: admin.firestore.FieldValue.increment(1),
                    });
                }
                catch { }
            }
            const executionTimeMs = Date.now() - startTime;
            console.log(`azifyGateway [Direct API]: Commande ${orderId} reçue en ${executionTimeMs}ms et routée vers ${assignedTeamName} (${assignedTeamId}) - Pays: ${countryCode} - Montant Net: ${pricingInfo.amount} (Code: ${pricingInfo.promoCode || 'aucun'}, -${pricingInfo.discountAmount})`);
            res.status(200).json({
                success: true,
                orderId,
                status: "routed",
                assignedTeamId,
                assignedTeamName,
                countryCode,
                amount: pricingInfo.amount,
                originalAmount: pricingInfo.originalAmount,
                promoCode: pricingInfo.promoCode,
                discountAmount: pricingInfo.discountAmount,
                quantity: qtyInfo.quantity,
                mapUrl: mapInfo.mapUrl,
                isUnrouted,
                executionTimeMs,
                message: "Commande Azify reçue et routée avec succès via l'API Directe.",
            });
            return;
        }
        catch (err) {
            console.error("azifyGateway direct order error:", err);
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
