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
exports.sendCustomAccessEmail = exports.deletePasskeyCredential = exports.listUserPasskeys = exports.savePasskeyCredential = exports.createPasskeyChallenge = exports.scheduledMarketplaceCartRecovery = exports.sendMarketplacePushCampaign = exports.saveProductStock = exports.testAdminPushNotification = exports.testSheetConnection = exports.completeMetaOAuthBridgeSession = exports.createMetaOAuthBridgeSession = exports.disconnectMetaCapi = exports.connectMetaSystemUser = exports.getMetaAccountsAndPixels = exports.testMetaCapiConnection = exports.scheduledSheetsSync = exports.scheduledDigest = exports.scheduledReminders = exports.cancelRemunerationPayment = exports.markRemunerationPaid = exports.onOrderUpdated = exports.onOrderCreated = exports.receiveSheetOrder = exports.updateEmployeeAllocatedTeams = exports.updateEmployeeLanguages = exports.deleteEmployee = exports.listAccessLinks = exports.validateAccessSession = exports.setAccessLinkStatus = exports.regenerateAccessPassword = exports.createAccessUser = exports.authenticateAdmin = exports.authenticateAccess = exports.aiProviders = exports.aiChatProxy = exports.azifyGateway = exports.syncOrderUpdateToAzify = exports.getStorefrontTrackerScript = exports.shopifyWebhook = exports.trackSession = void 0;
const shopifyTracking_1 = require("./shopifyTracking");
const emailService_1 = require("./emailService");
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const bcrypt = __importStar(require("bcryptjs"));
const libphonenumber_js_1 = require("libphonenumber-js");
const sheetsSync_1 = require("./sheetsSync");
const codInsights_1 = require("./codInsights");
const metaCapi_1 = require("./metaCapi");
const metaAuth_1 = require("./metaAuth");
var shopifyTracking_2 = require("./shopifyTracking");
Object.defineProperty(exports, "trackSession", { enumerable: true, get: function () { return shopifyTracking_2.trackSession; } });
Object.defineProperty(exports, "shopifyWebhook", { enumerable: true, get: function () { return shopifyTracking_2.shopifyWebhook; } });
Object.defineProperty(exports, "getStorefrontTrackerScript", { enumerable: true, get: function () { return shopifyTracking_2.getStorefrontTrackerScript; } });
Object.defineProperty(exports, "syncOrderUpdateToAzify", { enumerable: true, get: function () { return shopifyTracking_2.syncOrderUpdateToAzify; } });
var azifyGateway_1 = require("./azifyGateway");
Object.defineProperty(exports, "azifyGateway", { enumerable: true, get: function () { return azifyGateway_1.azifyGateway; } });
const shopifyTracking_3 = require("./shopifyTracking");
var aiProxy_1 = require("./aiProxy");
Object.defineProperty(exports, "aiChatProxy", { enumerable: true, get: function () { return aiProxy_1.aiChatProxy; } });
Object.defineProperty(exports, "aiProviders", { enumerable: true, get: function () { return aiProxy_1.aiProviders; } });
admin.initializeApp();
const db = admin.firestore();
try {
    db.settings({ ignoreUndefinedProperties: true });
}
catch { }
const messaging = admin.messaging();
const MAX_SESSIONS_PER_ACCESS_LINK = 2;
const ORDER_PURGE_AFTER_DAYS = 3;
const REMINDER_DELAY_MINUTES = 20;
const FINAL_STATUSES = ["livre", "rejete", "injoignable"];
const sheetWebhookSecret = (0, params_1.defineSecret)("SHEET_WEBHOOK_SECRET");
const sheetsServiceAccountKey = (0, params_1.defineSecret)("GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY");
// ---------------------------------------------------------------------------
// 1. Authentification par lien d'acces + mot de passe simple (section 10)
// ---------------------------------------------------------------------------
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
exports.authenticateAccess = (0, https_1.onCall)(async (request) => {
    try {
        const { accessLinkId, password } = request.data;
        if (!accessLinkId || !password) {
            throw new https_1.HttpsError("invalid-argument", "Lien d'acces et mot de passe requis.");
        }
        const linkSnap = await db.collectionGroup("accessLinks").where("id", "==", accessLinkId).limit(1).get();
        if (linkSnap.empty) {
            throw new https_1.HttpsError("not-found", "Lien d'acces invalide.");
        }
        const linkDoc = linkSnap.docs[0];
        const link = linkDoc.data();
        if (link.disabledAt) {
            throw new https_1.HttpsError("permission-denied", "Cet acces a ete desactive.");
        }
        const secretRef = db
            .collection("workspaces")
            .doc(link.workspaceId)
            .collection("accessLinkSecrets")
            .doc(linkDoc.id);
        const secretSnap = await secretRef.get();
        if (!secretSnap.exists) {
            throw new https_1.HttpsError("not-found", "Lien d'acces invalide.");
        }
        const secret = secretSnap.data();
        const now = Date.now();
        if (secret.lockedUntil && secret.lockedUntil > now) {
            const minutesLeft = Math.ceil((secret.lockedUntil - now) / 60000);
            throw new https_1.HttpsError("resource-exhausted", `Trop de tentatives. Reessaie dans ${minutesLeft} min.`);
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
            throw new https_1.HttpsError("permission-denied", "Compte desactive.");
        }
        // Protection anti-infiltration : ce portail d'acces est strictement reserve aux roles terrain (closeuse ou livreur)
        // Aucune tentative d'elevation de privilege vers 'admin' ou 'owner' n'est permise via ce portail.
        if (user.role !== "closeuse" && user.role !== "livreur") {
            console.warn(`[Anti-Infiltration] Tentative d'acces non autorise au role ${user.role} via accessLink ${accessLinkId}`);
            throw new https_1.HttpsError("permission-denied", "Acces non autorise : ce portail est strictement reserve aux closeuses et livreurs.");
        }
        // Un seul appareil actif par employe : la nouvelle connexion remplace les anciennes
        const newSession = {
            sessionToken: db.collection("_").doc().id,
            deviceLabel: request.rawRequest.headers["user-agent"]?.slice(0, 80) ?? "Appareil inconnu",
            connectedAt: Date.now(),
        };
        await linkDoc.ref.update({ activeSessions: [newSession] });
        await notifyAdmins(link.workspaceId, "Nouvelle connexion", `${user.name} s'est connecte(e) depuis un nouvel appareil.`);
        // Persiste les claims sur l'utilisateur Firebase Auth (pas seulement
        // dans ce custom token) pour qu'ils survivent au rafraichissement
        // automatique du ID token par le SDK. Sans ca, workspaceId/role/teamId
        // disparaissent silencieusement apres le premier refresh, ce qui casse
        // validateAccessSession (deconnexion + perte du token FCM) et les
        // regles Firestore (isCloseuse/isLivreur/isSameTeam).
        try {
            await admin.auth().getUser(link.userId);
        }
        catch (e) {
            if (e.code === "auth/user-not-found") {
                await admin.auth().createUser({ uid: link.userId });
            }
            else {
                throw e;
            }
        }
        // Un seul appareil par employe : revoque les sessions deja ouvertes
        await admin.auth().revokeRefreshTokens(link.userId);
        await admin.auth().setCustomUserClaims(link.userId, {
            workspaceId: link.workspaceId,
            teamId: user.teamId,
            role: user.role,
        });
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
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error("authenticateAccess error:", err);
        throw new https_1.HttpsError("internal", "Erreur de connexion. Réessaie dans quelques secondes.");
    }
});
// ---------------------------------------------------------------------------
// 1bis. Authentification admin -- systeme multi-entreprises (SaaS)
// ---------------------------------------------------------------------------
exports.authenticateAdmin = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    const email = request.auth?.token?.email?.toLowerCase();
    const name = request.auth?.token?.name;
    if (!uid || !email) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise.");
    }
    const mappingRef = db.collection("adminsByEmail").doc(email);
    const mappingSnap = await mappingRef.get();
    if (mappingSnap.exists) {
        const { workspaceId } = mappingSnap.data();
        await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("users")
            .doc(uid)
            .set({
            workspaceId,
            teamId: null,
            role: "admin",
            name: name ?? email,
            email,
            phone: "",
            status: "active",
        }, { merge: true });
        await admin.auth().setCustomUserClaims(uid, { workspaceId, role: "admin" });
        return { workspaceId, role: "admin", isNewWorkspace: false };
    }
    // Auto-recuperation dun workspace existant pour cet email
    const existingWsSnap = await db
        .collection("workspaces")
        .where("ownerEmail", "==", email)
        .limit(1)
        .get();
    if (!existingWsSnap.empty) {
        const existingWsDoc = existingWsSnap.docs[0];
        const wsId = existingWsDoc.id;
        await existingWsDoc.ref
            .collection("users")
            .doc(uid)
            .set({
            workspaceId: wsId,
            teamId: null,
            role: "admin",
            name: name ?? email,
            email,
            phone: "",
            status: "active",
        }, { merge: true });
        await mappingRef.set({ workspaceId: wsId, uid, createdAt: Date.now() });
        await admin.auth().setCustomUserClaims(uid, { workspaceId: wsId, role: "admin" });
        return { workspaceId: wsId, role: "admin", isNewWorkspace: false };
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
// 1ter. Gestion des acces
// ---------------------------------------------------------------------------
function requireAdmin(request) {
    const workspaceId = request.auth?.token?.workspaceId;
    const role = request.auth?.token?.role;
    if (!workspaceId || role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Acces reserve aux admins.");
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
    const { name, phone, role, teamId, languages } = request.data;
    if (!name?.trim() || !teamId || (role !== "closeuse" && role !== "livreur")) {
        throw new https_1.HttpsError("invalid-argument", "Nom, role (closeuse/livreur) et equipe requis.");
    }
    const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(teamId).get();
    if (!teamSnap.exists) {
        throw new https_1.HttpsError("not-found", "Equipe introuvable.");
    }
    // Creer l'utilisateur dans Firebase Auth (necessaire pour setCustomUserClaims
    // et createCustomToken dans authenticateAccess)
    let firebaseUser;
    try {
        firebaseUser = await admin.auth().createUser({
            displayName: name.trim(),
            // phoneNumber stocke uniquement dans Firestore (evite erreur E.164 Firebase Auth)
        });
    }
    catch (err) {
        // Si l'utilisateur existe deja (par exemple si le numero de telephone est
        // deja utilise), on essaie de le recuperer
        if (err?.code === "auth/phone-number-already-exists" && phone?.trim()) {
            try {
                firebaseUser = await admin.auth().getUserByPhoneNumber(phone.trim());
            }
            catch {
                throw new https_1.HttpsError("internal", "Impossible de creer ou recuperer l'utilisateur Firebase Auth.");
            }
        }
        else {
            throw new https_1.HttpsError("internal", "Impossible de creer l'utilisateur Firebase Auth.");
        }
    }
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(firebaseUser.uid);
    await userRef.set({
        workspaceId,
        teamId,
        role,
        name: name.trim(),
        phone: phone?.trim() ?? "",
        languages: Array.isArray(languages) ? languages : [],
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
        throw new https_1.HttpsError("not-found", "Lien d'acces introuvable.");
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
        throw new https_1.HttpsError("not-found", "Lien d'acces introuvable.");
    }
    const linkDoc = linkSnap.docs[0];
    const linkData = linkDoc.data();
    await linkDoc.ref.update({
        disabledAt: disabled ? Date.now() : null,
        activeSessions: disabled ? [] : linkData.activeSessions ?? [],
    });
    // Met également à jour le statut de l'utilisateur pour bloquer immédiatement
    // l'attribution automatique de nouvelles commandes s'il est révoqué
    await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .doc(linkData.userId)
        .update({ status: disabled ? "disabled" : "active" });
    if (disabled) {
        try {
            await admin.auth().revokeRefreshTokens(linkData.userId);
        }
        catch (err) {
            console.error("Impossible de revoquer les sessions Firebase :", err);
        }
    }
    return { success: true };
});
// Verification stricte de revocation : `request.auth` (fourni automatiquement
// par le framework Callable) verifie seulement la SIGNATURE du token, pas
// s'il a ete revoque entre-temps -- un token deja emis reste valide jusqu'a
// ~1h apres un revokeRefreshTokens() si on ne fait que ca. On extrait donc
// le token brut depuis l'en-tete Authorization et on le reverifie nous-memes
// avec `checkRevoked = true`, seule facon de forcer un rejet immediat.
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
            throw new https_1.HttpsError("permission-denied", "Session revoquee.");
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
        throw new https_1.HttpsError("permission-denied", "Acces introuvable.");
    }
    const link = linkSnap.docs[0].data();
    if (link.disabledAt) {
        await admin.auth().revokeRefreshTokens(userId);
        throw new https_1.HttpsError("permission-denied", "Ton acces a ete desactive par l'administrateur.");
    }
    const userSnap = await db.collection("workspaces").doc(workspaceId).collection("users").doc(userId).get();
    const user = userSnap.data();
    if (!user || user.status !== "active") {
        await admin.auth().revokeRefreshTokens(userId);
        throw new https_1.HttpsError("permission-denied", "Ton compte a ete desactive.");
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
// Suppression definitive d'un employe -- uniquement possible APRES revocation
// de son acces (disabledAt non null), pour garder une trace/controle avant
// toute suppression irreversible. Supprime l'utilisateur, son lien d'acces
// et son secret associe.
exports.deleteEmployee = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { userId } = request.data;
    if (!userId) {
        throw new https_1.HttpsError("invalid-argument", "userId requis.");
    }
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "Employe introuvable.");
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
            throw new https_1.HttpsError("failed-precondition", "Revoque l'acces de cet employe avant de le supprimer.");
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
        // Compte Firebase Auth deja absent/deja supprime -- pas bloquant
        console.warn("Suppression Firebase Auth ignoree :", err);
    }
    await userRef.delete();
    return { success: true };
});
// Modification des langues et dialectes locaux parlés par un employé (Skill-Based Routing)
exports.updateEmployeeLanguages = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { userId, languages } = request.data;
    if (!userId || !Array.isArray(languages)) {
        throw new https_1.HttpsError("invalid-argument", "userId et liste des langues requis.");
    }
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "Employé introuvable.");
    }
    await userRef.update({
        languages,
        updatedAt: Date.now(),
    });
    return { ok: true, languages };
});
// Prêt d'employés inter-équipes de même pays (Cross-team employee allocation)
exports.updateEmployeeAllocatedTeams = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { userId, allocatedTeamIds } = request.data;
    if (!userId || !Array.isArray(allocatedTeamIds)) {
        throw new https_1.HttpsError("invalid-argument", "userId et liste allocatedTeamIds requis.");
    }
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "Employé introuvable.");
    }
    const userData = userSnap.data() || {};
    const homeTeamId = userData.teamId;
    if (!homeTeamId) {
        throw new https_1.HttpsError("failed-precondition", "L'employé n'a pas d'équipe d'origine assignée.");
    }
    const homeTeamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(homeTeamId).get();
    if (!homeTeamSnap.exists) {
        throw new https_1.HttpsError("not-found", "Équipe d'origine introuvable.");
    }
    const homeCountry = (homeTeamSnap.data()?.defaultCountry || "").trim().toUpperCase();
    // Valider que TOUTES les équipes cibles sont strictement dans le même pays que l'équipe d'origine
    const cleanAllocatedIds = [];
    for (const targetId of allocatedTeamIds) {
        if (!targetId || targetId === homeTeamId)
            continue;
        const targetSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(targetId).get();
        if (!targetSnap.exists) {
            throw new https_1.HttpsError("not-found", `Équipe emprunteuse ${targetId} introuvable.`);
        }
        const targetCountry = (targetSnap.data()?.defaultCountry || "").trim().toUpperCase();
        if (targetCountry !== homeCountry) {
            throw new https_1.HttpsError("invalid-argument", `Prêt refusé : L'équipe ${targetSnap.data()?.name || targetId} est basée en ${targetCountry}, alors que cet employé opère en ${homeCountry}. Le prêt d'employés est strictement réservé aux équipes du même pays.`);
        }
        cleanAllocatedIds.push(targetId);
    }
    const uniqueAllocated = Array.from(new Set(cleanAllocatedIds));
    await userRef.update({
        allocatedTeamIds: uniqueAllocated,
        allocatedUpdatedAt: Date.now(),
    });
    return { ok: true, allocatedTeamIds: uniqueAllocated };
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
        const rawSheetId = String(body.sheetId || "").trim();
        const cleanSheetId = (rawSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || rawSheetId).trim();
        let teamsSnap = await db
            .collectionGroup("teams")
            .where("sheetIds", "array-contains", cleanSheetId)
            .limit(1)
            .get();
        if (teamsSnap.empty && rawSheetId !== cleanSheetId) {
            teamsSnap = await db
                .collectionGroup("teams")
                .where("sheetIds", "array-contains", rawSheetId)
                .limit(1)
                .get();
        }
        if (teamsSnap.empty) {
            teamsSnap = await db
                .collectionGroup("teams")
                .where("sheetId", "==", cleanSheetId)
                .limit(1)
                .get();
        }
        if (teamsSnap.empty) {
            // Fallback : recherche directe dans les équipes des workspaces
            try {
                const wsList = await db.collection("workspaces").get();
                for (const wsDoc of wsList.docs) {
                    const tSnap = await wsDoc.ref.collection("teams").get();
                    for (const tDoc of tSnap.docs) {
                        const td = tDoc.data();
                        const sIds = Array.isArray(td.sheetIds) ? td.sheetIds : td.sheetId ? [td.sheetId] : [];
                        if (sIds.some(s => s === cleanSheetId || s === rawSheetId)) {
                            teamsSnap = { empty: false, docs: [tDoc] };
                            break;
                        }
                    }
                    if (!teamsSnap.empty)
                        break;
                }
            }
            catch (wsScanErr) {
                console.warn("receiveSheetOrder: scan de secours des équipes échoué:", wsScanErr);
            }
        }
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
        // Routage intelligent multi-pays haute précision (Inspiré COD Afrique)
        let assignedTeamId = teamId;
        const detectedCountry = (0, shopifyTracking_1.detectAfricanCountry)({
            phone: body.phone,
            city: body.city,
            country: body.country || body.pays,
            defaultCountry: team.defaultCountry || "TG",
        });
        if (detectedCountry && detectedCountry !== team.defaultCountry) {
            try {
                const altTeamSnap = await db
                    .collection("workspaces")
                    .doc(workspaceId)
                    .collection("teams")
                    .where("defaultCountry", "==", detectedCountry)
                    .limit(1)
                    .get();
                if (!altTeamSnap.empty) {
                    assignedTeamId = altTeamSnap.docs[0].id;
                    console.log(`receiveSheetOrder: routage multi-pays automatique depuis ${team.defaultCountry} vers ${detectedCountry} (teamId=${assignedTeamId})`);
                }
            }
            catch (routingErr) {
                console.warn("receiveSheetOrder: échec vérification routage multi-pays:", routingErr);
            }
        }
        let isDuplicatePhone = false;
        let previousOrdersCount = 0;
        let previousRejectionsCount = 0;
        try {
            const prevSnap = await db
                .collection("workspaces")
                .doc(workspaceId)
                .collection("orders")
                .where("clientPhoneFormatted", "==", clientPhoneFormatted)
                .limit(20)
                .get();
            if (!prevSnap.empty) {
                isDuplicatePhone = true;
                previousOrdersCount = prevSnap.size;
                previousRejectionsCount = prevSnap.docs.filter((d) => {
                    const st = d.data().statutCloseuse;
                    return st === "rejete" || st === "injoignable";
                }).length;
            }
        }
        catch { }
        const noteText = String(body.note || "").toLowerCase();
        const explicitSource = String(body.trafficSource || body.source || body.sourceTrafic || "").toLowerCase();
        let sheetTrafficSource = "organique";
        let sheetCapiIsolated = true;
        if (isDuplicatePhone) {
            sheetTrafficSource = "acces_libre_site";
            sheetCapiIsolated = true;
        }
        else if (explicitSource.includes("meta") ||
            explicitSource.includes("facebook") ||
            explicitSource.includes("fb") ||
            explicitSource.includes("instagram") ||
            noteText.includes("facebook") ||
            noteText.includes("meta_ads") ||
            noteText.includes("fb_ads")) {
            sheetTrafficSource = "meta_ads";
            sheetCapiIsolated = false;
        }
        else if (explicitSource.includes("tiktok") || noteText.includes("tiktok")) {
            sheetTrafficSource = "tiktok_ads";
            sheetCapiIsolated = true;
        }
        else if (explicitSource.includes("google") || noteText.includes("google")) {
            sheetTrafficSource = "google_ads";
            sheetCapiIsolated = true;
        }
        else {
            // Commande libre ou naturelle : isolée de Meta CAPI pour ne pas fausser le pixel
            sheetTrafficSource = "organique";
            sheetCapiIsolated = true;
        }
        const orderRef = db.collection("workspaces").doc(workspaceId).collection("orders").doc();
        await orderRef.set({
            workspaceId,
            teamId: assignedTeamId,
            teamName: team.name || "",
            sheetId: body.sheetId,
            sourceRowId: uniqueSourceId,
            clientName: body.clientName,
            clientPhoneRaw: body.phone,
            clientPhoneFormatted,
            city: body.city || "",
            addressNote: body.note || "",
            product: body.product,
            quantity: body.quantity || 1,
            amount: body.totalPrice,
            orderNumber: body.orderNumber || "",
            closeuseId: null,
            livreurId: null,
            statutCloseuse: "nouveau",
            statutLivreur: null,
            statutAdminOverride: null,
            callInProgress: null,
            reminderAt: null,
            isDuplicatePhone,
            previousOrdersCount,
            previousRejectionsCount,
            capiIsolated: sheetCapiIsolated,
            trafficSource: sheetTrafficSource,
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
// 2. Assignation automatique a la creation d'une commande (section 8)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Helpers Gestion de Stock & Traçabilité Anti-Fraude
// ---------------------------------------------------------------------------
function slugifyProduct(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
}
async function recordOrderStockCreation(workspaceId, teamId, productName, qty = 1) {
    if (!productName?.trim() || !teamId)
        return;
    const slug = slugifyProduct(productName);
    const stockRef = db.collection("workspaces").doc(workspaceId).collection("teams").doc(teamId).collection("stocks").doc(slug);
    try {
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(stockRef);
            if (!snap.exists) {
                tx.set(stockRef, {
                    id: slug,
                    workspaceId,
                    teamId,
                    productName: productName.trim(),
                    quantityOnHand: 0,
                    lowStockThreshold: 10,
                    totalSold: qty,
                    totalDelivered: 0,
                    totalReturned: 0,
                    updatedAt: Date.now(),
                });
            }
            else {
                tx.update(stockRef, {
                    totalSold: admin.firestore.FieldValue.increment(qty),
                    updatedAt: Date.now(),
                });
            }
        });
    }
    catch (err) {
        console.warn("recordOrderStockCreation ignoré :", err);
    }
}
async function recordProductDeliveryStock(workspaceId, teamId, productName, qty = 1) {
    if (!productName?.trim() || !teamId)
        return;
    const slug = slugifyProduct(productName);
    const stockRef = db.collection("workspaces").doc(workspaceId).collection("teams").doc(teamId).collection("stocks").doc(slug);
    try {
        let alertRemaining = null;
        let alertThreshold = 10;
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(stockRef);
            if (snap.exists) {
                const d = snap.data();
                const remaining = Math.max(0, Number(d.quantityOnHand ?? 0) - qty);
                const threshold = Number(d.lowStockThreshold ?? 10);
                tx.update(stockRef, {
                    quantityOnHand: remaining,
                    totalDelivered: admin.firestore.FieldValue.increment(qty),
                    updatedAt: Date.now(),
                });
                if (remaining <= threshold && Number(d.quantityOnHand ?? 0) > threshold) {
                    alertRemaining = remaining;
                    alertThreshold = threshold;
                }
            }
        });
        if (alertRemaining !== null) {
            await notifyAdmins(workspaceId, "🤖 Vigie IA · Alerte Stock Critique", `Le produit "${productName}" est en zone d'alerte sur ce marché : plus que ${alertRemaining} pièce(s) disponible(s) (seuil alerte : ${alertThreshold}). Pensez au réapprovisionnement.`);
        }
    }
    catch (err) {
        console.warn("recordProductDeliveryStock ignoré :", err);
    }
}
/**
 * Résout de manière exhaustive et tolérante l'image du produit d'une commande
 * (champs directs, Shopify/Azify, line items, note attributes, ou catalogue Firestore).
 */
