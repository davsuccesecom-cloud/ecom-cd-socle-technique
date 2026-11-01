import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Fenêtre de revalidation explicite pour toute décision sensible ou irréversible
 * (paiement, suppression, révocation d'accès, forçage de statut, déconnexion).
 *
 * Utilise un portail React monté directement sur document.body avec z-[99999]
 * et capture totale des événements pour éviter tout débordement de contexte
 * d'empilement (stacking context) ou de fuite de survol/clic vers les graphiques sous-jacents.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);

    // Verrouillage propre du scroll de fond pendant l'affichage du dialogue
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, loading, onCancel]);

  if (!open || !mounted || typeof document === "undefined") {
    return null;
  }

  const dialogContent = (
    <div
      role="presentation"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm pointer-events-auto select-none"
      onClick={(e) => {
        e.stopPropagation();
        if (!loading) onCancel();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        className="w-full max-w-sm select-text rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl transition-all"
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              danger
                ? "bg-red-500/15 text-red-400 border border-red-500/30"
                : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
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
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-100">
              {title}
            </h2>
            <p id="confirm-dialog-desc" className="mt-1.5 text-xs leading-relaxed text-slate-400">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={loading}
            className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-surface-subtle hover:text-white disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            disabled={loading}
            className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-500" : "bg-brand"
            }`}
          >
            {loading ? "Validation…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
