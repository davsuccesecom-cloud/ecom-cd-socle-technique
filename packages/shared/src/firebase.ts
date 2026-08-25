import { initializeApp, type FirebaseApp, getApps } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getMessaging, type Messaging, isSupported } from "firebase/messaging";

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let messaging: Messaging | null = null;

export function initFirebase(config: FirebaseEnvConfig) {
  if (getApps().length === 0) {
    app = initializeApp(config);
  } else {
    app = getApps()[0];
  }
  db = getFirestore(app!);
  auth = getAuth(app!);
  return { app, db, auth };
}

export function getDb(): Firestore {
  if (!db) throw new Error("Firebase non initialise - appelle initFirebase() d'abord.");
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error("Firebase non initialise - appelle initFirebase() d'abord.");
  return auth;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;

  const supported = await isSupported().catch((err) => {
    console.error("getFirebaseMessaging: isSupported() a leve une erreur:", err);
    return false;
  });

  if (!supported) {
    console.error("getFirebaseMessaging: isSupported() a retourne false, messaging non disponible sur ce navigateur/contexte.");
    return null;
  }

  if (!app) {
    console.error("getFirebaseMessaging: app Firebase non initialise (app est null).");
    return null;
  }

  messaging = getMessaging(app);
  console.log("getFirebaseMessaging: messaging initialise avec succes.");
  return messaging;
}