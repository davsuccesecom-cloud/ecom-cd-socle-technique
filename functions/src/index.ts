import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as bcrypt from "bcryptjs";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  writeOrderStatusToSheet,
  detectAndEnsureSheetColumns,
  getServiceAccountEmail,
  getSheetsClient,
} from "./sheetsSync";
import { sendMetaPurchaseEvent, sendMetaConfirmedEvent } from "./metaCapi";
import {
  fetchMetaAdAccountsAndPixels,
  setupMetaSystemUserAndPixel,
  disconnectMetaCapiConfig,
} from "./metaAuth";
export { trackSession, shopifyWebhook, getStorefrontTrackerScript } from "./shopifyTracking";
export { aiChatProxy, aiProviders } from "./aiProxy";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const MAX_SESSIONS_PER_ACCESS_LINK = 2;
const ORDER_PURGE_AFTER_DAYS = 3;
const REMINDER_DELAY_MINUTES = 20;
const FINAL_STATUSES = ["livre", "rejete", "injoignable"];

const sheetWebhookSecret = defineSecret("SHEET_WEBHOOK_SECRET");
const sheetsServiceAccountKey = defineSecret("GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY");

// ---------------------------------------------------------------------------
// 1. Authentification par lien d'acces + mot de passe simple (section 10)
// ---------------------------------------------------------------------------

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const authenticateAccess = onCall(async (request) => {
  try {
    const { accessLinkId, password } = request.data as {
      accessLinkId: string;
      password: string;
    };
    if (!accessLinkId || !password) {
      throw new HttpsError("invalid-argument", "Lien d'acces et mot de passe requis.");
    }

    const linkSnap = await db.collectionGroup("accessLinks").where("id", "==", accessLinkId).limit(1).get();
    if (linkSnap.empty) {
      throw new HttpsError("not-found", "Lien d'acces invalide.");
    }

  const linkDoc = linkSnap.docs[0];
  const link = linkDoc.data();

  if (link.disabledAt) {
    throw new HttpsError("permission-denied", "Cet acces a ete desactive.");
  }

  const secretRef = db
    .collection("workspaces")
    .doc(link.workspaceId)
    .collection("accessLinkSecrets")
    .doc(linkDoc.id);
  const secretSnap = await secretRef.get();
  if (!secretSnap.exists) {
    throw new HttpsError("not-found", "Lien d'acces invalide.");
  }
  const secret = secretSnap.data()!;

  const now = Date.now();
  if (secret.lockedUntil && secret.lockedUntil > now) {
    const minutesLeft = Math.ceil((secret.lockedUntil - now) / 60000);
    throw new HttpsError("resource-exhausted", `Trop de tentatives. Reessaie dans ${minutesLeft} min.`);
  }

  const passwordOk = await bcrypt.compare(password, secret.passwordHash);
  if (!passwordOk) {
    const failedAttempts = (secret.failedAttempts ?? 0) + 1;
    const update: Record<string, unknown> = { failedAttempts };
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      update.lockedUntil = now + LOCKOUT_DURATION_MS;
      update.failedAttempts = 0;
    }
    await secretRef.set(update, { merge: true });
    throw new HttpsError("permission-denied", "Mot de passe incorrect.");
  }

  if (secret.failedAttempts || secret.lockedUntil) {
    await secretRef.set(
      { failedAttempts: 0, lockedUntil: admin.firestore.FieldValue.delete() },
      { merge: true }
    );
  }

  const userSnap = await db
    .collection("workspaces")
    .doc(link.workspaceId)
    .collection("users")
    .doc(link.userId)
    .get();
  const user = userSnap.data();
  if (!user || user.status !== "active") {
    throw new HttpsError("permission-denied", "Compte desactive.");
  }

  // Un seul appareil actif par employe : la nouvelle connexion remplace les anciennes
  const newSession = {
    sessionToken: db.collection("_").doc().id,
    deviceLabel: request.rawRequest.headers["user-agent"]?.slice(0, 80) ?? "Appareil inconnu",
    connectedAt: Date.now(),
  };
  await linkDoc.ref.update({ activeSessions: [newSession] });

  await notifyAdmins(
    link.workspaceId,
    "Nouvelle connexion",
    `${user.name} s'est connecte(e) depuis un nouvel appareil.`
  );

  // Persiste les claims sur l'utilisateur Firebase Auth (pas seulement
  // dans ce custom token) pour qu'ils survivent au rafraichissement
  // automatique du ID token par le SDK. Sans ca, workspaceId/role/teamId
  // disparaissent silencieusement apres le premier refresh, ce qui casse
  // validateAccessSession (deconnexion + perte du token FCM) et les
  // regles Firestore (isCloseuse/isLivreur/isSameTeam).
  try {
    await admin.auth().getUser(link.userId);
  } catch (e) {
    if ((e as { code?: string }).code === "auth/user-not-found") {
      await admin.auth().createUser({ uid: link.userId });
    } else {
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
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("authenticateAccess error:", err);
    throw new HttpsError("internal", "Erreur de connexion. Réessaie dans quelques secondes.");
  }
});

// ---------------------------------------------------------------------------
// 1bis. Authentification admin -- systeme multi-entreprises (SaaS)
// ---------------------------------------------------------------------------

export const authenticateAdmin = onCall(async (request) => {
  const uid = request.auth?.uid;
  const email = (request.auth?.token?.email as string | undefined)?.toLowerCase();
  const name = request.auth?.token?.name as string | undefined;

  if (!uid || !email) {
    throw new HttpsError("unauthenticated", "Connexion requise.");
  }

  const mappingRef = db.collection("adminsByEmail").doc(email);
  const mappingSnap = await mappingRef.get();

  if (mappingSnap.exists) {
    const { workspaceId } = mappingSnap.data() as { workspaceId: string };
    await admin.auth().setCustomUserClaims(uid, { workspaceId, role: "admin" });
    return { workspaceId, role: "admin" as const, isNewWorkspace: false };
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
    await mappingRef.set({ workspaceId: wsId, uid, createdAt: Date.now() });
    await admin.auth().setCustomUserClaims(uid, { workspaceId: wsId, role: "admin" });
    return { workspaceId: wsId, role: "admin" as const, isNewWorkspace: false };
  }

  const { workspaceName } = request.data as { workspaceName?: string };
  if (!workspaceName || !workspaceName.trim()) {
    throw new HttpsError("failed-precondition", "NEW_WORKSPACE_NEEDS_NAME");
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

  return { workspaceId: workspaceRef.id, role: "admin" as const, isNewWorkspace: true };
});

// ---------------------------------------------------------------------------
// 1ter. Gestion des acces
// ---------------------------------------------------------------------------

function requireAdmin(request: { auth?: { token?: Record<string, unknown> } }): string {
  const workspaceId = request.auth?.token?.workspaceId as string | undefined;
  const role = request.auth?.token?.role as string | undefined;
  if (!workspaceId || role !== "admin") {
    throw new HttpsError("permission-denied", "Acces reserve aux admins.");
  }
  return workspaceId;
}

function generateAccessLinkId(): string {
  return crypto.randomBytes(9).toString("base64url");
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(8), (b) => chars[b % chars.length]).join("");
}

export const createAccessUser = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { name, phone, role, teamId } = request.data as {
    name: string;
    phone?: string;
    role: "closeuse" | "livreur";
    teamId: string;
  };

  if (!name?.trim() || !teamId || (role !== "closeuse" && role !== "livreur")) {
    throw new HttpsError("invalid-argument", "Nom, role (closeuse/livreur) et equipe requis.");
  }

  const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(teamId).get();
  if (!teamSnap.exists) {
    throw new HttpsError("not-found", "Equipe introuvable.");
  }

  // Creer l'utilisateur dans Firebase Auth (necessaire pour setCustomUserClaims
  // et createCustomToken dans authenticateAccess)
  let firebaseUser: admin.auth.UserRecord;
  try {
    firebaseUser = await admin.auth().createUser({
      displayName: name.trim(),
      // phoneNumber stocke uniquement dans Firestore (evite erreur E.164 Firebase Auth)
    });
  } catch (err: any) {
    // Si l'utilisateur existe deja (par exemple si le numero de telephone est
    // deja utilise), on essaie de le recuperer
    if (err?.code === "auth/phone-number-already-exists" && phone?.trim()) {
      try {
        firebaseUser = await admin.auth().getUserByPhoneNumber(phone.trim());
      } catch {
        throw new HttpsError("internal", "Impossible de creer ou recuperer l'utilisateur Firebase Auth.");
      }
    } else {
      throw new HttpsError("internal", "Impossible de creer l'utilisateur Firebase Auth.");
    }
  }

  const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(firebaseUser.uid);
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

export const regenerateAccessPassword = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { accessLinkId } = request.data as { accessLinkId: string };
  if (!accessLinkId) {
    throw new HttpsError("invalid-argument", "accessLinkId requis.");
  }

  const linkSnap = await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("accessLinks")
    .where("id", "==", accessLinkId)
    .limit(1)
    .get();
  if (linkSnap.empty) {
    throw new HttpsError("not-found", "Lien d'acces introuvable.");
  }
  const linkDoc = linkSnap.docs[0];

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("accessLinkSecrets")
    .doc(linkDoc.id)
    .set(
      { passwordHash, failedAttempts: 0, lockedUntil: admin.firestore.FieldValue.delete() },
      { merge: true }
    );

  await linkDoc.ref.update({ activeSessions: [] });

  return { password };
});

