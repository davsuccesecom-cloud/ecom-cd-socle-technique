import { PhoneCall } from "lucide-react";

interface CallBarProps {
  onEndCall: () => void;
}

/**
 * Bandeau compact blanc (hauteur max 2cm) avec "Terminer" en bleu à droite.
 * Reste affiché tant que l'employé n'a pas appuyé sur "Terminer".
 */
export default function CallBar({ onEndCall }: CallBarProps) {
  return (
    <div className="mb-2 flex h-7 items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 shadow-xs">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
        <PhoneCall className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">Appel en cours</span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEndCall();
        }}
        className="text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 hover:underline px-1 py-0.5 transition-colors cursor-pointer"
      >
        Terminer
      </button>
    </div>
  );
}
