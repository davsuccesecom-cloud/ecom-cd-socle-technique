import { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { AppUser, CashSettlementEntry, Order, Team, UserRole } from "@ecomcod/shared";
import { getDb, useRemunerationTotals, ConfirmDialog } from "@ecomcod/shared";
import { Landmark, AlertTriangle, CheckCircle2 } from "lucide-react";
import StatCard from "../components/StatCard";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface RemunerationProps {
  team: Team | null;
  closeuses: AppUser[];
  livreurs: AppUser[];
  orders: Order[];
  onOpenCaisse?: () => void;
}

interface EmployeeRow {
  user: AppUser;
  livraisons: number;
  remuneration: number;
  remunDeductions: number;
  remunDeductionNotes: string[];
  unsettledCash: number;
}

const callMarkPaid = httpsCallable(getFunctions(), "markRemunerationPaid");
const callCancelPaid = httpsCallable(getFunctions(), "cancelRemunerationPayment");

export default function Remuneration({ team, closeuses, livreurs, orders, onOpenCaisse }: RemunerationProps) {
  const [role, setRole] = useState<UserRole>("closeuse");
  const [confirmTarget, setConfirmTarget] = useState<{
    userId: string;
    name: string;
    amount: number;
    unsettledCash?: number;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ userId: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settlementEntries, setSettlementEntries] = useState<CashSettlementEntry[]>([]);

  useEffect(() => {
    const wsId = team?.workspaceId;
    const tId = team?.id;
    if (!wsId || !tId) {
      setSettlementEntries([]);
      return;
    }
    const q = query(
      collection(getDb(), `workspaces/${wsId}/cashSettlements`),
      where("teamId", "==", tId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: CashSettlementEntry[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CashSettlementEntry, "id">),
      }));
      setSettlementEntries(list);
    });
    return () => unsub();
  }, [team?.workspaceId, team?.id]);

  const remunCloseuse = team?.remunerationCloseusePerOrder ?? 0;
  const remunLivreur = team?.remunerationLivreurPerOrder ?? 0;

  const { totals: closeuseTotals } = useRemunerationTotals(team?.workspaceId ?? null, "closeuse");
  const { totals: livreurTotals } = useRemunerationTotals(team?.workspaceId ?? null, "livreur");
  const totals = role === "closeuse" ? closeuseTotals : livreurTotals;

  const delivered = useMemo(
    () => orders.filter((o) => o.statutLivreur === "livre" || o.statutCloseuse === "livre"),
    [orders]
  );

  const caTotal = useMemo(() => delivered.reduce((sum, o) => sum + (o.amount || 0), 0), [delivered]);

  const rows: EmployeeRow[] = useMemo(() => {
    const users = role === "closeuse" ? closeuses : livreurs;
    const remunPerOrder = role === "closeuse" ? remunCloseuse : remunLivreur;
    return users.map((user) => {
      const mine = delivered.filter((o) =>
        role === "closeuse" ? o.closeuseId === user.id : o.livreurId === user.id
      );
      const userEntries = settlementEntries.filter((e) => e.livreurId === user.id);
      const remunDeductionEntries = userEntries.filter(
        (e) => e.type === "deduction" && e.impact === "remuneration"
      );
      const remunDeductions = remunDeductionEntries.reduce((s, e) => s + (e.amount || 0), 0);
      const remunDeductionNotes = remunDeductionEntries.map(
        (e) => `-${e.amount.toLocaleString("fr-FR")} F (${e.note})`
      );

      const expectedCash =
        role === "livreur" ? mine.reduce((s, o) => s + (o.amount || 0), 0) : 0;
      const remittedCash =
        role === "livreur"
          ? userEntries
              .filter((e) => e.type === "remittance")
              .reduce((s, e) => s + (e.amount || 0), 0)
          : 0;
      const caisseDeductions =
        role === "livreur"
          ? userEntries
              .filter((e) => e.type === "deduction" && e.impact === "caisse")
              .reduce((s, e) => s + (e.amount || 0), 0)
          : 0;
      const unsettledCash = Math.max(0, expectedCash - caisseDeductions - remittedCash);

      return {
        user,
        livraisons: mine.length,
        remuneration: mine.length * remunPerOrder,
        remunDeductions,
        remunDeductionNotes,
        unsettledCash,
      };
    });
  }, [role, closeuses, livreurs, delivered, remunCloseuse, remunLivreur, settlementEntries]);

  const remunerationTotale = useMemo(() => {
    const closeuseTotal = closeuses.reduce((sum, u) => {
      const mine = delivered.filter((o) => o.closeuseId === u.id);
      return sum + mine.length * remunCloseuse;
    }, 0);
    const livreurTotal = livreurs.reduce((sum, u) => {
      const mine = delivered.filter((o) => o.livreurId === u.id);
      return sum + mine.length * remunLivreur;
    }, 0);
    return closeuseTotal + livreurTotal;
  }, [closeuses, livreurs, delivered, remunCloseuse, remunLivreur]);

  // Reste a payer global (toutes periodes confondues) -- somme des soldes
  // reels issus de la collection "remunerations", pas du calcul par
  // periode ci-dessus (un paiement solde un cumul, pas une plage de dates).
  const resteAPayerGlobal = useMemo(() => {
    return Object.values(closeuseTotals).reduce((s, t) => s + t.resteAPayer, 0)
      + Object.values(livreurTotals).reduce((s, t) => s + t.resteAPayer, 0);
  }, [closeuseTotals, livreurTotals]);

  const remunPerOrderConfigured = role === "closeuse" ? remunCloseuse > 0 : remunLivreur > 0;

  const handleConfirmPay = async () => {
    if (!confirmTarget) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await callMarkPaid({ userId: confirmTarget.userId });
      setConfirmTarget(null);
    } catch (err) {
      const f = formatFirebaseError(err);
      setErrorMsg(`${f.title} : ${f.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await callCancelPaid({ userId: cancelTarget.userId });
      setCancelTarget(null);
    } catch (err) {
      const f = formatFirebaseError(err);
      setErrorMsg(`${f.title} : ${f.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Chiffre d'Affaires Livré"
          value={`${caTotal.toLocaleString("fr-FR")} FCFA`}
          icon={<CaIcon />}
          accent="blue"
        />
        <StatCard
          label="Colis Livrés & Encaissés"
          value={`${delivered.length.toLocaleString("fr-FR")}`}
          subtitle="Taux réel sur période"
          icon={<TruckIcon />}
          accent="green"
        />
        <StatCard
          label="Commissions Générées"
          value={`${remunerationTotale.toLocaleString("fr-FR")} FCFA`}
          subtitle="Closeuses & Livreurs"
          icon={<CoinIcon />}
          accent="purple"
        />
        <StatCard
          label="Solde Net à Régler"
          value={`${resteAPayerGlobal.toLocaleString("fr-FR")} FCFA`}
          subtitle="Cumul en attente de paiement"
          icon={<ClockIcon />}
          accent="orange"
        />
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-surface-border bg-surface p-1 shadow-xs">
            <button
              onClick={() => setRole("closeuse")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                role === "closeuse" ? "bg-brand text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Closeuses ({closeuses.length})
            </button>
            <button
              onClick={() => setRole("livreur")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                role === "livreur" ? "bg-brand text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Livreurs ({livreurs.length})
            </button>
          </div>
          {role === "livreur" && onOpenCaisse && (
            <button
              type="button"
              onClick={onOpenCaisse}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2 text-xs font-semibold text-brand transition-all hover:bg-brand/20 shadow-xs"
            >
              <Landmark className="h-4 w-4" />
              <span>Pointage de Caisse Livreurs</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <p className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            {errorMsg}
          </p>
        )}

        {!remunPerOrderConfigured && (
          <p className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            Tarif de commission par commande non configuré pour les {role === "closeuse" ? "closeuses" : "livreurs"} —
            à ajuster dans Paramètres pour que les montants se calculent automatiquement.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">Aucun opérateur assigné à cette équipe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-3 font-semibold">{role === "closeuse" ? "Closeuse" : "Livreur"}</th>
                  <th className="pb-3 px-3 font-semibold">Colis Livrés</th>
                  {role === "livreur" && <th className="pb-3 px-3 font-semibold">Statut Caisse Terrain</th>}
                  <th className="pb-3 px-3 font-semibold">Commissions Brutes</th>
                  {role === "livreur" && <th className="pb-3 px-3 font-semibold">Retenues Justifiées</th>}
                  <th className="pb-3 px-3 font-semibold">Net à Régler</th>
                  <th className="pb-3 pl-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => {
                  const total = totals[r.user.id];
                  const baseReste = total?.resteAPayer ?? r.remuneration;
                  const netAPayer = Math.max(0, baseReste - r.remunDeductions);
                  const isPaid = baseReste <= 0 && (total?.totalAmount ?? 0) > 0;
                  return (
                    <tr key={r.user.id} className="transition-colors hover:bg-surface/30">
                      <td className="py-3.5 pr-3 font-semibold text-slate-100">{r.user.name}</td>
                      <td className="py-3.5 px-3 font-mono font-semibold text-slate-200 tabular-nums">{r.livraisons} colis</td>
                      {role === "livreur" && (
                        <td className="py-3.5 px-3">
                          {r.livraisons === 0 ? (
                            <span className="text-xs text-slate-500">Aucun encaissement</span>
                          ) : r.unsettledCash <= 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Caisse soldée ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={onOpenCaisse}
                              title="Ouvrir le pointage de caisse pour vérifier ce livreur"
                              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-400 transition hover:bg-amber-500/20"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {r.unsettledCash.toLocaleString("fr-FR")} FCFA dû
                            </button>
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-3 font-mono font-bold tabular-nums text-slate-100">
                        {r.remuneration.toLocaleString("fr-FR")} FCFA
                      </td>
                      {role === "livreur" && (
                        <td className="py-3.5 px-3">
                          {r.remunDeductions > 0 ? (
                            <div className="space-y-0.5">
                              <span className="font-mono text-xs font-bold text-rose-400">
                                −{r.remunDeductions.toLocaleString("fr-FR")} FCFA
                              </span>
                              <p
                                className="max-w-[220px] truncate text-[10px] text-slate-400"
                                title={r.remunDeductionNotes.join(" • ")}
                              >
                                {r.remunDeductionNotes.join(" • ")}
                              </p>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-slate-500">0 FCFA</span>
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-3">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 shadow-xs">
                            <CheckIcon /> Payé & Soldé
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
                            {netAPayer.toLocaleString("fr-FR")} FCFA
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 text-right">
                        {isPaid ? (
                          <button
                            onClick={() => setCancelTarget({ userId: r.user.id, name: r.user.name })}
                            className="rounded-xl border border-surface-border bg-surface px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:border-rose-500/30 hover:text-rose-400"
                          >
                            Annuler
                          </button>
                        ) : netAPayer > 0 ? (
                          <button
                            onClick={() =>
                              setConfirmTarget({
                                userId: r.user.id,
                                name: r.user.name,
                                amount: netAPayer,
                                unsettledCash: role === "livreur" ? r.unsettledCash : 0,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.98]"
                          >
                            Régler la paie
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Validation du règlement"
        message={
          confirmTarget
            ? confirmTarget.unsettledCash && confirmTarget.unsettledCash > 0
              ? `⚠️ Attention : ${confirmTarget.name} a encore ${confirmTarget.unsettledCash.toLocaleString("fr-FR")} FCFA de cash terrain non reversé dans le pointage de caisse. Confirmer malgré tout le paiement de sa prime nette (${confirmTarget.amount.toLocaleString("fr-FR")} FCFA) ?`
              : `Confirmer le règlement de ${confirmTarget.amount.toLocaleString("fr-FR")} FCFA à ${confirmTarget.name} ?`
            : ""
        }
        confirmLabel="Valider le règlement"
        danger={!!(confirmTarget?.unsettledCash && confirmTarget.unsettledCash > 0)}
        loading={actionLoading}
        onConfirm={handleConfirmPay}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        title="Annulation du règlement"
        message={cancelTarget ? `Remettre le versement de ${cancelTarget.name} en attente ?` : ""}
        confirmLabel="Annuler le paiement"
        danger
        loading={actionLoading}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

function CaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3h13v13H1z" />
      <path d="M14 8h4l3 3v5h-7V8Z" />
      <circle cx="5.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  );
}
function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 0 5h-1a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 0 2.5-2.5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}