export const setAccessLinkStatus = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { accessLinkId, disabled } = request.data as { accessLinkId: string; disabled: boolean };
  if (!accessLinkId || typeof disabled !== "boolean") {
    throw new HttpsError("invalid-argument", "accessLinkId et disabled requis.");
  }

  const linkSnap = await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("accessLinks")
    .where("id", "==", accessLinkId)
    .limit(1)
    .get();
  if (linkSnap.empty) {
    throw new HttpsError("not-found", "Lien d'acces introuvable.");
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
    } catch (err) {
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
export const validateAccessSession = onCall(async (request) => {
  const authHeader = request.rawRequest.headers.authorization;
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!request.auth || !rawToken) {
    throw new HttpsError("unauthenticated", "Session Firebase absente.");
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(rawToken, true); // checkRevoked = true
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/id-token-revoked") {
      throw new HttpsError("permission-denied", "Session revoquee.");
    }
    throw new HttpsError("unauthenticated", "Session invalide.");
  }

  const workspaceId = decoded.workspaceId as string | undefined;
  const userId = decoded.uid;

  if (!workspaceId) {
    throw new HttpsError("permission-denied", "Workspace introuvable.");
  }

  const linkSnap = await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("accessLinks")
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (linkSnap.empty) {
    throw new HttpsError("permission-denied", "Acces introuvable.");
  }

  const link = linkSnap.docs[0].data();

  if (link.disabledAt) {
    await admin.auth().revokeRefreshTokens(userId);
    throw new HttpsError("permission-denied", "Ton acces a ete desactive par l'administrateur.");
  }

  const userSnap = await db.collection("workspaces").doc(workspaceId).collection("users").doc(userId).get();
  const user = userSnap.data();

  if (!user || user.status !== "active") {
    await admin.auth().revokeRefreshTokens(userId);
    throw new HttpsError("permission-denied", "Ton compte a ete desactive.");
  }

  return { valid: true };
});

