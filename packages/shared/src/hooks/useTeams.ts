import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDb } from "../firebase";
import type { Team } from "../types";

/**
 * Écoute temps réel de TOUTES les équipes d'un workspace — contrairement à
 * useTeam (singulier) utilisé par closeuse/livreur qui n'en connaissent
 * qu'une. Nécessaire pour l'app Admin (sélecteur d'équipe / marché,
 * section 5 — "Équipes & Sheets", jusqu'à 20 équipes par workspace).
 */
export function useTeams(workspaceId: string | null) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setTeams([]);
      setLoading(false);
      return;
    }
    const db = getDb();
    const ref = collection(db, "workspaces", workspaceId, "teams");
    const q = query(ref, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTeams(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Team));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [workspaceId]);

  return { teams, loading };
}
