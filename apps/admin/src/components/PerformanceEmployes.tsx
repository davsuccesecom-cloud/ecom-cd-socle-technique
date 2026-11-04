import { useMemo, useState, useEffect } from "react";
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
// un retard méritant une alerte (15 minutes).
const DELAY_ALERT_MINUTES = 15;

function safeTs(ts: any): number {
  if (typeof ts === "number") return ts;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  if (ts && typeof ts.seconds === "number") return ts.seconds * 1000;
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function rangeStartMs(range: Range): number {
  const now = new Date();
  if (range === "jour") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === "7j") return Date.now() - 7 * 24 * 60 * 60 * 1000;
  return Date.now() - 30 * 24 * 60 * 60 * 1000;
}

function isToday(ts: number) {
  if (!ts) return false;
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
  const mine = orders.filter((o) => o && o.closeuseId === user.id);
  const inRange = mine.filter((o) => safeTs(o.timestamps?.received) >= rangeStart);

  const delays = inRange
    .filter((o) => o.timestamps?.assignedToCloseuse && o.timestamps?.closeuseDecidedAt)
    .map((o) => (safeTs(o.timestamps.closeuseDecidedAt) - safeTs(o.timestamps.assignedToCloseuse)) / 60000)
    .filter((d) => d >= 0);
  const delaiMoyenMin = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : null;

  const livrees = inRange.filter((o) => o.statutCloseuse === "livre").length;
  const confirmees = inRange.filter(
    (o) => o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || o.statutCloseuse === "livre"
  ).length;
  const echouees = inRange.filter(
    (o) => o.statutCloseuse === "rejete" || o.statutCloseuse === "injoignable" || o.statutCloseuse === "indisponible"
  ).length;
  const totalTraite = confirmees + echouees;
  const tauxClosing = totalTraite > 0 ? Math.round((confirmees / totalTraite) * 100) : null;

  const livreesAujourdhui = mine.filter(
    (o) => o.statutCloseuse === "livre" && o.timestamps?.delivered && isToday(safeTs(o.timestamps.delivered))
  );

  return {
    user,
    ordersInRange: inRange,
    delaiMoyenMin,
    livraisonsReussies: livrees,
    echouees,
    tauxReussite: tauxClosing,
    remunerationAujourdhui: livreesAujourdhui.length * remunPerOrder,
    livraisonsAujourdhui: livreesAujourdhui.length,
    isDelayed: delaiMoyenMin !== null && delaiMoyenMin > DELAY_ALERT_MINUTES,
  };
}

