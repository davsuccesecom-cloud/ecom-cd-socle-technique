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
exports.scheduledDigest = exports.scheduledReminders = exports.scheduledPurge = exports.onOrderUpdated = exports.onOrderCreated = exports.listAccessLinks = exports.validateAccessSession = exports.setAccessLinkStatus = exports.regenerateAccessPassword = exports.createAccessUser = exports.authenticateAdmin = exports.authenticateAccess = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const bcrypt = __importStar(require("bcryptjs"));
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const MAX_SESSIONS_PER_ACCESS_LINK = 2;
const ORDER_PURGE_AFTER_DAYS = 3;
const REMINDER_DELAY_MINUTES = 20;
const FINAL_STATUSES = ["livre", "rejete", "injoignable"];
// ---------------------------------------------------------------------------
// 1. Authentification par lien d'accÃ¨s + mot de passe simple (section 10)
// ---------------------------------------------------------------------------
// REMPLACE AUSSI toute la fonction `authenticateAccess` existante par
// celle-ci (elle inclut la lecture depuis accessLinkSecrets + le rate
// limiting anti-bruteforce, dÃ©jÃ  donnÃ©s dans un message prÃ©cÃ©dent) :
// ============================================================================
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
exports.authenticateAccess = (0, https_1.onCall)(async (request) => {
    const { accessLinkId, password } = request.data;
    if (!accessLinkId || !password) {
        throw new https_1.HttpsError("invalid-argument", "Lien d'accÃ¨s et mot de passe requis.");
    }
    const linkSnap = await db.collectionGroup("accessLinks").where("id", "==", accessLinkId).limit(1).get();
    if (linkSnap.empty) {
        throw new https_1.HttpsError("not-found", "Lien d'accÃ¨s invalide.");
    }
    const linkDoc = linkSnap.docs[0];
    const link = linkDoc.data();
    if (link.disabledAt) {
        throw new https_1.HttpsError("permission-denied", "Cet accÃ¨s a Ã©tÃ© dÃ©sactivÃ©.");
    }
    // Le hash vit dans une sous-collection sÃ©parÃ©e, jamais retournÃ©e dans
    // aucune rÃ©ponse de Cloud Function cÃ´tÃ© client â€” corrige la faille
    // "passwordHash exposÃ©".
    const secretRef = db
        .collection("workspaces")
        .doc(link.workspaceId)
        .collection("accessLinkSecrets")
        .doc(linkDoc.id);
    const secretSnap = await secretRef.get();
    if (!secretSnap.exists) {
        throw new https_1.HttpsError("not-found", "Lien d'accÃ¨s invalide.");
    }
    const secret = secretSnap.data();
    // Verrouillage anti-bruteforce : 5 tentatives ratÃ©es â†’ blocage 15 min
    const now = Date.now();
    if (secret.lockedUntil && secret.lockedUntil > now) {
        const minutesLeft = Math.ceil((secret.lockedUntil - now) / 60000);
        throw new https_1.HttpsError("resource-exhausted", `Trop de tentatives. RÃ©essaie dans ${minutesLeft} min.`);
    }
    const passwordOk = await bcrypt.compare(password, secret.passwordHash);
    if (!passwordOk) {
        const failedAttempts = (secret.failedAttempts ?? 0) + 1;
        const update = { failedAttempts };
        if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
            update.lockedUntil = now + LOCKOUT_DURATION_MS;
            update.failedAttempts = 0;
        }
        await secretRef.set(update, { merge: true });
        throw new https_1.HttpsError("permission-denied", "Mot de passe incorrect.");
    }
    // Connexion rÃ©ussie : on remet le compteur Ã  zÃ©ro
    if (secret.failedAttempts || secret.lockedUntil) {
        await secretRef.set({ failedAttempts: 0, lockedUntil: admin.firestore.FieldValue.delete() }, { merge: true });
    }
    const userSnap = await db
        .collection("workspaces")
        .doc(link.workspaceId)
        .collection("users")
        .doc(link.userId)
        .get();
    const user = userSnap.data();
    if (!user || user.status !== "active") {
        throw new https_1.HttpsError("permission-denied", "Compte dÃ©sactivÃ©.");
    }
    const sessions = link.activeSessions ?? [];
    const newSession = {
        sessionToken: db.collection("_").doc().id,
        deviceLabel: request.rawRequest.headers["user-agent"]?.slice(0, 80) ?? "Appareil inconnu",
        connectedAt: Date.now(),
    };
    const updatedSessions = [...sessions, newSession]
        .sort((a, b) => b.connectedAt - a.connectedAt)
        .slice(0, MAX_SESSIONS_PER_ACCESS_LINK);
    await linkDoc.ref.update({ activeSessions: updatedSessions });
    await notifyAdmins(link.workspaceId, "Nouvelle connexion", `${user.name} s'est connectÃ©(e) depuis un nouvel appareil.`);
    const customToken = await admin.auth().createCustomToken(link.userId, {
        workspaceId: link.workspaceId,
        teamId: user.teamId,
        role: user.role,
    });
    return {
        customToken,
        workspaceId: link.workspaceId,
        teamId: user.teamId,
        userId: link.userId,
        role: user.role,
    };
});
// ---------------------------------------------------------------------------
// 1bis. Authentification admin â€” systÃ¨me multi-entreprises (SaaS) : n'importe
// quel email peut crÃ©er SON PROPRE espace isolÃ© (workspace), avec son propre
// nom, ses propres Ã©quipes/closeuses/livreurs. Aucune donnÃ©e n'est jamais
// partagÃ©e entre deux espaces diffÃ©rents. Agnostique du mode de connexion
// utilisÃ© cÃ´tÃ© client (lien magique par email) â€” seul l'email authentifiÃ©
// par Firebase Auth compte ici. Une simple table de correspondance
// (adminsByEmail) relie chaque email au workspace qu'il possÃ¨de.
// ---------------------------------------------------------------------------
exports.authenticateAdmin = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token?.email?.toLowerCase();
    const name = request.auth?.token?.name;
    if (!uid || !email) {
        throw new https_1.HttpsError("unauthenticated", "Connexion Google requise.");
    }
    const mappingRef = db.collection("adminsByEmail").doc(email);
    const mappingSnap = await mappingRef.get();
    // Cas 1 : ce compte Google possÃ¨de dÃ©jÃ  un espace â€” on le reconnecte
    // simplement Ã  SON workspace existant.
    if (mappingSnap.exists) {
        const { workspaceId } = mappingSnap.data();
        await admin.auth().setCustomUserClaims(uid, { workspaceId, role: "admin" });
        return { workspaceId, role: "admin", isNewWorkspace: false };
    }
    // Cas 2 : premiÃ¨re connexion de ce compte â€” nouvelle entreprise qui
    // s'inscrit. Il faut le nom de son espace pour le crÃ©er ; si le client
    // ne l'a pas encore fourni, on le lui demande via ce code d'erreur
    // reconnu cÃ´tÃ© frontend (affiche un formulaire "Nom de ton entreprise").
    const { workspaceName } = request.data;
    if (!workspaceName || !workspaceName.trim()) {
        throw new https_1.HttpsError("failed-precondition", "NEW_WORKSPACE_NEEDS_NAME");
    }
    const workspaceRef = db.collection("workspaces").doc();
    await workspaceRef.set({
        id: workspaceRef.id,
        name: workspaceName.trim(),
        ownerEmail: email,
        createdAt: Date.now(),
    });
    await workspaceRef.collection("users").doc(uid).set({
        workspaceId: workspaceRef.id,
        teamId: null,
        role: "admin",
        name: name ?? email,
        phone: "",
        fcmTokens: [],
        status: "active",
    });
    await mappingRef.set({ workspaceId: workspaceRef.id, uid, createdAt: Date.now() });
    await admin.auth().setCustomUserClaims(uid, { workspaceId: workspaceRef.id, role: "admin" });
    return { workspaceId: workspaceRef.id, role: "admin", isNewWorkspace: true };
});
// ---------------------------------------------------------------------------
// 1ter. Gestion des accÃ¨s â€” crÃ©ation, rÃ©gÃ©nÃ©ration mot de passe, activation,
// listing (section "Utilisateurs & AccÃ¨s"). Toutes rÃ©servÃ©es Ã  un admin de
// SON workspace (isolation multi-tenant vÃ©rifiÃ©e Ã  chaque appel).
// ---------------------------------------------------------------------------
function requireAdmin(request) {
    const workspaceId = request.auth?.token?.workspaceId;
    const role = request.auth?.token?.role;
    if (!workspaceId || role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "AccÃ¨s rÃ©servÃ© aux admins.");
    }
    return workspaceId;
}
function generateAccessLinkId() {
    return crypto.randomBytes(9).toString("base64url"); // ~12 caractÃ¨res, sÃ»r en URL
}
function generatePassword() {
    // Sans caractÃ¨res ambigus (I, O, 0, 1, L) â€” plus simple Ã  lire/taper Ã  l'oral
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return Array.from(crypto.randomBytes(8), (b) => chars[b % chars.length]).join("");
}
exports.createAccessUser = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { name, phone, role, teamId } = request.data;
    if (!name?.trim() || !teamId || (role !== "closeuse" && role !== "livreur")) {
        throw new https_1.HttpsError("invalid-argument", "Nom, rÃ´le (closeuse/livreur) et Ã©quipe requis.");
    }
    // VÃ©rifie que l'Ã©quipe appartient bien Ã  CE workspace â€” isolation multi-tenant
    const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(teamId).get();
    if (!teamSnap.exists) {
        throw new https_1.HttpsError("not-found", "Ã‰quipe introuvable.");
    }
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc();
    await userRef.set({
        workspaceId,
        teamId,
        role,
        name: name.trim(),
        phone: phone?.trim() ?? "",
        fcmTokens: [],
        status: "active",
        createdAt: Date.now(),
    });
    const accessLinkId = generateAccessLinkId();
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const linkRef = db.collection("workspaces").doc(workspaceId).collection("accessLinks").doc();
    await linkRef.set({
        id: accessLinkId,
        workspaceId,
        userId: userRef.id,
        disabledAt: null,
        activeSessions: [],
        createdAt: Date.now(),
    });
    // Le hash vit UNIQUEMENT ici â€” jamais dans accessLinks, jamais renvoyÃ©
    // ailleurs qu'Ã  cet instant prÃ©cis de crÃ©ation.
    await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinkSecrets")
        .doc(linkRef.id)
        .set({ passwordHash, failedAttempts: 0 });
    return {
        userId: userRef.id,
        accessLinkId,
        password, // affichÃ© une seule fois cÃ´tÃ© Admin â€” jamais re-consultable aprÃ¨s
    };
});
exports.regenerateAccessPassword = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { accessLinkId } = request.data;
    if (!accessLinkId) {
        throw new https_1.HttpsError("invalid-argument", "accessLinkId requis.");
    }
    const linkSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinks")
        .where("id", "==", accessLinkId)
        .limit(1)
        .get();
    if (linkSnap.empty) {
        throw new https_1.HttpsError("not-found", "Lien d'accÃ¨s introuvable.");
    }
    const linkDoc = linkSnap.docs[0];
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinkSecrets")
        .doc(linkDoc.id)
        .set({ passwordHash, failedAttempts: 0, lockedUntil: admin.firestore.FieldValue.delete() }, { merge: true });
    // Nouveau mot de passe = toutes les sessions dÃ©jÃ  connectÃ©es sont Ã©jectÃ©es
    await linkDoc.ref.update({ activeSessions: [] });
    return { password }; // affichÃ© une seule fois
});
exports.setAccessLinkStatus = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { accessLinkId, disabled } = request.data;
    if (!accessLinkId || typeof disabled !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", "accessLinkId et disabled requis.");
    }
    const linkSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinks")
        .where("id", "==", accessLinkId)
        .limit(1)
        .get();
    if (linkSnap.empty) {
        throw new https_1.HttpsError("not-found", "Lien d'accÃ¨s introuvable.");
    }
    const linkDoc = linkSnap.docs[0];
    await linkDoc.ref.update({
        disabledAt: disabled ? Date.now() : null,
        activeSessions: disabled ? [] : linkDoc.data().activeSessions ?? [],
    });
    // Désactivation : révoquer également les sessions Firebase existantes.
    if (disabled) {
        const linkData = linkDoc.data();
        try {
            await admin.auth().revokeRefreshTokens(linkData.userId);
        }
        catch (err) {
            console.error("Impossible de révoquer les sessions Firebase :", err);
        }
    }
    return { success: true };
});
exports.validateAccessSession = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Session Firebase absente.");
    }
    const workspaceId = request.auth.token.workspaceId;
    const userId = request.auth.uid;
    if (!workspaceId) {
        throw new https_1.HttpsError("permission-denied", "Workspace introuvable.");
    }
    const linkSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinks")
        .where("userId", "==", userId)
        .limit(1)
        .get();
    if (linkSnap.empty) {
        throw new https_1.HttpsError("permission-denied", "Accès introuvable.");
    }
    const link = linkSnap.docs[0].data();
    if (link.disabledAt) {
        await admin.auth().revokeRefreshTokens(userId);
        throw new https_1.HttpsError("permission-denied", "Ton accès a été désactivé par l'administrateur.");
    }
    const userSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .doc(userId)
        .get();
    const user = userSnap.data();
    if (!user || user.status !== "active") {
        await admin.auth().revokeRefreshTokens(userId);
        throw new https_1.HttpsError("permission-denied", "Ton compte a été désactivé.");
    }
    return { valid: true };
});
exports.listAccessLinks = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { teamId } = request.data;
    if (!teamId) {
        throw new https_1.HttpsError("invalid-argument", "teamId requis.");
    }
    const usersSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .where("teamId", "==", teamId)
        .get();
    const userIds = usersSnap.docs.map((d) => d.id);
    if (userIds.length === 0)
        return { links: [] };
    // Limite Firestore : "in" accepte 30 valeurs max â€” largement suffisant
    // pour une Ã©quipe (maxClosseuses/maxLivreurs = 10 chacun par dÃ©faut)
    const linksSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinks")
        .where("userId", "in", userIds.slice(0, 30))
        .get();
    const links = linksSnap.docs.map((d) => {
        const l = d.data();
        return {
            userId: l.userId,
            accessLinkId: l.id,
            disabledAt: l.disabledAt ?? null,
            sessionsCount: (l.activeSessions ?? []).length,
        };
    });
    return { links };
});
// ---------------------------------------------------------------------------
// 2. Assignation automatique Ã  la crÃ©ation d'une commande (section 8)
// ---------------------------------------------------------------------------
exports.onOrderCreated = (0, firestore_1.onDocumentCreated)("workspaces/{workspaceId}/orders/{orderId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const order = snap.data();
    const { workspaceId } = event.params;
    const closeusesSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .where("teamId", "==", order.teamId)
        .where("role", "==", "closeuse")
        .where("status", "==", "active")
        .get();
    if (closeusesSnap.empty)
        return; // aucune closeuse active, laissÃ©e non assignÃ©e
    // Charge active de chaque closeuse
    const loads = await Promise.all(closeusesSnap.docs.map(async (userDoc) => {
        const activeSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("closeuseId", "==", userDoc.id)
            .where("statutCloseuse", "in", ["nouveau", "programme", "en_cours"])
            .get();
        return { id: userDoc.id, data: userDoc.data(), count: activeSnap.size };
    }));
    const chosen = loads.reduce((lowest, current) => (current.count < lowest.count ? current : lowest));
    await snap.ref.update({
        closeuseId: chosen.id,
        "timestamps.assignedToCloseuse": Date.now(),
    });
    await sendPushToUser(workspaceId, chosen.id, "Nouvelle commande", `${order.clientName} â€” ${order.product}`);
    // Alerte admin si surcharge, sans jamais bloquer l'assignation (section 8)
    const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(order.teamId).get();
    const threshold = teamSnap.data()?.overloadAlertThreshold ?? 20;
    if (chosen.count + 1 >= threshold) {
        await notifyAdmins(workspaceId, "Closeuse surchargÃ©e", `${chosen.data.name} a ${chosen.count + 1} commandes actives.`);
    }
});
// ---------------------------------------------------------------------------
// 3. Propagation de statut livreur â†’ closeuse + rÃ©munÃ©ration (sections 6, 15)
// ---------------------------------------------------------------------------
exports.onOrderUpdated = (0, firestore_1.onDocumentUpdated)("workspaces/{workspaceId}/orders/{orderId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const { workspaceId, orderId } = event.params;
    const ref = db.collection("workspaces").doc(workspaceId).collection("orders").doc(orderId);
    const statutLivreurChanged = before.statutLivreur !== after.statutLivreur;
    const statutCloseuseChanged = before.statutCloseuse !== after.statutCloseuse;
    // Horodatage de rÃ©activitÃ© rÃ©elle â€” base du module "Performance
    // employÃ©s" (dÃ©lai de traitement par closeuse, dÃ©lai de rÃ©action par
    // livreur). PosÃ© une seule fois, Ã  la premiÃ¨re sortie de l'Ã©tat initial.
    if (statutCloseuseChanged && before.statutCloseuse === "nouveau" && !after.timestamps?.closeuseDecidedAt) {
        await ref.update({ "timestamps.closeuseDecidedAt": Date.now() });
    }
    if (statutLivreurChanged && before.statutLivreur === "recu" && !after.timestamps?.livreurRespondedAt) {
        await ref.update({ "timestamps.livreurRespondedAt": Date.now() });
    }
    if (statutLivreurChanged && after.statutLivreur === "en_route") {
        if (after.closeuseId) {
            await sendPushToUser(workspaceId, after.closeuseId, "Livraison en route", `${after.clientName} â€” en cours de livraison`);
        }
    }
    if (statutLivreurChanged && after.statutLivreur === "livre") {
        const purgeAt = Date.now() + ORDER_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000;
        await ref.update({
            statutCloseuse: "livre", // visibilitÃ© instantanÃ©e chez la closeuse, section 6
            "timestamps.delivered": Date.now(),
            purgeAt,
        });
        const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(after.teamId).get();
        const team = teamSnap.data();
        await Promise.all([
            after.closeuseId
                ? incrementRemuneration(workspaceId, after.closeuseId, "closeuse", team?.remunerationCloseusePerOrder ?? 0, after.amount)
                : Promise.resolve(),
            after.livreurId
                ? incrementRemuneration(workspaceId, after.livreurId, "livreur", team?.remunerationLivreurPerOrder ?? 0, after.amount)
                : Promise.resolve(),
        ]);
        if (after.closeuseId) {
            await sendPushToUser(workspaceId, after.closeuseId, "Commande livrÃ©e", `${after.clientName} â€” confirmÃ© livrÃ©`);
        }
    }
    if (statutLivreurChanged && after.statutLivreur === "injoignable") {
        // Remonte immÃ©diatement dans le flux principal de la closeuse â€” pas
        // cachÃ© dans le menu secondaire (demande explicite, section 6)
        await ref.update({ statutCloseuse: "injoignable" });
        if (after.closeuseId) {
            await sendPushToUser(workspaceId, after.closeuseId, "Client injoignable", `${after.clientName} â€” le livreur n'a pas pu joindre le client`);
        }
    }
    // Purge programmÃ©e si la closeuse clÃ´ture elle-mÃªme une commande sans
    // passage par le livreur (rejetÃ© / injoignable direct)
    if (statutCloseuseChanged && FINAL_STATUSES.includes(after.statutCloseuse) && !after.purgeAt) {
        await ref.update({ purgeAt: Date.now() + ORDER_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000 });
    }
});
async function incrementRemuneration(workspaceId, userId, role, amountPerOrder, orderAmount) {
    const ref = db.collection("workspaces").doc(workspaceId).collection("remunerations").doc(userId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists ? snap.data() : { totalOrders: 0, totalAmount: 0 };
        tx.set(ref, {
            userId,
            workspaceId,
            role,
            totalOrders: (current.totalOrders ?? 0) + 1,
            totalAmount: (current.totalAmount ?? 0) + amountPerOrder,
            updatedAt: Date.now(),
        }, { merge: true });
    });
}
// ---------------------------------------------------------------------------
// 4. Purge automatique des commandes traitÃ©es (section 15/16)
// ---------------------------------------------------------------------------
exports.scheduledPurge = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const now = Date.now();
    const workspacesSnap = await db.collection("workspaces").get();
    for (const wsDoc of workspacesSnap.docs) {
        const toPurge = await wsDoc.ref.collection("orders").where("purgeAt", "<=", now).get();
        const batch = db.batch();
        toPurge.docs.forEach((d) => batch.delete(d.ref));
        if (!toPurge.empty)
            await batch.commit();
    }
});
// ---------------------------------------------------------------------------
// 5. Rappels automatiques 15-20 min sans action sur "Nouveau" (section 6)
// ---------------------------------------------------------------------------
exports.scheduledReminders = (0, scheduler_1.onSchedule)("every 5 minutes", async () => {
    const cutoff = Date.now() - REMINDER_DELAY_MINUTES * 60 * 1000;
    const workspacesSnap = await db.collection("workspaces").get();
    for (const wsDoc of workspacesSnap.docs) {
        const staleOrders = await wsDoc.ref
            .collection("orders")
            .where("statutCloseuse", "==", "nouveau")
            .where("timestamps.received", "<=", cutoff)
            .get();
        const byCloseuse = new Map();
        staleOrders.docs.forEach((d) => {
            const closeuseId = d.data().closeuseId;
            if (closeuseId)
                byCloseuse.set(closeuseId, (byCloseuse.get(closeuseId) ?? 0) + 1);
        });
        for (const [closeuseId, count] of byCloseuse) {
            await sendPushToUser(wsDoc.id, closeuseId, "Rappel", `${count} commande(s) en attente depuis plus de ${REMINDER_DELAY_MINUTES} min`);
        }
        // Alerte agrÃ©gÃ©e pour l'admin â€” surveillance des retards par Ã©quipe,
        // demandÃ©e explicitement pour suivre l'efficacitÃ© des employÃ©s.
        // Anti-spam : au plus une alerte toutes les ~25 min tant que le retard
        // persiste (sinon une notif identique toutes les 5 min, illisible).
        if (byCloseuse.size > 0) {
            const recentAlert = await wsDoc.ref
                .collection("notifications")
                .where("title", "==", "Commandes en retard")
                .where("createdAt", ">=", Date.now() - 25 * 60 * 1000)
                .limit(1)
                .get();
            if (recentAlert.empty) {
                const totalStale = [...byCloseuse.values()].reduce((a, b) => a + b, 0);
                await notifyAdmins(wsDoc.id, "Commandes en retard", `${totalStale} commande(s) en attente depuis plus de ${REMINDER_DELAY_MINUTES} min, chez ${byCloseuse.size} closeuse(s)`);
            }
        }
    }
});
// ---------------------------------------------------------------------------
// 6. RÃ©sumÃ© pÃ©riodique admin (section 5.1)
// ---------------------------------------------------------------------------
exports.scheduledDigest = (0, scheduler_1.onSchedule)("every 30 minutes", async () => {
    const now = Date.now();
    const workspacesSnap = await db.collection("workspaces").get();
    for (const wsDoc of workspacesSnap.docs) {
        const teamsSnap = await wsDoc.ref.collection("teams").get();
        for (const teamDoc of teamsSnap.docs) {
            const team = teamDoc.data();
            const intervalMs = (team.digestIntervalMinutes ?? 120) * 60 * 1000;
            const lastDigestAt = team.lastDigestAt ?? 0;
            if (now - lastDigestAt < intervalMs)
                continue;
            const since = lastDigestAt || now - intervalMs;
            const ordersSnap = await wsDoc.ref
                .collection("orders")
                .where("teamId", "==", teamDoc.id)
                .where("timestamps.received", ">=", since)
                .get();
            let livrees = 0, rejetees = 0, injoignables = 0, ca = 0;
            ordersSnap.docs.forEach((d) => {
                const o = d.data();
                if (o.statutCloseuse === "livre") {
                    livrees++;
                    ca += o.amount ?? 0;
                }
                if (o.statutCloseuse === "rejete")
                    rejetees++;
                if (o.statutCloseuse === "injoignable")
                    injoignables++;
            });
            await notifyAdmins(wsDoc.id, `RÃ©sumÃ© â€” ${team.name}`, `${livrees} livrÃ©es, ${rejetees} rejetÃ©es, ${injoignables} injoignables â€” ${ca} F`);
            await teamDoc.ref.update({ lastDigestAt: now });
        }
    }
});
// ---------------------------------------------------------------------------
// Utilitaires de notification (section 3.2)
// ---------------------------------------------------------------------------
async function sendPushToUser(workspaceId, userId, title, body) {
    const userSnap = await db.collection("workspaces").doc(workspaceId).collection("users").doc(userId).get();
    const tokens = userSnap.data()?.fcmTokens ?? [];
    if (tokens.length === 0)
        return;
    await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
    });
}
async function notifyAdmins(workspaceId, title, body) {
    // PersistÃ© en Firestore (pas juste push FCM) pour que la cloche de
    // l'app Admin ait un vrai historique consultable, mÃªme aprÃ¨s coup â€”
    // demande explicite : "des rappels notifs pour moi".
    await db.collection("workspaces").doc(workspaceId).collection("notifications").add({
        title,
        body,
        read: false,
        createdAt: Date.now(),
    });
    const adminsSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .where("role", "==", "admin")
        .where("status", "==", "active")
        .get();
    await Promise.all(adminsSnap.docs.map((adminDoc) => {
        const tokens = adminDoc.data().fcmTokens ?? [];
        if (tokens.length === 0)
            return Promise.resolve();
        return messaging.sendEachForMulticast({ tokens, notification: { title, body } });
    }));
}
