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
exports.getStorefrontTrackerScript = exports.shopifyWebhook = exports.trackSession = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const libphonenumber_js_1 = require("libphonenumber-js");
function getDb() {
    return admin.firestore();
}
function sha256(str) {
    if (!str)
        return "";
    return crypto
        .createHash("sha256")
        .update(str.trim().toLowerCase())
        .digest("hex");
}
function cleanPhone(raw) {
    if (!raw)
        return "";
    return raw.replace(/[^\d+]/g, "").trim();
}
function normalizePhoneE164(raw, defaultCountry = "TG") {
    const cleaned = cleanPhone(raw);
    if (!cleaned)
        return { normalized: "", hash: "" };
    try {
        const parsed = (0, libphonenumber_js_1.parsePhoneNumberFromString)(cleaned, defaultCountry);
        if (parsed && parsed.isValid()) {
            const e164 = parsed.format("E.164");
            return { normalized: e164, hash: sha256(e164.replace(/[^\d]/g, "")) };
        }
    }
    catch {
        // Fallback simple
    }
    // Format de secours : supprimer tout sauf les chiffres
    const digits = cleaned.replace(/[^\d]/g, "");
    return { normalized: digits ? `+${digits}` : "", hash: sha256(digits) };
}
function cleanDomain(d) {
    if (!d)
        return "";
    return d
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/:\d+$/, "");
}
/**
 * Retrouve la connexion Shopify d'une boutique en tolérant les domaines personnalisés,
 * sous-domaines .myshopify.com, préfixes www et alias enregistrés.
 */
async function findConnection(db, rawDomain) {
    const clean = cleanDomain(rawDomain);
    if (!clean)
        return null;
    const withoutWww = clean.replace(/^www\./, "");
    const withWww = `www.${withoutWww}`;
    const candidates = Array.from(new Set([clean, withoutWww, withWww])).filter(Boolean);
    // 1. Recherche par shopDomain principal
    for (const cand of candidates) {
        const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", cand).limit(5).get();
        if (!snap.empty) {
            const active = snap.docs.find((d) => d.data().status === "active");
            const chosen = active || snap.docs[0];
            return { doc: chosen, status: chosen.data().status || "active" };
        }
    }
    // 2. Recherche par myshopifyDomain
    for (const cand of candidates) {
        const snap = await db.collectionGroup("shopifyConnections").where("myshopifyDomain", "==", cand).limit(5).get();
        if (!snap.empty) {
            const active = snap.docs.find((d) => d.data().status === "active");
            const chosen = active || snap.docs[0];
            return { doc: chosen, status: chosen.data().status || "active" };
        }
    }
    // 3. Recherche par customDomain
    for (const cand of candidates) {
        const snap = await db.collectionGroup("shopifyConnections").where("customDomain", "==", cand).limit(5).get();
        if (!snap.empty) {
            const active = snap.docs.find((d) => d.data().status === "active");
            const chosen = active || snap.docs[0];
            return { doc: chosen, status: chosen.data().status || "active" };
        }
    }
    // 4. Recherche par alias dans le tableau domains
    for (const cand of candidates) {
        try {
            const snap = await db.collectionGroup("shopifyConnections").where("domains", "array-contains", cand).limit(5).get();
            if (!snap.empty) {
                const active = snap.docs.find((d) => d.data().status === "active");
                const chosen = active || snap.docs[0];
                return { doc: chosen, status: chosen.data().status || "active" };
            }
        }
        catch {
            // Ignorer si index absent
        }
    }
    // 5. Recherche par shopName si cand se termine par .myshopify.com
    for (const cand of candidates) {
        if (cand.endsWith(".myshopify.com")) {
            const prefix = cand.replace(".myshopify.com", "");
            const snap = await db.collectionGroup("shopifyConnections").where("shopName", "==", prefix).limit(5).get();
            if (!snap.empty) {
                const active = snap.docs.find((d) => d.data().status === "active");
                const chosen = active || snap.docs[0];
                return { doc: chosen, status: chosen.data().status || "active" };
            }
        }
    }
    return null;
}
/**
 * navigator.sendBeacon envoie du texte brut : Firebase fournit alors req.body
 * sous forme de chaîne. On accepte donc objet, chaîne et Buffer.
 */
