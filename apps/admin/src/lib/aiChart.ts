import type { Metric, Period } from './dailyStatsSeries';

export type Panel = 'volume' | 'rsi' | 'macd';
export type Overlay = 'ma20' | 'ma50' | 'bollinger';

export interface ChartSpec {
  type: 'chart';
  metric: Metric;
  period: Period;
  panels: Panel[];
  overlays: Overlay[];
}

const METRICS: Metric[] = ['ca', 'livraisons', 'rejetees', 'injoignables', 'tauxLivraison'];
const PERIODS: Period[] = ['day', 'week', 'month', 'year'];
const PANELS: Panel[] = ['volume', 'rsi', 'macd'];
const OVERLAYS: Overlay[] = ['ma20', 'ma50', 'bollinger'];

export const DEFAULT_SPEC: ChartSpec = {
  type: 'chart',
  metric: 'ca',
  period: 'day',
  panels: ['volume', 'rsi', 'macd'],
  overlays: ['ma20', 'ma50', 'bollinger'],
};

/** Liste blanche : tout ce que l'IA envoie hors de ces valeurs est ignoré. */
export function parseChartSpec(raw: unknown): ChartSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== 'chart') return null;
  const pick = <T extends string>(v: unknown, allowed: T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback;
  const list = <T extends string>(v: unknown, allowed: T[], fallback: T[]): T[] =>
    Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : fallback;
  return {
    type: 'chart',
    metric: pick(r.metric, METRICS, DEFAULT_SPEC.metric),
    period: pick(r.period, PERIODS, DEFAULT_SPEC.period),
    panels: list(r.panels, PANELS, DEFAULT_SPEC.panels),
    overlays: list(r.overlays, OVERLAYS, DEFAULT_SPEC.overlays),
  };
}

export type MessagePart = { kind: 'text'; text: string } | { kind: 'chart'; spec: ChartSpec };

/** Découpe une réponse de l'IA en texte et blocs ```chart {...} ```. */
export function splitMessage(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const re = /```chart\s*([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: content.slice(last, m.index) });
    try {
      const spec = parseChartSpec(JSON.parse(m[1]));
      if (spec) parts.push({ kind: 'chart', spec });
    } catch {
      // JSON invalide : le bloc est ignoré, jamais affiché brut.
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ kind: 'text', text: content.slice(last) });
  return parts;
}

/**
 * À ajouter au prompt système de /api/chat-groq et /api/chat-nvidia.
 * `today` doit être injecté côté serveur (YYYY-MM-DD, UTC), jamais laissé à l'IA.
 */
export const buildChartPrompt = (today: string) => `
DATE DU JOUR : ${today} (UTC, identique à l'heure de Lomé, Dakar et Abidjan).

RÈGLES DE DATES (obligatoires)
- Chaque commande et chaque livraison fournie dans le contexte porte sa propre date. Ne mélange jamais des dates différentes.
- Pour un bilan d'un jour précis, utilise uniquement les éléments dont la date est ce jour-là. Si le contexte ne contient rien pour ce jour, dis-le clairement. N'invente aucun chiffre.
- Ne jamais déduire une date : si elle manque, dis qu'elle manque.
- Les commandes détaillées sont purgées après 3 jours. Au-delà, tu n'as que les totaux journaliers (CA, livraisons, rejetées, injoignables). Dis-le quand on te demande le détail d'une ancienne commande.

GRAPHIQUES
Quand une courbe aide à répondre, ajoute un bloc exactement comme ceci (JSON valide, rien d'autre dans le bloc) :
\`\`\`chart
{"type":"chart","metric":"ca","period":"day","panels":["volume","rsi","macd"],"overlays":["ma20","ma50","bollinger"]}
\`\`\`
- metric : ca | livraisons | rejetees | injoignables | tauxLivraison
- period : day | week | month | year
- panels : volume | rsi | macd
- overlays : ma20 | ma50 | bollinger
Tu choisis le graphique, tu ne fournis jamais les valeurs : l'application lit les vraies données. Commente ensuite en 2 ou 3 phrases ce que montre la courbe.
`;