export const listAccessLinks = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { teamId } = request.data as { teamId: string };
  if (!teamId) {
    throw new HttpsError("invalid-argument", "teamId requis.");
  }

  const usersSnap = await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("users")
    .where("teamId", "==", teamId)
    .get();
  const userIds = usersSnap.docs.map((d) => d.id);
  if (userIds.length === 0) return { links: [] };

  const linksSnap = await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("accessLinks")
    .where("userId", "in", userIds.slice(0, 30))
    .get();

  const links = linksSnap.docs.map((d) => {
    const l = d.data();
    return {
      userId: l.userId as string,
      accessLinkId: l.id as string,
      disabledAt: (l.disabledAt as number | null) ?? null,
      sessionsCount: ((l.activeSessions as unknown[]) ?? []).length,
    };
  });

  return { links };
});

// Suppression definitive d'un employe -- uniquement possible APRES revocation
// de son acces (disabledAt non null), pour garder une trace/controle avant
// toute suppression irreversible. Supprime l'utilisateur, son lien d'acces
// et son secret associe.
export const deleteEmployee = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { userId } = request.data as { userId: string };
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId requis.");
  }

  const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Employe introuvable.");
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
      throw new HttpsError(
        "failed-precondition",
        "Revoque l'acces de cet employe avant de le supprimer."
      );
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
  } catch (err) {
    // Compte Firebase Auth deja absent/deja supprime -- pas bloquant
    console.warn("Suppression Firebase Auth ignoree :", err);
  }

  await userRef.delete();

  return { success: true };
});

// ---------------------------------------------------------------------------
// 1quater. Reception des nouvelles commandes depuis Google Sheets
// ---------------------------------------------------------------------------

interface IncomingSheetOrder {
  sheetId: string;
  rowNumber: number;
  orderUid?: string;
  date: string;
  orderNumber: string;
  clientName: string;
  phone: string;
  city: string;
  note: string;
  product: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  trafficSource?: string;
  source?: string;
  sourceTrafic?: string;
}

export const receiveSheetOrder = onRequest({ secrets: [sheetWebhookSecret] }, async (req, res) => {
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

    const body = req.body as IncomingSheetOrder;
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
    const workspaceId = team.workspaceId as string;
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

    const phoneParsed = parsePhoneNumberFromString(body.phone, team.defaultCountry as never);
    const clientPhoneFormatted = phoneParsed?.formatInternational() ?? body.phone;

    // Routage intelligent multi-pays : si un tableur partagé contient des commandes
    // destinées à différents pays (ex: +229 Bénin, +225 Côte d'Ivoire, +228 Togo),
    // WariTrack réoriente automatiquement la commande vers l'équipe locale correspondante.
    let assignedTeamId = teamId;
    const detectedCountry = phoneParsed?.country;
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
          console.log(
            `receiveSheetOrder: routage multi-pays automatique depuis ${team.defaultCountry} vers ${detectedCountry} (teamId=${assignedTeamId})`
          );
        }
      } catch (routingErr) {
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
    } catch {}

    const noteText = String(body.note || "").toLowerCase();
    const explicitSource = String(body.trafficSource || body.source || body.sourceTrafic || "").toLowerCase();
    let sheetTrafficSource: "meta_ads" | "tiktok_ads" | "google_ads" | "organique" | "acces_libre_site" = "organique";
    let sheetCapiIsolated = true;

    if (isDuplicatePhone) {
      sheetTrafficSource = "acces_libre_site";
      sheetCapiIsolated = true;
    } else if (
      explicitSource.includes("meta") ||
      explicitSource.includes("facebook") ||
      explicitSource.includes("fb") ||
      explicitSource.includes("instagram") ||
      noteText.includes("facebook") ||
      noteText.includes("meta_ads") ||
      noteText.includes("fb_ads")
    ) {
      sheetTrafficSource = "meta_ads";
      sheetCapiIsolated = false;
    } else if (explicitSource.includes("tiktok") || noteText.includes("tiktok")) {
      sheetTrafficSource = "tiktok_ads";
      sheetCapiIsolated = true;
    } else if (explicitSource.includes("google") || noteText.includes("google")) {
      sheetTrafficSource = "google_ads";
      sheetCapiIsolated = true;
    } else {
      // Commande libre ou naturelle : isolée de Meta CAPI pour ne pas fausser le pixel
      sheetTrafficSource = "organique";
      sheetCapiIsolated = true;
    }

    const orderRef = db.collection("workspaces").doc(workspaceId).collection("orders").doc();
    await orderRef.set({
      workspaceId,
      teamId: assignedTeamId,
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
  } catch (err) {
    console.error("receiveSheetOrder: erreur inattendue:", err);
    res.status(500).send("Erreur interne.");
  }
});
// ---------------------------------------------------------------------------
// 2. Assignation automatique a la creation d'une commande (section 8)
// ---------------------------------------------------------------------------

