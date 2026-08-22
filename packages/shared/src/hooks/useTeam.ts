import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "../firebase";
import type { Team } from "../types";

/**
 * Écoute temps réel d'une équipe : nécessaire pour que l'app réagisse
 * immédiatement si l'admin change un paramètre (fenêtre de rappel, seuil
 * d'alerte, Sheets connectés) sans que l'employé ait à recharger la page.
 */
export function useTeam(workspaceId: string, teamId: string) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDb();
    const ref = doc(db, "workspaces", workspaceId, "teams", teamId);

    const unsubscribe = onSnapshot(ref, (snap) => {
      setTeam(snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [workspaceId, teamId]);

  return { team, loading };
}
