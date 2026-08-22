import { buildTelLink, LIVREUR_STATUS_LABELS, type LivreurStatus, type Order } from "@ecomcod/shared";

interface OrderCardProps {
  order: Order;
  onChangeStatus: (status: LivreurStatus) => void;
}

const STATUS_BADGE_CLASS: Record<LivreurStatus, string> = {
  recu: "bg-indigo-50 text-indigo-600",
  en_route: "bg-sky-50 text-sky-600",
  livre: "bg-green-50 text-green-700",
  injoignable: "bg-red-50 text-red-700",
};

export default function OrderCard({ order, onChangeStatus }: OrderCardProps) {
  const status = order.statutLivreur ?? "recu";
  const isFinal = status === "livre" || status === "injoignable";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
          {LIVREUR_STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-medium text-brand">
          {order.clientName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{order.clientName}</p>
          <p className="truncate text-sm text-slate-500">{order.product}</p>
        </div>
        {!isFinal && (
          <a
            href={buildTelLink(order.clientPhoneFormatted)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand"
            aria-label="Appeler"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
        )}
      </div>

      <p className="mb-3 text-lg font-medium">{order.amount.toLocaleString("fr-FR")} F</p>

      {status === "recu" && (
        <button
          onClick={() => onChangeStatus("en_route")}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white"
        >
          Démarrer la livraison
        </button>
      )}

      {status === "en_route" && (
        <div className="flex gap-2">
          <button
            onClick={() => onChangeStatus("livre")}
            className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white"
          >
            Livré
          </button>
          <button
            onClick={() => onChangeStatus("injoignable")}
            className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-medium text-red-600"
          >
            Injoignable
          </button>
        </div>
      )}
    </div>
  );
}
