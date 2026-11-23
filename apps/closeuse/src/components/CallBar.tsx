import { PhoneCall } from "lucide-react";

interface CallBarProps {
  onEndCall: () => void;
}

/**
 * Bandeau persistant affiché sur la commande en cours d'appel pour éviter
 * qu'une autre commande soit ouverte simultanément par erreur.
 */
export default function CallBar({ onEndCall }: CallBarProps) {
  return (
    <div className="mb-3 flex min-h-[44px] items-center justify-between rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm">
      <span className="flex items-center gap-2">
        <PhoneCall className="h-4 w-4 shrink-0" />
        <span className="font-semibold tracking-wide">Appel en cours</span>
      </span>
      <button
        type="button"
        onClick={onEndCall}
        className="min-h-[34px] rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white hover:bg-white/30 active:scale-95 transition-all"
      >
        Terminer
      </button>
    </div>
  );
}
