import { useCallback, useEffect, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
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
 * Connexion admin par lien magique -- pas de mot de passe, pas de popup
 * Google (source du blocage CORS rencontre). L'admin saisit son email,
 * recoit un lien, clique dessus, revient sur l'app deja connecte.
 * Systeme multi-entreprises inchange : chaque email obtient son propre
 * workspace isole, la Cloud Function reste agnostique du fournisseur.
 */
function formatAuthError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as any).code);
    if (code === "auth/unauthorized-domain") {
      return "Ce domaine n'est pas autorisé pour la connexion sécurisée. Veuillez vous connecter depuis l'adresse officielle de votre plateforme.";
    }
    if (code === "auth/unauthorized-continue-uri") {
      return "L'adresse de redirection n'est pas autorisée. Veuillez vous connecter depuis l'adresse officielle de votre plateforme.";
    }
    if (code === "auth/network-request-failed") {
      return "Impossible de joindre les serveurs sécurisés. Vérifiez votre connexion Internet.";
    }
    if (code === "auth/invalid-email") {
      return "Adresse email invalide. Veuillez vérifier votre saisie.";
    }
  }
  return err instanceof Error ? err.message : fallback;
}

export function useAdminEmailAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [needsWorkspaceName, setNeedsWorkspaceName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Empeche de traiter le lien de connexion deux fois (StrictMode en dev
  // invoque les effets deux fois au montage) -- un lien magique est a
  // usage unique, une deuxieme tentative echoue et peut declencher une
  // deconnexion de la session qui vient tout juste de reussir.
  const emailLinkProcessedRef = useRef(false);

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
  // cliquer sur le lien recu par email), on termine la connexion.
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    if (emailLinkProcessedRef.current) return;
    emailLinkProcessedRef.current = true;

    let email = window.localStorage.getItem(STORAGE_KEY);
    if (!email) {
      // Cas rare : le lien est ouvert sur un autre appareil/navigateur que
      // celui ou l'email a ete demande -- on redemande l'email pour confirmer.
      email = window.prompt("Confirme ton adresse email pour terminer la connexion :");
    }
    if (!email) {
      emailLinkProcessedRef.current = false;
      return;
    }

    setBusy(true);
    signInWithEmailLink(auth, email, window.location.href)
      .then(async () => {
        window.localStorage.removeItem(STORAGE_KEY);
        window.history.replaceState(null, "", window.location.pathname);
        await provision();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Lien invalide ou expire.");
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
      setError(formatAuthError(err, "Envoi impossible."));
    } finally {
      setBusy(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      await provision();
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user") {
        setBusy(false);
        return;
      }
      setError(formatAuthError(err, "Connexion Google impossible."));
      setBusy(false);
    }
  }, [provision]);

  const signInWithFacebook = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const provider = new FacebookAuthProvider();
      await signInWithPopup(auth, provider);
      await provision();
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user") {
        setBusy(false);
        return;
      }
      setError(formatAuthError(err, "Connexion Facebook impossible."));
      setBusy(false);
    }
  }, [provision]);

  const createWorkspace = useCallback(
    async (workspaceName: string) => provision(workspaceName),
    [provision]
  );

  const logout = useCallback(async () => {
    setNeedsWorkspaceName(false);
    setLinkSent(false);
    try {
      window.localStorage.removeItem("ecomcod-theme");
      window.localStorage.setItem("ecomcod-theme", "dark");
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
        window.dispatchEvent(new Event("ecomcod-theme-sync"));
      }
    } catch (_) {}
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
    signInWithGoogle,
    signInWithFacebook,
    createWorkspace,
    logout,
  };
}