function computeLivreurStats(user: AppUser, orders: Order[], rangeStart: number, remunPerOrder: number): EmployeeStats {
  const mine = orders.filter((o) => o && o.livreurId === user.id);
  const inRange = mine.filter((o) => safeTs(o.timestamps?.received) >= rangeStart);

  const delays = inRange
    .filter((o) => o.timestamps?.assignedToLivreur && o.timestamps?.livreurRespondedAt)
    .map((o) => (safeTs(o.timestamps.livreurRespondedAt) - safeTs(o.timestamps.assignedToLivreur)) / 60000)
    .filter((d) => d >= 0);
  const delaiMoyenMin = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : null;

  const livrees = inRange.filter((o) => o.statutLivreur === "livre").length;
  const echouees = inRange.filter((o) => o.statutLivreur === "injoignable").length;
  const denom = livrees + echouees;

  const livreesAujourdhui = mine.filter(
    (o) => o.statutLivreur === "livre" && o.timestamps?.delivered && isToday(safeTs(o.timestamps.delivered))
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
  const currency = team?.currency || "XOF";

  const stats = useMemo(() => {
    if (role === "closeuse") {
      return closeuses.map((u) => computeCloseuseStats(u, orders, rangeStart, remunCloseuse));
    }
    return livreurs.map((u) => computeLivreurStats(u, orders, rangeStart, remunLivreur));
  }, [role, closeuses, livreurs, orders, rangeStart, remunCloseuse, remunLivreur]);

  // Pré-sélectionner automatiquement le premier employé disponible pour éviter la zone vide
  useEffect(() => {
    if (!selectedId && stats.length > 0) {
      setSelectedId(stats[0].user.id);
    }
  }, [stats, selectedId]);

  const alerts = stats.filter((s) => s.isDelayed);
  const selected = stats.find((s) => s.user.id === selectedId) ?? (stats.length > 0 ? stats[0] : null);

  const remunerationDuJourTotal = stats.reduce((sum, s) => sum + s.remunerationAujourdhui, 0);

  return (
    <div className="space-y-4">
      {/* Sélecteurs Rôle & Période */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-surface-border bg-surface-raised p-1">
          <button
            onClick={() => { setRole("closeuse"); setSelectedId(null); }}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${role === "closeuse" ? "bg-brand text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            Closeuses ({closeuses.length})
          </button>
          <button
            onClick={() => { setRole("livreur"); setSelectedId(null); }}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${role === "livreur" ? "bg-brand text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
          >
            Livreurs ({livreurs.length})
          </button>
        </div>

        <div className="flex rounded-xl border border-surface-border bg-surface-raised p-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${range === r ? "bg-brand text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Rémunération du jour en temps réel */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">
            Rémunération du jour — {role === "closeuse" ? "Closeuses" : "Livreurs"}
          </h3>
          <span className="text-xs text-slate-400">
            Total généré : <span className="font-bold text-slate-100">{remunerationDuJourTotal.toLocaleString("fr-FR")} {currency}</span>
          </span>
        </div>
        {stats.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Aucun {role === "closeuse" ? "closeuse" : "livreur"} rattaché à cette équipe.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {stats.map((s) => (
              <li key={s.user.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                    {(s.user.name || "E").charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-200">{s.user.name || "Sans nom"}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">
                    {s.livraisonsAujourdhui} livraison{s.livraisonsAujourdhui > 1 ? "s" : ""} · {" "}
                    <span className="font-bold text-slate-100">{s.remunerationAujourdhui.toLocaleString("fr-FR")} {currency}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {remunCloseuse === 0 && role === "closeuse" && (
          <p className="mt-2 text-xs text-slate-500">
            Commission par commande non configurée pour les closeuses — à définir dans Paramètres Système.
          </p>
        )}
        {remunLivreur === 0 && role === "livreur" && (
          <p className="mt-2 text-xs text-slate-500">
            Commission par commande non configurée pour les livreurs — à définir dans Paramètres Système.
          </p>
        )}
      </div>

      {/* Alertes performance (retards au-delà de 15 min) */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-300">
            <AlertIcon /> Alertes de Réactivité Opérationnelle
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {alerts.map((a) => (
              <li key={a.user.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>
                  <strong className="text-slate-100">{a.user.name}</strong> — délai moyen d'appel de{" "}
                  <strong className="text-amber-300">{Math.round(a.delaiMoyenMin!)} min</strong> (seuil optimal : {DELAY_ALERT_MINUTES} min)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Liste des Employés & Panneau Détaillé */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Colonne gauche : Liste des employés */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 lg:col-span-1">
          <h3 className="mb-3 text-sm font-bold text-slate-100">
            {role === "closeuse" ? "Classement des Closeuses" : "Efficacité des Livreurs"}
          </h3>
          {stats.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aucun employé sur cette équipe.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {stats.map((s) => {
                const isSelected = (selected?.user?.id === s.user.id);
                return (
                  <li key={s.user.id}>
                    <button
                      onClick={() => setSelectedId(s.user.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition-colors ${
                        isSelected ? "bg-brand/15 border border-brand/30" : "hover:bg-surface/60"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface border border-surface-border text-xs font-bold text-slate-200">
                        {(s.user.name || "E").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">{s.user.name || "Sans nom"}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {role === "closeuse" ? (
                            <>
                              <span className={s.tauxReussite && s.tauxReussite >= 70 ? "text-emerald-400 font-medium" : "text-slate-300"}>
                                {s.tauxReussite !== null ? `${s.tauxReussite}% closing` : "Aucun appel"}
                              </span>
                              <span>·</span>
                              <span>{s.delaiMoyenMin !== null ? `${Math.round(s.delaiMoyenMin)} min` : "—"}</span>
                            </>
                          ) : (
                            <>
                              <span className={s.tauxReussite && s.tauxReussite >= 75 ? "text-emerald-400 font-medium" : "text-slate-300"}>
                                {s.tauxReussite !== null ? `${s.tauxReussite}% succès` : "Aucun colis"}
                              </span>
                              <span>·</span>
                              <span>{s.livraisonsReussies} livrés</span>
                            </>
                          )}
                        </div>
                      </div>
                      {s.isDelayed && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" title="Délai supérieur à 15 min" />}
                      <ChevronIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Colonne droite : Détail de l'employé sélectionné */}
        <div className="lg:col-span-2">
          {selected ? (
            <EmployeeDetail stats={selected} role={role} currency={currency} />
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-surface-border p-6 text-center text-sm text-slate-500">
              Sélectionnez un employé dans la liste pour consulter ses métriques détaillées.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeDetail({ stats, role, currency }: { stats: EmployeeStats; role: UserRole; currency: string }) {
  const recent = [...stats.ordersInRange]
    .sort((a, b) => safeTs(b.timestamps?.received) - safeTs(a.timestamps?.received))
    .slice(0, 8);

  // Répartition par jour sur les 7 derniers jours
  const dayBuckets = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const count = stats.ordersInRange.filter((o) => {
        const r = safeTs(o.timestamps?.received);
        return r >= dayStart && r < dayEnd;
      }).length;
      days.push({ label: d.toLocaleDateString("fr-FR", { weekday: "short" }), count });
    }
    return days;
  }, [stats.ordersInRange]);

  const maxCount = Math.max(...dayBuckets.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      {/* Carte Résumé Profil & KPIs */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 border border-brand/30 text-base font-bold text-brand">
            {(stats.user.name || "E").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-bold text-slate-100">{stats.user.name || "Sans nom"}</p>
            <p className="text-xs text-slate-400 font-mono">{stats.user.phone || "Téléphone non renseigné"}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat
            label={role === "closeuse" ? "Délai moyen d'appel" : "Délai de réaction"}
            value={stats.delaiMoyenMin !== null ? `${Math.round(stats.delaiMoyenMin)} min` : "—"}
            warn={stats.isDelayed}
          />
          <MiniStat
            label={role === "closeuse" ? "Taux de Closing" : "Succès terrain"}
            value={stats.tauxReussite !== null ? `${stats.tauxReussite}%` : "—"}
          />
          <MiniStat
            label={role === "closeuse" ? "Colis livrés" : "Livraisons réussies"}
            value={String(stats.livraisonsReussies)}
          />
        </div>
      </div>

      {/* Graphique d'activité des 7 derniers jours */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <h4 className="mb-3 text-sm font-bold text-slate-100">Régularité opérationnelle — 7 derniers jours</h4>
        <div className="flex items-end justify-between gap-2" style={{ height: 85 }}>
          {dayBuckets.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">{d.count > 0 ? d.count : ""}</span>
              <div
                className="w-full rounded-t bg-brand/80 transition-all hover:bg-brand"
                style={{ height: `${Math.max((d.count / maxCount) * 55, d.count > 0 ? 6 : 2)}px` }}
              />
              <span className="text-[11px] font-medium text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Commandes récentes traitées */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <h4 className="mb-3 text-sm font-bold text-slate-100">Dernières commandes traitées</h4>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">Aucune commande enregistrée pour cet employé sur la période.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <span className="font-semibold text-slate-200">{o.clientName}</span>
                  <p className="text-slate-500 truncate max-w-[200px]">{o.product}</p>
                </div>
                <div className="text-right font-mono text-slate-400">
                  {safeTs(o.timestamps?.received) > 0
                    ? new Date(safeTs(o.timestamps.received)).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                    : "—"}
                </div>
                <div>
                  <span className="rounded bg-surface px-2 py-0.5 font-medium text-slate-300 border border-surface-border">
                    {role === "closeuse" ? o.statutCloseuse : o.statutLivreur ?? "reçu"}
                  </span>
                </div>
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
    <div className="rounded-xl border border-surface-border bg-surface p-3">
      <p className="text-xs text-slate-400 truncate">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${warn ? "text-amber-400" : "text-slate-100"}`}>{value}</p>
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
