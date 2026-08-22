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
      <h3 className="mb-3 text-sm font-medium text-slate-200">Livraisons par livreur</h3>
      {ranked.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Aucune livraison sur la période.</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {ranked.map(([livreurId, count]) => (
            <li key={livreurId} className="flex items-center gap-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-xs font-medium text-brand">
                {(nameById.get(livreurId) ?? "?").charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-sm text-slate-300">
                {nameById.get(livreurId) ?? "Livreur inconnu"}
              </span>
              <span className="text-sm text-slate-500">
                {count} livraison{count > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
