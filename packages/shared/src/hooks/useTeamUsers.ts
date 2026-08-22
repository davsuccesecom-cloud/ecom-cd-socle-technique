import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "../firebase";
import type { AppUser, UserRole } from "../types";

/**
 * Écoute temps réel des employés (closeuses et/ou livreurs) d'une équipe.
 * Utilisé par l'app Admin pour : afficher les noms dans "Livraisons par
 * livreur", et plus tard le module "Utilisateurs & Accès" (section 5).
 */
export function useTeamUsers(workspaceId: string | null, teamId: string | null, role?: UserRole) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !teamId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    const db = getDb();
    const ref = collection(db, "workspaces", workspaceId, "users");
    const clauses = [where("teamId", "==", teamId)];
    if (role) clauses.push(where("role", "==", role));
    const q = query(ref, ...clauses);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [workspaceId, teamId, role]);

  return { users, loading };
}
