import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "../firebase";
import type { AppUser, UserRole } from "../types";

/**
 * Écoute temps réel des employés (closeuses et/ou livreurs) d'une équipe.
 * Récupère à la fois les employés d'origine (home team) ET les employés
 * alloués/prêtés par d'autres équipes du même pays.
 */
export function useTeamUsers(
  workspaceId: string | null,
  teamId: string | null,
  role?: UserRole,
  onlyActive = false
) {
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

    // 1. Employés directs de l'équipe (home team)
    const homeClauses = [where("teamId", "==", teamId)];
    if (role) homeClauses.push(where("role", "==", role));
    const qHome = query(ref, ...homeClauses);

    // 2. Employés alloués/prêtés à cette équipe (même pays)
    const allocatedClauses = [where("allocatedTeamIds", "array-contains", teamId)];
    if (role) allocatedClauses.push(where("role", "==", role));
    const qAllocated = query(ref, ...allocatedClauses);

    let homeUsers: AppUser[] = [];
    let allocatedUsers: AppUser[] = [];

    const mergeUsers = () => {
      const map = new Map<string, AppUser>();
      homeUsers.forEach((u) => map.set(u.id, u));
      allocatedUsers.forEach((u) => {
        if (!map.has(u.id)) {
          map.set(u.id, u);
        }
      });
      const all = Array.from(map.values());
      setUsers(onlyActive ? all.filter((u) => u.status === "active") : all);
      setLoading(false);
    };

    const unsubHome = onSnapshot(
      qHome,
      (snapshot) => {
        homeUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser);
        mergeUsers();
      },
      () => setLoading(false)
    );

    const unsubAllocated = onSnapshot(
      qAllocated,
      (snapshot) => {
        allocatedUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser);
        mergeUsers();
      },
      (err) => {
        console.warn("[useTeamUsers] allocatedTeamIds query avertissement:", err);
      }
    );

    return () => {
      unsubHome();
      unsubAllocated();
    };
  }, [workspaceId, teamId, role, onlyActive]);

  return { users, loading };
}
