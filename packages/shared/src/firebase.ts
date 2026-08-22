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

/**
 * Chaque app (admin/closeuse/livreur) appelle ceci une seule fois au démarrage,
 * avec sa propre config Vite (VITE_FIREBASE_*). Évite de dupliquer la logique
 * d'initialisation dans chacune des 3 apps.
 */
export function initFirebase(config: FirebaseEnvConfig) {
  if (getApps().length === 0) {
    app = initializeApp(config);
  }
  db = getFirestore(app!);
  auth = getAuth(app!);
  return { app, db, auth };
}

export function getDb(): Firestore {
  if (!db) throw new Error("Firebase non initialisé — appelle initFirebase() d'abord.");
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error("Firebase non initialisé — appelle initFirebase() d'abord.");
  return auth;
}

/**
 * La messagerie (notifications push) n'est pas supportée partout (ex: Safari
 * ancien, contextes non sécurisés). On vérifie avant d'initialiser pour éviter
 * un crash silencieux — voir architecture section 3.2.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  const supported = await isSupported().catch(() => false);
  if (!supported || !app) return null;
  messaging = getMessaging(app);
  return messaging;
}
