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
 * - `assignLivreur` écrit `livreurId` + initialise `statutLivreur` à
 *   "recu" — la closeuse choisit elle-même le livreur disponible une fois
 *   la commande confirmée (flux validé : closeuse traite puis assigne,
 *   l'admin ne gère plus l'assignation en usage normal).
 */
export interface CloseuseUpdateExtras {
  reminderAt?: number | null;
  rejectionReason?: string | null;
  fieldNote?: string | null;
  rescheduleReason?: string | null;
  livreurId?: string | null;
}

export interface LivreurUpdateExtras {
  rejectionReason?: string | null;
  deliveryFailureReason?: string | null;
  deliveryFieldNote?: string | null;
}

export function useUpdateOrderStatus(workspaceId: string) {
  const updateCloseuseStatus = useCallback(
    async (
      orderId: string,
      status: CloseuseStatus,
      reminderAtOrExtras?: number | null | CloseuseUpdateExtras,
      rejectionReason?: string | null,
      extrasArg?: CloseuseUpdateExtras
    ) => {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
      const extras: CloseuseUpdateExtras =
        reminderAtOrExtras !== null && typeof reminderAtOrExtras === "object"
          ? reminderAtOrExtras
          : {
              reminderAt: reminderAtOrExtras,
              rejectionReason,
              ...extrasArg,
            };
      const payload: Record<string, unknown> = {
        statutCloseuse: status,
        callInProgress: null, // toute action ferme l'appel en cours (section 6)
      };
      if (extras.reminderAt !== undefined) {
        payload.reminderAt = extras.reminderAt;
      }
      if (extras.rejectionReason !== undefined) {
        payload.rejectionReason = extras.rejectionReason;
      }
      if (extras.fieldNote !== undefined) {
        payload.fieldNote = extras.fieldNote;
      }
      if (extras.rescheduleReason !== undefined) {
        payload.rescheduleReason = extras.rescheduleReason;
      }
      if (status === "en_cours" && extras.livreurId) {
        payload.livreurId = extras.livreurId;
        payload.statutLivreur = "recu";
      }
      await updateDoc(ref, payload);
    },
    [workspaceId]
  );

  const updateLivreurStatus = useCallback(
    async (
      orderId: string,
      status: LivreurStatus,
      rejectionReasonOrExtras?: string | null | LivreurUpdateExtras
    ) => {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
      const extras: LivreurUpdateExtras =
        rejectionReasonOrExtras !== null && typeof rejectionReasonOrExtras === "object"
          ? rejectionReasonOrExtras
          : { rejectionReason: rejectionReasonOrExtras };
      const payload: Record<string, unknown> = { statutLivreur: status };
      if (extras.rejectionReason !== undefined) {
        payload.rejectionReason = extras.rejectionReason;
      }
      if (extras.deliveryFailureReason !== undefined) {
        payload.deliveryFailureReason = extras.deliveryFailureReason;
      }
      if (extras.deliveryFieldNote !== undefined) {
        payload.deliveryFieldNote = extras.deliveryFieldNote;
      }
      await updateDoc(ref, payload);
      // Le passage à "livre"/"injoignable" déclenche la suite (notifs,
      // rémunération, purge programmée) côté Cloud Function `onOrderUpdated`
      // — jamais côté client, pour garder une seule source de vérité.
    },
    [workspaceId]
  );

  const assignLivreur = useCallback(
    async (orderId: string, livreurId: string) => {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "orders", orderId);
      // "recu" = statut initial livreur dès l'assignation, apparaît
      // immédiatement dans l'onglet "À livrer" côté app Livreur.
      // Note : pas de "timestamps.assignedToLivreur" ici -- les regles
      // Firestore n'autorisent la closeuse qu'a modifier les cles
      // top-level ['statutCloseuse','callInProgress','livreurId',
      // 'statutLivreur']. Ecrire un champ nested "timestamps.xxx" fait
      // apparaitre "timestamps" comme cle top-level modifiee dans
      // affectedKeys(), ce qui fait echouer le hasOnly() et bloque
      // TOUTE l'ecriture (livreurId inclus). Les timestamps restent
      // geres cote Cloud Function, comme partout ailleurs dans le projet.
      await updateDoc(ref, {
        livreurId,
        statutLivreur: "recu",
      });
    },
    [workspaceId]
  );

  return { updateCloseuseStatus, updateLivreurStatus, assignLivreur };
}
