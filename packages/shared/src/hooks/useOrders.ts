import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { getDb } from "../firebase";
import type { Order } from "../types";

interface UseOrdersOptions {
  workspaceId: string;
  teamId?: string | null; // si vide, null ou "all", écoute toutes les commandes du workspace
  allocatedTeamIds?: string[]; // IDs des équipes additionnelles allouées (prêt d'employés)
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
 * Supporte le filtrage propre par teamId (compatible index et règles de sécurité Firestore),
 * et supporte également les équipes allouées (prêt d'employés) sans casser les index composites.
 */
export function useOrders({ workspaceId, teamId, allocatedTeamIds, closeuseId, livreurId }: UseOrdersOptions) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const allocatedKey = allocatedTeamIds && allocatedTeamIds.length > 0 ? allocatedTeamIds.slice().sort().join(",") : "";

  useEffect(() => {
    if (!workspaceId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const db = getDb();
    const ordersRef = collection(db, "workspaces", workspaceId, "orders");

    // Construire la liste des équipes cibles :
    // - Si teamId est "all", vide ou non spécifié => écoute globale sans filtre teamId (ex: Admin)
    // - Si teamId est spécifié => écoute teamId + éventuelles allocatedTeamIds (sans duplication)
    const isGlobal = !teamId || teamId === "all" || teamId.trim() === "";
    const targetTeams: (string | null)[] = isGlobal
      ? [null]
      : Array.from(new Set([teamId, ...(allocatedTeamIds || [])].filter(Boolean))) as string[];

    const unsubs: (() => void)[] = [];
    const ordersByTeam = new Map<string, Order[]>();

    const mergeAndSet = () => {
      const all: Order[] = [];
      const seenIds = new Set<string>();
      ordersByTeam.forEach((teamOrders) => {
        for (const o of teamOrders) {
          if (!seenIds.has(o.id)) {
            seenIds.add(o.id);
            all.push(o);
          }
        }
      });
      all.sort((a, b) => safeOrderTs(b) - safeOrderTs(a));
      setOrders(all);
      setLoading(false);
    };

    targetTeams.forEach((tId) => {
      const clauses: any[] = [];
      if (tId) {
        clauses.push(where("teamId", "==", tId));
      }
      if (closeuseId) clauses.push(where("closeuseId", "==", closeuseId));
      if (livreurId) clauses.push(where("livreurId", "==", livreurId));

      const teamKey = tId || "__global__";
      let q = query(ordersRef, ...clauses, orderBy("timestamps.received", "desc"));
      let unsubFallback: (() => void) | null = null;

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
          ordersByTeam.set(teamKey, list);
          mergeAndSet();
        },
        (err) => {
          console.warn(`[useOrders] Query avec orderBy échouée pour team ${teamKey}, repli sans orderBy:`, err.message);
          try {
            const fallbackQ = query(ordersRef, ...clauses);
            unsubFallback = onSnapshot(
              fallbackQ,
              (snap) => {
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
                ordersByTeam.set(teamKey, list);
                mergeAndSet();
              },
              (fallbackErr) => {
                console.error(`[useOrders] Erreur fallback pour team ${teamKey}:`, fallbackErr);
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

      unsubs.push(() => {
        unsub();
        if (unsubFallback) unsubFallback();
      });
    });

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [workspaceId, teamId, allocatedKey, closeuseId, livreurId]);

  return { orders, loading, error };
}
