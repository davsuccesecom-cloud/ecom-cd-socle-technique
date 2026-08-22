import { initFirebase } from "@ecomcod/shared";

// Les valeurs viennent de Firebase Console → Paramètres du projet →
// Vos applications → Web. Renseigne apps/admin/.env.local avec les
// mêmes 6 variables VITE_FIREBASE_* que closeuse/livreur.
initFirebase({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
