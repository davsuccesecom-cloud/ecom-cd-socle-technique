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
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-72 bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-sm font-medium text-slate-400">Autres statuts</h2>
        <div className="space-y-1">
          {CLOSEUSE_SECONDARY_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => {
                onSelectSecondary(activeSecondary === status ? null : status);
                onClose();
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                activeSecondary === status ? "bg-brand-light text-brand" : "hover:bg-slate-50"
              }`}
            >
              {CLOSEUSE_STATUS_LABELS[status]}
              <span className="text-slate-400">{countFor(status)}</span>
            </button>
          ))}
          {activeSecondary && (
            <button
              onClick={() => {
                onSelectSecondary(null);
                onClose();
              }}
              className="w-full pt-2 text-left text-sm text-slate-400"
            >
              ← Revenir aux commandes actives
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
