import { useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "../firebase";

/**
 * Gère la barre "appel en cours" (section 6) : quand la closeuse tape
 * "Appeler", la commande est marquée pour que d'autres commandes arrivant
 * entre-temps ne fassent pas oublier que cet appel est toujours ouvert.
 */
export function useCallInProgress(workspaceId: string) {
  const startCall = useCallback(
    async (orderId: string, closeuseId: string) => {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
      await updateDoc(ref, {
        callInProgress: {
          active: true,
          by: closeuseId,
          startedAt: Date.now(),
        },
      });
    },
    [workspaceId]
  );

  const endCall = useCallback(
    async (orderId: string) => {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
      await updateDoc(ref, { callInProgress: null });
    },
    [workspaceId]
  );

  return { startCall, endCall };
}
