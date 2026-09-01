import { useCallback, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithCustomToken, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, arrayRemove, updateDoc } from "firebase/firestore";
import { getDb } from "../firebase";
import { useEffect } from "react";
import { getFirebaseAuth } from "../firebase";

interface AuthenticateResult {
  customToken: string;
  workspaceId: string;
  teamId: string;
  userId: string;
  role: "admin" | "closeuse" | "livreur";
}

/**
 * Connexion via lien d'acces (accessLinkId, dans l'URL) + mot de passe simple
 * saisi par l'employe. Appelle la Cloud Function `authenticateAccess`, qui
 * verifie le mot de passe, gere la limite de 2 sessions simultanees
 * (section 10.1), et renvoie un token Firebase personnalise.
 *
 * Utilise identiquement par les 3 apps (section 16) -- seule la redirection
 * post-connexion differe selon le role renvoye.
 *
 * Verification de revocation toutes les 10s -- combine a la verification
 * stricte cote serveur (checkRevoked: true dans validateAccessSession),
 * garantit qu'une desactivation admin coupe l'acces en quelques secondes.
 *
 * `verifySession` est expose separement pour etre appele au retour de
 * connexion reseau (voir ConnectionGuard) -- empeche un acces revoque de
 * continuer a fonctionner offline puis de reprendre sans verification.
 */
export function useAccessLinkAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAccess = useCallback(async (): Promise<boolean> => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return true;
    try {
      const functions = getFunctions();
      const validateAccessSession = httpsCallable(functions, "validateAccessSession");
      await validateAccessSession();
      return true;
    } catch (err: any) {
      console.warn("Verification de session echouee :", err);

      if (err?.code === "functions/permission-denied") {
        try {
          const claims = (await user.getIdTokenResult()).claims;
          const workspaceId = claims.workspaceId as string | undefined;
          const storageKey = `ecomcod_last_fcm_token_${user.uid}`;
          const lastToken = localStorage.getItem(storageKey);
          if (workspaceId && lastToken) {
            const userRef = doc(getDb(), "workspaces", workspaceId, "users", user.uid);
            await updateDoc(userRef, { fcmTokens: arrayRemove(lastToken) });
            localStorage.removeItem(storageKey);
          }
        } catch (cleanupErr) {
          console.warn("Nettoyage du token FCM echoue (non bloquant) :", cleanupErr);
        }
        await signOut(auth);
        setFirebaseUser(null);
        return false;
      }
      return true;
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    checkAccess();
    const interval = window.setInterval(checkAccess, 10_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAccess();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkAccess]);

  const login = useCallback(async (accessLinkId: string, password: string) => {
    setError(null);
    try {
      const functions = getFunctions();
      const authenticateAccess = httpsCallable<
        { accessLinkId: string; password: string },
        AuthenticateResult
      >(functions, "authenticateAccess");
      const { data } = await authenticateAccess({ accessLinkId, password });
      const auth = getFirebaseAuth();
      await signInWithCustomToken(auth, data.customToken);
      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connexion impossible, verifie le mot de passe."
      );
      return null;
    }
  }, []);

  return { firebaseUser, authLoading, login, error, verifySession: checkAccess };
}
