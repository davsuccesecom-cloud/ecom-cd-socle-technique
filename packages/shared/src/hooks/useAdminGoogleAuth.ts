import { useCallback, useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "../firebase";

interface AdminAuthResult {
  workspaceId: string;
  role: "admin";
  isNewWorkspace: boolean;
}

/**
 * Connexion admin via compte Google, système multi-entreprises (SaaS) :
 * chaque compte Google obtient son propre workspace isolé. Deux étapes :
 *  1. signInWithGoogle() — popup Google, puis tentative de provisionnement
 *     sans nom (fonctionne directement si ce compte a déjà un espace).
 *  2. Si le compte est nouveau, needsWorkspaceName passe à true : l'UI doit
 *     demander le nom de l'entreprise puis appeler createWorkspace(name).
 */
export function useAdminGoogleAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
      const authenticateAdminGoogle = httpsCallable<{ workspaceName?: string }, AdminAuthResult>(
        functions,
        "authenticateAdminGoogle"
      );
      await authenticateAdminGoogle({ workspaceName });

      // Les custom claims viennent d'être posés côté serveur — on force le
      // rafraîchissement du token pour que le client les voie tout de suite.
      await getFirebaseAuth().currentUser?.getIdToken(true);
      setNeedsWorkspaceName(false);
      return true;
    } catch (err) {
      // Compte inconnu ET pas encore de nom fourni : demande le nom de
      // l'entreprise plutôt que d'afficher une erreur (section auto-signup).
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

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion Google impossible.");
      setBusy(false);
      return;
    }
    // Tentative directe sans nom : passe si ce compte a déjà un espace,
    // sinon needsWorkspaceName sera levé automatiquement par provision().
    await provision();
  }, [provision]);

  const createWorkspace = useCallback(
    async (workspaceName: string) => provision(workspaceName),
    [provision]
  );

  const logout = useCallback(async () => {
    setNeedsWorkspaceName(false);
    await signOut(getFirebaseAuth());
  }, []);

  return {
    firebaseUser,
    authLoading,
    busy,
    needsWorkspaceName,
    error,
    signInWithGoogle,
    createWorkspace,
    logout,
  };
}
