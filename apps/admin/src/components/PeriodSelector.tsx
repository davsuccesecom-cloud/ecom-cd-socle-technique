import { useState, useRef, useEffect } from "react";

export type PeriodPreset = "jour" | "semaine" | "mois" | "tout";
export type Period =
  | { type: "preset"; value: PeriodPreset }
  | { type: "custom"; start: number; end: number };

const PRESET_LABELS: Record<PeriodPreset, string> = {
  jour: "Jour",
  semaine: "Semaine",
  mois: "Mois",
  tout: "Tout",
};

export function periodRangeMs(period: Period): { start: number; end: number } {
  if (period.type === "custom") {
    return { start: period.start, end: period.end };
  }
  const now = Date.now();
  const preset = period.value;
  if (preset === "tout") return { start: 0, end: now };
  if (preset === "jour") {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { start, end: now };
  }
  if (preset === "semaine") return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
  return { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
}

export function periodLabel(period: Period): string {
  if (period.type === "preset") return PRESET_LABELS[period.value];
  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `${fmt(period.start)} — ${fmt(period.end)}`;
}

interface PeriodSelectorProps {
  period: Period;
  onChange: (period: Period) => void;
}

export default function PeriodSelector({ period, onChange }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const isCustom = period.type === "custom";

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const openCustomPanel = () => {
    if (isCustom) {
      setDraftStart(new Date(period.start).toISOString().slice(0, 10));
      setDraftEnd(new Date(period.end).toISOString().slice(0, 10));
    } else {
      const { start, end } = periodRangeMs(period);
      setDraftStart(new Date(start).toISOString().slice(0, 10));
      setDraftEnd(new Date(end).toISOString().slice(0, 10));
    }
    setOpen((v) => !v);
  };

  const applyCustom = () => {
    if (!draftStart || !draftEnd) return;
    const start = new Date(draftStart + "T00:00:00").getTime();
    const end = new Date(draftEnd + "T23:59:59").getTime();
    if (start > end) return;
    onChange({ type: "custom", start, end });
    setOpen(false);
  };

  return (
    <div className="relative flex rounded-xl border border-surface-border bg-surface-raised p-1">
      {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange({ type: "preset", value: p })}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            period.type === "preset" && period.value === p
              ? "bg-brand text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
      <button
        onClick={openCustomPanel}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
          isCustom ? "bg-brand text-white" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <CalendarIcon />
        {isCustom ? periodLabel(period) : "Personnalisé"}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-surface-border bg-surface-raised p-4 shadow-xl"
        >
          <p className="mb-3 text-sm font-medium text-slate-200">Choisir une plage de dates</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Du</label>
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Au</label>
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
            <button
              onClick={applyCustom}
              disabled={!draftStart || !draftEnd}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}