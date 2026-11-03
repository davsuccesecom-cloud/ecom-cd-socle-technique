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

type ConnectionStatus = "active" | "pending" | "disconnected" | "inactive";

function cleanDomain(d: string): string {
  if (!d) return "";
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
async function findConnection(
  db: admin.firestore.Firestore,
  rawDomain: string
): Promise<{ doc: admin.firestore.QueryDocumentSnapshot; status: ConnectionStatus } | null> {
  const clean = cleanDomain(rawDomain);
  if (!clean) return null;

  const withoutWww = clean.replace(/^www\./, "");
  const withWww = `www.${withoutWww}`;
  const candidates = Array.from(new Set([clean, withoutWww, withWww])).filter(Boolean);

  try {
    // 1. Recherche par shopDomain principal
    for (const cand of candidates) {
      try {
        const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", cand).limit(5).get();
        if (!snap.empty) {
          const active = snap.docs.find((d) => d.data().status === "active");
          const chosen = active || snap.docs[0];
          return { doc: chosen, status: (chosen.data().status as ConnectionStatus) || "active" };
        }
      } catch {}
    }

    // 2. Recherche par myshopifyDomain
    for (const cand of candidates) {
      try {
        const snap = await db.collectionGroup("shopifyConnections").where("myshopifyDomain", "==", cand).limit(5).get();
        if (!snap.empty) {
          const active = snap.docs.find((d) => d.data().status === "active");
          const chosen = active || snap.docs[0];
          return { doc: chosen, status: (chosen.data().status as ConnectionStatus) || "active" };
        }
      } catch {}
    }

    // 3. Recherche par customDomain
    for (const cand of candidates) {
      try {
        const snap = await db.collectionGroup("shopifyConnections").where("customDomain", "==", cand).limit(5).get();
        if (!snap.empty) {
          const active = snap.docs.find((d) => d.data().status === "active");
          const chosen = active || snap.docs[0];
          return { doc: chosen, status: (chosen.data().status as ConnectionStatus) || "active" };
        }
      } catch {}
    }

    // 4. Recherche par alias dans le tableau domains
    for (const cand of candidates) {
      try {
        const snap = await db.collectionGroup("shopifyConnections").where("domains", "array-contains", cand).limit(5).get();
        if (!snap.empty) {
          const active = snap.docs.find((d) => d.data().status === "active");
          const chosen = active || snap.docs[0];
          return { doc: chosen, status: (chosen.data().status as ConnectionStatus) || "active" };
        }
      } catch {}
    }

    // 5. Recherche par shopName si cand se termine par .myshopify.com
    for (const cand of candidates) {
      if (cand.endsWith(".myshopify.com")) {
        const prefix = cand.replace(".myshopify.com", "");
        try {
          const snap = await db.collectionGroup("shopifyConnections").where("shopName", "==", prefix).limit(5).get();
          if (!snap.empty) {
            const active = snap.docs.find((d) => d.data().status === "active");
            const chosen = active || snap.docs[0];
            return { doc: chosen, status: (chosen.data().status as ConnectionStatus) || "active" };
          }
        } catch {}
      }
    }
  } catch (cgErr) {
    console.warn("collectionGroup lookup error, falling back to direct workspace scan:", cgErr);
  }

  // Fallback direct sur workspaces/{ws}/shopifyConnections
  try {
    const wsSnap = await db.collection("workspaces").get();
    for (const wsDoc of wsSnap.docs) {
      const connsSnap = await wsDoc.ref.collection("shopifyConnections").get();
      for (const cDoc of connsSnap.docs) {
        const data = cDoc.data();
        const domains = [
          data.shopDomain,
          data.myshopifyDomain,
          data.customDomain,
          data.shopName ? `${data.shopName}.myshopify.com` : "",
          ...(Array.isArray(data.domains) ? data.domains : []),
        ].map(cleanDomain).filter(Boolean);
        if (candidates.some((c) => domains.includes(c))) {
          return { doc: cDoc, status: (data.status as ConnectionStatus) || "active" };
        }
      }
    }
  } catch (fallbackErr) {
    console.error("Direct workspace scan failed:", fallbackErr);
  }

  return null;
}

function parseJsonBody(req: any): any {
  if (!req) return {};
  const body = req.body;

  // 1. Objet JS deja parse et non vide
  if (body && typeof body === 'object' && !Buffer.isBuffer(body) && Object.keys(body).length > 0) {
    return body;
  }

  // 2. Chaine de caracteres
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }

  // 3. Buffer dans req.body
  if (body && Buffer.isBuffer(body)) {
    try {
      const text = body.toString('utf8').trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
  }

  // 4. req.rawBody (fourni par Cloud Functions / Cloud Run)
  const raw = req.rawBody;
  if (raw && Buffer.isBuffer(raw)) {
    try {
      const text = raw.toString('utf8').trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }

  return (body && typeof body === 'object' && !Buffer.isBuffer(body)) ? body : {};
}

// ===========================================================================
// 1. trackSession : Capture fbp, fbc, UTM, IP, UA et telephone du visiteur
// ===========================================================================

export const trackSession = onRequest(
  { cors: true },
  async (req, res): Promise<void> => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      res.status(405).json({ error: 'Methode non autorisee. Utilisez POST ou GET.' });
      return;
    }

    try {
      const body = req.method === 'GET' ? (req.query || {}) : parseJsonBody(req);
      const verifyToken = String(body.verifyToken || body.ecomcod_verify || (req.query && req.query.ecomcod_verify) || '').trim();
      const shopDomain = String(body.shopDomain || body.myshopifyDomain || body.customDomain || (req.query && req.query.shopDomain) || '').trim().toLowerCase();
      const phoneRaw = String(body.phone || '').trim();

      if (!shopDomain && !verifyToken) {
        res.status(400).json({ error: 'shopDomain ou verifyToken requis.' });
        return;
      }

      // Recuperer l'IP et le User Agent depuis les en-tetes
      const forwarded = req.headers['x-forwarded-for'];
      const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || '';
      const userAgent = (req.headers['user-agent'] || '').slice(0, 300);

      // Normalisation du telephone
      const { normalized: phoneNormalized, hash: phoneHash } = normalizePhoneE164(phoneRaw);

      const db = getDb();

      // Le workspace vient UNIQUEMENT de la connexion enregistree (jamais du navigateur)
      let found: { doc: admin.firestore.QueryDocumentSnapshot; status: ConnectionStatus } | null = null;

      // 1. Recherche directe et immediate par verifyToken en priorite absolue si present
      if (verifyToken) {
        try {
          const tokenSnap = await db
            .collectionGroup('shopifyConnections')
            .where('verifyToken', '==', verifyToken)
            .limit(1)
            .get();
          if (!tokenSnap.empty) {
            const doc = tokenSnap.docs[0];
            found = { doc, status: (doc.data().status as ConnectionStatus) || 'pending' };
          }
        } catch (tokenErr) {
          console.warn("verifyToken lookup by collectionGroup skipped, using domain lookup:", tokenErr);
        }
      }

      // 2. Recherche par les differents domaines
      if (!found && shopDomain) {
        found = await findConnection(db, shopDomain);
      }
      if (!found && body.customDomain) {
        found = await findConnection(db, String(body.customDomain));
      }
      if (!found && body.myshopifyDomain) {
        found = await findConnection(db, String(body.myshopifyDomain));
      }

      if (!found) {
        res.status(200).json({ success: true, matched: false });
        return;
      }

      const connData = found.doc.data();
      const workspaceId = String(connData.workspaceId || '');
      const teamId = String(connData.ownerTeamId || '');

      // Preuve d'installation du script & apprentissage automatique des domaines
      if (verifyToken && connData.verifyToken && verifyToken === connData.verifyToken) {
        const updateData: Record<string, unknown> = {
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
        ttclid: body.ttclid || "",
        ttp: body.ttp || "",
        gclid: body.gclid || "",
        referrer: (body.referrer || "").slice(0, 500),
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
      const orderPayload = parseJsonBody(req);
      const shopDomain = (
        (req.headers["x-shopify-shop-domain"] as string) ||
        orderPayload?.shop_url ||
        orderPayload?.domain ||
        ""
      ).trim().toLowerCase();

      if (!orderPayload || !orderPayload.id) {
        res.status(400).send("Bad Request: payload manquant ou invalide.");
        return;
      }

      const shopifyOrderId = String(orderPayload.id);
      const orderNumber = orderPayload.order_number ? `#${orderPayload.order_number}` : (orderPayload.name || `#${shopifyOrderId}`);
      const db = getDb();

      // Rechercher la connexion Shopify correspondante (Multi-boutique / Flux)
      let found = await findConnection(db, shopDomain);

      // Si non trouvé via l'en-tête, chercher dans les métadonnées de commande
      if (!found && orderPayload) {
        const candidatesFromPayload: string[] = [];
        if (orderPayload.order_status_url) {
          try {
            candidatesFromPayload.push(new URL(orderPayload.order_status_url).hostname);
          } catch {}
        }
        if (orderPayload.landing_site) {
          try {
            candidatesFromPayload.push(new URL(orderPayload.landing_site, "https://dummy.local").hostname);
          } catch {}
        }
        if (orderPayload.domain) {
          candidatesFromPayload.push(String(orderPayload.domain));
        }

        for (const cand of candidatesFromPayload) {
          found = await findConnection(db, cand);
          if (found) {
            if (shopDomain.endsWith(".myshopify.com") && !found.doc.data().myshopifyDomain) {
              try {
                await found.doc.ref.update({
                  myshopifyDomain: shopDomain,
                  domains: admin.firestore.FieldValue.arrayUnion(shopDomain),
                });
              } catch {}
            }
            break;
          }
        }
      }

      if (!found) {
        console.warn(`shopifyWebhook: boutique non trouvée pour le domaine: ${shopDomain}`);
        // Répondre 200 à Shopify pour éviter qu'il retente en boucle indéfiniment
        res.status(200).json({ received: true, warning: "Boutique non connectée dans l'application." });
        return;
      }

      const connDoc = found.doc;
      const connection = connDoc.data();
      const workspaceId = connection.workspaceId;

      // Détection notification de test Shopify (bouton "Envoyer une notification de test" dans l'admin Shopify)
      const isShopifyTest =
        String(req.headers["x-shopify-test"] || "").toLowerCase() === "true" ||
        String(orderPayload.name || "").includes("#TEST_VERIF");

      if (isShopifyTest) {
        try {
          await connDoc.ref.update({ webhookVerifiedAt: Date.now() });
        } catch {}
        res.status(200).json({
          received: true,
          verified: true,
          imported: false,
          reason: "Notification de test Shopify (non importée).",
        });
        return;
      }

      // Si la boutique est déconnectée par l'administrateur, on suspend l'importation sans erreur (200 OK)
      if (found.status === "disconnected") {
        res.status(200).json({ skipped: true, reason: "Boutique temporairement déconnectée par l'administrateur." });
        return;
      }

      // Si la boutique était encore marquée "pending", la réception d'une commande valide
      // prouve que la connexion est 100% active. On l'active automatiquement !
      if (found.status === "pending") {
        try {
          await connDoc.ref.update({
            status: "active",
            activatedAt: Date.now(),
            webhookVerifiedAt: Date.now(),
          });
        } catch (actErr) {
          console.warn("Auto-activation boutique warning (non-bloquant):", actErr);
        }
      }

      // Idempotence : vérifier directement si la commande existe déjà (accès direct par ID)
      const existingOrderSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("orders")
        .doc(shopifyOrderId)
        .get();

      if (existingOrderSnap.exists) {
        console.log(`shopifyWebhook: commande ${shopifyOrderId} déjà existante, skip.`);
        res.status(200).json({ skipped: true, reason: "Commande déjà importée." });
        return;
      }

      // Extraction des coordonnées et de l'adresse
      const shipping = orderPayload.shipping_address || orderPayload.billing_address || {};
      const customer = orderPayload.customer || {};
      const countryCode = String(shipping.country_code || customer.default_address?.country_code || "TG").toUpperCase();
      const city = String(shipping.city || "");
      const province = String(shipping.province || "");
      const zip = String(shipping.zip || "");
      const locationHint = [city, province, countryCode].filter(Boolean).join(", ");

      const clientName =
        [shipping.first_name, shipping.last_name].filter(Boolean).join(" ") ||
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        "Client Shopify";

      const rawPhone = String(shipping.phone || customer.phone || orderPayload.phone || "");
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
      const currency = String(orderPayload.currency || "XOF").toUpperCase();

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

      let assignedTeamId = (targetRoute && targetRoute.status === "active" && targetRoute.assignedTeamId)
        ? targetRoute.assignedTeamId
        : (connection.ownerTeamId || "");

      let isUnrouted = false;
      if (!targetRoute || targetRoute.status !== "active" || !targetRoute.assignedTeamId) {
        isUnrouted = true;
        console.warn(`shopifyWebhook: Pays ${countryCode} non assigné pour la boutique ${shopDomain}. Placé sous ${connection.ownerTeamId || 'équipe par défaut'}.`);

        // Journaliser dans shopifyUnroutedOrders
        try {
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
        } catch (unroutedErr) {
          console.warn("Could not log shopifyUnroutedOrder (non-bloquant):", unroutedErr);
        }
      }

      // Si assignedTeamId est toujours vide, fallback sur la première équipe du workspace
      if (!assignedTeamId) {
        try {
          const teamsSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").limit(1).get();
          if (!teamsSnap.empty) {
            assignedTeamId = teamsSnap.docs[0].id;
          }
        } catch (tErr) {
          console.warn("Could not fallback teamId:", tErr);
        }
      }

      // =====================================================================
      // RÉCONCILIATION DE SESSION (Liaison avec fbp, fbc, UTM capturés par le tracker)
      // Protection absolue : aucune erreur de session ne doit bloquer la création de commande !
      // =====================================================================
      let sessionData: Record<string, unknown> = {};
      let matchedSessionId: string | null = null;

      if (phoneNormalized) {
        try {
          const fortyFiveMinAgo = Date.now() - 45 * 60 * 1000;
          // Requête simple sur phoneNormalized (ne nécessite AUCUN index composite)
          const sessionsSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("trackingSessions")
            .where("phoneNormalized", "==", phoneNormalized)
            .limit(10)
            .get();

          if (!sessionsSnap.empty) {
            // Filtrer et trier en mémoire pour s'affranchir de tout index composite Firestore
            const valid = sessionsSnap.docs
              .map((d) => ({ doc: d, data: d.data() }))
              .filter(({ data }) => {
                const created = Number(data.createdAt) || 0;
                return created >= fortyFiveMinAgo;
              })
              .sort((a, b) => (Number(b.data.createdAt) || 0) - (Number(a.data.createdAt) || 0));

            if (valid.length > 0) {
              const matched = valid[0];
              matchedSessionId = matched.doc.id;
              const s = matched.data;
              sessionData = {
                fbp: s.fbp || "",
                fbc: s.fbc || "",
                fbclid: s.fbclid || "",
                ttclid: s.ttclid || "",
                ttp: s.ttp || "",
                gclid: s.gclid || "",
                referrer: s.referrer || "",
                utm: {
                  source: s.utmSource || "",
                  medium: s.utmMedium || "",
                  campaign: s.utmCampaign || "",
                  content: s.utmContent || "",
                  term: s.utmTerm || "",
                },
              };
              try {
                await matched.doc.ref.update({ linkedOrderId: shopifyOrderId });
              } catch {}
            }
          }
        } catch (sessionErr) {
          console.warn("shopifyWebhook: réconciliation session ignorée (non bloquant):", sessionErr);
        }
      }

      // =====================================================================
      // DÉTECTION NUMÉRO DOUBLON & ISOLATION META CAPI (Accès libre site)
      // Si ce numéro a déjà passé commande, on l'isole du tracking Meta CAPI
      // et on le qualifie en "acces_libre_site" pour que la closeuse vérifie
      // s'il s'agit d'un doublon involontaire (1 produit) ou d'un 2e produit.
      // =====================================================================
      const formattedPhoneForCheck = phoneNormalized || rawPhone || "";
      let isDuplicatePhone = false;
      let previousOrdersCount = 0;
      let previousRejectionsCount = 0;

      if (formattedPhoneForCheck && formattedPhoneForCheck !== "Non renseigné") {
        try {
          const prevSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("clientPhoneFormatted", "==", formattedPhoneForCheck)
            .limit(25)
            .get();

          if (!prevSnap.empty) {
            isDuplicatePhone = true;
            previousOrdersCount = prevSnap.size;
            previousRejectionsCount = prevSnap.docs.filter((d) => {
              const st = d.data().statutCloseuse;
              return st === "rejete" || st === "injoignable";
            }).length;
          }
        } catch (dupErr) {
          console.warn("shopifyWebhook: vérification doublon numéro ignorée (non bloquant):", dupErr);
        }
      }

      // =====================================================================
      // ANALYSE MULTI-CANAUX & VÉRIFICATION D'ATTRIBUTION HORS CAMPAGNE
      // Vérification fbp/fbc (Meta), ttclid/_ttp (TikTok), gclid (Google) et Trafic Organique
      // =====================================================================
      const landingSite = String(orderPayload.landing_site || orderPayload.landing_site_ref || "").toLowerCase();
      const referringSite = String(orderPayload.referring_site || "").toLowerCase();

      // Extraction des notes Shopify (EasySell / formulaires COD injectent souvent les trackers ici)
      const noteMap: Record<string, string> = {};
      if (Array.isArray(noteAttributes)) {
        for (const attr of noteAttributes) {
          if (attr && typeof attr.name === "string" && typeof attr.value === "string") {
            noteMap[attr.name.toLowerCase().trim()] = attr.value.trim();
          }
        }
      }

      const effectiveFbp = String(sessionData.fbp || noteMap["_fbp"] || noteMap["fbp"] || "");
      const effectiveFbc = String(sessionData.fbc || noteMap["_fbc"] || noteMap["fbc"] || "");
      const effectiveFbclid = String(sessionData.fbclid || noteMap["fbclid"] || (landingSite.match(/[?&]fbclid=([^&#]+)/i)?.[1] ?? ""));
      const effectiveTtclid = String(sessionData.ttclid || noteMap["ttclid"] || noteMap["_ttclid"] || (landingSite.match(/[?&]ttclid=([^&#]+)/i)?.[1] ?? ""));
      const effectiveTtp = String(sessionData.ttp || noteMap["_ttp"] || noteMap["ttp"] || "");
      const effectiveGclid = String(sessionData.gclid || noteMap["gclid"] || (landingSite.match(/[?&]gclid=([^&#]+)/i)?.[1] ?? ""));
      const rawUtm = (sessionData.utm as Record<string, string>) || {};
      const utmSource = String(rawUtm.source || noteMap["utm_source"] || (landingSite.match(/[?&]utm_source=([^&#]+)/i)?.[1] ?? "")).toLowerCase();
      const utmMedium = String(rawUtm.medium || noteMap["utm_medium"] || (landingSite.match(/[?&]utm_medium=([^&#]+)/i)?.[1] ?? "")).toLowerCase();
      const utmCampaign = String(rawUtm.campaign || noteMap["utm_campaign"] || (landingSite.match(/[?&]utm_campaign=([^&#]+)/i)?.[1] ?? ""));

      let trafficSource: "meta_ads" | "tiktok_ads" | "google_ads" | "organique" | "acces_libre_site" = "organique";
      let capiIsolated = false;
      let attributionDetail = "";

      if (isDuplicatePhone) {
        trafficSource = "acces_libre_site";
        capiIsolated = true; // Isolé pour protéger le budget Meta CAPI
        attributionDetail = "Numéro doublon / Ancien client (Accès libre site)";
      } else if (
        effectiveTtclid ||
        effectiveTtp ||
        utmSource.includes("tiktok") ||
        referringSite.includes("tiktok")
      ) {
        trafficSource = "tiktok_ads";
        capiIsolated = true; // Isolé de Meta CAPI car campagne TikTok Ads
        attributionDetail = "Campagne TikTok Ads";
      } else if (
        effectiveGclid ||
        (utmSource.includes("google") && (utmMedium.includes("cpc") || utmMedium.includes("ads")))
      ) {
        trafficSource = "google_ads";
        capiIsolated = true; // Isolé de Meta CAPI car campagne Google Ads
        attributionDetail = "Campagne Google Ads";
      } else if (
        effectiveFbclid ||
        (effectiveFbc && effectiveFbc.startsWith("fb.1.")) ||
        ["facebook", "fb", "instagram", "ig", "meta"].some((s) => utmSource.includes(s))
      ) {
        // Campagne Meta Ads vérifiée par fbc ou fbclid
        trafficSource = "meta_ads";
        capiIsolated = false; // Validé pour Meta CAPI
        attributionDetail = "Campagne Meta Ads (fbc/fbclid vérifié)";
      } else {
        // Commande hors campagne : trafic naturel, recherche organique, direct
        trafficSource = "organique";
        capiIsolated = true; // Isolé de Meta CAPI pour ne pas fausser le pixel sur du trafic non payant
        attributionDetail = "Organique / Hors campagne (Trafic naturel direct sans clic publicitaire)";
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
        teamId: assignedTeamId || "",
        sheetId: "", // Origine Shopify
        sourceRowId: `shopify_${shopifyOrderId}`,
        sourceType: "shopify",
        shopifyOrderId,
        sessionId: matchedSessionId || null,

        clientName: clientName || "Client Shopify",
        clientPhoneRaw: rawPhone || "",
        clientPhoneFormatted: phoneNormalized || rawPhone || "Non renseigné",
        city: city || "",
        addressNote: shipping.address1 || orderPayload.note || "",
        product: product || "Produit COD Shopify",
        quantity: Number(quantity) || 1,
        amount: Number(amount) || 0,
        orderNumber: orderNumber || `#${shopifyOrderId}`,

        closeuseId: null,
        livreurId: null,
        statutCloseuse: "nouveau",
        statutLivreur: null,
        statutAdminOverride: null,
        callInProgress: null,
        reminderAt: null,

        // Température initiale : "hot" car commande toute fraîche
        temperature: "hot",

        // Qualification doublon & isolation Meta CAPI
        isDuplicatePhone,
        previousOrdersCount,
        previousRejectionsCount,
        capiIsolated: isDuplicatePhone,
        trafficSource: isDuplicatePhone ? "acces_libre_site" : "meta_ads",

        // Données Shopify & EasySell enrichies
        shopifyData: {
          shopifyOrderId,
          orderNumber: orderNumber || `#${shopifyOrderId}`,
          shopDomain,
          countryCode: countryCode || "",
          city: city || "",
          province: province || "",
          zip: zip || "",
          locationHint: locationHint || "",
          browserIp: String(orderPayload.browser_ip || ""),
          noteAttributes: Array.isArray(noteAttributes) ? noteAttributes : [],
          rawCustomerNotes: String(orderPayload.note || ""),
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
        isUnrouted: Boolean(isUnrouted),
      };

      await newOrderRef.set(orderDoc);

      // Preuve de fonctionnement continue : sert au badge « En direct » de l'interface
      try {
        await connDoc.ref.update({
          status: "active",
          webhookVerifiedAt: connection.webhookVerifiedAt || Date.now(),
          lastOrderAt: Date.now(),
          ordersCount: admin.firestore.FieldValue.increment(1),
        });
      } catch (upErr) {
        console.warn("connDoc update warning (non-bloquant):", upErr);
      }

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
    res.set('Content-Type', 'application/javascript');
    res.set('Cache-Control', 'public, max-age=300');

    // Assurer que le endpoint pointe vers us-central1-meta-capi-app.cloudfunctions.net
    const defaultHost = 'us-central1-meta-capi-app.cloudfunctions.net';
    const host = req.hostname && req.hostname.includes('cloudfunctions.net')
      ? req.hostname
      : defaultHost;
    const trackEndpoint = `https://${host}/trackSession`;

    const scriptCode = `
/**
 * Ecom COD Real Tracking - Storefront & EasySell Interceptor
 * Capture fbp, fbc, UTM et telephone avant validation pour CAPI enrichi
 */
(function() {
  var ENDPOINT = "${trackEndpoint}";
  var myshopify = String((window.Shopify && window.Shopify.shop) || '').toLowerCase();
  var hostname = String(window.location.hostname || '').toLowerCase();
  var SHOP_DOMAIN = myshopify || hostname;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : '';
  }

  function getParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      fbclid: params.get('fbclid') || '',
      ttclid: params.get('ttclid') || '',
      gclid: params.get('gclid') || '',
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
        ttclid: p.ttclid,
        ttp: getCookie('_ttp'),
        gclid: p.gclid,
        referrer: document.referrer || '',
        utm_source: p.utm_source,
        utm_medium: p.utm_medium,
        utm_campaign: p.utm_campaign,
        utm_content: p.utm_content,
        utm_term: p.utm_term,
        verifyToken: p.ecomcod_verify,
        pageUrl: window.location.href
      };

      var payload = JSON.stringify(data);
      var sent = false;

      // Priorite au Blob JSON avec sendBeacon pour preserver Content-Type application/json
      if (window.Blob && navigator.sendBeacon) {
        try {
          var blob = new Blob([payload], { type: 'application/json' });
          sent = navigator.sendBeacon(ENDPOINT, blob);
        } catch (e) {
          sent = false;
        }
      }

      // Repli sur fetch keepalive avec Content-Type explicite
      if (!sent) {
        try {
          fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
            mode: 'cors'
          }).catch(function() {});
        } catch (e) {}
      }
    } catch (e) {}
  }

  // 1. Envoi initial immediat
  sendTracking('');

  // 2. Deuxieme envoi 2 secondes plus tard :
  // - Laisse le temps au Pixel Meta de poser le cookie _fbp
  // - Securise la detection de verification sans surcharger
  setTimeout(function() {
    sendTracking('');
  }, 2000);

  // 3. Interception continue : ecouter les saisies sur les champs telephones
  document.addEventListener('input', function(e) {
    var target = e.target;
    if (!target) return;
    var name = (target.name || target.id || '').toLowerCase();
    var type = (target.type || '').toLowerCase();
    if (type === 'tel' || name.indexOf('phone') !== -1 || name.indexOf('tel') !== -1) {
      var val = (target.value || '').trim();
      if (val.length >= 8) {
        clearTimeout(window.__ecomCodTimer);
        window.__ecomCodTimer = setTimeout(function() {
          sendTracking(val);
        }, 800);
      }
    }
  }, true);

  // 4. Ecouter la soumission du formulaire EasySell
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
