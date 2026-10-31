import { collection, documentId, getDocs, orderBy, query, where, type Firestore } from 'firebase/firestore';

export type Period = 'day' | 'week' | 'month' | 'year';
export type Metric = 'ca' | 'livraisons' | 'rejetees' | 'injoignables' | 'tauxLivraison';

export interface DayStat {
  ca: number;
  livraisons: number;
  rejetees: number;
  injoignables: number;
}

export interface Point extends DayStat {
  /** Clé de la période : 2026-10-22 | 2026-10-19 (lundi) | 2026-10 | 2026 */
  key: string;
  label: string;
  /** livraisons / (livraisons + rejetees + injoignables), en % */
  tauxLivraison: number;
  /** true si la période n'est pas terminée (semaine, mois ou année en cours) */
  partial: boolean;
}

export const PERIODS: Record<Period, { label: string; days: number }> = {
  day: { label: 'Jour', days: 90 },
  week: { label: 'Semaine', days: 364 },
  month: { label: 'Mois', days: 1095 },
  year: { label: 'Année', days: 1825 },
};

// Les jours de dailyStats sont en UTC. Lomé, Dakar et Abidjan sont aussi à UTC+0 :
// pas de décalage pour vos marchés actuels.
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

function bucketKey(dayKey: string, bucket: Period): string {
  if (bucket === 'day') return dayKey;
  if (bucket === 'month') return dayKey.slice(0, 7);
  if (bucket === 'year') return dayKey.slice(0, 4);
  const d = new Date(`${dayKey}T00:00:00Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  return iso(addDays(d, -mondayOffset));
}

function bucketLabel(key: string, bucket: Period): string {
  if (bucket === 'year') return key;
  if (bucket === 'month') {
    return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  const d = new Date(`${key}T00:00:00Z`);
  const txt = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return bucket === 'week' ? `Sem. ${txt}` : txt;
}

/**
 * Lit dailyStats pour la période, comble les jours sans document avec des zéros
 * (indispensable pour des moyennes mobiles justes), puis agrège par jour, semaine,
 * mois ou année en additionnant les compteurs. Les taux sont recalculés sur les
 * totaux, jamais moyennés.
 */
export async function fetchDailyStats(
  db: Firestore,
  workspaceId: string,
  teamId: string,
  period: Period,
  now: Date = new Date(),
): Promise<Point[]> {
  const end = iso(now);
  const start = iso(addDays(now, -(PERIODS[period].days - 1)));
  const col = collection(db, `workspaces/${workspaceId}/teams/${teamId}/dailyStats`);
  const snap = await getDocs(
    query(col, where(documentId(), '>=', start), where(documentId(), '<=', end), orderBy(documentId())),
  );

  const byDay = new Map<string, Partial<DayStat>>();
  snap.forEach((d) => byDay.set(d.id, d.data() as Partial<DayStat>));

  const buckets = new Map<string, DayStat>();
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    const dayKey = iso(cursor);
    const s = byDay.get(dayKey) ?? {};
    const k = bucketKey(dayKey, period);
    const acc = buckets.get(k) ?? { ca: 0, livraisons: 0, rejetees: 0, injoignables: 0 };
    acc.ca += s.ca ?? 0;
    acc.livraisons += s.livraisons ?? 0;
    acc.rejetees += s.rejetees ?? 0;
    acc.injoignables += s.injoignables ?? 0;
    buckets.set(k, acc);
    cursor = addDays(cursor, 1);
  }

  const currentKey = bucketKey(end, period);
  let points: Point[] = [...buckets.entries()].map(([key, v]) => {
    const total = v.livraisons + v.rejetees + v.injoignables;
    return {
      ...v,
      key,
      label: bucketLabel(key, period),
      tauxLivraison: total > 0 ? (v.livraisons / total) * 100 : 0,
      partial: key === currentKey && period !== 'day',
    };
  });

  // On retire les périodes vides avant la première activité (plateforme récente).
  const first = points.findIndex((p) => p.ca || p.livraisons || p.rejetees || p.injoignables);
  points = first === -1 ? [] : points.slice(first);
  return points;
}
