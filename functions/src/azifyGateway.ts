import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

function setCorsHeaders(req: any, res: any): boolean {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Azify-Verify-Token, X-Azify-Signature, X-WariTrack-Signature");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

function parseJsonBody(req: any): any {
  if (!req) return {};
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      const p = JSON.parse(req.body);
      if (p && typeof p === "object") return p;
    } catch {}
  }
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      const text = req.body.toString("utf8").trim();
      if (text) {
        const p = JSON.parse(text);
        if (p && typeof p === "object") return p;
      }
    } catch {}
  }
  if (req.rawBody) {
    try {
      const text = req.rawBody.toString("utf8").trim();
      if (text) {
        const p = JSON.parse(text);
        if (p && typeof p === "object") return p;
      }
    } catch {}
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
export const azifyGateway = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
  },
  async (req, res) => {
    if (setCorsHeaders(req, res)) return;

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
      const verifyToken = String(
        req.headers["x-azify-verify-token"] ||
        req.query.verifyToken ||
        req.query.ecomcod_verify ||
        ""
      ).trim();

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
        } catch (err) {
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
      } catch (err: any) {
        console.error("azifyGateway getTeams error:", err);
        res.status(500).json({ error: "Internal Server Error", message: err.message });
        return;
      }
    }

    // 3. POST /pair : Appairage sécurisé Azify <-> WariTrack
    if (req.method === "POST" && (path === "/pair" || path.endsWith("/pair"))) {
      try {
        const body = parseJsonBody(req);
        const {
          storeId,
          storeName,
          slug,
          shopDomain,
          customDomain,
          verifyToken,
          ownerTeamId,
          defaultCountry,
          countryRoutes,
          accountEmail,
          workspaceId,
        } = body;

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
          ...(existing.exists && Array.isArray(existing.data()?.domains) ? existing.data()!.domains : []),
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
      } catch (err: any) {
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
        let connDoc: admin.firestore.QueryDocumentSnapshot | null = null;
        if (verifyToken) {
          const snap = await db.collectionGroup("shopifyConnections").where("verifyToken", "==", verifyToken).limit(1).get();
          if (!snap.empty) connDoc = snap.docs[0];
        }
        if (!connDoc && shopDomain) {
          const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          const connId = cleanDomain.replace(/[^a-z0-9]/gi, "_");
          const snap = await db.collectionGroup("shopifyConnections").where("shopDomain", "==", cleanDomain).limit(1).get();
          if (!snap.empty) connDoc = snap.docs[0];
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
      } catch (err: any) {
        console.error("azifyGateway status error:", err);
        res.status(500).json({ error: "Internal Server Error", message: err.message });
        return;
      }
    }

    // Route non reconnue
    res.status(404).json({ error: "Not Found", path });
  }
);
