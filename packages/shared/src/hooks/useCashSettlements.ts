import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getDb } from "../firebase";
import type { CashSettlementEntry } from "../types";

/**
 * Écoute temps réel des règlements de caisse livreurs et retenues d'une équipe.
 * Nettoie systématiquement son listener même en cas de repli sans index composite.
 */
export function useCashSettlements(workspaceId: string | null, teamId: string | null) {
  const [entries, setEntries] = useState<CashSettlementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !teamId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let activeUnsub: (() => void) | null = null;
    const db = getDb();

    const q = query(
      collection(db, "workspaces", workspaceId, "cashSettlements"),
      where("teamId", "==", teamId),
      orderBy("createdAt", "desc")
    );

    activeUnsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CashSettlementEntry));
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        const fallbackQ = query(
          collection(db, "workspaces", workspaceId, "cashSettlements"),
          where("teamId", "==", teamId)
        );
        if (activeUnsub) activeUnsub();
        activeUnsub = onSnapshot(
          fallbackQ,
          (snap2) => {
            if (cancelled) return;
            const list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }) as CashSettlementEntry);
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setEntries(list);
            setLoading(false);
          },
          () => {
            if (!cancelled) setLoading(false);
          }
        );
      }
    );

    return () => {
      cancelled = true;
      if (activeUnsub) activeUnsub();
    };
  }, [workspaceId, teamId]);

  return { entries, loading };
}
