import { useEffect, useState } from "react";
import { ArrowRight, Compass } from "lucide-react";

interface SequenceIndicatorProps {
  pendingSequence: string | null;
}

const SEQUENCE_MAP: Record<string, { label: string; key: string }[]> = {
  g: [
    { key: "D", label: "Cockpit" },
    { key: "O", label: "Commandes" },
    { key: "C", label: "Caisse" },
    { key: "T", label: "Marchés" },
    { key: "U", label: "Accès" },
    { key: "R", label: "Paie" },
    { key: "A", label: "Analyste IA" },
    { key: "P", label: "Performance" },
    { key: "S", label: "Paramètres" },
  ],
};

export default function SequenceIndicator({ pendingSequence }: SequenceIndicatorProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pendingSequence) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 150);
      return () => clearTimeout(timer);
    }
  }, [pendingSequence]);

  if (!visible || !pendingSequence) return null;

  const currentOptions = SEQUENCE_MAP[pendingSequence.toLowerCase()] || [];

  return (
    <div className="fixed bottom-20 md:bottom-8 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-surface-raised px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <Compass className="h-4 w-4 animate-spin text-brand [animation-duration:3s]" />
          <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-brand/50 bg-brand/10 px-1.5 font-mono text-xs font-bold text-brand">
            {pendingSequence.toUpperCase()}
          </kbd>
          <ArrowRight className="h-3 w-3 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {currentOptions.map((opt) => (
            <div
              key={opt.key}
              className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2 py-1 text-[11px] text-slate-300"
            >
              <kbd className="font-mono font-bold text-slate-100">{opt.key}</kbd>
              <span className="text-slate-400">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