export const onOrderCreated = onDocumentCreated(
  "workspaces/{workspaceId}/orders/{orderId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const order = snap.data();
    const { workspaceId } = event.params as { workspaceId: string };

    const closeusesSnap = await db
      .collection("workspaces")
      .doc(workspaceId)
      .collection("users")
      .where("teamId", "==", order.teamId)
      .where("role", "==", "closeuse")
      .where("status", "==", "active")
      .get();

    if (closeusesSnap.empty) return;

    const loads = await Promise.all(
      closeusesSnap.docs.map(async (userDoc) => {
        const activeSnap = await db
          .collection("workspaces")
          .doc(workspaceId)
          .collection("orders")
          .where("closeuseId", "==", userDoc.id)
          .where("statutCloseuse", "in", ["nouveau", "programme", "en_cours"])
          .get();
        return { id: userDoc.id, data: userDoc.data(), count: activeSnap.size };
      })
    );

    const chosen = loads.reduce((lowest, current) => (current.count < lowest.count ? current : lowest));

    await snap.ref.update({
      closeuseId: chosen.id,
      "timestamps.assignedToCloseuse": Date.now(),
    });

    await sendPushToUser(
      workspaceId,
      chosen.id,
      order.isDuplicatePhone ? "⚠️ Nouvelle commande (Doublon N°)" : "Nouvelle commande",
      order.isDuplicatePhone
        ? `${order.clientName} - ${order.product} · Vérifier si 1 ou 2 produits`
        : `${order.clientName} - ${order.product}`,
      snap.id
    );

    if (order.isDuplicatePhone) {
      await notifyAdmins(
        workspaceId,
        "🤖 Vigie IA · Numéro doublon (Accès libre site)",
        `${order.clientName} (${order.clientPhoneFormatted}) a commandé à nouveau (${order.product}). Isolé de Meta CAPI — vérifier avec ${chosen.data.name} si 1 ou 2 produits.`
      );
    }

    const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(order.teamId).get();
    const threshold = teamSnap.data()?.overloadAlertThreshold ?? 20;
    if (chosen.count + 1 >= threshold) {
      await notifyAdmins(
        workspaceId,
        "🤖 Vigie IA · Closeuse surchargée",
        `${chosen.data.name} a ${chosen.count + 1} commandes actives en attente.`
      );
    }
  }
);

// ---------------------------------------------------------------------------
// 2bis. Statistiques journalieres persistantes (survivent a la purge)
// ---------------------------------------------------------------------------

