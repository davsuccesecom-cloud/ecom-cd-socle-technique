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
exports.scheduledDigest = exports.scheduledReminders = exports.scheduledPurge = exports.onOrderUpdated = exports.onOrderCreated = exports.receiveSheetOrder = exports.deleteEmployee = exports.listAccessLinks = exports.validateAccessSession = exports.setAccessLinkStatus = exports.regenerateAccessPassword = exports.createAccessUser = exports.authenticateAdmin = exports.authenticateAccess = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const bcrypt = __importStar(require("bcryptjs"));
const libphonenumber_js_1 = require("libphonenumber-js");
const sheetsSync_1 = require("./sheetsSync");
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const MAX_SESSIONS_PER_ACCESS_LINK = 2;
const ORDER_PURGE_AFTER_DAYS = 3;
const REMINDER_DELAY_MINUTES = 20;
const FINAL_STATUSES = ["livre", "rejete", "injoignable"];
const sheetWebhookSecret = (0, params_1.defineSecret)("SHEET_WEBHOOK_SECRET");
const sheetsServiceAccountKey = (0, params_1.defineSecret)("GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY");
// ---------------------------------------------------------------------------
// 1. Authentification par lien d'accès + mot de passe simple (section 10)
// ---------------------------------------------------------------------------
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
exports.authenticateAccess = (0, https_1.onCall)(async (request) => {
    const { accessLinkId, password } = request.data;
    if (!accessLinkId || !password) {
        throw new https_1.HttpsError("invalid-argument", "Lien d'accès et mot de passe requis.");
    }
    const linkSnap = await db.collectionGroup("accessLinks").where("id", "==", accessLinkId).limit(1).get();
    if (linkSnap.empty) {
        throw new https_1.HttpsError("not-found", "Lien d'accès invalide.");
    }
    const linkDoc = linkSnap.docs[0];
    const link = linkDoc.data();
    if (link.disabledAt) {
        throw new https_1.HttpsError("permission-denied", "Cet accès a été désactivé.");
    }
    const secretRef = db
        .collection("workspaces")
        .doc(link.workspaceId)
        .collection("accessLinkSecrets")
        .doc(linkDoc.id);
    const secretSnap = await secretRef.get();
    if (!secretSnap.exists) {
        throw new https_1.HttpsError("not-found", "Lien d'accès invalide.");
    }
    const secret = secretSnap.data();
    const now = Date.now();
    if (secret.lockedUntil && secret.lockedUntil > now) {
        const minutesLeft = Math.ceil((secret.lockedUntil - now) / 60000);
        throw new https_1.HttpsError("resource-exhausted", `Trop de tentatives. Réessaie dans ${minutesLeft} min.`);
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
        throw new https_1.HttpsError("permission-denied", "Compte désactivé.");
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
    await notifyAdmins(link.workspaceId, "Nouvelle connexion", `${user.name} s'est connecté(e) depuis un nouvel appareil.`);
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
// 1bis. Authentification admin — système multi-entreprises (SaaS)
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
    if (mappingSnap.exists) {
        const { workspaceId } = mappingSnap.data();
        await admin.auth().setCustomUserClaims(uid, { workspaceId, role: "admin" });
        return { workspaceId, role: "admin", isNewWorkspace: false };
    }
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
// 1ter. Gestion des accès
// ---------------------------------------------------------------------------
function requireAdmin(request) {
    const workspaceId = request.auth?.token?.workspaceId;
    const role = request.auth?.token?.role;
    if (!workspaceId || role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Accès réservé aux admins.");
    }
    return workspaceId;
}
function generateAccessLinkId() {
    return crypto.randomBytes(9).toString("base64url");
}
function generatePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    return Array.from(crypto.randomBytes(8), (b) => chars[b % chars.length]).join("");
}
exports.createAccessUser = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { name, phone, role, teamId } = request.data;
    if (!name?.trim() || !teamId || (role !== "closeuse" && role !== "livreur")) {
        throw new https_1.HttpsError("invalid-argument", "Nom, rôle (closeuse/livreur) et équipe requis.");
    }
    const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(teamId).get();
    if (!teamSnap.exists) {
        throw new https_1.HttpsError("not-found", "Équipe introuvable.");
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
    await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinkSecrets")
        .doc(linkRef.id)
        .set({ passwordHash, failedAttempts: 0 });
    return {
        userId: userRef.id,
        accessLinkId,
        password,
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
        throw new https_1.HttpsError("not-found", "Lien d'accès introuvable.");
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
    await linkDoc.ref.update({ activeSessions: [] });
    return { password };
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
        throw new https_1.HttpsError("not-found", "Lien d'accès introuvable.");
    }
    const linkDoc = linkSnap.docs[0];
    await linkDoc.ref.update({
        disabledAt: disabled ? Date.now() : null,
        activeSessions: disabled ? [] : linkDoc.data().activeSessions ?? [],
    });
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
// Vérification stricte de révocation : `request.auth` (fourni automatiquement
// par le framework Callable) vérifie seulement la SIGNATURE du token, pas
// s'il a été révoqué entre-temps — un token déjà émis reste valide jusqu'à
// ~1h après un revokeRefreshTokens() si on ne fait que ça. On extrait donc
// le token brut depuis l'en-tête Authorization et on le revérifie nous-mêmes
// avec `checkRevoked = true`, seule façon de forcer un rejet immédiat.
exports.validateAccessSession = (0, https_1.onCall)(async (request) => {
    const authHeader = request.rawRequest.headers.authorization;
    const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!request.auth || !rawToken) {
        throw new https_1.HttpsError("unauthenticated", "Session Firebase absente.");
    }
    let decoded;
    try {
        decoded = await admin.auth().verifyIdToken(rawToken, true); // checkRevoked = true
    }
    catch (err) {
        const code = err.code;
        if (code === "auth/id-token-revoked") {
            throw new https_1.HttpsError("permission-denied", "Session révoquée.");
        }
        throw new https_1.HttpsError("unauthenticated", "Session invalide.");
    }
    const workspaceId = decoded.workspaceId;
    const userId = decoded.uid;
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
    const userSnap = await db.collection("workspaces").doc(workspaceId).collection("users").doc(userId).get();
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
// Suppression définitive d'un employé — uniquement possible APRÈS révocation
// de son accès (disabledAt non null), pour garder une trace/contrôle avant
// toute suppression irréversible. Supprime l'utilisateur, son lien d'accès
// et son secret associé.
exports.deleteEmployee = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { userId } = request.data;
    if (!userId) {
        throw new https_1.HttpsError("invalid-argument", "userId requis.");
    }
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "Employé introuvable.");
    }
    const linkSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("accessLinks")
        .where("userId", "==", userId)
        .limit(1)
        .get();
    if (!linkSnap.empty) {
        const link = linkSnap.docs[0];
        if (!link.data().disabledAt) {
            throw new https_1.HttpsError("failed-precondition", "Révoque l'accès de cet employé avant de le supprimer.");
        }
        await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("accessLinkSecrets")
            .doc(link.id)
            .delete();
        await link.ref.delete();
    }
    try {
        await admin.auth().deleteUser(userId);
    }
    catch (err) {
        // Compte Firebase Auth déjà absent/déjà supprimé — pas bloquant
        console.warn("Suppression Firebase Auth ignorée :", err);
    }
    await userRef.delete();
    return { success: true };
});
exports.receiveSheetOrder = (0, https_1.onRequest)({ secrets: [sheetWebhookSecret] }, async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).send("Method not allowed");
            return;
        }
        const providedSecret = req.headers["x-webhook-secret"];
        if (providedSecret !== sheetWebhookSecret.value()) {
            console.error("receiveSheetOrder: secret invalide recu.");
            res.status(401).send("Unauthorized");
            return;
        }
        const body = req.body;
        console.log("receiveSheetOrder: payload recu:", JSON.stringify(body));
        if (!body.sheetId || !body.rowNumber || !body.clientName || !body.phone) {
            console.error("receiveSheetOrder: champs manquants.", JSON.stringify(body));
            res.status(400).send("Champs requis manquants.");
            return;
        }
        // Identifiant unique stable : priorite a orderUid (genere par le Sheet
        // et fige a la creation de la ligne), sinon repli sur le numero de
        // ligne (ancien comportement, recycle si des lignes sont dupliquees
        // ou supprimees dans le Sheet).
        const uniqueSourceId = body.orderUid && String(body.orderUid).trim() !== ""
            ? `uid:${String(body.orderUid).trim()}`
            : `row:${String(body.rowNumber)}`;
        const teamsSnap = await db
            .collectionGroup("teams")
            .where("sheetIds", "array-contains", body.sheetId)
            .limit(1)
            .get();
        if (teamsSnap.empty) {
            console.error(`receiveSheetOrder: aucune equipe trouvee pour sheetId=${body.sheetId}`);
            res.status(404).send("Aucune equipe connectee a ce Sheet.");
            return;
        }
        const teamDoc = teamsSnap.docs[0];
        const team = teamDoc.data();
        const workspaceId = team.workspaceId;
        const teamId = teamDoc.id;
        console.log(`receiveSheetOrder: equipe trouvee, workspaceId=${workspaceId}, teamId=${teamId}`);
        const existingSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("sheetId", "==", body.sheetId)
            .where("sourceRowId", "==", uniqueSourceId)
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            console.log(`receiveSheetOrder: commande deja existante (sourceRowId=${uniqueSourceId}), skip.`);
            res.status(200).send({ skipped: true, reason: "already exists" });
            return;
        }
        const phoneParsed = (0, libphonenumber_js_1.parsePhoneNumberFromString)(body.phone, team.defaultCountry);
        const clientPhoneFormatted = phoneParsed?.formatInternational() ?? body.phone;
        const orderRef = db.collection("workspaces").doc(workspaceId).collection("orders").doc();
        await orderRef.set({
            workspaceId,
            teamId,
            sheetId: body.sheetId,
            sourceRowId: uniqueSourceId,
            clientName: body.clientName,
            clientPhoneRaw: body.phone,
            clientPhoneFormatted,
            product: body.product,
            amount: body.totalPrice,
            closeuseId: null,
            livreurId: null,
            statutCloseuse: "nouveau",
            statutLivreur: null,
            statutAdminOverride: null,
            callInProgress: null,
            timestamps: {
                received: Date.now(),
                assignedToCloseuse: null,
                assignedToLivreur: null,
                closeuseDecidedAt: null,
                livreurRespondedAt: null,
                delivered: null,
            },
            capiSent: false,
            purgeAt: null,
        });
        console.log(`receiveSheetOrder: commande creee avec succes, orderId=${orderRef.id}`);
        res.status(200).send({ success: true, orderId: orderRef.id });
    }
    catch (err) {
        console.error("receiveSheetOrder: erreur inattendue:", err);
        res.status(500).send("Erreur interne.");
    }
});
// ---------------------------------------------------------------------------
// 2. Assignation automatique à la création d'une commande (section 8)
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
        return;
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
    await sendPushToUser(workspaceId, chosen.id, "Nouvelle commande", `${order.clientName} — ${order.product}`);
    const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(order.teamId).get();
    const threshold = teamSnap.data()?.overloadAlertThreshold ?? 20;
    if (chosen.count + 1 >= threshold) {
        await notifyAdmins(workspaceId, "Closeuse surchargée", `${chosen.data.name} a ${chosen.count + 1} commandes actives.`);
    }
});
// ---------------------------------------------------------------------------
// 3. Propagation de statut livreur → closeuse + rémunération + sync Sheet
// ---------------------------------------------------------------------------
exports.onOrderUpdated = (0, firestore_1.onDocumentUpdated)({ document: "workspaces/{workspaceId}/orders/{orderId}", secrets: [sheetsServiceAccountKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const { workspaceId, orderId } = event.params;
    const ref = db.collection("workspaces").doc(workspaceId).collection("orders").doc(orderId);
    const statutLivreurChanged = before.statutLivreur !== after.statutLivreur;
    const statutCloseuseChanged = before.statutCloseuse !== after.statutCloseuse;
    const livreurAssigned = !before.livreurId && !!after.livreurId;
    if (livreurAssigned) {
        await sendPushToUser(workspaceId, after.livreurId, "Nouvelle livraison", `${after.clientName} — ${after.product}`);
    }
    if (statutCloseuseChanged && before.statutCloseuse === "nouveau" && !after.timestamps?.closeuseDecidedAt) {
        await ref.update({ "timestamps.closeuseDecidedAt": Date.now() });
    }
    if (statutLivreurChanged && before.statutLivreur === "recu" && !after.timestamps?.livreurRespondedAt) {
        await ref.update({ "timestamps.livreurRespondedAt": Date.now() });
    }
    if (statutLivreurChanged && after.statutLivreur === "en_route") {
        if (after.closeuseId) {
            await sendPushToUser(workspaceId, after.closeuseId, "Livraison en route", `${after.clientName} — en cours de livraison`);
        }
    }
    if (statutLivreurChanged && after.statutLivreur === "livre") {
        const purgeAt = Date.now() + ORDER_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000;
        await ref.update({
            statutCloseuse: "livre",
            "timestamps.delivered": Date.now(),
            purgeAt,
        });
        // Sync directe vers le Sheet — ne dépend pas d'un second passage de
        // la fonction (avant, on comptait sur before/after de l'événement,
        // qui ne reflète pas cette écriture faite DANS cette même exécution ;
        // corrige le bug "Livré ne remonte pas sur le Sheet").
        if (after.sheetId && after.sourceRowId) {
            await (0, sheetsSync_1.writeOrderStatusToSheet)(after.sheetId, after.sourceRowId, "livre");
        }
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
            await sendPushToUser(workspaceId, after.closeuseId, "Commande livrée", `${after.clientName} — confirmé livré`);
        }
    }
    if (statutLivreurChanged && after.statutLivreur === "injoignable") {
        await ref.update({ statutCloseuse: "injoignable" });
        // Même correctif que ci-dessus, pour ce cas aussi.
        if (after.sheetId && after.sourceRowId) {
            await (0, sheetsSync_1.writeOrderStatusToSheet)(after.sheetId, after.sourceRowId, "injoignable");
        }
        if (after.closeuseId) {
            await sendPushToUser(workspaceId, after.closeuseId, "Client injoignable", `${after.clientName} — le livreur n'a pas pu joindre le client`);
        }
    }
    if (statutCloseuseChanged && FINAL_STATUSES.includes(after.statutCloseuse) && !after.purgeAt) {
        await ref.update({ purgeAt: Date.now() + ORDER_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000 });
    }
    // Sync retour Firestore → Sheet pour tous les AUTRES changements de
    // statutCloseuse (ceux décidés directement par la closeuse : en_cours,
    // programme, rejete, indisponible — pas ceux forcés par le livreur,
    // déjà gérés explicitement ci-dessus).
    if (statutCloseuseChanged &&
        after.statutCloseuse !== "livre" &&
        after.statutCloseuse !== "injoignable" &&
        after.sheetId &&
        after.sourceRowId) {
        await (0, sheetsSync_1.writeOrderStatusToSheet)(after.sheetId, after.sourceRowId, after.statutCloseuse);
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
// 4. Purge automatique des commandes traitées (section 15/16)
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
// 6. Résumé périodique admin (section 5.1)
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
            await notifyAdmins(wsDoc.id, `Résumé — ${team.name}`, `${livrees} livrées, ${rejetees} rejetées, ${injoignables} injoignables — ${ca} F`);
            await teamDoc.ref.update({ lastDigestAt: now });
        }
    }
});
// ---------------------------------------------------------------------------
// Utilitaires de notification (section 3.2)
// ---------------------------------------------------------------------------
async function sendPushToUser(workspaceId, userId, title, body) {
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
    const userSnap = await userRef.get();
    const tokens = userSnap.data()?.fcmTokens ?? [];
    if (tokens.length === 0) {
        console.log(`sendPushToUser: aucun token pour user ${userId}`);
        return;
    }
    await db.collection("workspaces").doc(workspaceId).collection("notifications").add({
        userId,
        title,
        body,
        read: false,
        createdAt: Date.now(),
    });
    const response = await messaging.sendEachForMulticast({
        tokens,
        data: { title, body },
    });
    console.log(`sendPushToUser: ${response.successCount} succes, ${response.failureCount} echecs pour user ${userId}`);
    const invalidTokens = [];
    response.responses.forEach((r, i) => {
        if (!r.success) {
            const code = r.error?.code;
            console.error(`Token invalide/echec [${i}] pour user ${userId}:`, r.error?.message);
            if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
                invalidTokens.push(tokens[i]);
            }
        }
    });
    if (invalidTokens.length > 0) {
        await userRef.update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        });
        console.log(`sendPushToUser: ${invalidTokens.length} token(s) invalide(s) supprime(s) pour user ${userId}`);
    }
}
async function notifyAdmins(workspaceId, title, body) {
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
        return messaging.sendEachForMulticast({ tokens, data: { title, body } });
    }));
}