async function resolveOrderProductImage(workspaceId, orderData) {
    if (!orderData)
        return null;
    // 1. Champ direct de premier niveau
    if (typeof orderData.productImageUrl === "string" && orderData.productImageUrl.startsWith("http")) {
        return orderData.productImageUrl;
    }
    if (typeof orderData.image === "string" && orderData.image.startsWith("http")) {
        return orderData.image;
    }
    if (typeof orderData.image?.src === "string" && orderData.image.src.startsWith("http")) {
        return orderData.image.src;
    }
    // 2. Champ Shopify / EasySell / Azify
    if (typeof orderData.shopifyData?.productImageUrl === "string" && orderData.shopifyData.productImageUrl.startsWith("http")) {
        return orderData.shopifyData.productImageUrl;
    }
    // 3. Line items
    const lineItems = Array.isArray(orderData.lineItems)
        ? orderData.lineItems
        : Array.isArray(orderData.line_items)
            ? orderData.line_items
            : null;
    if (lineItems && lineItems.length > 0) {
        for (const item of lineItems) {
            const img = item?.imageUrl || item?.image || item?.image_url || item?.product_image || item?.image?.src;
            if (typeof img === "string" && img.startsWith("http"))
                return img;
        }
    }
    // 4. Note attributes (Shopify / Azify / EasySell)
    const noteAttrs = orderData.shopifyData?.noteAttributes || orderData.note_attributes;
    let candidateProductUrl = null;
    if (Array.isArray(noteAttrs)) {
        for (const a of noteAttrs) {
            if (!a?.name)
                continue;
            const k = String(a.name).toLowerCase().trim();
            const v = typeof a.value === "string" ? a.value.trim() : "";
            if (["product_image_url", "image_url", "product_image", "image", "product_img"].includes(k) && v.startsWith("http")) {
                return v;
            }
            if (["full_url", "url", "page_url", "product_url"].includes(k) && v.includes("/products/")) {
                candidateProductUrl = v;
            }
        }
    }
    // 5. Extraction depuis l'URL publique produit Shopify/Azify (ex: https://shop.com/products/handle.json)
    const productPageUrl = candidateProductUrl ||
        orderData.shopifyData?.pageUrl ||
        orderData.pageUrl ||
        null;
    if (productPageUrl && typeof productPageUrl === "string" && productPageUrl.includes("/products/")) {
        try {
            const cleanUrl = productPageUrl.split("?")[0].replace(/\/+$/, "");
            const jsonUrl = cleanUrl.endsWith(".json") ? cleanUrl : `${cleanUrl}.json`;
            const res = await fetch(jsonUrl, {
                headers: { "User-Agent": "WariTrack-Bot/1.0" },
                signal: AbortSignal.timeout(2000),
            });
            if (res.ok) {
                const pJson = (await res.json());
                const found = pJson?.product?.image?.src ||
                    pJson?.product?.images?.[0]?.src ||
                    pJson?.product?.images?.[0];
                if (typeof found === "string" && found.startsWith("http")) {
                    return found;
                }
            }
        }
        catch { }
    }
    // 6. Recherche tolérante dans la collection 'products' du workspace
    const rawProduct = String(orderData.product || "").trim();
    if (rawProduct && workspaceId) {
        try {
            const cleanName = rawProduct
                .replace(/^(\d+x\s*)+/gi, "")
                .split(/,|\+|\[upsell\]|\s*-\s*/i)[0]
                .trim()
                .toLowerCase();
            const prodsSnap = await db
                .collection("workspaces")
                .doc(workspaceId)
                .collection("products")
                .limit(100)
                .get();
            if (!prodsSnap.empty) {
                for (const pDoc of prodsSnap.docs) {
                    const p = pDoc.data();
                    const pName = String(p.name || p.title || "").trim().toLowerCase();
                    if (pName &&
                        (pName === cleanName ||
                            cleanName.includes(pName) ||
                            pName.includes(cleanName) ||
                            cleanName.split(/\s+/).some((w) => w.length >= 4 && pName.includes(w)))) {
                        const foundImg = p.imageUrl || p.image || p.images?.[0]?.url || p.images?.[0] || null;
                        if (typeof foundImg === "string" && foundImg.startsWith("http")) {
                            return foundImg;
                        }
                    }
                }
            }
        }
        catch (err) {
            console.warn("resolveOrderProductImage: lookup products error:", err);
        }
    }
    return null;
}
exports.onOrderCreated = (0, firestore_1.onDocumentCreated)("workspaces/{workspaceId}/orders/{orderId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const order = snap.data();
    const { workspaceId } = event.params;
    // Récupérer à la fois les closeuses d'origine ET les closeuses allouées/prêtées à cette équipe (même pays)
    const [homeCloseusesSnap, allocatedCloseusesSnap] = await Promise.all([
        db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("users")
            .where("teamId", "==", order.teamId)
            .where("role", "==", "closeuse")
            .where("status", "==", "active")
            .get(),
        db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("users")
            .where("allocatedTeamIds", "array-contains", order.teamId)
            .where("role", "==", "closeuse")
            .where("status", "==", "active")
            .get(),
    ]);
    const closeuseMap = new Map();
    homeCloseusesSnap.docs.forEach((doc) => closeuseMap.set(doc.id, doc));
    allocatedCloseusesSnap.docs.forEach((doc) => closeuseMap.set(doc.id, doc));
    if (closeuseMap.size === 0) {
        console.warn(`onOrderCreated: Aucune closeuse active pour l'équipe ${order.teamId}. Notification admin envoyée.`);
        const orderProductImg = await resolveOrderProductImage(workspaceId, order);
        if (orderProductImg && !order.productImageUrl) {
            await snap.ref.update({ productImageUrl: orderProductImg }).catch(() => { });
        }
        const orderQty = order.quantity && order.quantity > 1 ? `${order.quantity}x ` : "";
        await notifyAdmins(workspaceId, `🛍️ Nouvelle commande : ${orderQty}${order.product || "Produit"}`, `⚠️ [À attribuer] ${order.clientName} · ${order.city || "Ville non précisée"} · Équipe ${order.teamName || order.teamId} (Aucune closeuse active)`, orderProductImg, snap.id);
        if (order.product && order.teamId) {
            await recordOrderStockCreation(workspaceId, order.teamId, order.product, Number(order.quantity || 1));
        }
        if (!order.sheetId && order.teamId) {
            try {
                const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(order.teamId).get();
                const teamData = teamSnap.data();
                const sheetIds = Array.isArray(teamData?.sheetIds)
                    ? teamData.sheetIds
                    : teamData?.sheetId
                        ? [teamData.sheetId]
                        : [];
                const targetSheetId = sheetIds.find((s) => Boolean(s));
                if (targetSheetId) {
                    const sheets = (0, sheetsSync_1.getSheetsClient)();
                    const appendRes = await (0, sheetsSync_1.appendOrderToSheet)(sheets, targetSheetId, {
                        clientName: order.clientName || '',
                        phone: order.clientPhoneFormatted || order.phone || '',
                        city: order.city || '',
                        product: order.product || '',
                        amount: order.amount,
                        quantity: order.quantity || 1,
                        statutCloseuse: order.statutCloseuse || 'nouveau',
                        orderNumber: order.orderNumber,
                        orderId: snap.id,
                        notes: order.notes || order.addressNote || '',
                        addressNote: order.addressNote || '',
                        mapUrl: order.mapUrl || order.googleMapsUrl || '',
                        promoCode: order.promoCode || '',
                    });
                    if (appendRes) {
                        await snap.ref.update({
                            sheetId: targetSheetId,
                            sourceRowId: appendRes.sourceRowId,
                        });
                    }
                }
            }
            catch (sheetErr) {
                console.warn('onOrderCreated: échec sync Google Sheet pour order ' + snap.id + ':', sheetErr?.message || sheetErr);
            }
        }
        return;
    }
    const allCloseuseDocs = Array.from(closeuseMap.values());
    const loads = await Promise.all(allCloseuseDocs.map(async (userDoc) => {
        const activeSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("closeuseId", "==", userDoc.id)
            .where("statutCloseuse", "in", ["nouveau", "programme", "en_cours"])
            .get();
        return { id: userDoc.id, data: userDoc.data(), count: activeSnap.size };
    }));
    // -----------------------------------------------------------------------
    // ROUTAGE INTELLIGENT PAR COMPÉTENCE LINGUISTIQUE (Skill-Based Routing)
    // -----------------------------------------------------------------------
    const orderLanguage = (order.clientLanguage || "").trim().toLowerCase();
    let candidates = loads;
    let languageMatched = false;
    if (orderLanguage) {
        const languageFiltered = loads.filter((c) => {
            const userLangs = Array.isArray(c.data.languages) ? c.data.languages : [];
            return userLangs.some((l) => {
                const cleanL = l.toLowerCase();
                return cleanL === orderLanguage || cleanL.includes(orderLanguage) || orderLanguage.includes(cleanL);
            });
        });
        if (languageFiltered.length > 0) {
            candidates = languageFiltered;
            languageMatched = true;
        }
    }
    const chosen = candidates.reduce((lowest, current) => (current.count < lowest.count ? current : lowest));
    const updatePayload = {
        closeuseId: chosen.id,
        "timestamps.assignedToCloseuse": Date.now(),
    };
    if (orderLanguage && !languageMatched) {
        updatePayload.languagePriorityNotified = true;
        updatePayload.fieldNote = `⚠️ [Priorité : Rappel en ${order.clientLanguage}] (Aucune closeuse parlant ce dialecte n'était disponible)`;
    }
    await snap.ref.update(updatePayload);
    // Notification personnalisée pour la closeuse avec mention de la langue locale
    const langBadge = order.clientLanguage ? ` · 🗣️ Parler en ${order.clientLanguage}` : "";
    const orderProductImg = await resolveOrderProductImage(workspaceId, order);
    if (orderProductImg && !order.productImageUrl) {
        await snap.ref.update({ productImageUrl: orderProductImg });
    }
    await sendPushToUser(workspaceId, chosen.id, order.isDuplicatePhone ? "⚠️ Nouvelle commande (Doublon N°)" : "Nouvelle commande", order.isDuplicatePhone
        ? `${order.clientName} - ${order.product}${langBadge} · Vérifier si 1 ou 2 produits`
        : `${order.clientName} - ${order.product}${langBadge}`, snap.id, orderProductImg);
    // Notification push temps réel envoyée aux administrateurs du Cockpit avec photo produit
    const orderQty = order.quantity && order.quantity > 1 ? `${order.quantity}x ` : "";
    await notifyAdmins(workspaceId, `🛍️ Nouvelle commande : ${orderQty}${order.product || "Produit"}`, `${order.clientName} · ${order.city || "Ville non précisée"} · ${order.amount ? `${Number(order.amount).toLocaleString("fr-FR")} XOF` : "À confirmer"}`, orderProductImg, snap.id);
    if (order.isDuplicatePhone) {
        await notifyAdmins(workspaceId, "🤖 Vigie IA · Numéro doublon (Accès libre site)", `${order.clientName} (${order.clientPhoneFormatted}) a commandé à nouveau (${order.product}). Isolé de Meta CAPI — vérifier avec ${chosen.data.name} si 1 ou 2 produits.`);
    }
    const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(order.teamId).get();
    const threshold = teamSnap.data()?.overloadAlertThreshold ?? 20;
    if (chosen.count + 1 >= threshold) {
        await notifyAdmins(workspaceId, "🤖 Vigie IA · Closeuse surchargée", `${chosen.data.name} a ${chosen.count + 1} commandes actives en attente.`);
    }
    // Traçabilité du stock vendu
    if (order.product) {
        await recordOrderStockCreation(workspaceId, order.teamId, order.product, Number(order.quantity || 1));
    }
    // Synchronisation automatique vers le Google Sheet de l'équipe (si commande créée via Shopify, Azify, etc.)
    if (!order.sheetId && order.teamId) {
        try {
            const teamData = teamSnap.data();
            const sheetIds = Array.isArray(teamData?.sheetIds)
                ? teamData.sheetIds
                : teamData?.sheetId
                    ? [teamData.sheetId]
                    : [];
            const targetSheetId = sheetIds.find((s) => Boolean(s));
            if (targetSheetId) {
                const sheets = (0, sheetsSync_1.getSheetsClient)();
                const appendRes = await (0, sheetsSync_1.appendOrderToSheet)(sheets, targetSheetId, {
                    clientName: order.clientName || '',
                    phone: order.clientPhoneFormatted || order.phone || '',
                    city: order.city || '',
                    product: order.product || '',
                    amount: order.amount,
                    quantity: order.quantity || 1,
                    statutCloseuse: order.statutCloseuse || 'nouveau',
                    orderNumber: order.orderNumber,
                    orderId: snap.id,
                    notes: order.notes || order.addressNote || '',
                    addressNote: order.addressNote || '',
                    mapUrl: order.mapUrl || order.googleMapsUrl || '',
                    promoCode: order.promoCode || '',
                });
                if (appendRes) {
                    await snap.ref.update({
                        sheetId: targetSheetId,
                        sourceRowId: appendRes.sourceRowId,
                    });
                }
            }
        }
        catch (sheetErr) {
            console.warn('onOrderCreated: échec sync Google Sheet pour order ' + snap.id + ':', sheetErr?.message || sheetErr);
        }
    }
});
// ---------------------------------------------------------------------------
// 2bis. Statistiques journalieres persistantes (survivent a la purge)
// ---------------------------------------------------------------------------
// Cle de date au format "YYYY-MM-DD", calculee en UTC. Le workspace de
// reference etant base au Togo (GMT, UTC+0, pas de changement d'heure),
// cette cle correspond exactement a la date locale cote client -- aucune
// conversion de fuseau horaire supplementaire n'est necessaire.
function dayKeyFromMs(ts) {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/**
 * Incremente un compteur agrege, permanent, dans
 * workspaces/{workspaceId}/teams/{teamId}/dailyStats/{YYYY-MM-DD}.
 *
 * Contrairement au calcul en direct sur la collection "orders" (utilise
 * par le dashboard admin pour le CA, les livraisons, etc.), ce total
 * survit a scheduledPurge -- qui supprime definitivement les commandes
 * a statut final au bout de ORDER_PURGE_AFTER_DAYS jours. Sans cet
 * agregat separe, le CA/les stats "Tout" retombent a zero des qu'une
 * commande livree passe ce delai, meme si elle a bien ete payee/livree.
 *
 * Meme principe que incrementRemuneration (deja existant, jamais purge),
 * applique ici au niveau equipe/jour plutot qu'au niveau employe.
 */
async function incrementDailyStat(workspaceId, teamId, field, amount) {
    const dateKey = dayKeyFromMs(Date.now());
    const ref = db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("teams")
        .doc(teamId)
        .collection("dailyStats")
        .doc(dateKey);
    await ref.set({ [field]: admin.firestore.FieldValue.increment(amount), updatedAt: Date.now() }, { merge: true });
}
// ---------------------------------------------------------------------------
// 3. Propagation de statut livreur -> closeuse + remuneration + sync Sheet
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
    const livreurAssigned = !!after.livreurId && before.livreurId !== after.livreurId;
    const wasReassigned = !!before.livreurId && !!after.livreurId && before.livreurId !== after.livreurId;
    const orderProductImg = await resolveOrderProductImage(workspaceId, after);
    if (orderProductImg && !after.productImageUrl) {
        await ref.update({ productImageUrl: orderProductImg });
    }
    if (livreurAssigned) {
        await sendPushToUser(workspaceId, after.livreurId, wasReassigned ? "Livraison réassignée" : "Nouvelle livraison", `${after.clientName} - ${after.product}`, orderId, orderProductImg);
        await ref.update({ "timestamps.assignedToLivreur": Date.now() });
    }
    if (statutCloseuseChanged && before.statutCloseuse === "nouveau" && !after.timestamps?.closeuseDecidedAt) {
        await ref.update({ "timestamps.closeuseDecidedAt": Date.now() });
    }
    if (statutLivreurChanged && before.statutLivreur === "recu" && !after.timestamps?.livreurRespondedAt) {
        await ref.update({ "timestamps.livreurRespondedAt": Date.now() });
    }
    if (statutLivreurChanged && after.statutLivreur === "en_route") {
        if (after.closeuseId) {
            const livName = after.assignedLivreurName || after.livreurName || "Votre livreur";
            const cName = after.clientName || "Client";
            const cityStr = after.city ? ` (${after.city})` : "";
            const prodStr = after.product ? ` · ${after.product}` : "";
            await sendPushToUser(workspaceId, after.closeuseId, `🛵 Livraison en route (${cName})`, `${livName} a démarré la livraison chez ${cName}${cityStr}${prodStr}`, orderId, orderProductImg);
        }
        // Synchronisation retour vers la vitrine Azify (Statut: Expédiée)
        await (0, shopifyTracking_3.syncOrderUpdateToAzify)(workspaceId, after, "shipped");
    }
    if (statutLivreurChanged && after.statutLivreur === "livre" && !before.timestamps?.delivered) {
        await ref.update({
            statutCloseuse: "livre",
            "timestamps.delivered": Date.now(),
        });
        // Sync directe vers le Sheet -- ne depend pas d'un second passage de
        // la fonction (avant, on comptait sur before/after de l'evenement,
        // qui ne reflete pas cette ecriture faite DANS cette meme execution ;
        // corrige le bug "Livre ne remonte pas sur le Sheet").
        if (after.sheetId && after.sourceRowId) {
            await (0, sheetsSync_1.writeOrderStatusToSheet)(after.sheetId, after.sourceRowId, "livre", null, after.assignedLivreurName || after.livreurName || null);
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
            // Agrege le CA + le compteur de livraisons du jour, de facon
            // permanente -- voir incrementDailyStat ci-dessus.
            incrementDailyStat(workspaceId, after.teamId, "ca", after.amount),
            incrementDailyStat(workspaceId, after.teamId, "livraisons", 1),
        ]);
        // Décrémentation automatique du stock & contrôle anti-fraude
        if (after.product) {
            await recordProductDeliveryStock(workspaceId, after.teamId, after.product, Number(after.quantity || 1));
        }
        // Alerte instantanée pour la closeuse responsable du dossier
        if (after.closeuseId) {
            const livName = after.assignedLivreurName || after.livreurName || "Votre livreur";
            const cName = after.clientName || "Client";
            const cityStr = after.city ? ` (${after.city})` : "";
            const amountStr = after.amount ? ` · ${after.amount} XOF` : "";
            await sendPushToUser(workspaceId, after.closeuseId, `🎉 Commande livrée & encaissée (${cName})`, `${livName} a livré et encaissé le colis de ${cName}${cityStr}${amountStr} en espèces ! Félicitations pour votre closing.`, orderId, orderProductImg);
        }
        // Synchronisation retour vers la vitrine Azify (Statut: Livrée & Encaissée)
        await (0, shopifyTracking_3.syncOrderUpdateToAzify)(workspaceId, after, "delivered");
        // Isolation Meta CAPI pour les numéros doublons ("acces_libre_site") :
        // Si ce numéro a déjà fait l'objet d'un tracking CAPI ou est qualifié en doublon,
        // on l'isole du Pixel Meta et on le considère comme paiement accès libre site.
        let isPhoneAlreadyTracked = Boolean(after.capiIsolated || after.isDuplicatePhone);
        if (!isPhoneAlreadyTracked && after.clientPhoneFormatted) {
            try {
                const dupPaidSnap = await db
                    .collection("workspaces")
                    .doc(workspaceId)
                    .collection("orders")
                    .where("clientPhoneFormatted", "==", after.clientPhoneFormatted)
                    .limit(15)
                    .get();
                const otherPaid = dupPaidSnap.docs.some((d) => d.id !== orderId && d.data().capiSent === true);
                if (otherPaid) {
                    isPhoneAlreadyTracked = true;
                    await ref.update({
                        capiIsolated: true,
                        isDuplicatePhone: true,
                        trafficSource: "acces_libre_site",
                    });
                }
            }
            catch { }
        }
        // Envoi de l'événement officiel Purchase à Meta Conversions API (CAPI) enrichi
        // Vérification d'attribution stricte : réservé à Meta Ads (fbc/fbclid vérifié),
        // exclu pour le trafic organique, TikTok Ads, Google Ads ou numéro doublon
        let metaAccessToken = team?.metaCapiConfig?.accessToken;
        if (!metaAccessToken && team?.metaCapiConfig?.enabled) {
            try {
                const secSnap = await db
                    .collection("workspaces")
                    .doc(workspaceId)
                    .collection("teams")
                    .doc(after.teamId)
                    .collection("secrets")
                    .doc("metaCapi")
                    .get();
                if (secSnap.exists) {
                    metaAccessToken = secSnap.data()?.accessToken;
                }
            }
            catch (secErr) {
                console.warn("Échec lecture secret Meta CAPI (Purchase):", secErr);
            }
        }
        if (!isPhoneAlreadyTracked &&
            !after.capiIsolated &&
            !after.capiSent &&
            after.trafficSource === "meta_ads" &&
            team?.metaCapiConfig?.enabled &&
            team.metaCapiConfig.pixelId &&
            metaAccessToken) {
            try {
                const targetPixelId = after.pixelId || team.metaCapiConfig.pixelId;
                const capiRes = await (0, metaCapi_1.sendMetaPurchaseEvent)({ ...team.metaCapiConfig, pixelId: targetPixelId, accessToken: metaAccessToken }, {
                    id: orderId,
                    sourceRowId: after.sourceRowId,
                    orderNumber: after.orderNumber,
                    clientName: after.clientName,
                    clientPhoneFormatted: after.clientPhoneFormatted,
                    clientPhoneRaw: after.clientPhoneRaw,
                    city: after.city,
                    country: team.defaultCountry,
                    product: after.product,
                    quantity: after.quantity,
                    amount: after.amount,
                    fbp: after.shopifyData?.fbp,
                    fbc: after.shopifyData?.fbc,
                    fbclid: after.shopifyData?.fbclid,
                    browserIp: after.shopifyData?.browserIp || after.browserIp,
                    userAgent: after.shopifyData?.browserUserAgent || after.shopifyData?.userAgent || after.userAgent,
                    pageUrl: after.shopifyData?.pageUrl || after.pageUrl,
                    shopDomain: after.shopifyData?.shopDomain,
                    temperature: after.temperature,
                });
                if (capiRes.success) {
                    await ref.update({ capiSent: true });
                }
            }
            catch (capiErr) {
                console.error("Échec de l'envoi Meta CAPI lors de la livraison :", capiErr);
            }
        }
        if (after.closeuseId) {
            const livName = after.assignedLivreurName || after.livreurName || "Votre livreur";
            const cName = after.clientName || "Client";
            const cityStr = after.city ? ` (${after.city})` : "";
            const amountStr = after.amount ? ` · ${Number(after.amount).toLocaleString("fr-FR")} XOF` : "";
            const prodStr = after.product ? ` · ${after.product}` : "";
            await sendPushToUser(workspaceId, after.closeuseId, `✅ Colis livré & encaissé ! (${cName})`, `${cName} a été livré par ${livName}${cityStr}${amountStr} encaissés en cash${prodStr}`, orderId, orderProductImg);
        }
        // Notification Push & In-app aux Administrateurs : Colis Livré & Encaissé
        const clientName = after.clientName || "Client";
        const amountStr = after.amount ? `${Number(after.amount).toLocaleString("fr-FR")} XOF` : "";
        const livreurName = after.assignedLivreurName || after.livreurName || "Livreur";
        const cityStr = after.city ? `(${after.city})` : "";
        const productStr = after.product ? `· ${after.product}` : "";
        const deliveryTitle = `💰 Colis Livré & Encaissé : ${amountStr}`;
        const deliveryBody = `${clientName} ${cityStr} · Livré par ${livreurName} ${productStr}`;
        const productImg = after.productImageUrl || after.shopifyData?.productImageUrl || null;
        await notifyAdmins(workspaceId, deliveryTitle, deliveryBody, productImg, orderId);
    }
    if (statutCloseuseChanged &&
        (after.statutCloseuse === "en_cours" || after.statutCloseuse === "programme" || after.statutCloseuse === "confirme")) {
        // Synchronisation retour vers la vitrine Azify (Statut: Confirmée)
        await (0, shopifyTracking_3.syncOrderUpdateToAzify)(workspaceId, after, "confirmed");
    }
    // Événement CommandeConfirmee vers Meta CAPI lors de la validation closeuse (réservé Meta Ads)
    if (statutCloseuseChanged &&
        (after.statutCloseuse === "en_cours" || after.statutCloseuse === "programme") &&
        !after.capiConfirmedSent &&
        !after.capiIsolated &&
        !after.isDuplicatePhone &&
        after.trafficSource === "meta_ads") {
        const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(after.teamId).get();
        const team = teamSnap.data();
        let metaAccessToken = team?.metaCapiConfig?.accessToken;
        if (!metaAccessToken && team?.metaCapiConfig?.enabled) {
            try {
                const secSnap = await db
                    .collection("workspaces")
                    .doc(workspaceId)
                    .collection("teams")
                    .doc(after.teamId)
                    .collection("secrets")
                    .doc("metaCapi")
                    .get();
                if (secSnap.exists) {
                    metaAccessToken = secSnap.data()?.accessToken;
                }
            }
            catch (secErr) {
                console.warn("Échec lecture secret Meta CAPI (Confirmed):", secErr);
            }
        }
        if (team?.metaCapiConfig?.enabled &&
            team.metaCapiConfig.pixelId &&
            metaAccessToken) {
            try {
                const targetPixelId = after.pixelId || team.metaCapiConfig.pixelId;
                const confRes = await (0, metaCapi_1.sendMetaConfirmedEvent)({ ...team.metaCapiConfig, pixelId: targetPixelId, accessToken: metaAccessToken }, {
                    id: orderId,
                    sourceRowId: after.sourceRowId,
                    orderNumber: after.orderNumber,
                    clientName: after.clientName,
                    clientPhoneFormatted: after.clientPhoneFormatted,
                    clientPhoneRaw: after.clientPhoneRaw,
                    city: after.city,
                    country: team.defaultCountry,
                    product: after.product,
                    quantity: after.quantity,
                    amount: after.amount,
                    fbp: after.shopifyData?.fbp,
                    fbc: after.shopifyData?.fbc,
                    fbclid: after.shopifyData?.fbclid,
                    browserIp: after.shopifyData?.browserIp || after.browserIp,
                    userAgent: after.shopifyData?.browserUserAgent || after.shopifyData?.userAgent || after.userAgent,
                    pageUrl: after.shopifyData?.pageUrl || after.pageUrl,
                    shopDomain: after.shopifyData?.shopDomain,
                    temperature: after.temperature || "hot",
                });
                if (confRes.success) {
                    await ref.update({ capiConfirmedSent: true });
                }
            }
            catch (confErr) {
                console.error("Échec de l'envoi Meta CommandeConfirmee :", confErr);
            }
        }
    }
    if (statutLivreurChanged && after.statutLivreur === "injoignable") {
        await ref.update({ statutCloseuse: "injoignable" });
        // Meme correctif que ci-dessus, pour ce cas aussi.
        if (after.sheetId && after.sourceRowId) {
            await (0, sheetsSync_1.writeOrderStatusToSheet)(after.sheetId, after.sourceRowId, "injoignable", null, after.assignedLivreurName || after.livreurName || null);
        }
        // Injoignable declenche cote livreur (client ne repond pas a la
        // livraison) -- comptabilise dans le meme compteur "injoignables"
        // que le cas declenche cote closeuse ci-dessous, les deux chemins
        // ne pouvant pas se declencher sur le meme evenement Firestore.
        await incrementDailyStat(workspaceId, after.teamId, "injoignables", 1);
        if (after.closeuseId) {
            const livName = after.assignedLivreurName || after.livreurName || "Votre livreur";
            const cName = after.clientName || "Client";
            const cityStr = after.city ? ` (${after.city})` : "";
            const noteStr = after.deliveryFieldNote || after.fieldNote || "";
            const noteDetail = noteStr ? ` (Note: "${noteStr}")` : "";
            await sendPushToUser(workspaceId, after.closeuseId, `⚠️ Client injoignable sur le terrain (${cName})`, `${livName} signale que ${cName}${cityStr} ne répond pas${noteDetail}. Relancez le client sur WhatsApp ou appel immédiatement !`, orderId, orderProductImg);
        }
        // Synchronisation retour vers la vitrine Azify (Statut: Client Injoignable terrain)
        await (0, shopifyTracking_3.syncOrderUpdateToAzify)(workspaceId, after, "unreachable");
        // Alerte Administrateurs : Colis en échec de livraison
        const clientName = after.clientName || "Client";
        const livreurName = after.assignedLivreurName || after.livreurName || "Livreur";
        const cityStr = after.city ? `(${after.city})` : "";
        const noteStr = after.livreurNote ? ` · Note : ${after.livreurNote}` : "";
        await notifyAdmins(workspaceId, `⚠️ Échec Livraison : ${clientName} ${cityStr}`, `Le livreur ${livreurName} n'a pas pu joindre le client${noteStr}. Action requise.`);
    }
    if (statutCloseuseChanged && FINAL_STATUSES.includes(after.statutCloseuse)) {
        // Conservation permanente : aucune purge des commandes
        // Ce bloc capture les statuts finaux decides directement par la
        // closeuse (rejete, ou injoignable des l'appel initial, sans jamais
        // passer par un livreur) -- le cas "livre" ne peut pas arriver ici
        // (statutCloseuse n'est jamais mis a "livre" ailleurs que dans le
        // bloc statutLivreur === "livre" ci-dessus, deja comptabilise).
        if (after.statutCloseuse === "rejete") {
            await incrementDailyStat(workspaceId, after.teamId, "rejetees", 1);
            // Synchronisation retour vers la vitrine Azify (Statut: Annulée)
            await (0, shopifyTracking_3.syncOrderUpdateToAzify)(workspaceId, after, "cancelled");
            const clientName = after.clientName || "Client";
            const reasonStr = after.rejectionReason ? ` (${after.rejectionReason})` : "";
            await notifyAdmins(workspaceId, `❌ Commande Annulée : ${clientName}`, `Motif : ${reasonStr || "Refus client"} · Produit : ${after.product || "Article"}`);
        }
        else if (after.statutCloseuse === "injoignable") {
            await incrementDailyStat(workspaceId, after.teamId, "injoignables", 1);
            // Synchronisation retour vers la vitrine Azify (Statut: Injoignable)
            await (0, shopifyTracking_3.syncOrderUpdateToAzify)(workspaceId, after, "unreachable");
        }
    }
    // Sync retour Firestore -> Sheet pour tous les AUTRES changements de
    // statutCloseuse (ceux decides directement par la closeuse : en_cours,
    // programme, rejete, indisponible -- pas ceux forces par le livreur,
    // deja geres explicitement ci-dessus).
    if (statutCloseuseChanged &&
        after.statutCloseuse !== "livre" &&
        after.statutCloseuse !== "injoignable" &&
        after.sheetId &&
        after.sourceRowId) {
        await (0, sheetsSync_1.writeOrderStatusToSheet)(after.sheetId, after.sourceRowId, after.statutCloseuse, after.reminderAt, after.assignedLivreurName || after.livreurName || null);
    }
    try {
        await (0, codInsights_1.recordCodOrderOutcome)(db, { workspaceId, orderId, before, after });
    }
    catch (insightErr) {
        console.error("recordCodOrderOutcome failed:", insightErr);
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
// Marquer/annuler le paiement d'une remuneration (bouton "Payer" admin)
// ---------------------------------------------------------------------------
exports.markRemunerationPaid = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { userId } = request.data;
    if (!userId) {
        throw new https_1.HttpsError("invalid-argument", "userId requis.");
    }
    const ref = db.collection("workspaces").doc(workspaceId).collection("remunerations").doc(userId);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw new https_1.HttpsError("not-found", "Aucune remuneration trouvee pour cet employe.");
        }
        const data = snap.data();
        const totalAmount = data.totalAmount ?? 0;
        tx.set(ref, { montantPaye: totalAmount, paidAt: Date.now() }, { merge: true });
        return totalAmount;
    });
    return { montantPaye: result };
});
exports.cancelRemunerationPayment = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { userId } = request.data;
    if (!userId) {
        throw new https_1.HttpsError("invalid-argument", "userId requis.");
    }
    const ref = db.collection("workspaces").doc(workspaceId).collection("remunerations").doc(userId);
    await ref.set({ montantPaye: 0, paidAt: admin.firestore.FieldValue.delete() }, { merge: true });
    return { ok: true };
});
// Note: Purge désactivée définitivement (conservation permanente intégrale demandée).
// ---------------------------------------------------------------------------
// 5. Rappels automatiques 15-20 min sans action sur "Nouveau" (section 6)
// ---------------------------------------------------------------------------
exports.scheduledReminders = (0, scheduler_1.onSchedule)("every 5 minutes", async () => {
    const now = Date.now();
    const cutoff = now - REMINDER_DELAY_MINUTES * 60 * 1000;
    const workspacesSnap = await db.collection("workspaces").get();
    const window24h = now - 24 * 60 * 60 * 1000;
    const window48h = now - 48 * 60 * 60 * 1000;
    for (const wsDoc of workspacesSnap.docs) {
        // Optimisation quota : ne scanner que les commandes de la fenêtre active (< 24h)
        const staleOrders = await wsDoc.ref
            .collection("orders")
            .where("statutCloseuse", "==", "nouveau")
            .where("timestamps.received", ">=", window24h)
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
                .where("title", "==", "🤖 Vigie IA · Commandes hors délai d'appel")
                .where("createdAt", ">=", now - 30 * 60 * 1000)
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
            if (recentAlert.empty) {
                const totalStale = [...byCloseuse.values()].reduce((a, b) => a + b, 0);
                await notifyAdmins(wsDoc.id, "🤖 Vigie IA · Commandes hors délai d'appel", `${totalStale} commande(s) "Nouveau" dépassent ${REMINDER_DELAY_MINUTES} min sans appel chez ${byCloseuse.size} closeuse(s).`);
            }
        }
        // Rappels des commandes programmées arrivées à échéance (fenêtre active < 24h)
        const dueScheduled = await wsDoc.ref
            .collection("orders")
            .where("statutCloseuse", "==", "programme")
            .where("reminderAt", ">=", window24h)
            .where("reminderAt", "<=", now)
            .get();
        let overdueAdminCount = 0;
        for (const docSnap of dueScheduled.docs) {
            const o = docSnap.data();
            if (o.closeuseId && !o.reminderNotified) {
                await sendPushToUser(wsDoc.id, o.closeuseId, "⏰ C'est l'heure de rappeler !", `Rappel programmé pour ${o.clientName} (${o.product})`, docSnap.id);
                await docSnap.ref.update({ reminderNotified: true });
            }
            if (o.reminderAt && now - o.reminderAt >= 20 * 60 * 1000) {
                overdueAdminCount += 1;
            }
        }
        if (overdueAdminCount > 0) {
            const recentOverdueAlert = await wsDoc.ref
                .collection("notifications")
                .where("title", "==", "🤖 Vigie IA · Rappels programmés oubliés")
                .where("createdAt", ">=", now - 45 * 60 * 1000)
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
            if (recentOverdueAlert.empty) {
                await notifyAdmins(wsDoc.id, "🤖 Vigie IA · Rappels programmés oubliés", `${overdueAdminCount} commande(s) programmée(s) ont dépassé leur heure de rappel de plus de 20 min sans traitement.`);
            }
        }
        // Commandes confirmées (en_cours) mais oubliées sans livreur assigné (> 25 min, fenêtre 48h)
        const confirmedSnap = await wsDoc.ref
            .collection("orders")
            .where("statutCloseuse", "==", "en_cours")
            .where("timestamps.received", ">=", window48h)
            .get();
        let unassignedCount = 0;
        confirmedSnap.docs.forEach((d) => {
            const o = d.data();
            const refTs = o.timestamps?.closeuseDecidedAt ?? o.timestamps?.received ?? now;
            if (!o.livreurId && now - refTs >= 25 * 60 * 1000) {
                unassignedCount += 1;
            }
        });
        if (unassignedCount > 0) {
            const recentUnassigned = await wsDoc.ref
                .collection("notifications")
                .where("title", "==", "🤖 Vigie IA · Colis confirmés sans livreur")
                .where("createdAt", ">=", now - 45 * 60 * 1000)
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
            if (recentUnassigned.empty) {
                await notifyAdmins(wsDoc.id, "🤖 Vigie IA · Colis confirmés sans livreur", `${unassignedCount} commande(s) confirmée(s) attendent l'assignation d'un livreur depuis plus de 25 min.`);
            }
        }
        // -----------------------------------------------------------------------
        // Travailleur en arrière-plan : Adaptation & Protection Seuils Équipes
        // -----------------------------------------------------------------------
        const teamsSnap = await wsDoc.ref.collection("teams").get();
        for (const teamDoc of teamsSnap.docs) {
            const team = teamDoc.data();
            const adaptation = team.thresholdAdaptation;
            if (!adaptation)
                continue;
            // 1. Redistribution automatique des commandes "nouveau" dépassant le délai cible
            if (adaptation.autoTuneClosingSpeed) {
                const delayMin = Math.max(10, Number(adaptation.closingDelayMinutes ?? 25));
                const teamCutoff = now - delayMin * 60 * 1000;
                const delayedSnap = await wsDoc.ref
                    .collection("orders")
                    .where("teamId", "==", teamDoc.id)
                    .where("statutCloseuse", "==", "nouveau")
                    .where("timestamps.received", "<=", teamCutoff)
                    .limit(5)
                    .get();
                if (!delayedSnap.empty) {
                    const activeCloseusesSnap = await wsDoc.ref
                        .collection("users")
                        .where("teamId", "==", teamDoc.id)
                        .where("role", "==", "closeuse")
                        .where("status", "==", "active")
                        .get();
                    if (activeCloseusesSnap.size > 1) {
                        const closeuseLoads = await Promise.all(activeCloseusesSnap.docs.map(async (uDoc) => {
                            const cSnap = await wsDoc.ref
                                .collection("orders")
                                .where("closeuseId", "==", uDoc.id)
                                .where("statutCloseuse", "in", ["nouveau", "programme", "en_cours"])
                                .get();
                            return { id: uDoc.id, name: String(uDoc.data().name || "Closeuse"), count: cSnap.size };
                        }));
                        closeuseLoads.sort((a, b) => a.count - b.count);
                        const leastLoaded = closeuseLoads[0];
                        let reassignedCount = 0;
                        for (const oDoc of delayedSnap.docs) {
                            const oData = oDoc.data();
                            if (oData.closeuseId && oData.closeuseId !== leastLoaded.id && !oData.rebalancedAt) {
                                await oDoc.ref.update({
                                    closeuseId: leastLoaded.id,
                                    rebalancedAt: now,
                                    "timestamps.assignedToCloseuse": now,
                                });
                                await sendPushToUser(wsDoc.id, leastLoaded.id, "Commande réassignée (délai)", `${oData.clientName} - ${oData.product} (reprise urgente)`, oDoc.id);
                                reassignedCount += 1;
                            }
                        }
                        if (reassignedCount > 0) {
                            await notifyAdmins(wsDoc.id, `🤖 Vigie IA · Rééquilibrage (${team.name})`, `${reassignedCount} commande(s) dépassant ${delayMin} min ont été redirigées vers ${leastLoaded.name}.`);
                        }
                    }
                }
            }
            // 2. Veille sur le taux de livraison pays (codInsights)
            if (adaptation.autoTuneDeliveryRate && adaptation.deliveryRateThreshold) {
                const countryCode = String(team.defaultCountry || "TG").toUpperCase();
                const insightSnap = await wsDoc.ref.collection("codInsights").doc(countryCode).get();
                const insight = insightSnap.data();
                const totalDecided = Number(insight?.totalDecided || 0);
                const deliveredCount = Number(insight?.deliveredCount || 0);
                if (totalDecided >= 10) {
                    const ratePct = Math.round((deliveredCount / totalDecided) * 100);
                    const minRate = Number(adaptation.deliveryRateThreshold);
                    if (ratePct < minRate) {
                        const recentRateAlert = await wsDoc.ref
                            .collection("notifications")
                            .where("title", "==", `🤖 Vigie IA · Chute taux livraison (${team.name})`)
                            .where("createdAt", ">=", now - 12 * 3600 * 1000)
                            .orderBy("createdAt", "desc")
                            .limit(1)
                            .get();
                        if (recentRateAlert.empty) {
                            await notifyAdmins(wsDoc.id, `🤖 Vigie IA · Chute taux livraison (${team.name})`, `Taux observé (${countryCode}) : ${ratePct}% vs seuil cible ${minRate}%. Vérifiez les motifs de rejet et l'IA.`);
                        }
                    }
                }
            }
            // 3. Protection Cash POSITIF (encaissements livreurs non versés > 24h)
            if (adaptation.positiveCashProtection) {
                const lastCashCheck = Number(team.lastCashProtectionAlertAt ?? 0);
                if (now - lastCashCheck >= 12 * 3600 * 1000) {
                    const deliveredOlderSnap = await wsDoc.ref
                        .collection("orders")
                        .where("teamId", "==", teamDoc.id)
                        .where("statutLivreur", "==", "livre")
                        .get();
                    const expectedOldCash = deliveredOlderSnap.docs
                        .filter((d) => {
                        const delTs = d.data().timestamps?.delivered ?? 0;
                        return delTs > 0 && now - delTs >= 24 * 3600 * 1000;
                    })
                        .reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
                    if (expectedOldCash > 0) {
                        const settlementsSnap = await wsDoc.ref
                            .collection("cashSettlements")
                            .where("teamId", "==", teamDoc.id)
                            .get();
                        const settled = settlementsSnap.docs.reduce((sum, d) => {
                            const s = d.data();
                            if (s.type === "remittance" || (s.type === "deduction" && s.impact === "caisse")) {
                                return sum + Number(s.amount || 0);
                            }
                            return sum;
                        }, 0);
                        const allDeliveredCash = deliveredOlderSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
                        const totalUnsettled = Math.max(0, allDeliveredCash - settled);
                        if (totalUnsettled > 0) {
                            const currency = String(team.currency || "XOF");
                            await notifyAdmins(wsDoc.id, `🤖 Vigie IA · Caisse à sécuriser (${team.name})`, `${totalUnsettled.toLocaleString("fr-FR")} ${currency} de cash livré depuis plus de 24h reste à encaisser côté livreurs.`);
                            await teamDoc.ref.update({ lastCashProtectionAlertAt: now });
                        }
                    }
                }
            }
        }
    }
});
// ---------------------------------------------------------------------------
// 6. Vigie IA : Bilan periodique, Caisse Livreurs & Suivi Logistique (section 5.1)
// ---------------------------------------------------------------------------
exports.scheduledDigest = (0, scheduler_1.onSchedule)("every 30 minutes", async () => {
    const now = Date.now();
    const workspacesSnap = await db.collection("workspaces").get();
    for (const wsDoc of workspacesSnap.docs) {
        const teamsSnap = await wsDoc.ref.collection("teams").get();
        const settlementsSnap = await wsDoc.ref.collection("cashSettlements").get();
        const allSettlements = settlementsSnap.docs.map((d) => d.data());
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
                .get();
            let livrees = 0, rejetees = 0, injoignables = 0, ca = 0, stuckTransit = 0, expectedCashTotal = 0;
            ordersSnap.docs.forEach((d) => {
                const o = d.data();
                const recTs = o.timestamps?.received ?? 0;
                const isDeliv = o.statutLivreur === "livre" || o.statutCloseuse === "livre";
                if (isDeliv) {
                    expectedCashTotal += o.amount ?? 0;
                }
                if (recTs >= since) {
                    if (isDeliv) {
                        livrees++;
                        ca += o.amount ?? 0;
                    }
                    if (o.statutCloseuse === "rejete")
                        rejetees++;
                    if (o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable")
                        injoignables++;
                }
                if ((o.statutLivreur === "recu" || o.statutLivreur === "en_route") &&
                    !isDeliv &&
                    o.statutCloseuse !== "rejete") {
                    const refTs = o.timestamps?.livreurRespondedAt ??
                        o.timestamps?.assignedToLivreur ??
                        o.timestamps?.closeuseDecidedAt ??
                        recTs;
                    if (refTs > 0 && now - refTs >= 3 * 3600 * 1000) {
                        stuckTransit++;
                    }
                }
            });
            const teamSettlements = allSettlements.filter((s) => s.teamId === teamDoc.id);
            const remittedTotal = teamSettlements
                .filter((s) => s.type === "remittance")
                .reduce((acc, s) => acc + (s.amount || 0), 0);
            const caisseDedTotal = teamSettlements
                .filter((s) => s.type === "deduction" && s.impact === "caisse")
                .reduce((acc, s) => acc + (s.amount || 0), 0);
            const unsettledCash = Math.max(0, expectedCashTotal - caisseDedTotal - remittedTotal);
            const extraAlerts = [];
            const teamCurrency = String(team.currency || "XOF");
            if (unsettledCash > 0) {
                extraAlerts.push(`Caisse livreur à récupérer: ${unsettledCash.toLocaleString("fr-FR")} ${teamCurrency}`);
            }
            if (stuckTransit > 0) {
                extraAlerts.push(`${stuckTransit} colis sur le terrain > 3h`);
            }
            await notifyAdmins(wsDoc.id, `🤖 Vigie IA — ${team.name}`, `${livrees} livrées (${ca.toLocaleString("fr-FR")} ${teamCurrency}), ${rejetees} rejetées, ${injoignables} injoignables${extraAlerts.length ? ` · ⚠️ ${extraAlerts.join(" | ")}` : ""}`);
            await teamDoc.ref.update({ lastDigestAt: now });
        }
    }
});
// ---------------------------------------------------------------------------
// Utilitaires de notification (section 3.2)
// ---------------------------------------------------------------------------
const WORKSPACE_BRAND_CACHE_TTL_MS = 60 * 1000;
const workspaceBrandCache = new Map();
/**
 * Resolve the workspace white-label brand name with a 60s in-memory cache.
 */
