import { formatCurrency } from "@ecomcod/shared";
import type { Order } from "@ecomcod/shared";

interface FluxTempsReelProps {
  orders: Order[];
  currency?: string;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(ts: number) {
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `il y a ${diffD} j`;
}

export default function FluxTempsReel({ orders, currency = "XOF" }: FluxTempsReelProps) {
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
        <p className="py-6 text-center text-xs text-slate-500">Aucune activité terrain sur la période.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-surface-border overflow-y-auto pr-1">
          {recent.map((order) => {
            const delivered = order.statutLivreur === "livre";
            const ts = order.timestamps.delivered!;
            return (
              <li key={order.id} className="flex items-center gap-2.5 py-2.5 text-xs">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    delivered
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  }`}
                >
                  {delivered ? "Livrée" : "Échec / Injoignable"}
                </span>
                <span className="flex-1 truncate font-medium text-slate-200">{order.clientName}</span>
                <span className="shrink-0 font-semibold text-slate-200 tabular-nums whitespace-nowrap">
                  {delivered ? formatCurrency(order.amount, currency) : "—"}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{formatTime(ts)}</span>
                <span className="hidden shrink-0 text-[10px] text-slate-500 sm:inline whitespace-nowrap">
                  {timeAgo(ts)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
