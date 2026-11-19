import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { getDb } from "../firebase";
import type { Order } from "../types";

interface UseOrdersOptions {
  workspaceId: string;
  teamId?: string | null; // si vide, null ou "all", écoute toutes les commandes du workspace
  closeuseId?: string; // si fourni, filtre sur les commandes de cette closeuse uniquement
  livreurId?: string; // si fourni, filtre sur les commandes de ce livreur uniquement
}

function safeOrderTs(o: any): number {
  const r = o.timestamps?.received ?? o.received ?? o.createdAt ?? 0;
  if (typeof r === "number") return r;
  if (r && typeof r.toMillis === "function") return r.toMillis();
  if (r && typeof r.seconds === "number") return r.seconds * 1000;
  if (typeof r === "string") {
    const p = Date.parse(r);
    if (!Number.isNaN(p)) return p;
  }
  return 0;
}

/**
 * Écoute temps réel des commandes d'une équipe (ou de tout le workspace).
 * Résilient : gère automatiquement l'absence d'index composite avec repli client-side.
 */
export function useOrders({ workspaceId, teamId, closeuseId, livreurId }: UseOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const db = getDb();
    const ordersRef = collection(db, "workspaces", workspaceId, "orders");

    const clauses: any[] = [];
    if (teamId && teamId !== "all" && teamId.trim() !== "") {
      clauses.push(where("teamId", "==", teamId));
    }
    if (closeuseId) clauses.push(where("closeuseId", "==", closeuseId));
    if (livreurId) clauses.push(where("livreurId", "==", livreurId));

    let q = query(ordersRef, ...clauses, orderBy("timestamps.received", "desc"));
    let unsubscribeFallback: (() => void) | null = null;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const result = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
        setOrders(result);
        setLoading(false);
      },
      (err) => {
        console.warn("[useOrders] Query avec orderBy échouée (index en cours ou manquant), repli automatique sans orderBy:", err.message);
        // Repli immédiat sans orderBy pour ne jamais casser l'affichage
        try {
          const fallbackQ = query(ordersRef, ...clauses);
          unsubscribeFallback = onSnapshot(
            fallbackQ,
            (snap) => {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
              list.sort((a, b) => safeOrderTs(b) - safeOrderTs(a));
              setOrders(list);
              setLoading(false);
            },
            (fallbackErr) => {
              setError(fallbackErr as Error);
              setLoading(false);
            }
          );
        } catch (e) {
          setError(err as Error);
          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribe();
      if (unsubscribeFallback) unsubscribeFallback();
    };
  }, [workspaceId, teamId, closeuseId, livreurId]);

  return { orders, loading, error };
}