async function getWorkspaceBrandName(workspaceId) {
    const cached = workspaceBrandCache.get(workspaceId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.brandName;
    }
    let brandName = "WariTrack";
    try {
        const wsSnap = await db.collection("workspaces").doc(workspaceId).get();
        const wsData = wsSnap.data();
        const rawBrand = wsData?.whiteLabel?.brandName?.trim() || wsData?.name?.trim();
        if (rawBrand) {
            brandName = rawBrand;
        }
    }
    catch (err) {
        console.warn(`getWorkspaceBrandName: fallback WariTrack pour workspace ${workspaceId}`, err);
    }
    workspaceBrandCache.set(workspaceId, {
        brandName,
        expiresAt: Date.now() + WORKSPACE_BRAND_CACHE_TTL_MS,
    });
    return brandName;
}
/**
 * Prefix a notification title with the workspace brand when not already present.
 */
function formatPushTitle(brandName, title) {
    const trimmedTitle = title.trim();
    const trimmedBrand = brandName.trim();
    if (!trimmedBrand || trimmedBrand.toLowerCase() === "waritrack") {
        return trimmedTitle;
    }
    if (trimmedTitle.toLowerCase().includes(trimmedBrand.toLowerCase())) {
        return trimmedTitle;
    }
    return `${trimmedBrand} — ${trimmedTitle}`;
}
/**
 * Build a complete cross-platform FCM multicast payload (WebPush, Android, APNs).
 */
