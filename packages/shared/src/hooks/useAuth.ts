import { useCallback, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithCustomToken, onAuthStateChanged, signOut, type User } from "firebase/auth";
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
 * Connexion via lien d'accès (accessLinkId, dans l'URL) + mot de passe simple
 * saisi par l'employé. Appelle la Cloud Function `authenticateAccess`, qui
 * vérifie le mot de passe, gère la limite de 2 sessions simultanées
 * (section 10.1), et renvoie un token Firebase personnalisé.
 *
 * Utilisé identiquement par les 3 apps (section 16) — seule la redirection
 * post-connexion diffère selon le rôle renvoyé.
 *
 * Vérification de révocation toutes les 10s (réduit depuis 30s) — combiné
 * à la vérification stricte côté serveur (checkRevoked: true dans
 * validateAccessSession), garantit qu'une désactivation admin coupe
 * l'accès en quelques secondes, pas jusqu'à une heure comme avant.
 */
export function useAccessLinkAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    const checkAccess = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const functions = getFunctions();
        const validateAccessSession = httpsCallable(
          functions,
          "validateAccessSession"
        );
        await validateAccessSession();
      } catch (err) {
        console.warn("Session d'accès invalide :", err);
        await signOut(auth);
        setFirebaseUser(null);
      }
    };
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
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);
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
        err instanceof Error ? err.message : "Connexion impossible, vérifie le mot de passe."
      );
      return null;
    }
  }, []);
  return { firebaseUser, authLoading, login, error };
}