function parseJsonBody(raw) {
    if (raw && typeof raw === "object" && !Buffer.isBuffer(raw))
        return raw;
    const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : typeof raw === "string" ? raw : "";
    if (!text)
        return {};
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
// ===========================================================================
// 1. trackSession : Capture fbp, fbc, UTM, IP, UA et téléphone du visiteur
// ===========================================================================
exports.trackSession = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Méthode non autorisée. Utilisez POST." });
        return;
    }
    try {
        const body = parseJsonBody(req.body);
        const shopDomain = String(body.shopDomain || "").trim().toLowerCase();
        const phoneRaw = String(body.phone || "").trim();
        if (!shopDomain) {
            res.status(400).json({ error: "shopDomain requis." });
            return;
        }
        // Récupérer l'IP et le User Agent depuis les en-têtes
        const forwarded = req.headers["x-forwarded-for"];
        const clientIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip || "";
        const userAgent = (req.headers["user-agent"] || "").slice(0, 300);
        // Normalisation du téléphone
        const { normalized: phoneNormalized, hash: phoneHash } = normalizePhoneE164(phoneRaw);
        const db = getDb();
        // Le workspace vient UNIQUEMENT de la connexion enregistrée (jamais du navigateur)
        const verifyToken = String(body.verifyToken || "").trim();
        let found = await findConnection(db, shopDomain);
        if (!found && body.customDomain) {
            found = await findConnection(db, String(body.customDomain));
        }
        if (!found && body.myshopifyDomain) {
            found = await findConnection(db, String(body.myshopifyDomain));
        }
        // Si pas encore trouvé mais qu'un verifyToken est présent (validation de l'assistant)
        if (!found && verifyToken) {
            const tokenSnap = await db
                .collectionGroup("shopifyConnections")
                .where("verifyToken", "==", verifyToken)
                .limit(1)
                .get();
            if (!tokenSnap.empty) {
                const doc = tokenSnap.docs[0];
                found = { doc, status: doc.data().status || "pending" };
            }
        }
        if (!found) {
            res.status(200).json({ success: true, matched: false });
            return;
        }
        const connData = found.doc.data();
        const workspaceId = String(connData.workspaceId || "");
        const teamId = String(connData.ownerTeamId || "");
        // Preuve d'installation du script & apprentissage automatique des domaines
        if (verifyToken && connData.verifyToken && verifyToken === connData.verifyToken) {
            const updateData = {
                trackerVerifiedAt: Date.now(),
            };
            const incomingMyshopify = String(body.myshopifyDomain || (shopDomain.endsWith(".myshopify.com") ? shopDomain : "")).trim().toLowerCase();
            const incomingCustom = String(body.customDomain || (!shopDomain.endsWith(".myshopify.com") ? shopDomain : "")).trim().toLowerCase();
            if (incomingMyshopify && !connData.myshopifyDomain) {
                updateData.myshopifyDomain = incomingMyshopify;
            }
            if (incomingCustom && !connData.customDomain) {
                updateData.customDomain = incomingCustom;
            }
            const existingDomains = Array.isArray(connData.domains) ? connData.domains : [connData.shopDomain];
            const mergedDomains = Array.from(new Set([
                ...existingDomains,
                connData.shopDomain,
                shopDomain,
                incomingMyshopify,
                incomingCustom,
            ].filter(Boolean)));
            updateData.domains = mergedDomains;
            await found.doc.ref.update(updateData);
        }
        // Boutique pas encore activée : on ne stocke aucune session
        if (found.status !== "active" || !workspaceId) {
            res.status(200).json({ success: true, matched: true, stored: false });
            return;
        }
        const sessionId = db.collection("_").doc().id;
        const sessionDoc = {
            id: sessionId,
            workspaceId,
            teamId,
            shopDomain,
            phoneNormalized,
            phoneHash,
            fbp: body.fbp || "",
            fbc: body.fbc || "",
            fbclid: body.fbclid || "",
            utmSource: body.utm_source || body.utmSource || "",
            utmMedium: body.utm_medium || body.utmMedium || "",
            utmCampaign: body.utm_campaign || body.utmCampaign || "",
            utmContent: body.utm_content || body.utmContent || "",
            utmTerm: body.utm_term || body.utmTerm || "",
            pageUrl: (body.pageUrl || "").slice(0, 500),
            ip: clientIp,
            userAgent,
            createdAt: Date.now(),
            linkedOrderId: null,
        };
        await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("trackingSessions")
            .doc(sessionId)
            .set(sessionDoc);
        res.status(200).json({
            success: true,
            sessionId,
            matched: true,
            stored: true,
        });
    }
    catch (err) {
        console.error("trackSession error:", err);
        res.status(500).json({ error: "Erreur interne lors de la capture de session." });
    }
});
// ===========================================================================
// 2. shopifyWebhook : Réception des commandes Shopify & Routage par Pays/Flux
// ===========================================================================
exports.shopifyWebhook = (0, https_1.onRequest)(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const shopDomain = (req.headers["x-shopify-shop-domain"] ||
            req.body?.shop_url ||
            "").trim().toLowerCase();
        const orderPayload = req.body;
        if (!orderPayload || !orderPayload.id) {
            res.status(400).send("Bad Request: payload manquant ou invalide.");
            return;
        }
        const shopifyOrderId = String(orderPayload.id);
        const orderNumber = orderPayload.order_number ? `#${orderPayload.order_number}` : (orderPayload.name || "");
        const db = getDb();
        // Rechercher la connexion Shopify correspondante (Multi-boutique / Flux)
        let found = await findConnection(db, shopDomain);
        // Si non trouvé via l'en-tête (cas où la boutique a été créée avec son domaine personnalisé),
        // chercher dans les métadonnées de commande
        if (!found && orderPayload) {
            const candidatesFromPayload = [];
            if (orderPayload.order_status_url) {
                try {
                    candidatesFromPayload.push(new URL(orderPayload.order_status_url).hostname);
                }
                catch { }
            }
            if (orderPayload.landing_site) {
                try {
                    candidatesFromPayload.push(new URL(orderPayload.landing_site, "https://dummy.local").hostname);
                }
                catch { }
            }
            if (orderPayload.domain) {
                candidatesFromPayload.push(String(orderPayload.domain));
            }
            for (const cand of candidatesFromPayload) {
                found = await findConnection(db, cand);
                if (found) {
                    // Lier le myshopifyDomain pour les prochains webhooks
                    if (shopDomain.endsWith(".myshopify.com") && !found.doc.data().myshopifyDomain) {
                        await found.doc.ref.update({
                            myshopifyDomain: shopDomain,
                            domains: admin.firestore.FieldValue.arrayUnion(shopDomain),
                        });
                    }
                    break;
                }
            }
        }
        if (!found) {
            console.warn(`shopifyWebhook: boutique non trouvée ou inactive: ${shopDomain}`);
            // Répondre 200 à Shopify pour éviter qu'il retente en boucle indéfiniment
            res.status(200).json({ received: true, warning: "Boutique non connectée dans l'application." });
            return;
        }
        const connDoc = found.doc;
        const connection = connDoc.data();
        const workspaceId = connection.workspaceId;
        // Preuve de réception : Shopify a bien joint le webhook.
        // Pendant la configuration (statut "pending") ou pour une notification de test,
        // on enregistre la preuve mais on n'importe AUCUNE commande.
        const isShopifyTest = String(req.headers["x-shopify-test"] || "").toLowerCase() === "true";
        if (isShopifyTest || found.status !== "active") {
            await connDoc.ref.update({ webhookVerifiedAt: Date.now() });
            res.status(200).json({
                received: true,
                verified: true,
                imported: false,
                reason: isShopifyTest
                    ? "Notification de test Shopify (non importée)."
                    : "Boutique en attente d'activation (commande non importée).",
            });
            return;
        }
        // Idempotence : vérifier si la commande existe déjà
        const existingSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("shopifyOrderId", "==", shopifyOrderId)
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            console.log(`shopifyWebhook: commande ${shopifyOrderId} déjà existante, skip.`);
            res.status(200).json({ skipped: true, reason: "Commande déjà importée." });
            return;
        }
        // Extraction des coordonnées et de l'adresse
        const shipping = orderPayload.shipping_address || orderPayload.billing_address || {};
        const customer = orderPayload.customer || {};
        const countryCode = (shipping.country_code || customer.default_address?.country_code || "TG").toUpperCase();
        const city = shipping.city || "";
        const province = shipping.province || "";
        const zip = shipping.zip || "";
        const locationHint = [city, province, countryCode].filter(Boolean).join(", ");
        const clientName = [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") ||
            [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
            "Client Shopify";
        const rawPhone = shipping.phone || customer.phone || orderPayload.phone || "";
        const { normalized: phoneNormalized } = normalizePhoneE164(rawPhone, countryCode);
        // Extraction des note_attributes (champs personnalisés EasySell : heure souhaitée, commentaires, etc.)
        const noteAttributes = Array.isArray(orderPayload.note_attributes)
            ? orderPayload.note_attributes.map((attr) => ({
                name: String(attr.name || "").trim(),
                value: String(attr.value || "").trim(),
            }))
            : [];
        // Montant et devise
        const amount = parseFloat(orderPayload.total_price || "0") || 0;
        const currency = (orderPayload.currency || "XOF").toUpperCase();
        // Produits
        const product = Array.isArray(orderPayload.line_items) && orderPayload.line_items.length > 0
            ? orderPayload.line_items.map((item) => `${item.quantity || 1}x ${item.title || "Produit"}`).join(", ")
            : "Produit COD Shopify";
        const quantity = Array.isArray(orderPayload.line_items)
            ? orderPayload.line_items.reduce((sum, item) => sum + (item.quantity || 1), 0)
            : 1;
        // =====================================================================
        // ROUTING DU FLUX : Quelle équipe doit recevoir cette commande ?
        // =====================================================================
        const countryRoutes = connection.countryRoutes || {};
        const targetRoute = countryRoutes[countryCode];
        let assignedTeamId = connection.ownerTeamId;
        let isUnrouted = false;
        if (targetRoute && targetRoute.status === "active" && targetRoute.assignedTeamId) {
            // Le pays est explicitement assigné (à l'équipe propriétaire ou à une équipe emprunteuse)
            assignedTeamId = targetRoute.assignedTeamId;
        }
        else {
            // Pays non configuré dans les routes : la commande est enregistrée dans l'équipe propriétaire
            // mais marquée comme non routée pour alerter l'admin du flux !
            isUnrouted = true;
            console.warn(`shopifyWebhook: Pays ${countryCode} non assigné pour la boutique ${shopDomain}. Placé sous ${connection.ownerTeamId} avec alerte non routée.`);
            // Journaliser dans shopifyUnroutedOrders
            const unroutedRef = db
                .collection("workspaces")
                .doc(workspaceId)
                .collection("shopifyUnroutedOrders")
                .doc(shopifyOrderId);
            await unroutedRef.set({
                id: shopifyOrderId,
                workspaceId,
                connectionId: connDoc.id,
                shopDomain,
                shopifyOrderId,
                orderNumber,
                clientName,
                clientPhone: phoneNormalized || rawPhone,
                amount,
                currency,
                countryCode,
                createdAt: Date.now(),
            });
        }
        // =====================================================================
        // RÉCONCILIATION DE SESSION (Liaison avec fbp, fbc, UTM capturés par le tracker)
        // =====================================================================
        let sessionData = {};
        let matchedSessionId = null;
        if (phoneNormalized) {
            // Rechercher une session récente (dans les 45 dernières minutes) avec ce même numéro
            const thirtyMinAgo = Date.now() - 45 * 60 * 1000;
            const sessionsSnap = await db
                .collection("workspaces")
                .doc(workspaceId)
                .collection("trackingSessions")
                .where("shopDomain", "==", shopDomain)
                .where("phoneNormalized", "==", phoneNormalized)
                .where("createdAt", ">=", thirtyMinAgo)
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
            if (!sessionsSnap.empty) {
                const sDoc = sessionsSnap.docs[0];
                matchedSessionId = sDoc.id;
                const s = sDoc.data();
                sessionData = {
                    fbp: s.fbp || "",
                    fbc: s.fbc || "",
                    fbclid: s.fbclid || "",
                    utm: {
                        source: s.utmSource || "",
                        medium: s.utmMedium || "",
                        campaign: s.utmCampaign || "",
                        content: s.utmContent || "",
                        term: s.utmTerm || "",
                    },
                };
                // Marquer la session comme liée
                await sDoc.ref.update({ linkedOrderId: shopifyOrderId });
            }
        }
        // Création de la commande dans Firestore
        const newOrderRef = db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .doc(shopifyOrderId);
        const orderDoc = {
            id: shopifyOrderId,
            workspaceId,
            teamId: assignedTeamId,
            sheetId: "", // Origine Shopify
            sourceRowId: `shopify_${shopifyOrderId}`,
            sourceType: "shopify",
            shopifyOrderId,
            sessionId: matchedSessionId,
            clientName,
            clientPhoneRaw: rawPhone,
            clientPhoneFormatted: phoneNormalized || rawPhone,
            city,
            addressNote: shipping.address1 || orderPayload.note || "",
            product,
            quantity,
            amount,
            orderNumber,
            closeuseId: null,
            livreurId: null,
            statutCloseuse: "nouveau",
            statutLivreur: null,
            statutAdminOverride: null,
            callInProgress: null,
            reminderAt: null,
            // Température initiale : "hot" car commande toute fraîche
            temperature: "hot",
            // Données Shopify & EasySell enrichies
            shopifyData: {
                shopifyOrderId,
                orderNumber,
                shopDomain,
                countryCode,
                city,
                province,
                zip,
                locationHint,
                browserIp: orderPayload.browser_ip || "",
                noteAttributes,
                rawCustomerNotes: orderPayload.note || "",
                ...sessionData,
            },
            timestamps: {
                received: Date.now(),
                assignedToCloseuse: null,
                assignedToLivreur: null,
                closeuseDecidedAt: null,
                livreurRespondedAt: null,
                delivered: null,
            },
            capiSent: false,
            purgeAt: null, // Données permanentes
            isUnrouted,
        };
        await newOrderRef.set(orderDoc);
        // Preuve de fonctionnement continue : sert au badge « En direct » de l'interface
        await connDoc.ref.update({
            webhookVerifiedAt: connection.webhookVerifiedAt || Date.now(),
            lastOrderAt: Date.now(),
            ordersCount: admin.firestore.FieldValue.increment(1),
        });
        res.status(200).json({
            success: true,
            orderId: shopifyOrderId,
            assignedTeamId,
            reconciled: !!matchedSessionId,
            isUnrouted,
        });
    }
    catch (err) {
        console.error("shopifyWebhook error:", err);
        res.status(500).send("Internal Server Error");
    }
});
// ===========================================================================
// 3. getStorefrontTrackerScript : Fournit le script à insérer sur Shopify
// ===========================================================================
exports.getStorefrontTrackerScript = (0, https_1.onRequest)({ cors: true }, (req, res) => {
    res.set("Content-Type", "application/javascript");
    res.set("Cache-Control", "public, max-age=300");
    const trackEndpoint = `https://${req.hostname}/trackSession`;
    const scriptCode = `
/**
 * Ecom COD Real Tracking - Storefront & EasySell Interceptor
 * Capture fbp, fbc, UTM et téléphone avant validation pour CAPI enrichi
 */
(function() {
  var ENDPOINT = "${trackEndpoint}";
  var myshopify = String((window.Shopify && window.Shopify.shop) || '').toLowerCase();
  var hostname = String(window.location.hostname || '').toLowerCase();
  var SHOP_DOMAIN = myshopify || hostname;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : '';
  }

  function getParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      fbclid: params.get('fbclid') || '',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || '',
      ecomcod_verify: params.get('ecomcod_verify') || ''
    };
  }

  function sendTracking(phone) {
    try {
      var p = getParams();
      var data = {
        shopDomain: SHOP_DOMAIN,
        myshopifyDomain: myshopify,
        customDomain: hostname,
        phone: phone || '',
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc') || (p.fbclid ? 'fb.1.' + Date.now() + '.' + p.fbclid : ''),
        fbclid: p.fbclid,
        utm_source: p.utm_source,
        utm_medium: p.utm_medium,
        utm_campaign: p.utm_campaign,
        utm_content: p.utm_content,
        utm_term: p.utm_term,
        verifyToken: p.ecomcod_verify,
        pageUrl: window.location.href
      };

      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, JSON.stringify(data));
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true
        }).catch(function() {});
      }
    } catch (e) {}
  }

  // Envoi initial dès l'arrivée sur la page produit (sans téléphone pour lier la session)
  sendTracking('');

  // Interception continue : écouter les saisies sur les champs téléphones
  document.addEventListener('input', function(e) {
    var target = e.target;
    if (!target) return;
    var name = (target.name || target.id || '').toLowerCase();
    var type = (target.type || '').toLowerCase();
    if (type === 'tel' || name.indexOf('phone') !== -1 || name.indexOf('tel') !== -1) {
      var val = (target.value || '').trim();
      if (val.length >= 8) {
        // Débrouiller après 1 seconde sans frappe
        clearTimeout(window.__ecomCodTimer);
        window.__ecomCodTimer = setTimeout(function() {
          sendTracking(val);
        }, 800);
      }
    }
  }, true);

  // Écouter la soumission du formulaire EasySell
  document.addEventListener('submit', function(e) {
    try {
      var form = e.target;
      if (!form) return;
      var inputs = form.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var name = (inp.name || inp.id || '').toLowerCase();
        if (inp.type === 'tel' || name.indexOf('phone') !== -1 || name.indexOf('tel') !== -1) {
          if (inp.value && inp.value.trim().length >= 8) {
            sendTracking(inp.value.trim());
            break;
          }
        }
      }
    } catch(err) {}
  }, true);
})();
`;
    res.status(200).send(scriptCode);
});