// Cle de date au format "YYYY-MM-DD", calculee en UTC. Le workspace de
// reference etant base au Togo (GMT, UTC+0, pas de changement d'heure),
// cette cle correspond exactement a la date locale cote client -- aucune
// conversion de fuseau horaire supplementaire n'est necessaire.
function dayKeyFromMs(ts: number): string {
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
async function incrementDailyStat(
  workspaceId: string,
  teamId: string,
  field: "ca" | "livraisons" | "rejetees" | "injoignables",
  amount: number
) {
  const dateKey = dayKeyFromMs(Date.now());
  const ref = db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("teams")
    .doc(teamId)
    .collection("dailyStats")
    .doc(dateKey);
  await ref.set(
    { [field]: admin.firestore.FieldValue.increment(amount), updatedAt: Date.now() },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// 3. Propagation de statut livreur -> closeuse + remuneration + sync Sheet
// ---------------------------------------------------------------------------

export const onOrderUpdated = onDocumentUpdated(
  { document: "workspaces/{workspaceId}/orders/{orderId}", secrets: [sheetsServiceAccountKey] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const { workspaceId, orderId } = event.params as { workspaceId: string; orderId: string };
    const ref = db.collection("workspaces").doc(workspaceId).collection("orders").doc(orderId);

    const statutLivreurChanged = before.statutLivreur !== after.statutLivreur;
    const statutCloseuseChanged = before.statutCloseuse !== after.statutCloseuse;
    const livreurAssigned = !before.livreurId && !!after.livreurId;

    if (livreurAssigned) {
      await sendPushToUser(workspaceId, after.livreurId, "Nouvelle livraison", `${after.clientName} - ${after.product}`, orderId);
      if (!after.timestamps?.assignedToLivreur) {
        await ref.update({ "timestamps.assignedToLivreur": Date.now() });
      }
    }

    if (statutCloseuseChanged && before.statutCloseuse === "nouveau" && !after.timestamps?.closeuseDecidedAt) {
      await ref.update({ "timestamps.closeuseDecidedAt": Date.now() });
    }
    if (statutLivreurChanged && before.statutLivreur === "recu" && !after.timestamps?.livreurRespondedAt) {
      await ref.update({ "timestamps.livreurRespondedAt": Date.now() });
    }

    if (statutLivreurChanged && after.statutLivreur === "en_route") {
      if (after.closeuseId) {
        await sendPushToUser(workspaceId, after.closeuseId, "Livraison en route", `${after.clientName} - en cours de livraison`, orderId);
      }
    }

    if (statutLivreurChanged && after.statutLivreur === "livre") {
      await ref.update({
        statutCloseuse: "livre",
        "timestamps.delivered": Date.now(),
      });

      // Sync directe vers le Sheet -- ne depend pas d'un second passage de
      // la fonction (avant, on comptait sur before/after de l'evenement,
      // qui ne reflete pas cette ecriture faite DANS cette meme execution ;
      // corrige le bug "Livre ne remonte pas sur le Sheet").
      if (after.sheetId && after.sourceRowId) {
        await writeOrderStatusToSheet(after.sheetId, after.sourceRowId, "livre", null, after.assignedLivreurName || after.livreurName || null);
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
        } catch {}
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
        } catch (secErr) {
          console.warn("Échec lecture secret Meta CAPI (Purchase):", secErr);
        }
      }

      if (
        !isPhoneAlreadyTracked &&
        !after.capiIsolated &&
        !after.capiSent &&
        after.trafficSource === "meta_ads" &&
        team?.metaCapiConfig?.enabled &&
        team.metaCapiConfig.pixelId &&
        metaAccessToken
      ) {
        try {
          const capiRes = await sendMetaPurchaseEvent(
            { ...team.metaCapiConfig, accessToken: metaAccessToken },
            {
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
            }
          );
          if (capiRes.success) {
            await ref.update({ capiSent: true });
          }
        } catch (capiErr) {
          console.error("Échec de l'envoi Meta CAPI lors de la livraison :", capiErr);
        }
      }

      if (after.closeuseId) {
        await sendPushToUser(workspaceId, after.closeuseId, "Commande livree", `${after.clientName} - confirme livre`, orderId);
      }
    }

    // Événement CommandeConfirmee vers Meta CAPI lors de la validation closeuse (réservé Meta Ads)
    if (
      statutCloseuseChanged &&
      (after.statutCloseuse === "en_cours" || after.statutCloseuse === "programme") &&
      !after.capiConfirmedSent &&
      !after.capiIsolated &&
      !after.isDuplicatePhone &&
      after.trafficSource === "meta_ads"
    ) {
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
        } catch (secErr) {
          console.warn("Échec lecture secret Meta CAPI (Confirmed):", secErr);
        }
      }

      if (
        team?.metaCapiConfig?.enabled &&
        team.metaCapiConfig.pixelId &&
        metaAccessToken
      ) {
        try {
          const confRes = await sendMetaConfirmedEvent(
            { ...team.metaCapiConfig, accessToken: metaAccessToken },
            {
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
            }
          );
          if (confRes.success) {
            await ref.update({ capiConfirmedSent: true });
          }
        } catch (confErr) {
          console.error("Échec de l'envoi Meta CommandeConfirmee :", confErr);
        }
      }
    }

    if (statutLivreurChanged && after.statutLivreur === "injoignable") {
      await ref.update({ statutCloseuse: "injoignable" });

      // Meme correctif que ci-dessus, pour ce cas aussi.
      if (after.sheetId && after.sourceRowId) {
        await writeOrderStatusToSheet(after.sheetId, after.sourceRowId, "injoignable", null, after.assignedLivreurName || after.livreurName || null);
      }

      // Injoignable declenche cote livreur (client ne repond pas a la
      // livraison) -- comptabilise dans le meme compteur "injoignables"
      // que le cas declenche cote closeuse ci-dessous, les deux chemins
      // ne pouvant pas se declencher sur le meme evenement Firestore.
      await incrementDailyStat(workspaceId, after.teamId, "injoignables", 1);

      if (after.closeuseId) {
        await sendPushToUser(workspaceId, after.closeuseId, "Client injoignable", `${after.clientName} - le livreur n'a pas pu joindre le client`, orderId);
      }
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
      } else if (after.statutCloseuse === "injoignable") {
        await incrementDailyStat(workspaceId, after.teamId, "injoignables", 1);
      }
    }

    // Sync retour Firestore -> Sheet pour tous les AUTRES changements de
    // statutCloseuse (ceux decides directement par la closeuse : en_cours,
    // programme, rejete, indisponible -- pas ceux forces par le livreur,
    // deja geres explicitement ci-dessus).
    if (
      statutCloseuseChanged &&
      after.statutCloseuse !== "livre" &&
      after.statutCloseuse !== "injoignable" &&
      after.sheetId &&
      after.sourceRowId
    ) {
      await writeOrderStatusToSheet(after.sheetId, after.sourceRowId, after.statutCloseuse, after.reminderAt, after.assignedLivreurName || after.livreurName || null);
    }
  }
);

