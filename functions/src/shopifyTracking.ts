import { extractMapAndLocation, extractNotesAndAddress, calculateOrderPricing, extractQuantityAndItems } from "./azifyGateway";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { parsePhoneNumberFromString } from "libphonenumber-js";

function getDb(): admin.firestore.Firestore {
  const firestore = admin.firestore();
  try {
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch {}
  return firestore;
}

function sha256(str: string): string {
  if (!str) return "";
  return crypto
    .createHash("sha256")
    .update(str.trim().toLowerCase())
    .digest("hex");
}

const AFRICAN_DIAL_CODES: Record<string, string> = {
  // Afrique de l'Ouest (16 pays)
  BJ: "229", // Bénin
  BF: "226", // Burkina Faso
  CV: "238", // Cap-Vert
  CI: "225", // Côte d'Ivoire
  GM: "220", // Gambie
  GH: "233", // Ghana
  GN: "224", // Guinée
  GW: "245", // Guinée-Bissau
  LR: "231", // Liberia
  ML: "223", // Mali
  MR: "222", // Mauritanie
  NE: "227", // Niger
  NG: "234", // Nigeria
  SN: "221", // Sénégal
  SL: "232", // Sierra Leone
  TG: "228", // Togo

  // Afrique Centrale (9 pays)
  CM: "237", // Cameroun
  CF: "236", // République centrafricaine
  TD: "235", // Tchad
  CG: "242", // Congo
  CD: "243", // Congo (RDC)
  GQ: "240", // Guinée équatoriale
  GA: "241", // Gabon
  ST: "239", // Sao Tomé-et-Principe
  BI: "257", // Burundi

  // Afrique du Nord (6 pays)
  DZ: "213", // Algérie
  EG: "20",  // Égypte
  LY: "218", // Libye
  MA: "212", // Maroc
  SD: "249", // Soudan
  TN: "216", // Tunisie

  // Afrique de l'Est (14 pays)
  KM: "269", // Comores
  DJ: "253", // Djibouti
  ER: "291", // Érythrée
  ET: "251", // Éthiopie
  KE: "254", // Kenya
  MG: "261", // Madagascar
  MW: "265", // Malawi
  MU: "230", // Maurice
  UG: "256", // Ouganda
  RW: "250", // Rwanda
  SC: "248", // Seychelles
  SO: "252", // Somalie
  SS: "211", // Soudan du Sud
  TZ: "255", // Tanzanie

  // Afrique Australe (9 pays)
  ZA: "27",  // Afrique du Sud
  AO: "244", // Angola
  BW: "267", // Botswana
  SZ: "268", // Eswatini
  LS: "266", // Lesotho
  MZ: "258", // Mozambique
  NA: "264", // Namibie
  ZM: "260", // Zambie
  ZW: "263", // Zimbabwe
};

const ALL_AFRICAN_PREFIXES = Array.from(new Set(Object.values(AFRICAN_DIAL_CODES))).sort(
  (a, b) => b.length - a.length
);

function cleanAfricanPhone(raw: string, defaultCountry = "TG"): string {
  const s = String(raw || "").trim();
  if (!s || s === "Non renseigné") return "";

  let digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Détection d'un double indicatif involontaire (ex: 228 + 22966860045)
  for (const p1 of ALL_AFRICAN_PREFIXES) {
    if (digits.startsWith(p1)) {
      const sub = digits.slice(p1.length);
      for (const p2 of ALL_AFRICAN_PREFIXES) {
        if (sub.startsWith(p2) && sub.length >= 8 + p2.length) {
          return `+${sub}`;
        }
      }
    }
  }

  // Si le numéro commence déjà par un indicatif africain reconnu
  for (const p of ALL_AFRICAN_PREFIXES) {
    if (digits.startsWith(p) && digits.length >= 8 + p.length) {
      return `+${digits}`;
    }
  }

  const defaultDial = AFRICAN_DIAL_CODES[defaultCountry.toUpperCase()] || "228";
  return `+${defaultDial}${digits}`;
}

function normalizePhoneE164(raw: string, defaultCountry = "TG"): { normalized: string; hash: string } {
  const preCleaned = cleanAfricanPhone(raw, defaultCountry);
  if (!preCleaned) return { normalized: "", hash: "" };

  try {
    const parsed = parsePhoneNumberFromString(preCleaned);
    if (parsed && parsed.isValid()) {
      const e164 = parsed.format("E.164");
      return { normalized: e164, hash: sha256(e164.replace(/[^\d]/g, "")) };
    }
  } catch {
    // Fallback simple
  }

  // Format de secours : supprimer tout sauf les chiffres
  const digits = preCleaned.replace(/[^\d]/g, "");
  return { normalized: digits ? `+${digits}` : "", hash: sha256(digits) };
}


/**
 * Détecteur intelligent de pays COD Afrique (Multi-couches : Téléphone, Nom/Code Pays, Villes/Quartiers)
 * Garantit qu'une commande provenant du Togo, Bénin, Côte d'Ivoire, Sénégal ou autre marché
 * est toujours résolue sur son code ISO 2 lettres sans jamais échouer.
 */
export function detectAfricanCountry(params: {
  phone?: string;
  countryCode?: string;
  country?: string;
  city?: string;
  defaultCountry?: string;
}): string {
  const rawPhone = String(params.phone || "").replace(/[^\d+]/g, "");

  // 1. Détection prioritaire par indicatif téléphonique international
  if (rawPhone.startsWith("+228") || rawPhone.startsWith("00228") || (rawPhone.startsWith("228") && rawPhone.length >= 11)) return "TG";
  if (rawPhone.startsWith("+229") || rawPhone.startsWith("00229") || (rawPhone.startsWith("229") && rawPhone.length >= 11)) return "BJ";
  if (rawPhone.startsWith("+225") || rawPhone.startsWith("00225") || (rawPhone.startsWith("225") && rawPhone.length >= 12)) return "CI";
  if (rawPhone.startsWith("+221") || rawPhone.startsWith("00221") || (rawPhone.startsWith("221") && rawPhone.length >= 11)) return "SN";
  if (rawPhone.startsWith("+226") || rawPhone.startsWith("00226") || (rawPhone.startsWith("226") && rawPhone.length >= 11)) return "BF";
  if (rawPhone.startsWith("+223") || rawPhone.startsWith("00223") || (rawPhone.startsWith("223") && rawPhone.length >= 11)) return "ML";
  if (rawPhone.startsWith("+227") || rawPhone.startsWith("00227") || (rawPhone.startsWith("227") && rawPhone.length >= 11)) return "NE";
  if (rawPhone.startsWith("+224") || rawPhone.startsWith("00224") || (rawPhone.startsWith("224") && rawPhone.length >= 11)) return "GN";
  if (rawPhone.startsWith("+237") || rawPhone.startsWith("00237") || (rawPhone.startsWith("237") && rawPhone.length >= 11)) return "CM";
  if (rawPhone.startsWith("+241") || rawPhone.startsWith("00241") || (rawPhone.startsWith("241") && rawPhone.length >= 10)) return "GA";
  if (rawPhone.startsWith("+243") || rawPhone.startsWith("00243") || (rawPhone.startsWith("243") && rawPhone.length >= 11)) return "CD";
  if (rawPhone.startsWith("+242") || rawPhone.startsWith("00242") || (rawPhone.startsWith("242") && rawPhone.length >= 11)) return "CG";

  // 2. Détection par nom ou code pays dans l'adresse de livraison / commande
  const rawCountry = `${params.countryCode || ""} ${params.country || ""}`.toUpperCase().trim();
  if (rawCountry.includes("BENIN") || rawCountry.includes("BÉNIN") || rawCountry === "BJ" || rawCountry === "BEN") return "BJ";
  if (rawCountry.includes("TOGO") || rawCountry === "TG" || rawCountry === "TGO") return "TG";
  if (rawCountry.includes("COTE") || rawCountry.includes("CÔTE") || rawCountry.includes("IVORY") || rawCountry === "CI" || rawCountry === "CIV") return "CI";
  if (rawCountry.includes("SENEGAL") || rawCountry.includes("SÉNÉGAL") || rawCountry === "SN" || rawCountry === "SEN") return "SN";
  if (rawCountry.includes("BURKINA") || rawCountry === "BF" || rawCountry === "BFA") return "BF";
  if (rawCountry.includes("MALI") || rawCountry === "ML" || rawCountry === "MLI") return "ML";
  if (rawCountry.includes("NIGER") || rawCountry === "NE" || rawCountry === "NER") return "NE";
  if (rawCountry.includes("GUIN") || rawCountry === "GN" || rawCountry === "GIN") return "GN";
  if (rawCountry.includes("CAMEROUN") || rawCountry.includes("CAMEROON") || rawCountry === "CM" || rawCountry === "CMR") return "CM";
  if (rawCountry.includes("GABON") || rawCountry === "GA" || rawCountry === "GAB") return "GA";
  if (rawCountry.includes("RDC") || rawCountry.includes("KINSHASA") || rawCountry === "CD" || rawCountry === "COD") return "CD";
  if (rawCountry.includes("CONGO") || rawCountry === "CG" || rawCountry === "COG") return "CG";

  // 3. Détection par ville ou commune (Toponymes majeurs COD Afrique)
  const city = (params.city || "").toLowerCase().trim();
  if (/lom[eé]|kara|sokod[eé]|atakpam[eé]|kpalim[eé]|ago[eè]|adidogom[eé]|ts[eé]vi[eé]|dapaong|an[eé]ho|b[eè]/i.test(city)) return "TG";
  if (/cotonou|calavi|porto-novo|parakou|ouidah|bohicon|abomey|akpakpa|cadjehoun|fidjross[eè]|godomey|menontin/i.test(city)) return "BJ";
  if (/abidjan|yopougon|cocody|bouak[eé]|san-p[eé]dro|korhogo|daloa|yamoussoukro|marcory|treichville|koumassi|adjam[eé]|plateau|abobo|angr[eé]|riviera/i.test(city)) return "CI";
  if (/dakar|pikine|touba|thi[eè]s|saint-louis|kaolack|mbour|rufisque|ziguinchor|almadies|yoff|ouakam|mermoz/i.test(city)) return "SN";

  // 4. Repli sur le pays par défaut configuré
  if (params.defaultCountry && params.defaultCountry.length === 2) {
    return params.defaultCountry.toUpperCase();
  }

  return "TG";
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
      const azifyVerifyTokenHeader = String(
        req.headers["x-azify-verify-token"] ||
        req.headers["x-azify-token"] ||
        req.headers["x-verify-token"] ||
        ""
      ).trim();
      const azifyShopDomainHeader = String(
        req.headers["x-azify-shop-domain"] ||
        req.headers["x-azify-store-id"] ||
        ""
      ).trim().toLowerCase();
      const payloadVerifyToken = String(orderPayload?.verifyToken || orderPayload?.ecomcod_verify || "").trim();
      const effectiveVerifyToken = azifyVerifyTokenHeader || payloadVerifyToken || String(req.query.verifyToken || req.query.token || "");

      const shopDomain = (
        azifyShopDomainHeader ||
        (req.headers["x-shopify-shop-domain"] as string) ||
        orderPayload?.shop_url ||
        orderPayload?.domain ||
        orderPayload?.shopDomain ||
        orderPayload?.storeDomain ||
        orderPayload?.shop_name ||
        ""
      ).trim().toLowerCase();

      const isAzifyRequest =
        Boolean(azifyShopDomainHeader) ||
        Boolean(azifyVerifyTokenHeader) ||
        orderPayload?.sourcePlatform === "azify" ||
        Boolean(payloadVerifyToken) ||
        shopDomain.includes("azishop") ||
        shopDomain.includes("azify");

      // Déballage universel du payload (Shopify standard, Azify, EasySell ou formulaire direct)
      const root = (orderPayload?.order && typeof orderPayload.order === "object")
        ? orderPayload.order
        : (orderPayload?.data && typeof orderPayload.data === "object")
          ? orderPayload.data
          : (orderPayload?.payload && typeof orderPayload.payload === "object")
            ? orderPayload.payload
            : (orderPayload || {});

      // Extraction résiliente de l'ID de commande : aucun rejet 400
      const rawOrderId = String(
        root.id ??
        root.orderId ??
        root.order_id ??
        root._id ??
        root.orderNumber ??
        root.order_number ??
        root.reference ??
        root.name ??
        `ord_${Date.now()}`
      );
      const shopifyOrderId = rawOrderId.replace(/^#/, "");
      const orderNumber = root.order_number
        ? `#${root.order_number}`
        : root.orderNumber
          ? (String(root.orderNumber).startsWith("#") ? String(root.orderNumber) : `#${root.orderNumber}`)
          : (root.name || `#${shopifyOrderId}`);

      const db = getDb();

      // Rechercher la connexion Shopify / Azify correspondante (Multi-boutique / Flux)
      let found: { doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot; status: ConnectionStatus } | null = null;

      // 1. Recherche prioritaire par verifyToken si fourni
      if (effectiveVerifyToken) {
        try {
          const tokenSnap = await db
            .collectionGroup("shopifyConnections")
            .where("verifyToken", "==", effectiveVerifyToken)
            .limit(1)
            .get();
          if (!tokenSnap.empty) {
            const doc = tokenSnap.docs[0];
            found = { doc, status: (doc.data()?.status as ConnectionStatus) || "active" };
          }
        } catch (tokenErr) {
          console.warn("verifyToken collectionGroup lookup warning:", tokenErr);
        }
      }

      // 2. Recherche par domaine ou sous-domaine
      if (!found && shopDomain) {
        found = await findConnection(db, shopDomain);
      }

      // 3. Recherche dans les métadonnées de commande
      if (!found && root) {
        const candidatesFromPayload: string[] = [];
        if (root.order_status_url) {
          try {
            candidatesFromPayload.push(new URL(root.order_status_url).hostname);
          } catch {}
        }
        if (root.landing_site) {
          try {
            candidatesFromPayload.push(new URL(root.landing_site, "https://dummy.local").hostname);
          } catch {}
        }
        if (root.domain) candidatesFromPayload.push(String(root.domain));
        if (root.shop_url) candidatesFromPayload.push(String(root.shop_url));
        if (root.storeDomain) candidatesFromPayload.push(String(root.storeDomain));

        for (const cand of candidatesFromPayload) {
          found = await findConnection(db, cand);
          if (found) {
            if (shopDomain.endsWith(".myshopify.com") && !found.doc.data()?.myshopifyDomain) {
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

      // 4. RÉSOLUTION DYNAMIQUE DE SECOURS : NE JAMAIS PERDRE UNE COMMANDE
      let dynamicWorkspaceId = "";
      if (!found) {
        console.warn(`shopifyWebhook: boutique non trouvée par domaine (${shopDomain}), recherche automatique du workspace...`);
        try {
          let targetWsId = String(
            req.headers["x-workspace-id"] ||
            req.query.workspaceId ||
            root.workspaceId ||
            orderPayload?.workspaceId ||
            ""
          ).trim();

          if (!targetWsId) {
            const wsSnap = await db.collection("workspaces").limit(1).get();
            if (!wsSnap.empty) {
              targetWsId = wsSnap.docs[0].id;
            }
          }

          if (targetWsId) {
            dynamicWorkspaceId = targetWsId;
            const connsSnap = await db.collection("workspaces").doc(targetWsId).collection("shopifyConnections").limit(10).get();
            if (!connsSnap.empty) {
              const active = connsSnap.docs.find((d) => d.data()?.status === "active") || connsSnap.docs[0];
              found = { doc: active, status: (active.data()?.status as ConnectionStatus) || "active" };
              console.log(`shopifyWebhook: Commande reliée à la connexion active existante ${active.id}`);
            } else {
              // Création dynamique d'une connexion par défaut pour enregistrer la commande
              const safeDomain = shopDomain || (isAzifyRequest ? "azify-studio.store" : "boutique-cod.myshopify.com");
              const connId = safeDomain.replace(/[^a-z0-9]/gi, "_");
              const newConnRef = db.collection("workspaces").doc(targetWsId).collection("shopifyConnections").doc(connId);
              const defaultConnData = {
                id: connId,
                workspaceId: targetWsId,
                shopDomain: safeDomain,
                shopName: safeDomain.replace(/(\.myshopify\.com|\.azify\.store|\.store)$/, ""),
                status: "active",
                defaultCountry: "TG",
                createdAt: Date.now(),
                lastOrderAt: Date.now(),
                autoCreated: true,
              };
              await newConnRef.set(defaultConnData, { merge: true });
              const createdDoc = await newConnRef.get();
              found = { doc: createdDoc, status: "active" };
              console.log(`shopifyWebhook: Nouvelle connexion auto-provisionnée ${connId} pour ${safeDomain}`);
            }
          }
        } catch (wsErr) {
          console.error("shopifyWebhook: Erreur lors de la résolution de secours du workspace:", wsErr);
        }
      }

      if (!found) {
        console.error("shopifyWebhook: Impossible de trouver ou créer un workspace pour stocker la commande.");
        res.status(200).json({ received: true, warning: "Aucun espace de travail disponible." });
        return;
      }

      const connDoc = found.doc;
      const connection = connDoc.data() || {};
      const workspaceId = connection.workspaceId || dynamicWorkspaceId || connDoc.ref.parent?.parent?.id || "default_workspace";

      // SÉCURITÉ : Audit des signatures (non bloquant en production pour préserver le chiffre d'affaires)
      const hmacHeader = String(req.headers["x-shopify-hmac-sha256"] || "");
      const azifySigHeader = String(req.headers["x-azify-signature"] || req.headers["x-waritrack-signature"] || "");
      let authStatus: "verified" | "unverified_token" | "unverified_hmac" | "open" = "open";

      if (isAzifyRequest || effectiveVerifyToken) {
        const tokenMatches = Boolean(
          effectiveVerifyToken &&
          connection.verifyToken &&
          effectiveVerifyToken === connection.verifyToken
        );
        let hmacMatches = false;
        if (azifySigHeader && (connection.webhookSecret || connection.verifyToken)) {
          try {
            const secret = connection.webhookSecret || connection.verifyToken;
            const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(orderPayload);
            const expectedSig = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
            const sigBuf = Buffer.from(azifySigHeader);
            const expBuf = Buffer.from(expectedSig);
            if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
              hmacMatches = true;
            }
          } catch {}
        }
        if (tokenMatches || hmacMatches) {
          authStatus = "verified";
        } else if (connection.verifyToken || connection.webhookSecret) {
          authStatus = "unverified_token";
          console.warn("shopifyWebhook: Token Azify non concordant pour", shopDomain);
        }
      } else if (connection.webhookSecret && hmacHeader) {
        try {
          const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(orderPayload);
          const calculatedHmac = crypto.createHmac("sha256", connection.webhookSecret).update(rawBody, "utf8").digest("base64");
          const hmacBuf = Buffer.from(hmacHeader);
          const calcBuf = Buffer.from(calculatedHmac);
          if (hmacBuf.length === calcBuf.length && crypto.timingSafeEqual(hmacBuf, calcBuf)) {
            authStatus = "verified";
          } else {
            authStatus = "unverified_hmac";
            console.warn("shopifyWebhook: Signature HMAC Shopify non concordante pour", shopDomain);
          }
        } catch {}
      }

      // Détection notification de test Shopify (bouton "Envoyer une notification de test" dans l'admin)
      const isShopifyTest =
        String(req.headers["x-shopify-test"] || "").toLowerCase() === "true" ||
        String(root.name || "").includes("#TEST_VERIF");

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

      // Si la boutique était marquée "pending", la réception d'une commande valide l'active immédiatement
      if (found.status === "pending") {
        try {
          await connDoc.ref.update({
            status: "active",
            activatedAt: Date.now(),
            webhookVerifiedAt: Date.now(),
          });
        } catch {}
      }

      // Idempotence : vérifier directement si la commande existe déjà
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

      // =====================================================================
      // EXTRACTION UNIVERSELLE DES DONNÉES DE COMMANDE (Shopify & Azify COD)
      // =====================================================================
      const shipping = root.shipping_address || root.billing_address || root.shippingAddress || root.address || {};
      const customer = root.customer || root.client || {};

      const noteAttributes = Array.isArray(root.note_attributes)
        ? root.note_attributes.map((attr: { name?: string; value?: string }) => ({
            name: String(attr.name || "").trim(),
            value: String(attr.value || "").trim(),
          }))
        : [];
      const noteMap: Record<string, string> = {};
      for (const attr of noteAttributes) {
        if (attr && typeof attr.name === "string" && typeof attr.value === "string") {
          noteMap[attr.name.toLowerCase().trim()] = attr.value.trim();
        }
      }

      // Téléphone brut
      const rawPhone = String(
        root.clientPhone ||
        root.phone ||
        root.tel ||
        root.telephone ||
        root.whatsapp ||
        shipping.phone ||
        customer.phone ||
        noteMap["phone"] ||
        noteMap["telephone"] ||
        noteMap["whatsapp"] ||
        ""
      );

      // Ville et localisation
      const city = String(
        root.city ||
        root.ville ||
        root.commune ||
        shipping.city ||
        shipping.province ||
        noteMap["city"] ||
        noteMap["ville"] ||
        noteMap["commune"] ||
        ""
      );
      const province = String(shipping.province || root.province || root.region || "");
      const zip = String(shipping.zip || root.zip || "");

      // Détection automatique et infaillible du pays COD Afrique
      const countryCandidate = String(
        root.countryCode ||
        root.country ||
        root.pays ||
        shipping.country_code ||
        shipping.country ||
        customer.default_address?.country_code ||
        customer.default_address?.country ||
        noteMap["country"] ||
        noteMap["pays"] ||
        ""
      );
      const countryCode = detectAfricanCountry({
        phone: rawPhone,
        countryCode: countryCandidate,
        country: countryCandidate,
        city: city,
        defaultCountry: connection.defaultCountry || "TG",
      });

      const locationHint = [city, province, countryCode].filter(Boolean).join(", ");
      const { normalized: phoneNormalized } = normalizePhoneE164(rawPhone, countryCode);

      // Nom du client
      const clientName =
        String(root.clientName || root.customerName || root.fullName || "").trim() ||
        [shipping.first_name, shipping.last_name].filter(Boolean).join(" ").trim() ||
        [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
        String(root.name || "").replace(/^#\d+/, "").trim() ||
        "Client COD";

      // Montant et devise
      const rawAmount = root.amount ?? root.totalPrice ?? root.total_price ?? root.total ?? root.price ?? "0";
      const amount = parseFloat(String(rawAmount).replace(/[^\d.-]/g, "")) || 0;
      const currency = String(root.currency || root.devise || connection.currency || "XOF").toUpperCase();

      // Produits
      let product = "Produit COD";
      if (typeof root.product === "string" && root.product.trim()) {
        product = root.product.trim();
      } else if (Array.isArray(root.line_items) && root.line_items.length > 0) {
        product = root.line_items.map((item: any) => `${item.quantity || 1}x ${item.title || item.name || "Produit"}`).join(", ");
      } else if (Array.isArray(root.items) && root.items.length > 0) {
        product = root.items.map((item: any) => `${item.quantity || 1}x ${item.title || item.name || "Produit"}`).join(", ");
      }

      // Quantité
      let quantity = 1;
      if (typeof root.quantity === "number") {
        quantity = root.quantity;
      } else if (Array.isArray(root.line_items) && root.line_items.length > 0) {
        quantity = root.line_items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
      } else if (Array.isArray(root.items) && root.items.length > 0) {
        quantity = root.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 1), 0);
      }

      // =====================================================================
      // ROUTING DU FLUX ULTRA-RÉSILIENT : Attribution garantie sans perte
      // =====================================================================
      let targetRoute: any = null;
      if (Array.isArray(connection.countryRoutes)) {
        targetRoute = connection.countryRoutes.find(
          (r: any) => String(r?.countryCode || r?.country || "").toUpperCase() === countryCode
        );
      } else if (connection.countryRoutes && typeof connection.countryRoutes === "object") {
        targetRoute = connection.countryRoutes[countryCode] || connection.countryRoutes[countryCode.toLowerCase()];
      }

      let assignedTeamId = (targetRoute && targetRoute.status === "active" && targetRoute.assignedTeamId)
        ? targetRoute.assignedTeamId
        : "";
      let assignedTeamName = targetRoute?.assignedTeamName || "";
      let isUnrouted = false;

      // 1. Si aucune route explicite valide, chercher automatiquement l'équipe locale de ce pays
      if (!assignedTeamId) {
        try {
          const countryTeamsSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("teams")
            .where("defaultCountry", "==", countryCode)
            .limit(1)
            .get();

          if (!countryTeamsSnap.empty) {
            const teamDoc = countryTeamsSnap.docs[0];
            assignedTeamId = teamDoc.id;
            assignedTeamName = teamDoc.data()?.name || `Équipe ${countryCode}`;
            console.log(`shopifyWebhook: Routage multi-pays automatique vers ${assignedTeamName} (${countryCode})`);
          }
        } catch (matchErr) {
          console.warn("country team match warning:", matchErr);
        }
      }

      // 2. Repli sur l'équipe propriétaire de la boutique
      if (!assignedTeamId && connection.ownerTeamId) {
        assignedTeamId = connection.ownerTeamId;
        assignedTeamName = connection.ownerTeamName || "";
        isUnrouted = true;
      }

      // 3. Repli sur la première équipe active du workspace
      if (!assignedTeamId) {
        try {
          const allTeamsSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").limit(10).get();
          if (!allTeamsSnap.empty) {
            const activeTeam = allTeamsSnap.docs.find((d) => d.data()?.active !== false) || allTeamsSnap.docs[0];
            assignedTeamId = activeTeam.id;
            assignedTeamName = activeTeam.data()?.name || "";
            isUnrouted = true;
          }
        } catch (tErr) {
          console.warn("Could not fallback teamId:", tErr);
        }
      }

      // Si la commande n'a pas de route explicite configurée, journaliser dans shopifyUnroutedOrders pour revue
      if (isUnrouted || !targetRoute || targetRoute.status !== "active") {
        isUnrouted = true;
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
            assignedTeamId: assignedTeamId || "",
            assignedTeamName: assignedTeamName || "",
            createdAt: Date.now(),
          });
        } catch (unroutedErr) {
          console.warn("Could not log shopifyUnroutedOrder (non-bloquant):", unroutedErr);
        }
      }

      // =====================================================================
      // RÉCONCILIATION DE SESSION & ATTRIBUTION MARKETING (CAPI / UTM)
      // =====================================================================
      let sessionData: Record<string, unknown> = {};
      let matchedSessionId: string | null = null;

      if (phoneNormalized) {
        try {
          const fortyFiveMinAgo = Date.now() - 45 * 60 * 1000;
          const sessionsSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("trackingSessions")
            .where("phoneNormalized", "==", phoneNormalized)
            .limit(10)
            .get();

          if (!sessionsSnap.empty) {
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
                browserIp: s.ip || "",
                browserUserAgent: s.userAgent || "",
                pageUrl: s.pageUrl || "",
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

      // Détection numéro doublon
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
              const st = d.data()?.statutCloseuse;
              return st === "rejete" || st === "injoignable";
            }).length;
          }
        } catch (dupErr) {
          console.warn("shopifyWebhook: vérification doublon numéro ignorée (non bloquant):", dupErr);
        }
      }

      // Canaux d'acquisition
      const landingSite = String(root.landing_site || root.landing_site_ref || "").toLowerCase();
      const referringSite = String(root.referring_site || "").toLowerCase();

      const firstLineItem = Array.isArray(root.line_items) && root.line_items[0] ? root.line_items[0] : null;
      const productImageUrl: string | null =
        (typeof root.image === "string" ? root.image : root.image?.src) ||
        root.image_url ||
        root.productImageUrl ||
        firstLineItem?.image ||
        firstLineItem?.image_url ||
        firstLineItem?.product_image ||
        noteMap["product_image_url"] ||
        noteMap["image_url"] ||
        noteMap["product_image"] ||
        null;

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

      // GPS
      const googleMapsUrl = noteMap["google_maps_url"] || noteMap["maps"] || noteMap["maps_url"] || root.google_maps_url || null;
      const positionGps = noteMap["position_gps"] || noteMap["gps"] || (root.latitude && root.longitude ? `${root.latitude},${root.longitude}` : null);
      const precisionGps = noteMap["precision_gps"] || noteMap["accuracy"] || null;

      // Meta Pixel & CAPI Coordination (Azify <-> WariTrack)
      const azifyMetaEvent = String(noteMap["meta_event_sent"] || root.meta_event_sent || "").toLowerCase();
      const alreadySentPurchase =
        noteMap["capi_sent"] === "true" ||
        root.capiSent === true ||
        root.capi_sent === true ||
        azifyMetaEvent === "purchase";

      const incomingPixelId = String(
        noteMap["pixel_id"] ||
        noteMap["pixelid"] ||
        noteMap["meta_pixel_id"] ||
        root.pixel_id ||
        root.pixelId ||
        ""
      ).trim();

      const testEventCode = String(
        noteMap["capi_test_code"] ||
        noteMap["test_event_code"] ||
        root.capi_test_code ||
        root.capiTestCode ||
        ""
      ).trim();

      const isTestOrder = Boolean(
        testEventCode ||
        noteMap["is_test"] === "true" ||
        root.is_test === true ||
        root.isTest === true ||
        req.headers["x-shopify-test"] === "true"
      );

      let trafficSource: "meta_ads" | "tiktok_ads" | "google_ads" | "organique" | "acces_libre_site" = "organique";
      let capiIsolated = false;
      let attributionDetail = "";

      if (isDuplicatePhone) {
        trafficSource = "acces_libre_site";
        capiIsolated = true;
        attributionDetail = "Numéro doublon / Ancien client (Accès libre site)";
      } else if (
        effectiveTtclid ||
        effectiveTtp ||
        utmSource.includes("tiktok") ||
        referringSite.includes("tiktok")
      ) {
        trafficSource = "tiktok_ads";
        capiIsolated = true;
        attributionDetail = "Campagne TikTok Ads";
      } else if (
        effectiveGclid ||
        (utmSource.includes("google") && (utmMedium.includes("cpc") || utmMedium.includes("ads")))
      ) {
        trafficSource = "google_ads";
        capiIsolated = true;
        attributionDetail = "Campagne Google Ads";
      } else if (
        effectiveFbclid ||
        (effectiveFbc && effectiveFbc.startsWith("fb.1.")) ||
        ["facebook", "fb", "instagram", "ig", "meta"].some((s) => utmSource.includes(s)) ||
        isTestOrder ||
        incomingPixelId
      ) {
        trafficSource = "meta_ads";
        capiIsolated = false;
        attributionDetail = isTestOrder
          ? "Test d'intégration Meta Ads / CAPI (Événement Test)"
          : alreadySentPurchase
          ? "Campagne Meta Ads (Achat direct envoyé par Azify - Mode Testing)"
          : "Campagne Meta Ads (fbc/fbclid ou Pixel résolu)";
      } else {
        trafficSource = "organique";
        capiIsolated = true;
        attributionDetail = "Organique / Hors campagne (Trafic naturel direct sans clic publicitaire)";
      }

      // Extraction enrichie : Carte Maps réelle, Remarques & Notes, Quantités & Code Promo
      const mapInfo = extractMapAndLocation(root);
      const notesInfo = extractNotesAndAddress(root);
      const pricingInfo = calculateOrderPricing(root);
      const qtyInfo = extractQuantityAndItems(root);

      const effectiveFinalAmount = pricingInfo.amount > 0 ? pricingInfo.amount : (Number(amount) || 0);
      const effectiveOriginalAmount = pricingInfo.originalAmount > 0 ? pricingInfo.originalAmount : effectiveFinalAmount;
      const effectiveQty = qtyInfo.quantity > 0 ? qtyInfo.quantity : (Number(quantity) || 1);
      const effectiveMapUrl = mapInfo.mapUrl || googleMapsUrl || (positionGps ? `https://www.google.com/maps?q=${positionGps}` : null);
      const effectiveGps = mapInfo.gpsCoordinates || positionGps || null;

      // =====================================================================
      // ENREGISTREMENT DE LA COMMANDE DANS FIRESTORE
      // =====================================================================
      const newOrderRef = db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("orders")
        .doc(shopifyOrderId);

      const orderDoc: Record<string, any> = {
        id: shopifyOrderId,
        workspaceId,
        teamId: assignedTeamId || "",
        teamName: assignedTeamName || connection.ownerTeamName || "",
        sheetId: "",
        sourceRowId: `shopify_${shopifyOrderId}`,
        sourceType: isAzifyRequest ? "azify" : "shopify",
        shopifyOrderId,
        sessionId: matchedSessionId || null,

        clientName: clientName || "Client COD",
        clientPhoneRaw: rawPhone || "",
        clientPhoneFormatted: phoneNormalized || rawPhone || "Non renseigné",
        city: city || "",
        address: notesInfo.address || shipping.address1 || null,
        notes: notesInfo.notes || null,
        addressNote: notesInfo.addressNote || shipping.address1 || root.address || root.note || "",
        product: product || "Produit COD",
        productImageUrl: productImageUrl || null,
        quantity: effectiveQty,
        amount: effectiveFinalAmount,
        originalAmount: effectiveOriginalAmount,
        promoCode: pricingInfo.promoCode || null,
        discountAmount: pricingInfo.discountAmount || 0,
        discountPercent: pricingInfo.discountPercent || null,
        orderNumber: orderNumber || `#${shopifyOrderId}`,
        clientLanguage:
          root.clientLanguage ||
          noteMap["clientlanguage"] ||
          noteMap["client_language"] ||
          noteMap["language"] ||
          noteMap["langue"] ||
          noteMap["target_language"] ||
          noteMap["dialect"] ||
          null,

        sourcePlatform: isAzifyRequest ? "azify" : "shopify",
        azifyStoreId: isAzifyRequest ? (connection.azifyStoreId || connection.id) : null,
        azifyStoreName: isAzifyRequest ? (connection.shopName || connection.shopDomain || "Azify Studio") : null,

        closeuseId: null,
        livreurId: null,
        statutCloseuse: "nouveau",
        statutLivreur: null,
        statutAdminOverride: null,
        callInProgress: null,
        reminderAt: null,
        temperature: "hot",

        mapUrl: effectiveMapUrl || null,
        googleMapsUrl: effectiveMapUrl || null,
        gpsCoordinates: effectiveGps || null,
        latitude: mapInfo.latitude !== undefined && mapInfo.latitude !== null && !isNaN(mapInfo.latitude) ? mapInfo.latitude : null,
        longitude: mapInfo.longitude !== undefined && mapInfo.longitude !== null && !isNaN(mapInfo.longitude) ? mapInfo.longitude : null,
        mapAddress: mapInfo.mapAddress || null,
        gpsAccuracy: precisionGps || null,

        isDuplicatePhone,
        previousOrdersCount,
        previousRejectionsCount,
        capiIsolated,
        trafficSource,
        attributionDetail,
        authStatus,

        shopifyData: {
          shopifyOrderId,
          productImageUrl,
          orderNumber: orderNumber || `#${shopifyOrderId}`,
          clientLanguage:
            root.clientLanguage ||
            noteMap["clientlanguage"] ||
            noteMap["client_language"] ||
            noteMap["language"] ||
            noteMap["langue"] ||
            noteMap["target_language"] ||
            noteMap["dialect"] ||
            null,
          shopDomain: shopDomain || connection.shopDomain || "boutique.azify.store",
          countryCode: countryCode || "",
          city: city || "",
          province: province || "",
          zip: zip || "",
          locationHint: locationHint || "",
          browserIp: String(root.browser_ip || (root.client_details && root.client_details.browser_ip) || sessionData.browserIp || ""),
          browserUserAgent: String((root.client_details && root.client_details.user_agent) || sessionData.browserUserAgent || ""),
          pageUrl: String(root.landing_site || sessionData.pageUrl || ""),
          noteAttributes: Array.isArray(noteAttributes) ? noteAttributes : [],
          rawCustomerNotes: String(root.note || ""),
          googleMapsUrl: googleMapsUrl || (positionGps ? `https://www.google.com/maps?q=${positionGps}` : null),
          gpsCoordinates: positionGps || null,
          gpsAccuracy: precisionGps || null,
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

        pixelId: incomingPixelId || undefined,
        capiSent: alreadySentPurchase,
        metaEventSent: alreadySentPurchase ? "Purchase" : (azifyMetaEvent === "lead" ? "Lead" : undefined),
        testEventCode: testEventCode || undefined,
        purgeAt: null,
        isUnrouted: Boolean(isUnrouted),
      };

      await newOrderRef.set(orderDoc);

      // Conversion automatique du panier Marketplace si un abonné Push a le même téléphone
      const searchPhone = phoneNormalized || rawPhone;
      if (searchPhone) {
        db.collection("workspaces")
          .doc(workspaceId)
          .collection("marketplaceSubscribers")
          .where("clientPhone", "==", searchPhone)
          .limit(5)
          .get()
          .then((subSnap) => {
            subSnap.forEach((d) => {
              d.ref.update({
                "cart.status": "converted",
                cartRecoverySent: true,
                cartConvertedAt: Date.now(),
                lastConvertedOrderId: shopifyOrderId,
              }).catch(() => {});
            });
          })
          .catch(() => {});
      }

      // Preuve de fonctionnement continue : badge « En direct »
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

      console.log(`shopifyWebhook: Commande ${shopifyOrderId} ingérée avec succès. Équipe: ${assignedTeamName} (${assignedTeamId}) - Pays: ${countryCode}`);

      res.status(200).json({
        success: true,
        orderId: shopifyOrderId,
        assignedTeamId,
        assignedTeamName,
        countryCode,
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

  // 5. Bouclier Anti-Vol de Contenu & Anti « Save As » (Protection Droits d'Auteur)
  try {
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    }, true);

    window.addEventListener('keydown', function(e) {
      var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      var mod = isMac ? e.metaKey : e.ctrlKey;
      var key = (e.key || '').toLowerCase();
      var code = (e.code || '').toLowerCase();

      if (mod && (key === 's' || code === 'keys')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (mod && (key === 'u' || code === 'keyu')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (mod && (key === 'p' || code === 'keyp')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (key === 'f12' || (mod && e.shiftKey && key === 'i')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);

    document.addEventListener('dragstart', function(e) {
      var tag = (e.target && e.target.tagName || '').toUpperCase();
      if (tag === 'IMG' || tag === 'PICTURE' || tag === 'VIDEO') {
        e.preventDefault();
        return false;
      }
    }, true);
  } catch(e) {}
})();
`;

    res.status(200).send(scriptCode);
  }
);

// 4. syncOrderUpdateToAzify : Notifie automatiquement Azify lors des changements d'état (Confirmé, Livré, Annulé)
export async function syncOrderUpdateToAzify(
  workspaceId: string,
  orderData: Record<string, any>,
  status: "confirmed" | "shipped" | "delivered" | "cancelled" | "unreachable" | "returned"
) {
  try {
    const shopDomain = orderData?.shopifyData?.shopDomain || orderData?.shopDomain;
    const orderNumber = orderData?.orderNumber || orderData?.shopifyOrderId || orderData?.id;
    if (!orderNumber) return;

    let conn: any = null;
    let cleanDomain = "";

    if (shopDomain) {
      cleanDomain = String(shopDomain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const connId = cleanDomain.replace(/[^a-z0-9]/gi, "_");
      const connSnap = await getDb().collection("workspaces").doc(workspaceId).collection("shopifyConnections").doc(connId).get();
      if (connSnap.exists) conn = connSnap.data();
    }

    if (!conn) {
      // Rechercher la première connexion active Azify dans ce workspace
      const azifySnap = await getDb()
        .collection("workspaces")
        .doc(workspaceId)
        .collection("shopifyConnections")
        .where("status", "==", "active")
        .limit(5)
        .get();
      const azifyDoc = azifySnap.docs.find((d) => {
        const data = d.data();
        return (
          data.sourcePlatform === "azify" ||
          Boolean(data.azifyWebhookUrl) ||
          Boolean(data.azifyStoreId) ||
          (data.domains || []).some((dom: string) => dom.toLowerCase().includes("azishop")) ||
          (data.shopDomain || "").toLowerCase().includes("azishop")
        );
      });
      if (azifyDoc) {
        conn = azifyDoc.data();
        cleanDomain = conn.shopDomain || conn.customDomain || "azishop-pwa-studio.vercel.app";
      }
    }

    const targetUrl = conn?.azifyWebhookUrl || (cleanDomain ? `https://${cleanDomain}/api/integrations/waritrack/webhook` : null);
    if (!targetUrl) return;

    const payload = {
      orderId: orderNumber,
      orderNumber: orderNumber,
      status: status,
      courierName: orderData.assignedLivreurName || orderData.livreurName || undefined,
      courierPhone: orderData.assignedLivreurPhone || orderData.livreurPhone || undefined,
      amountCollected: status === "delivered" ? orderData.amount : undefined,
      failureReason: orderData.deliveryFailureReason || orderData.rejectionReason || undefined,
      notes: orderData.deliveryFieldNote || orderData.fieldNote || undefined,
      verifyToken: conn?.verifyToken || undefined,
      shopDomain: cleanDomain,
      timestamp: Date.now(),
    };

    const payloadJson = JSON.stringify(payload);
    const secret = conn?.verifyToken || conn?.webhookSecret || "waritrack_secret";
    const signature = crypto.createHmac("sha256", secret).update(payloadJson, "utf8").digest("hex");

    await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WariTrack-Signature": signature,
        "X-Azify-Verify-Token": conn?.verifyToken || "",
      },
      body: payloadJson,
      signal: AbortSignal.timeout(6000),
    });
    console.log(`syncOrderUpdateToAzify: statut ${status} synchronisé vers ${targetUrl}`);
  } catch (err) {
    console.warn("syncOrderUpdateToAzify error (non-bloquant):", err);
  }
}
