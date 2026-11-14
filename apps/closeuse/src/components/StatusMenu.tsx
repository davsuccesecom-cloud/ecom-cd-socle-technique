import { X, ArrowLeft } from "lucide-react";
import { CLOSEUSE_SECONDARY_STATUSES, CLOSEUSE_STATUS_LABELS, type CloseuseStatus, type Order } from "@ecomcod/shared";

interface StatusMenuProps {
  open: boolean;
  onClose: () => void;
  orders: Order[];
  activeSecondary: CloseuseStatus | null;
  onSelectSecondary: (status: CloseuseStatus | null) => void;
}

/**
 * Statuts secondaires regroupés dans le menu latéral afin de garder
 * les onglets principaux focalisés sur le flux quotidien de la closeuse.
 */
export default function StatusMenu({ open, onClose, orders, activeSecondary, onSelectSecondary }: StatusMenuProps) {
  if (!open) return null;

  const countFor = (status: CloseuseStatus) => orders.filter((o) => o.statutCloseuse === status).length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-72 border-l border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-2xl text-slate-900 dark:text-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Autres statuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {CLOSEUSE_SECONDARY_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                onSelectSecondary(activeSecondary === status ? null : status);
                onClose();
              }}
              className={`flex min-h-[48px] w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                activeSecondary === status
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <span>{CLOSEUSE_STATUS_LABELS[status]}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  activeSecondary === status
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {countFor(status)}
              </span>
            </button>
          ))}
          {activeSecondary && (
            <button
              type="button"
              onClick={() => {
                onSelectSecondary(null);
                onClose();
              }}
              className="mt-2 flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Revenir aux commandes actives</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
