import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { getDb } from "../firebase";
import type { Order } from "../types";

interface UseOrdersOptions {
  workspaceId: string;
  teamId: string;
  closeuseId?: string; // si fourni, filtre sur les commandes de cette closeuse uniquement
  livreurId?: string; // si fourni, filtre sur les commandes de ce livreur uniquement
}

/**
 * Écoute temps réel des commandes d'une équipe (ou d'un employé précis).
 * Utilisé par l'app Closeuse (ses commandes), l'app Livreur (ses livraisons)
 * et l'app Admin (toute l'équipe). Une seule implémentation, section 16.
 *
 * NB : ce hook lit `statutCloseuse`, jamais `statutAdminOverride` — c'est ce
 * qui garantit la synchronisation à sens unique décrite section 14. Si un
 * jour l'app admin a besoin de l'override, elle doit lire ce champ via un
 * hook séparé, pas celui-ci, pour ne jamais mélanger les deux logiques.
 */
export function useOrders({ workspaceId, teamId, closeuseId, livreurId }: UseOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const db = getDb();
    const ordersRef = collection(db, "workspaces", workspaceId, "orders");

    const clauses = [where("teamId", "==", teamId)];
    if (closeuseId) clauses.push(where("closeuseId", "==", closeuseId));
    if (livreurId) clauses.push(where("livreurId", "==", livreurId));

    const q = query(ordersRef, ...clauses, orderBy("timestamps.received", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const result = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
        setOrders(result);
        setLoading(false);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceId, teamId, closeuseId, livreurId]);

  return { orders, loading, error };
}
