import type { Order } from "@ecomcod/shared";

interface FluxTempsReelProps {
  orders: Order[];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(ts: number) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  return `il y a ${diffH} h`;
}

export default function FluxTempsReel({ orders }: FluxTempsReelProps) {
  // Commandes arrivées à un statut final livreur (livré ou injoignable),
  // les plus récentes en premier — ce sont les événements qui viennent
  // "d'arriver" côté admin (section 5.1, résumé + flux temps réel).
  const recent = orders
    .filter((o) => o.statutLivreur === "livre" || o.statutLivreur === "injoignable")
    .filter((o) => o.timestamps.delivered)
    .sort((a, b) => (b.timestamps.delivered ?? 0) - (a.timestamps.delivered ?? 0))
    .slice(0, 30);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Flux Terrain en Direct
      </h3>
      {recent.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">Aucune activité terrain pour le moment.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-surface-border overflow-y-auto pr-1">
          {recent.map((order) => {
            const delivered = order.statutLivreur === "livre";
            const ts = order.timestamps.delivered!;
            return (
              <li key={order.id} className="flex items-center gap-2.5 py-2.5 text-xs">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-[11px] ${
                    delivered
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border border-rose-500/30 bg-rose-500/10 text-rose-400"
                  }`}
                >
                  {delivered ? "✓ Livrée" : "✕ Injoignable"}
                </span>
                <span className="flex-1 truncate font-medium text-slate-200">{order.clientName}</span>
                <span className="shrink-0 font-semibold text-slate-200 tabular-nums">
                  {delivered ? `${order.amount.toLocaleString("fr-FR")} FCFA` : "—"}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatTime(ts)}</span>
                <span className="hidden shrink-0 text-[10px] text-slate-500 sm:inline">{timeAgo(ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
