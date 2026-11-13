import { useState } from "react";
import { ITEMS, ACCENT_CLASSES, type QuickSummaryCounts } from "./QuickSummary";

interface QuickSummaryFabProps {
  counts: QuickSummaryCounts;
}

export default function QuickSummaryFab({ counts }: QuickSummaryFabProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Résumé rapide"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-black/30 active:scale-95"
      >
        <BoltIcon />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-24"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <BoltIcon />
                Résumé rapide
              </span>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-slate-500">
                <CloseIcon />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ITEMS.map((item) => (
                <div key={item.key} className="rounded-xl border border-surface-border bg-surface px-3 py-2.5">
                  <span
                    className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-md ${ACCENT_CLASSES[item.accent]}`}
                  >
                    <DotIcon />
                  </span>
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-base font-semibold text-slate-100">{counts[item.key]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function DotIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}
