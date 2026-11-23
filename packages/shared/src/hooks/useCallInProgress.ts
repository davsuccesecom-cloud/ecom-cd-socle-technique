import { useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "../firebase";

/**
 * Gère la barre "appel en cours" : quand l'employé clique sur
 * "Appeler" ou "WhatsApp", la commande est marquée en cours d'appel.
 * Elle reste affichée jusqu'à ce que l'employé clique expressément sur "Terminer".
 */
export function useCallInProgress(workspaceId: string) {
  const startCall = useCallback(
    async (orderId: string, callerId?: string) => {
      try {
        const db = getDb();
        const auth = getFirebaseAuth();
        const effectiveCallerId = callerId || auth.currentUser?.uid || "user";
        const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
        await updateDoc(ref, {
          callInProgress: {
            active: true,
            by: effectiveCallerId,
            startedAt: Date.now(),
          },
        });
      } catch (err) {
        console.warn("[useCallInProgress] startCall sync warning:", err);
      }
    },
    [workspaceId]
  );

  const endCall = useCallback(
    async (orderId: string) => {
      try {
        const db = getDb();
        const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
        await updateDoc(ref, { callInProgress: null });
      } catch (err) {
        console.warn("[useCallInProgress] endCall sync warning:", err);
      }
    },
    [workspaceId]
  );

  return { startCall, endCall };
}
