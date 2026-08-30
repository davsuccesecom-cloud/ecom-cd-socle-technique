import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "../firebase";

export interface RemunerationTotalRow {
  userId: string;
  role: "closeuse" | "livreur";
  totalOrders: number;
  totalAmount: number;
  montantPaye: number;
  resteAPayer: number;
  paidAt?: number;
  updatedAt: number;
}

/**
 * Ecoute temps reel de la collection "remunerations" (cumul jamais purge,
 * voir incrementRemuneration cote Cloud Function). Sert de source de
 * verite pour le bouton "Payer" -- independant de la periode affichee
 * sur la page Remuneration, puisqu'un paiement solde un montant cumule,
 * pas une plage de dates.
 */
export function useRemunerationTotals(workspaceId: string | null, role: "closeuse" | "livreur") {
  const [totals, setTotals] = useState<Record<string, RemunerationTotalRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setTotals({});
      setLoading(false);
      return;
    }
    const db = getDb();
    const ref = collection(db, "workspaces", workspaceId, "remunerations");
    const q = query(ref, where("role", "==", role));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Record<string, RemunerationTotalRow> = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const totalAmount = data.totalAmount ?? 0;
          const montantPaye = data.montantPaye ?? 0;
          next[d.id] = {
            userId: d.id,
            role: data.role,
            totalOrders: data.totalOrders ?? 0,
            totalAmount,
            montantPaye,
            resteAPayer: Math.max(0, totalAmount - montantPaye),
            paidAt: data.paidAt,
            updatedAt: data.updatedAt ?? 0,
          };
        });
        setTotals(next);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [workspaceId, role]);

  return { totals, loading };
}