async function incrementRemuneration(
  workspaceId: string,
  userId: string,
  role: "closeuse" | "livreur",
  amountPerOrder: number,
  orderAmount: number
) {
  const ref = db.collection("workspaces").doc(workspaceId).collection("remunerations").doc(userId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data()! : { totalOrders: 0, totalAmount: 0 };
    tx.set(
      ref,
      {
        userId,
        workspaceId,
        role,
        totalOrders: (current.totalOrders ?? 0) + 1,
        totalAmount: (current.totalAmount ?? 0) + amountPerOrder,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  });
}

// ---------------------------------------------------------------------------
// Marquer/annuler le paiement d'une remuneration (bouton "Payer" admin)
// ---------------------------------------------------------------------------

export const markRemunerationPaid = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { userId } = request.data as { userId: string };
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId requis.");
  }

  const ref = db.collection("workspaces").doc(workspaceId).collection("remunerations").doc(userId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Aucune remuneration trouvee pour cet employe.");
    }
    const data = snap.data()!;
    const totalAmount = data.totalAmount ?? 0;
    tx.set(ref, { montantPaye: totalAmount, paidAt: Date.now() }, { merge: true });
    return totalAmount;
  });

  return { montantPaye: result };
});

export const cancelRemunerationPayment = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { userId } = request.data as { userId: string };
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId requis.");
  }

  const ref = db.collection("workspaces").doc(workspaceId).collection("remunerations").doc(userId);
  await ref.set(
    { montantPaye: 0, paidAt: admin.firestore.FieldValue.delete() },
    { merge: true }
  );

  return { ok: true };
});

// ---------------------------------------------------------------------------
// 4. Purge automatique des commandes traitees (section 15/16)
// ---------------------------------------------------------------------------

export const scheduledPurge = onSchedule("every 24 hours", async () => {
  // Purge désactivée définitivement à la demande du client :
  // Toutes les commandes et données restent 100% permanentes dans Firestore pour l'historique complet.
  console.log("scheduledPurge: conservation permanente activée, aucune commande supprimée.");
});

// ---------------------------------------------------------------------------
// 5. Rappels automatiques 15-20 min sans action sur "Nouveau" (section 6)
// ---------------------------------------------------------------------------

