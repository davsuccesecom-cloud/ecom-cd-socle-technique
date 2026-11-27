import { useState, useRef, useEffect } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { DayPicker, type DateRange } from "react-day-picker";
import { fr } from "date-fns/locale";
import "react-day-picker/dist/style.css";

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
  const bufferEnd = now + 10 * 60 * 1000;
  const preset = period.value;
  if (preset === "tout") return { start: 0, end: bufferEnd + 365 * 86400000 };
  if (preset === "jour") {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime() + 10 * 60 * 1000;
    return { start, end };
  }
  if (preset === "semaine") return { start: now - 7 * 24 * 60 * 60 * 1000, end: bufferEnd };
  return { start: now - 30 * 24 * 60 * 60 * 1000, end: bufferEnd };
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
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [month, setMonth] = useState<Date>(() => new Date());
  const popoverRef = useRef<HTMLDivElement>(null);

  const isCustom = period.type === "custom";
  const isMobile = useIsMobile();

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
    const now = new Date();
    if (isCustom && period.start > 0 && new Date(period.start).getFullYear() >= 2020) {
      const from = new Date(period.start);
      const to = new Date(period.end);
      setRange({ from, to });
      setMonth(from);
    } else {
      if (period.type === "preset" && period.value === "tout") {
        // En mode "Tout" (start: 0), ne pas sauter à l'époque Unix 1970 : initialiser sur les 30 derniers jours
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        setRange({ from: start, to: now });
        setMonth(now);
      } else {
        const { start, end } = periodRangeMs(period);
        const safeStart = start > 0 && new Date(start).getFullYear() >= 2020 ? start : now.getTime() - 30 * 24 * 60 * 60 * 1000;
        const from = new Date(safeStart);
        const to = new Date(end);
        setRange({ from, to });
        setMonth(from);
      }
    }
    setOpen((v) => !v);
  };

  const applyCustom = () => {
    if (!range?.from || !range?.to) return;
    const start = new Date(range.from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.to);
    end.setHours(23, 59, 59, 999);
    onChange({ type: "custom", start: start.getTime(), end: end.getTime() });
    setOpen(false);
  };

  return (
    <div className="relative flex rounded-xl border border-surface-border bg-surface-raised p-1 shadow-xs md:h-9 md:items-center md:rounded-xl md:p-0.5">
      {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange({ type: "preset", value: p })}
          className={`rounded-lg px-3 py-1.5 text-sm transition-all md:rounded-lg md:px-2.5 md:py-1 md:text-xs md:font-semibold ${
            period.type === "preset" && period.value === p
              ? "bg-brand text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
      <button
        onClick={openCustomPanel}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all md:rounded-lg md:px-2.5 md:py-1 md:text-xs md:font-semibold ${
          isCustom ? "bg-brand text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
        }`}
      >
        <CalendarIcon />
        {isCustom ? periodLabel(period) : "Personnalisé"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={() => setOpen(false)}
          />
          <div
            ref={popoverRef}
            className="ecomcod-daypicker fixed inset-x-4 top-24 z-50 mx-auto max-w-[calc(100vw-2rem)] overflow-x-auto rounded-xl border border-surface-border bg-surface-raised p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:max-w-none sm:mx-0"
          >
          <p className="mb-2 text-sm font-medium text-slate-200">
            Choisis une date de début, puis une date de fin
          </p>
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            month={month}
            onMonthChange={setMonth}
            startMonth={new Date(2020, 0, 1)}
            endMonth={new Date(new Date().getFullYear() + 2, 11, 31)}
            disabled={{ before: new Date(2020, 0, 1) }}
            numberOfMonths={isMobile ? 1 : 2}
            showOutsideDays
            locale={fr}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {range?.from && range?.to
                ? `${range.from.toLocaleDateString("fr-FR")} — ${range.to.toLocaleDateString("fr-FR")}`
                : range?.from
                  ? "Sélectionne la date de fin"
                  : "Aucune plage sélectionnée"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                onClick={applyCustom}
                disabled={!range?.from || !range?.to}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Appliquer
              </button>
            </div>
          </div>
          </div>
        </>
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