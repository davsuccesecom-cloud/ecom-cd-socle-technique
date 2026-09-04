import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getDb } from "../firebase";

export interface DailyStatRow {
  date: string; // "YYYY-MM-DD", cle du document
  ca: number;
  livraisons: number;
  rejetees: number;
  injoignables: number;
}

/**
 * Convertit une cle "YYYY-MM-DD" (UTC, telle qu'ecrite par incrementDailyStat
 * cote Cloud Functions) en timestamp ms UTC (minuit ce jour-la).
 */
export function dailyStatDateToMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

/**
 * Genere la cle "YYYY-MM-DD" (UTC) pour un timestamp ms donne.
 * Doit rester identique a dayKeyFromMs() cote functions/src/index.ts,
 * sinon les cles ne matcheront jamais entre ecriture et lecture.
 */
function dayKeyFromMsUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Additionne un tableau de DailyStatRow (ex : pour obtenir le total sur une
 * periode affichee dans le dashboard).
 */
export function sumDailyStats(rows: DailyStatRow[]): Omit<DailyStatRow, "date"> {
  return rows.reduce(
    (acc, row) => ({
      ca: acc.ca + row.ca,
      livraisons: acc.livraisons + row.livraisons,
      rejetees: acc.rejetees + row.rejetees,
      injoignables: acc.injoignables + row.injoignables,
    }),
    { ca: 0, livraisons: 0, rejetees: 0, injoignables: 0 }
  );
}

/**
 * Ecoute en temps reel les dailyStats d'une equipe sur les `daysBack`
 * derniers jours (par defaut 30). Remplace le recalcul en live depuis
 * `orders`, qui perdait les donnees apres la purge a 3 jours (scheduledPurge).
 *
 * Les documents dailyStats ne sont jamais purges -- voir incrementDailyStat
 * dans functions/src/index.ts.
 */
export function useDailyStats(
  workspaceId: string | null,
  teamId: string | null,
  daysBack: number = 30
) {
  const [rows, setRows] = useState<DailyStatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !teamId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const startKey = dayKeyFromMsUTC(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const q = query(
      collection(getDb(), "workspaces", workspaceId, "teams", teamId, "dailyStats"),
      where("__name__", ">=", startKey),
      orderBy("__name__", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next: DailyStatRow[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            date: d.id,
            ca: data.ca ?? 0,
            livraisons: data.livraisons ?? 0,
            rejetees: data.rejetees ?? 0,
            injoignables: data.injoignables ?? 0,
          };
        });
        setRows(next);
        setLoading(false);
      },
      (err) => {
        console.error("useDailyStats: onSnapshot erreur :", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceId, teamId, daysBack]);

  return { rows, loading };
}
