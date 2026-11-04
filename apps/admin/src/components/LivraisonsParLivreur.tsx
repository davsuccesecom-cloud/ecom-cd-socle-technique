import type { AppUser, Order } from "@ecomcod/shared";

interface LivraisonsParLivreurProps {
  orders: Order[];
  livreurs: AppUser[];
}

export default function LivraisonsParLivreur({ orders, livreurs }: LivraisonsParLivreurProps) {
  const nameById = new Map(livreurs.map((u) => [u.id, u.name]));

  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.statutLivreur === "livre" && order.livreurId) {
      counts.set(order.livreurId, (counts.get(order.livreurId) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Livraisons par Livreur
      </h3>
      {ranked.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">Aucune livraison enregistrée sur la période.</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {ranked.map(([livreurId, count]) => (
            <li key={livreurId} className="flex items-center gap-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-surface-border bg-surface text-xs font-bold text-brand shadow-xs">
                {(nameById.get(livreurId) ?? "?").charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-xs font-semibold text-slate-200 truncate">
                {nameById.get(livreurId) ?? "Livreur inconnu"}
              </span>
              <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                {count} {count > 1 ? "colis" : "colis"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
