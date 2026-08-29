import { useMemo, useState } from "react";
import type { AppUser, Order, Team, UserRole } from "@ecomcod/shared";
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

export default function Remuneration({ team, closeuses, livreurs, orders }: RemunerationProps) {
  const [role, setRole] = useState<UserRole>("closeuse");

  const remunCloseuse = team?.remunerationCloseusePerOrder ?? 0;
  const remunLivreur = team?.remunerationLivreurPerOrder ?? 0;

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

  const remunPerOrderConfigured = role === "closeuse" ? remunCloseuse > 0 : remunLivreur > 0;

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
          value={`${remunerationTotale.toLocaleString("fr-FR")} F`}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td className="py-2.5 text-slate-200">{r.user.name}</td>
                    <td className="py-2.5 text-slate-400">{r.livraisons}</td>
                    <td className="py-2.5 font-medium text-slate-200">
                      {r.remuneration.toLocaleString("fr-FR")} F
                    </td>
                    <td className="py-2.5 text-accent-orange">
                      {r.remuneration.toLocaleString("fr-FR")} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised p-6 text-center">
        <p className="text-sm text-slate-400">
          Historique des paiements — bientôt disponible.
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Cette section permettra de marquer une rémunération comme payée (espèces, Mobile Money) et
          de garder un historique complet par employé.
        </p>
      </div>
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