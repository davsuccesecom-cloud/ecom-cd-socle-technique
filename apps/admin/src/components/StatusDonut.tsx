import { CLOSEUSE_STATUS_LABELS } from "@ecomcod/shared";
import type { CloseuseStatus } from "@ecomcod/shared";

interface StatusDonutProps {
  counts: Record<CloseuseStatus, number>;
}

// Mêmes couleurs que le reste du système (tailwind.config.js `status.*`),
// dupliquées ici en valeurs hex car un <svg> ne peut pas lire les classes
// Tailwind directement.
const STATUS_COLORS: Record<CloseuseStatus, string> = {
  nouveau: "#4F46E5",
  programme: "#F59E0B",
  en_cours: "#0EA5E9",
  livre: "#16A34A",
  rejete: "#EF4444",
  injoignable: "#DC2626",
  indisponible: "#6B7280",
};

export default function StatusDonut({ counts }: StatusDonutProps) {
  const entries = (Object.keys(counts) as CloseuseStatus[]).filter((k) => counts[k] > 0);
  const total = entries.reduce((sum, k) => sum + counts[k], 0);

  const size = 168;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAcc = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#22262D"
              strokeWidth={strokeWidth}
            />
          ) : (
            entries.map((key) => {
              const fraction = counts[key] / total;
              const dash = fraction * circumference;
              const gap = circumference - dash;
              const el = (
                <circle
                  key={key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={STATUS_COLORS[key]}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-offsetAcc}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offsetAcc += dash;
              return el;
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight tabular-nums text-slate-100">
            {total.toLocaleString("fr-FR")}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Commandes
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 self-start">
        {entries.map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[key] }} />
            <span className="truncate">{CLOSEUSE_STATUS_LABELS[key]}</span>
            <span className="tabular-nums font-medium text-slate-400">({counts[key]})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
