import { PhoneCall } from "lucide-react";

interface CallBarProps {
  onEndCall: () => void;
}

/**
 * Bandeau compact blanc (non bleu) avec indicateur d'appel à gauche
 * et bouton "Terminer" à l'extrême droite de la ligne.
 */
export default function CallBar({ onEndCall }: CallBarProps) {
  return (
    <div className="mb-2.5 flex h-9 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 shadow-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <PhoneCall className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span className="truncate text-xs font-bold text-slate-900">
          Appel en cours...
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEndCall();
        }}
        className="ml-auto inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 shadow-xs transition-all hover:bg-rose-100 hover:text-rose-700 active:scale-95 cursor-pointer"
      >
        Terminer
      </button>
    </div>
  );
}
