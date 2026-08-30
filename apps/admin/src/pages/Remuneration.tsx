import { useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { AppUser, Order, Team, UserRole } from "@ecomcod/shared";
import { useRemunerationTotals, ConfirmDialog } from "@ecomcod/shared";
import StatCard from "../components/StatCard";

interface RemunerationProps {
  team: Team | null;
  closeuses: AppUser[];
  livreurs: AppUser[];
  orders: Order[];
}

interface EmployeeRow {
  user: AppUser;
  livraisons: number;
  remuneration: number;
}

const callMarkPaid = httpsCallable(getFunctions(), "markRemunerationPaid");
const callCancelPaid = httpsCallable(getFunctions(), "cancelRemunerationPayment");

export default function Remuneration({ team, closeuses, livreurs, orders }: RemunerationProps) {
  const [role, setRole] = useState<UserRole>("closeuse");
  const [confirmTarget, setConfirmTarget] = useState<{ userId: string; name: string; amount: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ userId: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const remunCloseuse = team?.remunerationCloseusePerOrder ?? 0;
  const remunLivreur = team?.remunerationLivreurPerOrder ?? 0;

  const { totals: closeuseTotals } = useRemunerationTotals(team?.workspaceId ?? null, "closeuse");
  const { totals: livreurTotals } = useRemunerationTotals(team?.workspaceId ?? null, "livreur");
  const totals = role === "closeuse" ? closeuseTotals : livreurTotals;

  const delivered = useMemo(() => orders.filter((o) => o.statutLivreur === "livre"), [orders]);

  const caTotal = useMemo(() => delivered.reduce((sum, o) => sum + o.amount, 0), [delivered]);

  const rows: EmployeeRow[] = useMemo(() => {
    const users = role === "closeuse" ? closeuses : livreurs;
    const remunPerOrder = role === "closeuse" ? remunCloseuse : remunLivreur;
    return users.map((user) => {
      const mine = delivered.filter((o) =>
        role === "closeuse" ? o.closeuseId === user.id : o.livreurId === user.id
      );
      return {
        user,
        livraisons: mine.length,
        remuneration: mine.length * remunPerOrder,
      };
    });
  }, [role, closeuses, livreurs, delivered, remunCloseuse, remunLivreur]);

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
    try {
      await callMarkPaid({ userId: confirmTarget.userId });
      setConfirmTarget(null);
    } catch (err) {
      console.error("Erreur lors du paiement:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      await callCancelPaid({ userId: cancelTarget.userId });
      setCancelTarget(null);
    } catch (err) {
      console.error("Erreur lors de l'annulation:", err);
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
        <div className="mb-4 flex rounded-xl border border-surface-border bg-surface p-1">
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
                  <th className="pb-2 font-medium">Rémunération</th>
                  <th className="pb-2 font-medium">Reste à payer</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => {
                  const total = totals[r.user.id];
                  const resteAPayer = total?.resteAPayer ?? r.remuneration;
                  const isPaid = resteAPayer <= 0 && (total?.totalAmount ?? 0) > 0;
                  return (
                    <tr key={r.user.id}>
                      <td className="py-2.5 text-slate-200">{r.user.name}</td>
                      <td className="py-2.5 text-slate-400">{r.livraisons}</td>
                      <td className="py-2.5 font-medium text-slate-200">
                        {r.remuneration.toLocaleString("fr-FR")} F
                      </td>
                      <td className="py-2.5">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 px-2 py-0.5 text-xs font-medium text-accent-green">
                            <CheckIcon /> Payé
                          </span>
                        ) : (
                          <span className="text-accent-orange">{resteAPayer.toLocaleString("fr-FR")} F</span>
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
                        ) : resteAPayer > 0 ? (
                          <button
                            onClick={() => setConfirmTarget({ userId: r.user.id, name: r.user.name, amount: resteAPayer })}
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
            ? `Confirmer le paiement de ${confirmTarget.amount.toLocaleString("fr-FR")} F à ${confirmTarget.name} ?`
            : ""
        }
        confirmLabel="Payer"
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