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
    .slice(0, 8);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-200">Flux temps réel</h3>
      {recent.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Rien à afficher pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {recent.map((order) => {
            const delivered = order.statutLivreur === "livre";
            const ts = order.timestamps.delivered!;
            return (
              <li key={order.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    delivered ? "bg-accent-green/15 text-accent-green" : "bg-accent-red/15 text-accent-red"
                  }`}
                >
                  {delivered ? "✓" : "✕"}
                </span>
                <span className={`w-24 shrink-0 ${delivered ? "text-accent-green" : "text-accent-red"}`}>
                  {delivered ? "Livrée" : "Injoignable"}
                </span>
                <span className="flex-1 truncate text-slate-300">{order.clientName}</span>
                <span className="shrink-0 text-slate-400">
                  {delivered ? `${order.amount.toLocaleString("fr-FR")} F` : "—"}
                </span>
                <span className="shrink-0 text-slate-500">{formatTime(ts)}</span>
                <span className="hidden shrink-0 text-xs text-slate-600 sm:inline">{timeAgo(ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
