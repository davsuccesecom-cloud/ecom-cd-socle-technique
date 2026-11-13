import { useEffect, useId, useRef, type ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Fenêtre de confirmation basée sur `<dialog>` natif (`showModal()`),
 * avec focus trap, fermeture `Esc`, confinement du scroll par CSS
 * (`overscroll-behavior: contain`) et repli light-dismiss pour Safari.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  loading = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Si showModal échoue dans un environnement limité, évite une exception fatale
        }
      }
    } else if (dialog.open) {
      dialog.close();
      dialog.returnValue = "";
    }
  }, [open]);

  const isOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      {...({ closedby: loading ? "none" : "any" } as Record<string, unknown>)}
      onCancel={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        onCancel();
      }}
      onPointerDown={(e) => {
        const dialog = dialogRef.current;
        if (!dialog || loading) {
          pressedOutsideRef.current = false;
          return;
        }
        if (!("closedBy" in HTMLDialogElement.prototype)) {
          pressedOutsideRef.current = isOutsideDialog(e, dialog);
        }
      }}
      onPointerUp={(e) => {
        const dialog = dialogRef.current;
        if (!dialog || loading) return;
        if (!("closedBy" in HTMLDialogElement.prototype) && pressedOutsideRef.current && isOutsideDialog(e, dialog)) {
          pressedOutsideRef.current = false;
          onCancel();
        } else {
          pressedOutsideRef.current = false;
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-5 text-left text-slate-900 dark:text-slate-100 shadow-2xl open:block"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
            danger
              ? "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400"
              : "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold leading-snug">
            {title}
          </h2>
          <p id={descId} className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {message}
          </p>
        </div>
      </div>

      {children && <div className="mt-4">{children}</div>}

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          autoFocus={danger}
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          disabled={loading}
          className="min-h-[44px] flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-surface-subtle disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          autoFocus={!danger}
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          disabled={loading}
          className={`min-h-[44px] flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 ${
            danger ? "bg-red-600 hover:bg-red-500" : "bg-brand"
          }`}
        >
          {loading ? "Validation…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