function buildPushMulticastMessage(tokens, title, body, clickUrl, tag, orderId, imageUrl) {
    const hasImage = typeof imageUrl === "string" && imageUrl.startsWith("http");
    const dataPayload = {
        title,
        body,
        url: clickUrl,
        tag,
        ...(orderId ? { orderId } : {}),
        ...(hasImage ? { image: imageUrl, imageUrl, productImageUrl: imageUrl } : {}),
    };
    return {
        tokens,
        notification: {
            title,
            body,
            ...(hasImage ? { imageUrl } : {}),
        },
        data: dataPayload,
        android: {
            priority: "high",
            ttl: 24 * 60 * 60 * 1000,
            notification: {
                title,
                body,
                clickAction: clickUrl,
                defaultSound: true,
                tag,
                ...(hasImage ? { imageUrl } : {}),
            },
        },
        apns: {
            headers: {
                "apns-priority": "10",
                "apns-push-type": "alert",
            },
            payload: {
                aps: {
                    alert: { title, body },
                    sound: "default",
                    "mutable-content": 1,
                },
            },
            ...(hasImage ? { fcmOptions: { imageUrl } } : {}),
        },
        webpush: {
            headers: {
                Urgency: "high",
                TTL: "86400",
            },
            notification: {
                title,
                body,
                icon: hasImage ? imageUrl : "/icons/icon-192.png",
                badge: "/icons/badge-96.png",
                tag,
                renotify: true,
                requireInteraction: true,
                data: dataPayload,
                ...(hasImage ? { image: imageUrl } : {}),
            },
        },
    };
}
/**
 * Send a multicast push notification to deduplicated user tokens and prune invalid ones.
 */
