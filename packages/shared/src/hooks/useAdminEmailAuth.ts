import { useCallback, useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "../firebase";

const STORAGE_KEY = "ecomcod_admin_email_pending";

interface AdminAuthResult {
  workspaceId: string;
  role: "admin";
  isNewWorkspace: boolean;
}

/**
 * Connexion admin par lien magique — pas de mot de passe, pas de popup
 * Google (source du blocage CORS rencontré). L'admin saisit son email,
 * reçoit un lien, clique dessus, revient sur l'app déjà connecté.
 * Système multi-entreprises inchangé : chaque email obtient son propre
 * workspace isolé, la Cloud Function reste agnostique du fournisseur.
 */
export function useAdminEmailAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [needsWorkspaceName, setNeedsWorkspaceName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const provision = useCallback(async (workspaceName?: string) => {
    setError(null);
    setBusy(true);
    try {
      const functions = getFunctions();
      const authenticateAdmin = httpsCallable<{ workspaceName?: string }, AdminAuthResult>(
        functions,
        "authenticateAdmin"
      );
      await authenticateAdmin({ workspaceName });
      await getFirebaseAuth().currentUser?.getIdToken(true);
      setNeedsWorkspaceName(false);
      return true;
    } catch (err) {
      if (err instanceof Error && err.message.includes("NEW_WORKSPACE_NEEDS_NAME")) {
        setNeedsWorkspaceName(true);
        return false;
      }
      await signOut(getFirebaseAuth()).catch(() => {});
      setError(err instanceof Error ? err.message : "Connexion impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // Au chargement : si l'URL contient un lien magique (l'admin vient de
  // cliquer sur le lien reçu par email), on termine la connexion.
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    let email = window.localStorage.getItem(STORAGE_KEY);
    if (!email) {
      // Cas rare : le lien est ouvert sur un autre appareil/navigateur que
      // celui où l'email a été demandé — on redemande l'email pour confirmer.
      email = window.prompt("Confirme ton adresse email pour terminer la connexion :");
    }
    if (!email) return;

    setBusy(true);
    signInWithEmailLink(auth, email, window.location.href)
      .then(async () => {
        window.localStorage.removeItem(STORAGE_KEY);
        window.history.replaceState(null, "", window.location.pathname);
        await provision();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Lien invalide ou expiré.");
      })
      .finally(() => setBusy(false));
  }, [provision]);

  const sendLoginLink = useCallback(async (email: string) => {
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.origin,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(STORAGE_KEY, email);
      setLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }, []);

  const createWorkspace = useCallback(
    async (workspaceName: string) => provision(workspaceName),
    [provision]
  );

  const logout = useCallback(async () => {
    setNeedsWorkspaceName(false);
    setLinkSent(false);
    await signOut(getFirebaseAuth());
  }, []);

  return {
    firebaseUser,
    authLoading,
    busy,
    linkSent,
    needsWorkspaceName,
    error,
    sendLoginLink,
    createWorkspace,
    logout,
  };
}
