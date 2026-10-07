import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { parsePhoneNumberFromString } from "libphonenumber-js";

function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

function sha256(str: string): string {
  if (!str) return "";
  return crypto
    .createHash("sha256")
    .update(str.trim().toLowerCase())
    .digest("hex");
}

function cleanPhone(raw: string): string {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "").trim();
}

function normalizePhoneE164(raw: string, defaultCountry = "TG"): { normalized: string; hash: string } {
  const cleaned = cleanPhone(raw);
  if (!cleaned) return { normalized: "", hash: "" };

  try {
    const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as never);
    if (parsed && parsed.isValid()) {
      const e164 = parsed.format("E.164");
      return { normalized: e164, hash: sha256(e164.replace(/[^\d]/g, "")) };
    }
  } catch {
    // Fallback simple
  }

  // Format de secours : supprimer tout sauf les chiffres
  const digits = cleaned.replace(/[^\d]/g, "");
  return { normalized: digits ? `+${digits}` : "", hash: sha256(digits) };
}

// ===========================================================================
// 1. trackSession : Capture fbp, fbc, UTM, IP, UA et téléphone du visiteur
// ===========================================================================

export const trackSession = onRequest(
  { cors: true },
  async (req, res): Promise<void> => {
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
      const body = req.body || {};
      const shopDomain = (body.shopDomain || "").trim().toLowerCase();
      const phoneRaw = (body.phone || "").trim();

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

      // Rechercher la connexion Shopify pour identifier le workspaceId
      let workspaceId = body.workspaceId || "";
      let teamId = body.teamId || "";

      if (!workspaceId) {
        const connSnap = await db
          .collectionGroup("shopifyConnections")
          .where("shopDomain", "==", shopDomain)
          .where("status", "==", "active")
          .limit(1)
          .get();

        if (!connSnap.empty) {
          const connData = connSnap.docs[0].data();
          workspaceId = connData.workspaceId;
          teamId = connData.ownerTeamId;
        }
      }

      if (!workspaceId) {
        // Fallback : rechercher dans le premier workspace disponible
        const wsSnap = await db.collection("workspaces").limit(1).get();
        if (!wsSnap.empty) {
          workspaceId = wsSnap.docs[0].id;
        }
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

      if (workspaceId) {
        await db
          .collection("workspaces")
          .doc(workspaceId)
          .collection("trackingSessions")
          .doc(sessionId)
          .set(sessionDoc);
      }

      res.status(200).json({
        success: true,
        sessionId,
        matched: !!workspaceId,
      });
    } catch (err) {
      console.error("trackSession error:", err);
      res.status(500).json({ error: "Erreur interne lors de la capture de session." });
    }
  }
);

// ===========================================================================
// 2. shopifyWebhook : Réception des commandes Shopify & Routage par Pays/Flux
// ===========================================================================

export const shopifyWebhook = onRequest(
  async (req, res): Promise<void> => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const shopDomain = (
        (req.headers["x-shopify-shop-domain"] as string) ||
        req.body?.shop_url ||
        ""
      ).trim().toLowerCase();

      const orderPayload = req.body;
      if (!orderPayload || !orderPayload.id) {
        res.status(400).send("Bad Request: payload manquant ou invalide.");
        return;
      }

      const shopifyOrderId = String(orderPayload.id);
      const orderNumber = orderPayload.order_number ? `#${orderPayload.order_number}` : (orderPayload.name || "");
      const db = getDb();

      // Rechercher la connexion Shopify correspondante (Multi-boutique / Flux)
      const connSnap = await db
        .collectionGroup("shopifyConnections")
        .where("shopDomain", "==", shopDomain)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (connSnap.empty) {
        console.warn(`shopifyWebhook: boutique non trouvée ou inactive: ${shopDomain}`);
        // Répondre 200 à Shopify pour éviter qu'il retente en boucle indéfiniment
        res.status(200).json({ received: true, warning: "Boutique non connectée dans l'application." });
        return;
      }

      const connDoc = connSnap.docs[0];
      const connection = connDoc.data();
      const workspaceId = connection.workspaceId;

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

      const clientName =
        [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") ||
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        "Client Shopify";

      const rawPhone = shipping.phone || customer.phone || orderPayload.phone || "";
      const { normalized: phoneNormalized } = normalizePhoneE164(rawPhone, countryCode);

      // Extraction des note_attributes (champs personnalisés EasySell : heure souhaitée, commentaires, etc.)
      const noteAttributes = Array.isArray(orderPayload.note_attributes)
        ? orderPayload.note_attributes.map((attr: { name?: string; value?: string }) => ({
            name: String(attr.name || "").trim(),
            value: String(attr.value || "").trim(),
          }))
        : [];

      // Montant et devise
      const amount = parseFloat(orderPayload.total_price || "0") || 0;
      const currency = (orderPayload.currency || "XOF").toUpperCase();

      // Produits
      const product = Array.isArray(orderPayload.line_items) && orderPayload.line_items.length > 0
        ? orderPayload.line_items.map((item: { title?: string; quantity?: number }) => `${item.quantity || 1}x ${item.title || "Produit"}`).join(", ")
        : "Produit COD Shopify";

      const quantity = Array.isArray(orderPayload.line_items)
        ? orderPayload.line_items.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 1), 0)
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
      } else {
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
      let sessionData: Record<string, unknown> = {};
      let matchedSessionId: string | null = null;

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

      res.status(200).json({
        success: true,
        orderId: shopifyOrderId,
        assignedTeamId,
        reconciled: !!matchedSessionId,
        isUnrouted,
      });
    } catch (err) {
      console.error("shopifyWebhook error:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);

// ===========================================================================
// 3. getStorefrontTrackerScript : Fournit le script à insérer sur Shopify
// ===========================================================================

export const getStorefrontTrackerScript = onRequest(
  { cors: true },
  (req, res): void => {
    res.set("Content-Type", "application/javascript");
    res.set("Cache-Control", "public, max-age=3600");

    const trackEndpoint = `https://${req.hostname}/trackSession`;

    const scriptCode = `
/**
 * Ecom COD Real Tracking - Storefront & EasySell Interceptor
 * Capture fbp, fbc, UTM et téléphone avant validation pour CAPI enrichi
 */
(function() {
  var ENDPOINT = "${trackEndpoint}";
  var SHOP_DOMAIN = window.location.hostname;

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
      utm_term: params.get('utm_term') || ''
    };
  }

  function sendTracking(phone) {
    try {
      var p = getParams();
      var data = {
        shopDomain: SHOP_DOMAIN,
        phone: phone || '',
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc') || (p.fbclid ? 'fb.1.' + Date.now() + '.' + p.fbclid : ''),
        fbclid: p.fbclid,
        utm_source: p.utm_source,
        utm_medium: p.utm_medium,
        utm_campaign: p.utm_campaign,
        utm_content: p.utm_content,
        utm_term: p.utm_term,
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
  }
);