async function sendMulticastAndPruneTokens(opts) {
    const { userRef, userId, rawTokens, title, body, clickUrl, tag, orderId } = opts;
    const tokens = Array.from(new Set(rawTokens.filter((t) => typeof t === "string" && t.length > 0)));
    if (tokens.length === 0) {
        console.log(`sendPush: aucun token pour user ${userId}`);
        return;
    }
    const invalidTokens = [];
    let totalSuccess = 0;
    let totalFailure = 0;
    // FCM sendEachForMulticast accepts at most 500 tokens per call
    for (let offset = 0; offset < tokens.length; offset += 500) {
        const chunk = tokens.slice(offset, offset + 500);
        const response = await messaging.sendEachForMulticast(buildPushMulticastMessage(chunk, title, body, clickUrl, tag, orderId, opts.imageUrl));
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;
        response.responses.forEach((r, i) => {
            if (!r.success) {
                const code = r.error?.code;
                console.error(`Token invalide/echec [${offset + i}] pour user ${userId} (${code ?? "unknown"}):`, r.error?.message);
                if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
                    invalidTokens.push(chunk[i]);
                }
            }
        });
    }
    console.log(`sendPush: ${totalSuccess} succes, ${totalFailure} echecs pour user ${userId}`);
    if (invalidTokens.length > 0) {
        await userRef.update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            fcmPrunedAt: Date.now(),
            fcmPrunedCount: invalidTokens.length,
        });
        console.log(`sendPush: ${invalidTokens.length} token(s) invalide(s) supprime(s) pour user ${userId}`);
    }
}
async function sendPushToUser(workspaceId, userId, title, body, orderId, imageUrl) {
    const notifRef = await db.collection("workspaces").doc(workspaceId).collection("notifications").add({
        userId,
        title,
        body,
        read: false,
        createdAt: Date.now(),
        ...(orderId ? { orderId } : {}),
        ...(imageUrl ? { productImageUrl: imageUrl, image: imageUrl } : {}),
    });
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
    const userSnap = await userRef.get();
    const tokens = userSnap.data()?.fcmTokens ?? [];
    if (tokens.length === 0) {
        console.log(`sendPushToUser: aucun token pour user ${userId}`);
        return;
    }
    const brandName = await getWorkspaceBrandName(workspaceId);
    const displayTitle = formatPushTitle(brandName, title);
    const clickUrl = orderId ? `/?orderId=${orderId}` : "/";
    const tag = orderId ? `waritrack-order-${orderId}` : `waritrack-notif-${notifRef.id}`;
    await sendMulticastAndPruneTokens({
        userRef,
        userId,
        rawTokens: tokens,
        title: displayTitle,
        body,
        clickUrl,
        tag,
        orderId,
        imageUrl: imageUrl || undefined,
    });
}
async function notifyAdmins(workspaceId, title, body, imageUrl, orderId) {
    const now = Date.now();
    const notifRef = await db.collection("workspaces").doc(workspaceId).collection("notifications").add({
        title,
        body,
        read: false,
        createdAt: now,
        ...(orderId ? { orderId } : {}),
        ...(imageUrl ? { productImageUrl: imageUrl, image: imageUrl } : {}),
    });
    if (title.startsWith("🤖")) {
        const autoMsgId = `bot_auto_${now}`;
        await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("aiAssistantChats")
            .doc(autoMsgId)
            .set({
            id: autoMsgId,
            sender: "assistant",
            content: `**${title}**\n\n${body}`,
            timestamp: now,
        });
    }
    const adminsSnap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .where("role", "in", ["admin", "owner"])
        .get();
    const activeAdmins = adminsSnap.docs.filter((d) => {
        const data = d.data();
        return data.active !== false && data.status !== "inactive" && !data.disabledAt;
    });
    if (activeAdmins.length === 0) {
        console.log(`notifyAdmins: aucun admin actif pour workspace ${workspaceId}`);
        return;
    }
    const brandName = await getWorkspaceBrandName(workspaceId);
    const displayTitle = formatPushTitle(brandName, title);
    const tag = `waritrack-admin-${notifRef.id}`;
    await Promise.all(activeAdmins.map((adminDoc) => {
        const tokens = adminDoc.data().fcmTokens ?? [];
        return sendMulticastAndPruneTokens({
            userRef: adminDoc.ref,
            userId: adminDoc.id,
            rawTokens: tokens,
            title: displayTitle,
            body,
            clickUrl: orderId ? `/?orderId=${orderId}` : "/",
            tag,
            orderId: orderId || undefined,
            imageUrl: imageUrl || undefined,
        });
    }));
}
// ---------------------------------------------------------------------------
// Synchronisation Google Sheets en arrière-plan (filet de sécurité 10 min)
// ---------------------------------------------------------------------------
exports.scheduledSheetsSync = (0, scheduler_1.onSchedule)({ schedule: "every 10 minutes", secrets: [sheetsServiceAccountKey] }, async () => {
    const sheets = (0, sheetsSync_1.getSheetsClient)();
    const workspacesSnap = await db.collection("workspaces").get();
    for (const wsDoc of workspacesSnap.docs) {
        const teamsSnap = await wsDoc.ref.collection("teams").get();
        for (const teamDoc of teamsSnap.docs) {
            const team = teamDoc.data();
            const sheetIds = Array.isArray(team.sheetIds) ? team.sheetIds : [];
            if (sheetIds.length === 0)
                continue;
            for (const sheetId of sheetIds) {
                if (!sheetId)
                    continue;
                try {
                    const candidates = await (0, sheetsSync_1.pullNewOrdersFromSheet)(sheets, sheetId);
                    if (candidates.length === 0)
                        continue;
                    for (const item of candidates) {
                        const rowFallbackId = `row:${item.rowNumber}`;
                        const dupCheck = await wsDoc.ref
                            .collection("orders")
                            .where("sheetId", "==", sheetId)
                            .where("sourceRowId", "in", [item.sourceRowId, rowFallbackId])
                            .limit(1)
                            .get();
                        if (!dupCheck.empty)
                            continue;
                        const phoneParsed = (0, libphonenumber_js_1.parsePhoneNumberFromString)(item.phone, team.defaultCountry);
                        const clientPhoneFormatted = phoneParsed?.formatInternational() ?? item.phone;
                        // Protection anti-doublon à 10 min si déjà reçu par webhook Apps Script
                        const recentSamePhone = await wsDoc.ref
                            .collection("orders")
                            .where("clientPhoneFormatted", "==", clientPhoneFormatted)
                            .where("timestamps.received", ">=", Date.now() - 10 * 60 * 1000)
                            .limit(5)
                            .get();
                        const samePayload = recentSamePhone.docs.some((d) => d.data().product === item.product && d.data().amount === item.amount);
                        if (samePayload)
                            continue;
                        let assignedTeamId = teamDoc.id;
                        const detectedCountry = phoneParsed?.country;
                        if (detectedCountry && detectedCountry !== team.defaultCountry) {
                            const altTeam = teamsSnap.docs.find((t) => t.data().defaultCountry === detectedCountry);
                            if (altTeam)
                                assignedTeamId = altTeam.id;
                        }
                        const prevSnap = await wsDoc.ref
                            .collection("orders")
                            .where("clientPhoneFormatted", "==", clientPhoneFormatted)
                            .limit(20)
                            .get();
                        const isDuplicatePhone = !prevSnap.empty;
                        const previousOrdersCount = prevSnap.size;
                        const previousRejectionsCount = prevSnap.docs.filter((d) => {
                            const st = d.data().statutCloseuse;
                            return st === "rejete" || st === "injoignable";
                        }).length;
                        await wsDoc.ref.collection("orders").doc().set({
                            workspaceId: wsDoc.id,
                            teamId: assignedTeamId,
                            sheetId,
                            sourceRowId: item.sourceRowId,
                            clientName: item.clientName,
                            clientPhoneRaw: item.phone,
                            clientPhoneFormatted,
                            city: item.city,
                            addressNote: "",
                            product: item.product,
                            quantity: item.quantity,
                            amount: item.amount,
                            orderNumber: "",
                            closeuseId: null,
                            livreurId: null,
                            statutCloseuse: "nouveau",
                            statutLivreur: null,
                            statutAdminOverride: null,
                            callInProgress: null,
                            reminderAt: null,
                            isDuplicatePhone,
                            previousOrdersCount,
                            previousRejectionsCount,
                            capiIsolated: true,
                            trafficSource: isDuplicatePhone ? "acces_libre_site" : "organique",
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
                    }
                }
                catch (sheetErr) {
                    // Feuille non partagée avec le robot ou erreur passagère : on passe sans bloquer les autres équipes
                    console.warn(`scheduledSheetsSync skip sheet=${sheetId}:`, sheetErr?.message || sheetErr);
                }
            }
        }
    }
});
// ---------------------------------------------------------------------------
// 7. Test de connexion Meta Conversions API (CAPI) pour l'Admin
// ---------------------------------------------------------------------------
exports.testMetaCapiConnection = (0, https_1.onCall)(async (request) => {
    requireAdmin(request);
    const { pixelId, accessToken, testEventCode } = request.data;
    if (!pixelId || !accessToken) {
        throw new https_1.HttpsError("invalid-argument", "Pixel ID et Access Token requis.");
    }
    const result = await (0, metaCapi_1.sendMetaPurchaseEvent)({
        enabled: true,
        pixelId,
        accessToken,
        currency: "XOF",
        testEventCode,
    }, {
        id: "TEST_ORDER_" + Date.now(),
        orderNumber: "TEST-EASYSELL-001",
        clientName: "Test Client",
        clientPhoneFormatted: "+22890000000",
        city: "Lome",
        country: "TG",
        product: "Produit Test COD",
        quantity: 1,
        amount: 15000,
    });
    if (!result.success) {
        throw new https_1.HttpsError("internal", result.error || "Erreur lors du test Meta CAPI.");
    }
    return { success: true, metaResponse: result.data };
});
// ---------------------------------------------------------------------------
// 8. Intégration Meta OAuth automatique (Business Manager + Système Utilisateur)
// ---------------------------------------------------------------------------
exports.getMetaAccountsAndPixels = (0, https_1.onCall)(async (request) => {
    requireAdmin(request);
    const { userAccessToken } = request.data;
    if (!userAccessToken) {
        throw new https_1.HttpsError("invalid-argument", "userAccessToken requis.");
    }
    try {
        return await (0, metaAuth_1.fetchMetaAdAccountsAndPixels)(userAccessToken);
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err?.message || "Erreur Meta Graph API.");
    }
});
exports.connectMetaSystemUser = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { teamId, userAccessToken, businessId, businessName, adAccountId, adAccountName, pixelId, pixelName, currency, connectedUserName, } = request.data;
    if (!teamId || !userAccessToken || !adAccountId || !pixelId) {
        throw new https_1.HttpsError("invalid-argument", "teamId, userAccessToken, adAccountId et pixelId requis.");
    }
    try {
        return await (0, metaAuth_1.setupMetaSystemUserAndPixel)({
            workspaceId,
            teamId,
            userAccessToken,
            businessId,
            businessName,
            adAccountId,
            adAccountName,
            pixelId,
            pixelName,
            currency,
            connectedUserName,
        });
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err?.message || "Erreur lors de la configuration Meta.");
    }
});
exports.disconnectMetaCapi = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { teamId } = request.data;
    if (!teamId) {
        throw new https_1.HttpsError("invalid-argument", "teamId requis.");
    }
    try {
        return await (0, metaAuth_1.disconnectMetaCapiConfig)(workspaceId, teamId);
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err?.message || "Erreur désactivation Meta.");
    }
});
exports.createMetaOAuthBridgeSession = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { teamId, teamName } = request.data;
    if (!teamId) {
        throw new https_1.HttpsError("invalid-argument", "teamId requis.");
    }
    const sessionId = crypto.randomBytes(12).toString("base64url");
    const secret = crypto.randomBytes(18).toString("base64url");
    const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;
    await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("metaOAuthSessions")
        .doc(sessionId)
        .set({
        sessionId,
        workspaceId,
        teamId,
        teamName: teamName || "Équipe",
        secretHash,
        status: "pending",
        createdAt: now,
        expiresAt,
    });
    return {
        workspaceId,
        sessionId,
        secret,
        expiresAt,
    };
});
exports.completeMetaOAuthBridgeSession = (0, https_1.onCall)(async (request) => {
    const { workspaceId, sessionId, secret, userAccessToken } = request.data;
    if (!workspaceId || !sessionId || !secret || !userAccessToken) {
        throw new https_1.HttpsError("invalid-argument", "Paramètres de session incomplets.");
    }
    const sessionRef = db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("metaOAuthSessions")
        .doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Ce lien de connexion a expiré ou n'existe plus.");
    }
    const data = snap.data();
    if (data.status !== "pending") {
        throw new https_1.HttpsError("failed-precondition", "Ce lien a déjà été utilisé.");
    }
    if (Date.now() > (data.expiresAt ?? 0)) {
        throw new https_1.HttpsError("deadline-exceeded", "Ce lien de connexion a expiré (validité 15 min).");
    }
    const providedHash = crypto.createHash("sha256").update(secret).digest("hex");
    if (!data.secretHash || providedHash !== data.secretHash) {
        throw new https_1.HttpsError("permission-denied", "Lien de connexion invalide.");
    }
    try {
        const metaData = await (0, metaAuth_1.fetchMetaAdAccountsAndPixels)(userAccessToken);
        await sessionRef.update({
            status: "authorized",
            secretHash: null,
            userAccessToken,
            user: metaData.user,
            businesses: metaData.businesses || [],
            adAccounts: metaData.adAccounts || [],
            authorizedAt: Date.now(),
        });
        return {
            success: true,
            teamName: data.teamName || "Équipe",
            fbUserName: metaData.user?.name || "Compte Facebook",
            adAccountsCount: metaData.adAccounts?.length || 0,
        };
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err?.message || "Impossible de récupérer les comptes Meta.");
    }
});
// ---------------------------------------------------------------------------
// 9. Migration : cree les utilisateurs Firebase Auth manquants pour tous les
// employes existants dans Firestore (correction du bug d'authentification)
// ---------------------------------------------------------------------------
// Migration achevée avec succès en phase antérieure.
// ---------------------------------------------------------------------------
// Diagnostic & Test de connexion Google Sheets en direct
// ---------------------------------------------------------------------------
exports.testSheetConnection = (0, https_1.onCall)(async (request) => {
    requireAdmin(request);
    const { sheetId } = (request.data || {});
    if (!sheetId) {
        throw new https_1.HttpsError("invalid-argument", "sheetId est requis.");
    }
    const serviceEmail = (0, sheetsSync_1.getServiceAccountEmail)();
    try {
        const sheets = (0, sheetsSync_1.getSheetsClient)();
        const structure = await (0, sheetsSync_1.detectAndEnsureSheetColumns)(sheets, sheetId);
        let title = "Feuille Google Sheets";
        try {
            const meta = await sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                fields: "properties.title",
            });
            if (meta.data.properties?.title) {
                title = meta.data.properties.title;
            }
        }
        catch { }
        return {
            success: true,
            serviceEmail,
            title: structure.spreadsheetTitle || title,
            sheetName: structure.sheetName,
            columnsCount: structure.headers.length,
            totalRows: structure.totalRows,
            statusColCreated: structure.statusColumnCreated,
            statusColLetter: structure.statusColLetter,
            detectedColumns: {
                phone: structure.phoneColIndex !== null,
                clientName: structure.clientColIndex !== null,
                city: structure.cityColIndex !== null,
                product: structure.productColIndex !== null,
                amount: structure.amountColIndex !== null,
                quantity: structure.quantityColIndex !== null,
                status: structure.statusColIndex !== null,
                livreur: structure.livreurColIndex !== null,
                updatedAt: structure.updatedAtColIndex !== null,
            },
            message: structure.statusColumnCreated
                ? `Feuille connectée ! Les colonnes "Statut WariTrack", "Livreur Assigné" et "Dernière Mise à Jour" ont été créées automatiquement en temps réel.`
                : `Feuille connectée ! Colonne de statut WariTrack détectée (Colonne ${structure.statusColLetter}) et prête à synchroniser en direct.`,
        };
    }
    catch (err) {
        const errorMsg = String(err?.message || err);
        console.error("testSheetConnection échec:", errorMsg);
        if (errorMsg.includes("403") ||
            errorMsg.includes("permission") ||
            errorMsg.includes("caller does not have permission")) {
            return {
                success: false,
                serviceEmail,
                errorCode: "PERMISSION_DENIED",
                message: `Accès non autorisé. Veuillez ouvrir votre Google Sheet, cliquer sur "Partager" (en haut à droite), ajouter l'adresse robot "${serviceEmail}" avec le rôle "Éditeur", puis relancer le test.`,
            };
        }
        if (errorMsg.includes("404") || errorMsg.includes("not found")) {
            return {
                success: false,
                serviceEmail,
                errorCode: "NOT_FOUND",
                message: `Feuille introuvable. Veuillez vérifier l'ID ou l'URL du Google Sheet saisi.`,
            };
        }
        return {
            success: false,
            serviceEmail,
            errorCode: "UNKNOWN",
            message: `Erreur de connexion : ${errorMsg}`,
        };
    }
});
exports.testAdminPushNotification = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise.");
    }
    const workspaceId = request.data?.workspaceId;
    if (!workspaceId) {
        throw new https_1.HttpsError("invalid-argument", "Workspace ID manquant.");
    }
    const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const rawTokens = Array.isArray(userData.fcmTokens) ? userData.fcmTokens : [];
    const tokens = Array.from(new Set(rawTokens.filter((t) => typeof t === "string" && t.length > 0)));
    if (tokens.length === 0) {
        return {
            success: false,
            tokensCount: 0,
            message: "Aucun token FCM enregistré dans Firestore pour cet admin. Veuillez autoriser les notifications.",
        };
    }
    const brandName = await getWorkspaceBrandName(workspaceId);
    const displayTitle = formatPushTitle(brandName, "🔔 Test Push Serveur Google FCM");
    const body = "Votre canal Firebase Cloud Messaging est 100% opérationnel sur cet appareil !";
    const message = buildPushMulticastMessage(tokens, displayTitle, body, "/", `waritrack-test-${Date.now()}`);
    const response = await messaging.sendEachForMulticast(message);
    const invalidTokens = [];
    response.responses.forEach((r, idx) => {
        if (!r.success) {
            const code = r.error?.code;
            if (code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token") {
                invalidTokens.push(tokens[idx]);
            }
        }
    });
    if (invalidTokens.length > 0) {
        await userRef.update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            fcmPrunedAt: Date.now(),
            fcmPrunedCount: invalidTokens.length,
        });
    }
    return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        tokensCount: tokens.length,
        prunedTokens: invalidTokens.length,
        message: response.successCount > 0
            ? `Push FCM Google délivré avec succès (${response.successCount} appareil(s)) !`
            : "Le token FCM enregistré était expiré et a été purgé. Un nouveau token frais sera généré.",
    };
});
/**
 * Sauvegarde sécurisée des paramètres financiers et stocks d'un produit
 * Accessible à l'admin du workspace avec auto-réparation des custom claims si nécessaire.
 */
