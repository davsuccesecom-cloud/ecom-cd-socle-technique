import { useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "../firebase";
import type { CloseuseStatus, LivreurStatus } from "../types";

/**
 * Écriture de statut, strictement séparée par rôle :
 * - `updateCloseuseStatus` écrit uniquement `statutCloseuse` — jamais
 *   `statutAdminOverride` (section 14, sync à sens unique).
 * - `updateLivreurStatus` écrit uniquement `statutLivreur`. Le passage à
 *   "livre" déclenche côté Cloud Function le calcul de rémunération
 *   (section 15) et la mise à jour visible instantanément chez la closeuse
 *   (section 6, visibilité temps réel).
 */
export function useUpdateOrderStatus(workspaceId: string) {
  const updateCloseuseStatus = useCallback(
    async (orderId: string, status: CloseuseStatus) => {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
      await updateDoc(ref, {
        statutCloseuse: status,
        callInProgress: null, // toute action ferme l'appel en cours (section 6)
      });
    },
    [workspaceId]
  );

  const updateLivreurStatus = useCallback(
    async (orderId: string, status: LivreurStatus) => {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
      await updateDoc(ref, { statutLivreur: status });
      // Le passage à "livre"/"injoignable" déclenche la suite (notifs,
      // rémunération, purge programmée) côté Cloud Function `onOrderUpdated`
      // — jamais côté client, pour garder une seule source de vérité.
    },
    [workspaceId]
  );

  return { updateCloseuseStatus, updateLivreurStatus };
}
