import { CLOSEUSE_SECONDARY_STATUSES, CLOSEUSE_STATUS_LABELS, type CloseuseStatus, type Order } from "@ecomcod/shared";

interface StatusMenuProps {
  open: boolean;
  onClose: () => void;
  orders: Order[];
  activeSecondary: CloseuseStatus | null;
  onSelectSecondary: (status: CloseuseStatus | null) => void;
}

/**
 * Statuts secondaires planqués derrière le hamburger (architecture
 * section 6) — pas sur l'écran principal, pour ne pas polluer le flux de
 * travail quotidien de la closeuse.
 */
export default function StatusMenu({ open, onClose, orders, activeSecondary, onSelectSecondary }: StatusMenuProps) {
  if (!open) return null;

  const countFor = (status: CloseuseStatus) => orders.filter((o) => o.statutCloseuse === status).length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-72 bg-white dark:bg-slate-800 p-5 shadow-2xl border-l border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100 transition-colors">
        <h2 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">Autres statuts</h2>
        <div className="space-y-1">
          {CLOSEUSE_SECONDARY_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => {
                onSelectSecondary(activeSecondary === status ? null : status);
                onClose();
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                activeSecondary === status
                  ? "bg-brand text-white"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <span>{CLOSEUSE_STATUS_LABELS[status]}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  activeSecondary === status
                    ? "bg-white/20 text-white"
                    : "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700"
                }`}
              >
                {countFor(status)}
              </span>
            </button>
          ))}
          {activeSecondary && (
            <button
              onClick={() => {
                onSelectSecondary(null);
                onClose();
              }}
              className="w-full pt-3 text-left text-sm text-brand hover:underline font-medium"
            >
              ← Revenir aux commandes actives
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