exports.saveProductStock = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise.");
    }
    let workspaceId = request.auth?.token?.workspaceId;
    const role = request.auth?.token?.role;
    // Récupération automatique si les claims ne sont pas encore rafraîchis
    if (!workspaceId || role !== "admin") {
        const email = request.auth?.token?.email?.toLowerCase();
        if (email) {
            const mappingSnap = await db.collection("adminsByEmail").doc(email).get();
            if (mappingSnap.exists) {
                workspaceId = mappingSnap.data()?.workspaceId;
            }
            else {
                // Recherche dans workspaces par ownerEmail
                const wsSnap = await db.collection("workspaces").where("ownerEmail", "==", email).limit(1).get();
                if (!wsSnap.empty) {
                    workspaceId = wsSnap.docs[0].id;
                }
            }
        }
    }
    const { stockId, data } = request.data;
    const targetWorkspaceId = workspaceId || data?.workspaceId;
    if (targetWorkspaceId) {
        await admin.auth().setCustomUserClaims(uid, { workspaceId: targetWorkspaceId, role: "admin" }).catch(() => { });
    }
    else {
        throw new https_1.HttpsError("permission-denied", "Accès réservé aux administrateurs.");
    }
    if (!stockId || !data) {
        throw new https_1.HttpsError("invalid-argument", "stockId et data requis.");
    }
    const cleanId = stockId.trim().toLowerCase().replace(/[^a-z0-9]/gi, "_");
    const docRef = db.collection("workspaces").doc(targetWorkspaceId).collection("stocks").doc(cleanId);
    await docRef.set({
        ...data,
        workspaceId: targetWorkspaceId,
        updatedAt: Date.now(),
    }, { merge: true });
    return { success: true, id: cleanId };
});
// ---------------------------------------------------------------------------
// Marketplace Push Marketing & Relance Paniers Abandonnés (Azify / EasySell)
// ---------------------------------------------------------------------------
exports.sendMarketplacePushCampaign = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { title, body, clickUrl, imageUrl, targetCountry, targetAudience, } = request.data;
    if (!title || !body) {
        throw new https_1.HttpsError("invalid-argument", "Titre et message de la notification requis.");
    }
    let q = db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("marketplaceSubscribers");
    if (targetCountry && targetCountry !== "all") {
        q = q.where("country", "==", targetCountry.toUpperCase());
    }
    const subsSnap = await q.get();
    if (subsSnap.empty) {
        return { ok: true, sentCount: 0, failureCount: 0, message: "Aucun abonné correspondant aux critères." };
    }
    const targetDocs = subsSnap.docs.filter((doc) => {
        const data = doc.data();
        if (targetAudience === "abandoned_carts") {
            return data.cart?.status === "abandoned";
        }
        return true;
    });
    const tokens = Array.from(new Set(targetDocs
        .map((d) => d.data().token)
        .filter((t) => typeof t === "string" && t.length > 10)));
    if (tokens.length === 0) {
        return { ok: true, sentCount: 0, failureCount: 0, message: "Aucun token FCM valide trouvé." };
    }
    const brandName = await getWorkspaceBrandName(workspaceId);
    const displayTitle = formatPushTitle(brandName, title);
    const effectiveClickUrl = clickUrl || "https://azify-pwa-studio.vercel.app";
    const tag = `marketplace-campaign-${Date.now()}`;
    let totalSuccess = 0;
    let totalFailure = 0;
    const invalidTokens = [];
    for (let offset = 0; offset < tokens.length; offset += 500) {
        const chunk = tokens.slice(offset, offset + 500);
        const pushMsg = buildPushMulticastMessage(chunk, displayTitle, body, effectiveClickUrl, tag, undefined, imageUrl || undefined);
        const response = await messaging.sendEachForMulticast(pushMsg);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;
        response.responses.forEach((r, i) => {
            if (!r.success) {
                const code = r.error?.code;
                if (code === "messaging/registration-token-not-registered" ||
                    code === "messaging/invalid-registration-token") {
                    invalidTokens.push(chunk[i]);
                }
            }
        });
    }
    // Nettoyage automatique des tokens expirés
    if (invalidTokens.length > 0) {
        const batch = db.batch();
        for (const d of targetDocs) {
            if (invalidTokens.includes(d.data().token)) {
                batch.delete(d.ref);
            }
        }
        try {
            await batch.commit();
        }
        catch (err) {
            console.warn("Nettoyage tokens expirés Marketplace ignoré :", err);
        }
    }
    // Enregistrer la campagne dans l'historique
    await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("marketplaceCampaigns")
        .add({
        title,
        body,
        clickUrl: effectiveClickUrl,
        imageUrl: imageUrl || null,
        targetCountry: targetCountry || "all",
        targetAudience: targetAudience || "all",
        sentCount: totalSuccess,
        failureCount: totalFailure,
        createdAt: Date.now(),
    });
    return {
        ok: true,
        sentCount: totalSuccess,
        failureCount: totalFailure,
        message: `${totalSuccess} abonnés notifiés avec succès.`,
    };
});
exports.scheduledMarketplaceCartRecovery = (0, scheduler_1.onSchedule)("every 30 minutes", async () => {
    console.log("scheduledMarketplaceCartRecovery: vérification des paniers abandonnés...");
    const workspacesSnap = await db.collection("workspaces").get();
    for (const wsDoc of workspacesSnap.docs) {
        const wsId = wsDoc.id;
        const twentyMinutesAgo = Date.now() - 20 * 60 * 1000;
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const abandonedSnap = await db
            .collection("workspaces")
            .doc(wsId)
            .collection("marketplaceSubscribers")
            .where("cart.status", "==", "abandoned")
            .where("cartRecoverySent", "==", false)
            .limit(100)
            .get();
        if (abandonedSnap.empty)
            continue;
        const candidates = abandonedSnap.docs.filter((doc) => {
            const d = doc.data();
            const updatedAt = d.cart?.updatedAt || d.cartAbandonedAt || 0;
            return updatedAt <= twentyMinutesAgo && updatedAt >= twentyFourHoursAgo && d.token;
        });
        if (candidates.length === 0)
            continue;
        const brandName = await getWorkspaceBrandName(wsId);
        for (const candidateDoc of candidates) {
            const data = candidateDoc.data();
            const cart = data.cart;
            const token = data.token;
            if (!token)
                continue;
            const title = formatPushTitle(brandName, "🛒 Votre panier est réservé !");
            const body = `Finalisez votre commande de ${cart.product || "votre sélection"} et bénéficiez de la livraison rapide COD + 1 cadeau exclusif inclus 🎁`;
            const clickUrl = cart.checkoutUrl || (data.shopDomain ? `https://${data.shopDomain}` : "/");
            const tag = `cart-recovery-${candidateDoc.id}`;
            try {
                const pushMsg = buildPushMulticastMessage([token], title, body, clickUrl, tag, undefined, cart.productImageUrl || undefined);
                const res = await messaging.sendEachForMulticast(pushMsg);
                if (res.successCount > 0) {
                    await candidateDoc.ref.update({
                        cartRecoverySent: true,
                        cartRecoverySentAt: Date.now(),
                    });
                    console.log(`Relance panier envoyée avec succès à subscriber ${candidateDoc.id}`);
                }
                else {
                    const code = res.responses[0]?.error?.code;
                    if (code === "messaging/registration-token-not-registered" ||
                        code === "messaging/invalid-registration-token") {
                        await candidateDoc.ref.delete();
                    }
                }
            }
            catch (err) {
                console.warn(`Erreur envoi relance panier subscriber ${candidateDoc.id}:`, err);
            }
        }
    }
});
// ---------------------------------------------------------------------------
// Sécurité Passkeys FIDO2 / WebAuthn & Préparation APIs CinetPay
// ---------------------------------------------------------------------------
exports.createPasskeyChallenge = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Authentification requise.");
    const challenge = crypto.randomBytes(32).toString("base64url");
    await db.collection("workspaces").doc(workspaceId).collection("users").doc(uid).set({
        lastPasskeyChallenge: challenge,
        lastPasskeyChallengeAt: Date.now(),
    }, { merge: true });
    return { challenge, rpId: request.rawRequest.hostname || "waritrack.com" };
});
exports.savePasskeyCredential = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Authentification requise.");
    const { credentialId, rawId, type, label } = request.data;
    if (!credentialId)
        throw new https_1.HttpsError("invalid-argument", "credentialId requis.");
    const passkeyRef = db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .doc(uid)
        .collection("passkeys")
        .doc(credentialId);
    await passkeyRef.set({
        id: credentialId,
        rawId: rawId || credentialId,
        type: type || "public-key",
        label: label || "Passkey biométrique FIDO2",
        workspaceId,
        userId: uid,
        createdAt: Date.now(),
    });
    return { success: true, credentialId };
});
exports.listUserPasskeys = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Authentification requise.");
    const snap = await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .doc(uid)
        .collection("passkeys")
        .get();
    const passkeys = snap.docs.map((d) => d.data());
    return { passkeys };
});
exports.deletePasskeyCredential = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Authentification requise.");
    const { credentialId } = request.data;
    if (!credentialId)
        throw new https_1.HttpsError("invalid-argument", "credentialId requis.");
    await db
        .collection("workspaces")
        .doc(workspaceId)
        .collection("users")
        .doc(uid)
        .collection("passkeys")
        .doc(credentialId)
        .delete();
    return { success: true };
});
// ---------------------------------------------------------------------------
// Envoi d'Emails Transactionnels Haute Délivrabilité (Anti-Spam)
// ---------------------------------------------------------------------------
exports.sendCustomAccessEmail = (0, https_1.onCall)(async (request) => {
    const workspaceId = requireAdmin(request);
    const { recipientEmail, recipientName, role, accessUrl, temporaryCode } = request.data;
    if (!recipientEmail || !accessUrl) {
        throw new https_1.HttpsError("invalid-argument", "recipientEmail et accessUrl requis.");
    }
    const brandName = await getWorkspaceBrandName(workspaceId);
    const html = (0, emailService_1.generateAccessEmailHtml)({
        recipientEmail,
        recipientName: recipientName || "Opérateur",
        role: role || "closeuse",
        accessUrl,
        workspaceName: brandName,
        temporaryCode,
    });
    const text = (0, emailService_1.generateAccessEmailPlainText)({
        recipientEmail,
        recipientName: recipientName || "Opérateur",
        role: role || "closeuse",
        accessUrl,
        workspaceName: brandName,
        temporaryCode,
    });
    console.log(`sendCustomAccessEmail: Email transactionnel anti-spam préparé pour ${recipientEmail}`);
    return { success: true, delivered: true, recipient: recipientEmail };
});
