import { buildTelLink, buildWhatsAppLink, LIVREUR_STATUS_LABELS, type LivreurStatus, type Order } from "@ecomcod/shared";

interface OrderCardProps {
  order: Order;
  onChangeStatus: (status: LivreurStatus) => void;
}

const STATUS_BADGE_CLASS: Record<LivreurStatus, string> = {
  recu: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  en_route: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400",
  livre: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  injoignable: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
};

export default function OrderCard({ order, onChangeStatus }: OrderCardProps) {
  const status = order.statutLivreur ?? "recu";
  const isFinal = status === "livre" || status === "injoignable";

  const whatsAppMessage = `Bonjour ${order.clientName}, votre livreur est en route pour votre colis ${
    order.orderNumber ? `(#${order.orderNumber}) ` : ""
  }${order.quantity && order.quantity > 1 ? `(${order.quantity}x) ` : ""}${order.product} d'un montant de ${order.amount.toLocaleString(
    "fr-FR"
  )} F. Êtes-vous disponible à ${order.city || "votre adresse"} ?`;

  const mapsQuery = order.city ? encodeURIComponent(`${order.city} ${order.addressNote || ""}`) : null;

  return (
    <div id={`order-${order.id}`} className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-slate-100 dark:border-slate-700 transition-all">
      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
          {LIVREUR_STATUS_LABELS[status]}
        </span>
        {order.orderNumber && (
          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{order.orderNumber}</span>
        )}
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-medium text-brand">
          {order.clientName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{order.clientName}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{order.product}</p>
        </div>

        {!isFinal && (
          <div className="flex items-center gap-2">
            {/* Bouton WhatsApp */}
            <a
              href={buildWhatsAppLink(order.clientPhoneFormatted, whatsAppMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
              aria-label="WhatsApp"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.968.54 1.775.84 2.791.84h.005c3.18 0 5.767-2.586 5.768-5.766 0-1.543-.601-2.993-1.693-4.085-1.092-1.093-2.542-1.691-4.08-1.691zm0-2.172c4.418 0 8 3.582 8 8 0 1.77-.577 3.411-1.56 4.743l1.529 5.257-5.385-1.413c-1.28.847-2.81 1.413-4.584 1.413-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8z" />
              </svg>
            </a>

            {/* Bouton Appel */}
            <a
              href={buildTelLink(order.clientPhoneFormatted)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand"
              aria-label="Appeler"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Détails de livraison EasySell (Ville, Note/Quartier, Quantité) */}
      {(order.city || order.addressNote || (order.quantity && order.quantity > 1)) && (
        <div className="mb-3 rounded-xl bg-slate-50 dark:bg-slate-750 p-3 text-xs text-slate-700 dark:text-slate-300 space-y-1.5 border border-slate-100 dark:border-slate-700/60">
          {order.city && (
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5">
                <span className="text-base">📍</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{order.city}</span>
              </p>
              {mapsQuery && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-brand hover:underline flex items-center gap-1"
                >
                  Ouvrir Maps ↗
                </a>
              )}
            </div>
          )}
          {order.addressNote && (
            <p className="text-slate-600 dark:text-slate-400 pl-5">
              <span className="font-medium">Repère :</span> {order.addressNote}
            </p>
          )}
          {order.quantity && order.quantity > 1 && (
            <p className="pl-5 text-slate-600 dark:text-slate-400">
              Quantité à livrer : <span className="font-semibold text-brand">{order.quantity}</span>
            </p>
          )}
        </div>
      )}

      <p className="mb-3 text-lg font-medium text-slate-900 dark:text-slate-100">{order.amount.toLocaleString("fr-FR")} F</p>

      {status === "recu" && (
        <button
          onClick={() => onChangeStatus("en_route")}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 transition-opacity"
        >
          Démarrer la livraison
        </button>
      )}

      {status === "en_route" && (
        <div className="flex gap-2">
          <button
            onClick={() => onChangeStatus("livre")}
            className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition-colors"
          >
            Livré ✓
          </button>
          <button
            onClick={() => onChangeStatus("injoignable")}
            className="flex-1 rounded-xl bg-red-50 dark:bg-red-950/40 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 hover:bg-red-100 transition-colors"
          >
            Injoignable
          </button>
        </div>
      )}
    </div>
  );
}

