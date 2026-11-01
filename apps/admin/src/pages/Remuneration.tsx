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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="CA total (livré)"
          value={`${caTotal.toLocaleString("fr-FR")} F`}
          icon={<CaIcon />}
          accent="blue"
        />
        <StatCard
          label="Commandes livrées"
          value={String(delivered.length)}
          icon={<TruckIcon />}
          accent="green"
        />
        <StatCard
          label="Rémunération totale"
          value={`${remunerationTotale.toLocaleString("fr-FR")} F`}
          icon={<CoinIcon />}
          accent="purple"
        />
        <StatCard
          label="Reste à payer"
          value={`${resteAPayerGlobal.toLocaleString("fr-FR")} F`}
          icon={<ClockIcon />}
          accent="orange"
        />
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 rounded-xl border border-surface-border bg-surface p-1">
            <button
              onClick={() => setRole("closeuse")}
              className={`flex-1 rounded-lg px-4 py-1.5 text-sm transition-colors ${
                role === "closeuse" ? "bg-brand text-white" : "text-slate-400"
              }`}
            >
              Closeuses
            </button>
            <button
              onClick={() => setRole("livreur")}
              className={`flex-1 rounded-lg px-4 py-1.5 text-sm transition-colors ${
                role === "livreur" ? "bg-brand text-white" : "text-slate-400"
              }`}
            >
              Livreurs
            </button>
          </div>
          {role === "livreur" && onOpenCaisse && (
            <button
              type="button"
              onClick={onOpenCaisse}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/15"
            >
              <Landmark className="h-3.5 w-3.5" />
              Contrôler Caisse & Versements fin de journée
            </button>
          )}
        </div>

        {errorMsg && (
          <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {errorMsg}
          </p>
        )}

        {!remunPerOrderConfigured && (
          <p className="mb-3 rounded-lg bg-accent-orange/10 px-3 py-2 text-xs text-accent-orange">
            Tarif par commande non configuré pour les {role === "closeuse" ? "closeuses" : "livreurs"} —
            à régler dans Paramètres pour que les montants s'affichent correctement.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Aucun employé sur cette équipe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">{role === "closeuse" ? "Closeuse" : "Livreur"}</th>
                  <th className="pb-2 font-medium">Livrées</th>
                  {role === "livreur" && <th className="pb-2 font-medium">Statut Caisse Terrain</th>}
                  <th className="pb-2 font-medium">Rémunération brute</th>
                  {role === "livreur" && <th className="pb-2 font-medium">Retenues (justifiées)</th>}
                  <th className="pb-2 font-medium">Net à payer</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => {
                  const total = totals[r.user.id];
                  const baseReste = total?.resteAPayer ?? r.remuneration;
                  const netAPayer = Math.max(0, baseReste - r.remunDeductions);
                  const isPaid = baseReste <= 0 && (total?.totalAmount ?? 0) > 0;
                  return (
                    <tr key={r.user.id}>
                      <td className="py-2.5 font-medium text-slate-200">{r.user.name}</td>
                      <td className="py-2.5 text-slate-400">{r.livraisons}</td>
                      {role === "livreur" && (
                        <td className="py-2.5">
                          {r.livraisons === 0 ? (
                            <span className="text-xs text-slate-500">Aucun encaissement</span>
                          ) : r.unsettledCash <= 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Caisse soldée ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={onOpenCaisse}
                              title="Ouvrir Caisse & Versements pour pointer ce livreur"
                              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {r.unsettledCash.toLocaleString("fr-FR")} F non versé
                            </button>
                          )}
                        </td>
                      )}
                      <td className="py-2.5 font-medium text-slate-200">
                        {r.remuneration.toLocaleString("fr-FR")} F
                      </td>
                      {role === "livreur" && (
                        <td className="py-2.5">
                          {r.remunDeductions > 0 ? (
                            <div className="space-y-0.5">
                              <span className="font-mono text-xs font-semibold text-rose-400">
                                -{r.remunDeductions.toLocaleString("fr-FR")} F
                              </span>
                              <p
                                className="max-w-[220px] truncate text-[10px] text-slate-400"
                                title={r.remunDeductionNotes.join(" • ")}
                              >
                                {r.remunDeductionNotes.join(" • ")}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">0 F</span>
                          )}
                        </td>
                      )}
                      <td className="py-2.5">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 px-2 py-0.5 text-xs font-medium text-accent-green">
                            <CheckIcon /> Payé
                          </span>
                        ) : (
                          <span className="font-semibold text-accent-orange">
                            {netAPayer.toLocaleString("fr-FR")} F
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {isPaid ? (
                          <button
                            onClick={() => setCancelTarget({ userId: r.user.id, name: r.user.name })}
                            className="text-xs text-slate-500 hover:text-accent-red hover:underline"
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
                            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Payer
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
        title="Confirmer le paiement"
        message={
          confirmTarget
            ? confirmTarget.unsettledCash && confirmTarget.unsettledCash > 0
              ? `⚠️ Attention : ${confirmTarget.name} a encore ${confirmTarget.unsettledCash.toLocaleString("fr-FR")} F de caisse terrain non validée dans Caisse & Versements. Confirmer malgré tout le versement de sa prime nette (${confirmTarget.amount.toLocaleString("fr-FR")} F) ?`
              : `Confirmer le paiement de ${confirmTarget.amount.toLocaleString("fr-FR")} F à ${confirmTarget.name} ?`
            : ""
        }
        confirmLabel="Payer"
        danger={!!(confirmTarget?.unsettledCash && confirmTarget.unsettledCash > 0)}
        loading={actionLoading}
        onConfirm={handleConfirmPay}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        title="Annuler le paiement"
        message={cancelTarget ? `Remettre le paiement de ${cancelTarget.name} en attente ?` : ""}
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