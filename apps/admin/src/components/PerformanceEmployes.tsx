import { useMemo, useState } from "react";
import type { AppUser, Order, Team, UserRole } from "@ecomcod/shared";

interface PerformanceEmployesProps {
  team: Team | null;
  closeuses: AppUser[];
  livreurs: AppUser[];
  orders: Order[]; // non filtrées par période — ce module gère sa propre fenêtre
}

type Range = "jour" | "7j" | "30j";

const RANGE_LABELS: Record<Range, string> = { jour: "Aujourd'hui", "7j": "7 derniers jours", "30j": "30 derniers jours" };

// Seuil au-delà duquel un délai de traitement/réaction est considéré comme
// un retard méritant une alerte — cohérent avec les seuils vus sur la
// maquette de référence (section "délai avant traitement").
const DELAY_ALERT_MINUTES = 15;

function rangeStartMs(range: Range): number {
  const now = new Date();
  if (range === "jour") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === "7j") return Date.now() - 7 * 24 * 60 * 60 * 1000;
  return Date.now() - 30 * 24 * 60 * 60 * 1000;
}

function isToday(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

interface EmployeeStats {
  user: AppUser;
  ordersInRange: Order[];
  delaiMoyenMin: number | null;
  livraisonsReussies: number;
  echouees: number;
  tauxReussite: number | null;
  remunerationAujourdhui: number;
  livraisonsAujourdhui: number;
  isDelayed: boolean;
}

function computeCloseuseStats(user: AppUser, orders: Order[], rangeStart: number, remunPerOrder: number): EmployeeStats {
  const mine = orders.filter((o) => o.closeuseId === user.id);
  const inRange = mine.filter((o) => o.timestamps.received >= rangeStart);

  const delays = inRange
    .filter((o) => o.timestamps.assignedToCloseuse && o.timestamps.closeuseDecidedAt)
    .map((o) => (o.timestamps.closeuseDecidedAt! - o.timestamps.assignedToCloseuse!) / 60000);
  const delaiMoyenMin = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : null;

  const livreesAujourdhui = mine.filter(
    (o) => o.statutCloseuse === "livre" && o.timestamps.delivered && isToday(o.timestamps.delivered)
  );

  return {
    user,
    ordersInRange: inRange,
    delaiMoyenMin,
    livraisonsReussies: inRange.filter((o) => o.statutCloseuse === "livre").length,
    echouees: inRange.filter((o) => o.statutCloseuse === "rejete" || o.statutCloseuse === "injoignable").length,
    tauxReussite: null,
    remunerationAujourdhui: livreesAujourdhui.length * remunPerOrder,
    livraisonsAujourdhui: livreesAujourdhui.length,
    isDelayed: delaiMoyenMin !== null && delaiMoyenMin > DELAY_ALERT_MINUTES,
  };
}

function computeLivreurStats(user: AppUser, orders: Order[], rangeStart: number, remunPerOrder: number): EmployeeStats {
  const mine = orders.filter((o) => o.livreurId === user.id);
  const inRange = mine.filter((o) => o.timestamps.received >= rangeStart);

  const delays = inRange
    .filter((o) => o.timestamps.assignedToLivreur && o.timestamps.livreurRespondedAt)
    .map((o) => (o.timestamps.livreurRespondedAt! - o.timestamps.assignedToLivreur!) / 60000);
  const delaiMoyenMin = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : null;

  const livrees = inRange.filter((o) => o.statutLivreur === "livre").length;
  const echouees = inRange.filter((o) => o.statutLivreur === "injoignable").length;
  const denom = livrees + echouees;

  const livreesAujourdhui = mine.filter(
    (o) => o.statutLivreur === "livre" && o.timestamps.delivered && isToday(o.timestamps.delivered)
  );

  return {
    user,
    ordersInRange: inRange,
    delaiMoyenMin,
    livraisonsReussies: livrees,
    echouees,
    tauxReussite: denom > 0 ? Math.round((livrees / denom) * 100) : null,
    remunerationAujourdhui: livreesAujourdhui.length * remunPerOrder,
    livraisonsAujourdhui: livreesAujourdhui.length,
    isDelayed: delaiMoyenMin !== null && delaiMoyenMin > DELAY_ALERT_MINUTES,
  };
}

export default function PerformanceEmployes({ team, closeuses, livreurs, orders }: PerformanceEmployesProps) {
  const [role, setRole] = useState<UserRole>("closeuse");
  const [range, setRange] = useState<Range>("7j");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rangeStart = rangeStartMs(range);
  const remunCloseuse = team?.remunerationCloseusePerOrder ?? 0;
  const remunLivreur = team?.remunerationLivreurPerOrder ?? 0;

  const stats = useMemo(() => {
    if (role === "closeuse") {
      return closeuses.map((u) => computeCloseuseStats(u, orders, rangeStart, remunCloseuse));
    }
    return livreurs.map((u) => computeLivreurStats(u, orders, rangeStart, remunLivreur));
  }, [role, closeuses, livreurs, orders, rangeStart, remunCloseuse, remunLivreur]);

  const alerts = stats.filter((s) => s.isDelayed);
  const selected = stats.find((s) => s.user.id === selectedId) ?? null;

  const remunerationDuJourTotal = stats.reduce((sum, s) => sum + s.remunerationAujourdhui, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-surface-border bg-surface-raised p-1">
          <button
            onClick={() => { setRole("closeuse"); setSelectedId(null); }}
            className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${role === "closeuse" ? "bg-brand text-white" : "text-slate-400"}`}
          >
            Closeuses
          </button>
          <button
            onClick={() => { setRole("livreur"); setSelectedId(null); }}
            className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${role === "livreur" ? "bg-brand text-white" : "text-slate-400"}`}
          >
            Livreurs
          </button>
        </div>

        <div className="flex rounded-xl border border-surface-border bg-surface-raised p-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${range === r ? "bg-brand text-white" : "text-slate-400"}`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Rémunération du jour — montant réellement dû aujourd'hui par employé,
          calculé en direct sur les livraisons confirmées (pas d'attente du
          bilan du soir), cf. discussion sur le suivi des paiements. */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">Rémunération du jour — {role === "closeuse" ? "closeuses" : "livreurs"}</h3>
          <span className="text-sm text-slate-400">
            Total : <span className="font-medium text-slate-200">{remunerationDuJourTotal.toLocaleString("fr-FR")} FCFA</span>
          </span>
        </div>
        {stats.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Aucun employé sur cette équipe.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {stats.map((s) => (
              <li key={s.user.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-300">{s.user.name}</span>
                <span className="text-slate-400">
                  {s.livraisonsAujourdhui} livraison{s.livraisonsAujourdhui > 1 ? "s" : ""} · {" "}
                  <span className="font-medium text-slate-200">{s.remunerationAujourdhui.toLocaleString("fr-FR")} FCFA</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {remunCloseuse === 0 && role === "closeuse" && (
          <p className="mt-2 text-xs text-slate-600">
            Tarif par commande non configuré pour les closeuses — à régler dans Paramètres.
          </p>
        )}
        {remunLivreur === 0 && role === "livreur" && (
          <p className="mt-2 text-xs text-slate-600">
            Tarif par commande non configuré pour les livreurs — à régler dans Paramètres.
          </p>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-accent-orange/30 bg-accent-orange/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-accent-orange">
            <AlertIcon /> Alertes performance
          </h3>
          <ul className="space-y-1 text-sm text-slate-300">
            {alerts.map((a) => (
              <li key={a.user.id}>
                <span className="font-medium">{a.user.name}</span> — délai moyen de{" "}
                {Math.round(a.delaiMoyenMin!)} min (au-delà de {DELAY_ALERT_MINUTES} min)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 lg:col-span-1">
          <h3 className="mb-3 text-sm font-medium text-slate-200">
            {role === "closeuse" ? "Délai avant traitement" : "Performance des livreurs"}
          </h3>
          {stats.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aucun employé sur cette équipe.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {stats.map((s) => (
                <li key={s.user.id}>
                  <button
                    onClick={() => setSelectedId(s.user.id === selectedId ? null : s.user.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
                      selectedId === s.user.id ? "bg-brand-light" : "hover:bg-surface"
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-medium text-slate-300">
                      {s.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">{s.user.name}</p>
                      <p className="text-xs text-slate-500">
                        {role === "closeuse"
                          ? s.delaiMoyenMin !== null
                            ? `${Math.round(s.delaiMoyenMin)} min en moyenne`
                            : "Pas encore de données"
                          : s.tauxReussite !== null
                            ? `${s.tauxReussite}% de réussite`
                            : "Pas encore de données"}
                      </p>
                    </div>
                    {s.isDelayed && <span className="h-2 w-2 shrink-0 rounded-full bg-accent-orange" />}
                    <ChevronIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <EmployeeDetail stats={selected} role={role} />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-surface-border text-sm text-slate-600">
              Sélectionne un employé dans la liste pour voir le détail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeDetail({ stats, role }: { stats: EmployeeStats; role: UserRole }) {
  const recent = [...stats.ordersInRange]
    .sort((a, b) => b.timestamps.received - a.timestamps.received)
    .slice(0, 8);

  // Répartition par jour sur les 7 derniers jours, pour un aperçu visuel
  // rapide de la régularité (pas juste une moyenne globale qui peut cacher
  // un jour catastrophique).
  const dayBuckets = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const count = stats.ordersInRange.filter(
        (o) => o.timestamps.received >= dayStart && o.timestamps.received < dayEnd
      ).length;
      days.push({ label: d.toLocaleDateString("fr-FR", { weekday: "short" }), count });
    }
    return days;
  }, [stats.ordersInRange]);

  const maxCount = Math.max(...dayBuckets.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-medium text-brand">
            {stats.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">{stats.user.name}</p>
            <p className="text-xs text-slate-500">{stats.user.phone || "Téléphone non renseigné"}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat
            label={role === "closeuse" ? "Délai moyen" : "Délai de réaction"}
            value={stats.delaiMoyenMin !== null ? `${Math.round(stats.delaiMoyenMin)} min` : "—"}
            warn={stats.isDelayed}
          />
          <MiniStat
            label={role === "closeuse" ? "Livraisons" : "Livrées"}
            value={String(stats.livraisonsReussies)}
          />
          <MiniStat
            label={role === "closeuse" ? "Échouées" : "Taux réussite"}
            value={role === "closeuse" ? String(stats.echouees) : stats.tauxReussite !== null ? `${stats.tauxReussite}%` : "—"}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <h4 className="mb-3 text-sm font-medium text-slate-200">Activité — 7 derniers jours</h4>
        <div className="flex items-end justify-between gap-2" style={{ height: 80 }}>
          {dayBuckets.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t bg-brand/70"
                style={{ height: `${Math.max((d.count / maxCount) * 56, d.count > 0 ? 4 : 0)}px` }}
              />
              <span className="text-[10px] text-slate-600">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <h4 className="mb-3 text-sm font-medium text-slate-200">Commandes récentes</h4>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Aucune commande sur la période.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-slate-300">{o.clientName}</span>
                <span className="text-slate-500">
                  {new Date(o.timestamps.received).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </span>
                <span className="text-slate-400">{role === "closeuse" ? o.statutCloseuse : o.statutLivreur ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${warn ? "text-accent-orange" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-600">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
