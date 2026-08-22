interface CallBarProps {
  onEndCall: () => void;
}

/**
 * Barre bleue demandée explicitement (architecture section 6) : reste
 * visible sur LA commande précise pendant l'appel, même si d'autres
 * commandes arrivent entre-temps, pour éviter qu'une closeuse ouvre une
 * 2e action pendant qu'un appel est encore en cours ailleurs.
 */
export default function CallBar({ onEndCall }: CallBarProps) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-lg bg-sky-500 px-3 py-1.5 text-sm text-white">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        Appel en cours
      </span>
      <button onClick={onEndCall} className="underline underline-offset-2">
        Terminer
      </button>
    </div>
  );
}
