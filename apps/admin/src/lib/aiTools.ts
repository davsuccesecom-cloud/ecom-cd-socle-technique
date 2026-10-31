/**
 * Accès de l'Assistant IA aux données de l'app, page par page.
 *
 * Principes
 * 1. L'IA ne touche jamais Firestore. Elle demande un OUTIL, le serveur l'exécute.
 * 2. workspaceId, teamId et role viennent du jeton d'authentification vérifié,
 *    jamais des arguments envoyés par l'IA (isolation multi-tenant).
 * 3. Lecture seule. Chaque outil appelle la MÊME fonction que la page correspondante,
 *    pour que l'IA et l'écran affichent toujours les mêmes chiffres.
 * 4. Aucun secret : jetons Shopify, clés API, mots de passe ne sont jamais renvoyés.
 */

export type Role = 'owner' | 'admin' | 'manager' | 'closeuse' | 'livreur';

export interface ToolContext {
  workspaceId: string;
  teamId: string;
  role: Role;
  /** YYYY-MM-DD, UTC, fixé par le serveur */
  today: string;
}

/** À brancher sur VOS fonctions existantes (celles que les pages utilisent déjà). */
export interface ToolHandlers {
  dailyStats(ctx: ToolContext, a: { from: string; to: string }): Promise<unknown>;
  orders(
    ctx: ToolContext,
    a: { date: string; status?: string; employee?: string; limit: number },
  ): Promise<{ availableFrom: string; orders: unknown[] }>;
  employeePerformance(
    ctx: ToolContext,
    a: { role: 'closeuse' | 'livreur'; period: 'today' | '7d' | '30d' },
  ): Promise<unknown>;
  teamsAndSheets(ctx: ToolContext): Promise<unknown>;
  usersAndRoles(ctx: ToolContext): Promise<unknown>;
  remuneration(ctx: ToolContext, a: { period: 'today' | '7d' | '30d' }): Promise<unknown>;
  shopsStatus(ctx: ToolContext): Promise<unknown>;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Rôles autorisés. L'IA ne contourne jamais les droits de la personne qui lui parle. */
  roles: Role[];
  run: (h: ToolHandlers, ctx: ToolContext, args: any) => Promise<unknown>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;
const MAX_RESULT_CHARS = 12_000;

const day = (s: string) => {
  if (!DATE.test(s)) throw new Error(`Date invalide : ${s}. Format attendu YYYY-MM-DD.`);
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`Date invalide : ${s}.`);
  return t;
};

const PERIOD = { type: 'string', enum: ['today', '7d', '30d'] };

export const TOOLS: ToolDef[] = [
  {
    name: 'get_daily_stats',
    description:
      "Totaux par jour (CA, livraisons, rejetées, injoignables) entre deux dates incluses. Seule source fiable pour l'historique de plus de 3 jours.",
    parameters: {
      type: 'object',
      properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } },
      required: ['from', 'to'],
    },
    roles: ['owner', 'admin', 'manager'],
    run: (h, ctx, a) => {
      const f = day(a.from);
      const t = day(a.to);
      if (t < f) throw new Error('"to" doit être après "from".');
      if ((t - f) / 86_400_000 > MAX_RANGE_DAYS) throw new Error(`Plage maximale : ${MAX_RANGE_DAYS} jours.`);
      return h.dailyStats(ctx, { from: a.from, to: a.to });
    },
  },
  {
    name: 'get_orders',
    description:
      "Commandes d'UN jour précis avec leurs dates (reçue, confirmée, livrée). Les commandes plus anciennes que la purge de 3 jours ne sont plus disponibles : la réponse indique availableFrom.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        status: { type: 'string' },
        employee: { type: 'string', description: "Nom de l'employé" },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      required: ['date'],
    },
    roles: ['owner', 'admin', 'manager'],
    run: (h, ctx, a) => {
      day(a.date);
      const limit = Math.min(Math.max(Number(a.limit) || 30, 1), 50);
      return h.orders(ctx, { date: a.date, status: a.status, employee: a.employee, limit });
    },
  },
  {
    name: 'get_employee_performance',
    description:
      "Performance des closeuses ou des livreurs : délai avant traitement (moyenne, médiane, pire cas), nombre de commandes, livraisons, échouées. Mêmes chiffres que la page Performance.",
    parameters: {
      type: 'object',
      properties: { role: { type: 'string', enum: ['closeuse', 'livreur'] }, period: PERIOD },
      required: ['role', 'period'],
    },
    roles: ['owner', 'admin', 'manager'],
    run: (h, ctx, a) => h.employeePerformance(ctx, { role: a.role, period: a.period }),
  },
  {
    name: 'get_teams_and_sheets',
    description: "Équipes et Google Sheets connectés : noms, statut de synchronisation. Sans identifiants.",
    parameters: { type: 'object', properties: {} },
    roles: ['owner', 'admin', 'manager'],
    run: (h, ctx) => h.teamsAndSheets(ctx),
  },
  {
    name: 'get_users_and_roles',
    description: 'Utilisateurs et leur rôle. Sans mots de passe ni jetons.',
    parameters: { type: 'object', properties: {} },
    roles: ['owner', 'admin'],
    run: (h, ctx) => h.usersAndRoles(ctx),
  },
  {
    name: 'get_remuneration',
    description: 'Rémunération des employés sur la période. Données sensibles.',
    parameters: { type: 'object', properties: { period: PERIOD }, required: ['period'] },
    roles: ['owner', 'admin'],
    run: (h, ctx, a) => h.remuneration(ctx, { period: a.period }),
  },
  {
    name: 'get_shops_status',
    description:
      'État des boutiques et des flux Shopify (connexion, dernier événement reçu). Jamais de jeton ni de clé.',
    parameters: { type: 'object', properties: {} },
    roles: ['owner', 'admin'],
    run: (h, ctx) => h.shopsStatus(ctx),
  },
];