export const scheduledReminders = onSchedule("every 5 minutes", async () => {
  const now = Date.now();
  const cutoff = now - REMINDER_DELAY_MINUTES * 60 * 1000;
  const workspacesSnap = await db.collection("workspaces").get();

  for (const wsDoc of workspacesSnap.docs) {
    const staleOrders = await wsDoc.ref
      .collection("orders")
      .where("statutCloseuse", "==", "nouveau")
      .where("timestamps.received", "<=", cutoff)
      .get();

    const byCloseuse = new Map<string, number>();
    staleOrders.docs.forEach((d) => {
      const closeuseId = d.data().closeuseId;
      if (closeuseId) byCloseuse.set(closeuseId, (byCloseuse.get(closeuseId) ?? 0) + 1);
    });

    for (const [closeuseId, count] of byCloseuse) {
      await sendPushToUser(
        wsDoc.id,
        closeuseId,
        "Rappel",
        `${count} commande(s) en attente depuis plus de ${REMINDER_DELAY_MINUTES} min`
      );
    }

    if (byCloseuse.size > 0) {
      const recentAlert = await wsDoc.ref
        .collection("notifications")
        .where("title", "==", "🤖 Vigie IA · Commandes hors délai d'appel")
        .where("createdAt", ">=", now - 30 * 60 * 1000)
        .limit(1)
        .get();

      if (recentAlert.empty) {
        const totalStale = [...byCloseuse.values()].reduce((a, b) => a + b, 0);
        await notifyAdmins(
          wsDoc.id,
          "🤖 Vigie IA · Commandes hors délai d'appel",
          `${totalStale} commande(s) "Nouveau" dépassent ${REMINDER_DELAY_MINUTES} min sans appel chez ${byCloseuse.size} closeuse(s).`
        );
      }
    }

    // Rappels des commandes programmées arrivées à échéance
    const dueScheduled = await wsDoc.ref
      .collection("orders")
      .where("statutCloseuse", "==", "programme")
      .where("reminderAt", "<=", now)
      .get();

    let overdueAdminCount = 0;
    for (const docSnap of dueScheduled.docs) {
      const o = docSnap.data();
      if (o.closeuseId && !o.reminderNotified) {
        await sendPushToUser(
          wsDoc.id,
          o.closeuseId,
          "⏰ C'est l'heure de rappeler !",
          `Rappel programmé pour ${o.clientName} (${o.product})`,
          docSnap.id
        );
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
        .limit(1)
        .get();

      if (recentOverdueAlert.empty) {
        await notifyAdmins(
          wsDoc.id,
          "🤖 Vigie IA · Rappels programmés oubliés",
          `${overdueAdminCount} commande(s) programmée(s) ont dépassé leur heure de rappel de plus de 20 min sans traitement.`
        );
      }
    }

    // Commandes confirmées (en_cours) mais oubliées sans livreur assigné (> 25 min)
    const confirmedSnap = await wsDoc.ref
      .collection("orders")
      .where("statutCloseuse", "==", "en_cours")
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
        .limit(1)
        .get();

      if (recentUnassigned.empty) {
        await notifyAdmins(
          wsDoc.id,
          "🤖 Vigie IA · Colis confirmés sans livreur",
          `${unassignedCount} commande(s) confirmée(s) attendent l'assignation d'un livreur depuis plus de 25 min.`
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Vigie IA : Bilan periodique, Caisse Livreurs & Suivi Logistique (section 5.1)
// ---------------------------------------------------------------------------

export const scheduledDigest = onSchedule("every 30 minutes", async () => {
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
      if (now - lastDigestAt < intervalMs) continue;

      const since = lastDigestAt || now - intervalMs;
      const ordersSnap = await wsDoc.ref
        .collection("orders")
        .where("teamId", "==", teamDoc.id)
        .get();

      let livrees = 0,
        rejetees = 0,
        injoignables = 0,
        ca = 0,
        stuckTransit = 0,
        expectedCashTotal = 0;

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
          if (o.statutCloseuse === "rejete") rejetees++;
          if (o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable") injoignables++;
        }
        if (
          (o.statutLivreur === "recu" || o.statutLivreur === "en_route") &&
          !isDeliv &&
          o.statutCloseuse !== "rejete"
        ) {
          const refTs =
            o.timestamps?.livreurRespondedAt ??
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

      const extraAlerts: string[] = [];
      if (unsettledCash > 0) {
        extraAlerts.push(`Caisse livreur à récupérer: ${unsettledCash.toLocaleString("fr-FR")} F`);
      }
      if (stuckTransit > 0) {
        extraAlerts.push(`${stuckTransit} colis sur le terrain > 3h`);
      }

      await notifyAdmins(
        wsDoc.id,
        `🤖 Vigie IA — ${team.name}`,
        `${livrees} livrées (${ca.toLocaleString("fr-FR")} F), ${rejetees} rejetées, ${injoignables} injoignables${
          extraAlerts.length ? ` · ⚠️ ${extraAlerts.join(" | ")}` : ""
        }`
      );

      await teamDoc.ref.update({ lastDigestAt: now });
    }
  }
});

// ---------------------------------------------------------------------------
// Utilitaires de notification (section 3.2)
// ---------------------------------------------------------------------------

async function sendPushToUser(workspaceId: string, userId: string, title: string, body: string, orderId?: string) {
  const userRef = db.collection("workspaces").doc(workspaceId).collection("users").doc(userId);
  const userSnap = await userRef.get();
  const tokens: string[] = userSnap.data()?.fcmTokens ?? [];
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
    ...(orderId ? { orderId } : {}),
  });

  const clickUrl = orderId ? `/?orderId=${orderId}` : "/";
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
    data: {
      title,
      body,
      ...(orderId ? { orderId } : {}),
      url: clickUrl,
    },
    android: {
      priority: "high",
      ttl: 24 * 60 * 60 * 1000,
      notification: {
        clickAction: clickUrl,
        defaultSound: true,
      },
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
    webpush: {
      notification: {
        title,
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: {
          orderId: orderId ?? "",
          url: clickUrl,
        },
      },
      fcmOptions: {
        link: clickUrl,
      },
    },
  });

  console.log(`sendPushToUser: ${response.successCount} succes, ${response.failureCount} echecs pour user ${userId}`);

  const invalidTokens: string[] = [];
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

async function notifyAdmins(workspaceId: string, title: string, body: string) {
  const now = Date.now();
  await db.collection("workspaces").doc(workspaceId).collection("notifications").add({
    title,
    body,
    read: false,
    createdAt: now,
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
    .where("role", "==", "admin")
    .where("status", "==", "active")
    .get();

  await Promise.all(
    adminsSnap.docs.map((adminDoc) => {
      const tokens: string[] = adminDoc.data().fcmTokens ?? [];
      if (tokens.length === 0) return Promise.resolve();
      return messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { title, body },
        android: { priority: "high" },
      });
    })
  );
}

// ---------------------------------------------------------------------------
// 7. Test de connexion Meta Conversions API (CAPI) pour l'Admin
// ---------------------------------------------------------------------------

export const testMetaCapiConnection = onCall(async (request) => {
  requireAdmin(request);
  const { pixelId, accessToken, testEventCode } = request.data as {
    pixelId: string;
    accessToken: string;
    testEventCode?: string;
  };

  if (!pixelId || !accessToken) {
    throw new HttpsError("invalid-argument", "Pixel ID et Access Token requis.");
  }

  const result = await sendMetaPurchaseEvent(
    {
      enabled: true,
      pixelId,
      accessToken,
      currency: "XOF",
      testEventCode,
    },
    {
      id: "TEST_ORDER_" + Date.now(),
      orderNumber: "TEST-EASYSELL-001",
      clientName: "Test Client",
      clientPhoneFormatted: "+22890000000",
      city: "Lome",
      country: "TG",
      product: "Produit Test COD",
      quantity: 1,
      amount: 15000,
    }
  );

  if (!result.success) {
    throw new HttpsError("internal", result.error || "Erreur lors du test Meta CAPI.");
  }

  return { success: true, metaResponse: result.data };
});

// ---------------------------------------------------------------------------
// 8. Intégration Meta OAuth automatique (Business Manager + Système Utilisateur)
// ---------------------------------------------------------------------------

export const getMetaAccountsAndPixels = onCall(async (request) => {
  requireAdmin(request);
  const { userAccessToken } = request.data as { userAccessToken: string };
  if (!userAccessToken) {
    throw new HttpsError("invalid-argument", "userAccessToken requis.");
  }
  try {
    return await fetchMetaAdAccountsAndPixels(userAccessToken);
  } catch (err: any) {
    throw new HttpsError("internal", err?.message || "Erreur Meta Graph API.");
  }
});

export const connectMetaSystemUser = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const {
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
  } = request.data as {
    teamId: string;
    userAccessToken: string;
    businessId?: string;
    businessName?: string;
    adAccountId: string;
    adAccountName?: string;
    pixelId: string;
    pixelName?: string;
    currency?: string;
    connectedUserName?: string;
  };

  if (!teamId || !userAccessToken || !adAccountId || !pixelId) {
    throw new HttpsError(
      "invalid-argument",
      "teamId, userAccessToken, adAccountId et pixelId requis."
    );
  }

  try {
    return await setupMetaSystemUserAndPixel({
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
  } catch (err: any) {
    throw new HttpsError("internal", err?.message || "Erreur lors de la configuration Meta.");
  }
});

export const disconnectMetaCapi = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { teamId } = request.data as { teamId: string };
  if (!teamId) {
    throw new HttpsError("invalid-argument", "teamId requis.");
  }
  try {
    return await disconnectMetaCapiConfig(workspaceId, teamId);
  } catch (err: any) {
    throw new HttpsError("internal", err?.message || "Erreur désactivation Meta.");
  }
});

export const createMetaOAuthBridgeSession = onCall(async (request) => {
  const workspaceId = requireAdmin(request);
  const { teamId, teamName } = request.data as { teamId: string; teamName?: string };
  if (!teamId) {
    throw new HttpsError("invalid-argument", "teamId requis.");
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

export const completeMetaOAuthBridgeSession = onCall(async (request) => {
  const { workspaceId, sessionId, secret, userAccessToken } = request.data as {
    workspaceId: string;
    sessionId: string;
    secret: string;
    userAccessToken: string;
  };

  if (!workspaceId || !sessionId || !secret || !userAccessToken) {
    throw new HttpsError("invalid-argument", "Paramètres de session incomplets.");
  }

  const sessionRef = db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("metaOAuthSessions")
    .doc(sessionId);
  const snap = await sessionRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Ce lien de connexion a expiré ou n'existe plus.");
  }

  const data = snap.data()!;
  if (data.status !== "pending") {
    throw new HttpsError("failed-precondition", "Ce lien a déjà été utilisé.");
  }
  if (Date.now() > (data.expiresAt ?? 0)) {
    throw new HttpsError("deadline-exceeded", "Ce lien de connexion a expiré (validité 15 min).");
  }

  const providedHash = crypto.createHash("sha256").update(secret).digest("hex");
  if (!data.secretHash || providedHash !== data.secretHash) {
    throw new HttpsError("permission-denied", "Lien de connexion invalide.");
  }

  try {
    const metaData = await fetchMetaAdAccountsAndPixels(userAccessToken);
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
  } catch (err: any) {
    throw new HttpsError("internal", err?.message || "Impossible de récupérer les comptes Meta.");
  }
});

// ---------------------------------------------------------------------------
// 9. Migration : cree les utilisateurs Firebase Auth manquants pour tous les
// employes existants dans Firestore (correction du bug d'authentification)
// ---------------------------------------------------------------------------

export const migrateUsers = onCall(async (request) => {
  const workspaceId = requireAdmin(request);

  // SÉCURITÉ : Ne migrer QUE le workspace de l'admin appelant (isolation multi-tenant stricte)
  const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
  if (!wsDoc.exists) {
    throw new HttpsError("not-found", "Workspace introuvable.");
  }

  let totalUsers = 0;
  let created = 0;
  let alreadyExists = 0;
  let errors = 0;
  const details: Array<{ name: string; userId: string; status: string }> = [];

  const usersSnap = await wsDoc.ref.collection("users").get();
  if (!usersSnap.empty) {
    for (const userDoc of usersSnap.docs) {
      totalUsers++;
      const userData = userDoc.data();
      const userId = userDoc.id;

      try {
        try {
          await admin.auth().getUser(userId);
          alreadyExists++;
          details.push({ name: userData.name || userId, userId, status: "existe_deja" });
        } catch (authErr: any) {
          if (authErr.code === "auth/user-not-found") {
            await admin.auth().createUser({
              uid: userId,
              displayName: userData.name || undefined,
              phoneNumber: userData.phone || undefined,
            });
            created++;
            details.push({ name: userData.name || userId, userId, status: "cree" });
          } else {
            throw authErr;
          }
        }
      } catch (err: any) {
        errors++;
        details.push({ name: userData.name || userId, userId, status: `erreur: ${err.message}` });
      }
    }
  }

  return { totalUsers, created, alreadyExists, errors, details };
});



// ---------------------------------------------------------------------------
// Diagnostic & Test de connexion Google Sheets en direct
// ---------------------------------------------------------------------------
export const testSheetConnection = onCall(async (request) => {
  requireAdmin(request);
  const { sheetId } = (request.data || {}) as { sheetId?: string };
  if (!sheetId) {
    throw new HttpsError("invalid-argument", "sheetId est requis.");
  }

  const serviceEmail = getServiceAccountEmail();
  try {
    const sheets = getSheetsClient();
    const structure = await detectAndEnsureSheetColumns(sheets, sheetId);

    let title = "Feuille Google Sheets";
    try {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: "properties.title",
      });
      if (meta.data.properties?.title) {
        title = meta.data.properties.title;
      }
    } catch {}

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
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    console.error("testSheetConnection échec:", errorMsg);

    if (
      errorMsg.includes("403") ||
      errorMsg.includes("permission") ||
      errorMsg.includes("caller does not have permission")
    ) {
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