/** Définitions à envoyer au modèle, filtrées selon le rôle de la personne connectée. */
export const toolsFor = (role: Role) =>
  TOOLS.filter((t) => t.roles.includes(role)).map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

export async function runTool(name: string, rawArgs: string, ctx: ToolContext, h: ToolHandlers): Promise<string> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return JSON.stringify({ error: `Outil inconnu : ${name}` });
  if (!tool.roles.includes(ctx.role)) {
    return JSON.stringify({ error: "Vous n'avez pas le droit de consulter ces données." });
  }
  try {
    const args = rawArgs ? JSON.parse(rawArgs) : {};
    const data = await tool.run(h, ctx, args);
    const out = JSON.stringify({ generatedAt: new Date().toISOString(), today: ctx.today, data });
    if (out.length > MAX_RESULT_CHARS) {
      return JSON.stringify({ error: 'Résultat trop volumineux. Demande une période ou un filtre plus étroit.' });
    }
    return out;
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur outil' });
  }
}

export type Msg =
  | { role: 'system' | 'user' | 'assistant'; content: string | null; tool_calls?: any[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ModelReply {
  content: string | null;
  toolCalls: { id: string; name: string; arguments: string }[];
}

/**
 * Boucle : le modèle demande des outils, le serveur les exécute, le modèle conclut.
 * callModel appelle Groq ou NVIDIA (API compatible OpenAI) avec `tools`.
 * Limitée à 4 tours pour maîtriser coût et durée.
 */
export async function runWithTools(opts: {
  callModel: (messages: Msg[], tools: ReturnType<typeof toolsFor>) => Promise<ModelReply>;
  messages: Msg[];
  ctx: ToolContext;
  handlers: ToolHandlers;
  maxRounds?: number;
}): Promise<string> {
  const { callModel, ctx, handlers, maxRounds = 4 } = opts;
  const messages = [...opts.messages];
  const tools = toolsFor(ctx.role);

  for (let round = 0; round < maxRounds; round++) {
    const reply = await callModel(messages, tools);
    if (!reply.toolCalls.length) return reply.content ?? '';
    messages.push({
      role: 'assistant',
      content: reply.content,
      tool_calls: reply.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments },
      })),
    });
    const results = await Promise.all(reply.toolCalls.map((c) => runTool(c.name, c.arguments, ctx, handlers)));
    reply.toolCalls.forEach((c, i) => messages.push({ role: 'tool', tool_call_id: c.id, content: results[i] }));
  }
  return "Je n'ai pas pu rassembler assez de données pour répondre. Précisez la période ou l'employé.";
}
