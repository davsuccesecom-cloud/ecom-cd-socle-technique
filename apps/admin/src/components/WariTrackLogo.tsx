import React, { useId } from "react";

interface WariTrackLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "full";
  className?: string;
  subtitle?: string;
  roundedBadge?: boolean;
}

export default function WariTrackLogo({
  size = "md",
  variant = "full",
  className = "",
  subtitle = "LOGISTICS PLATFORM",
  roundedBadge = false,
}: WariTrackLogoProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const legVioletId = `legViolet_${id}`;
  const legCyanId = `legCyan_${id}`;
  const legGoldId = `legGold_${id}`;
  const legOrangeId = `legOrange_${id}`;

  const iconDimensions = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  }[size];

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-2xl",
  }[size];

  const subSizes = {
    sm: "text-[8px]",
    md: "text-[9.5px]",
    lg: "text-[11px]",
    xl: "text-xs",
  }[size];

  return (
    <div className={`flex items-center gap-2.5 overflow-hidden ${className}`}>
      {/* Monogramme 'W' Multi-Couleurs Polyvalent à Pattes Ultra-Larges & Coins Arrondis */}
      <div
        className={`${iconDimensions} shrink-0 flex items-center justify-center relative select-none ${
          roundedBadge
            ? "rounded-2xl border border-white/10 bg-slate-900/90 p-1.5 shadow-md"
            : ""
        }`}
        title="WariTrack — Cash & Logistics OS"
      >
        <svg viewBox="0 0 160 105" fill="none" className="h-full w-full drop-shadow-sm overflow-visible">
          <defs>
            {/* Dégradé Branche 1 : Violet Royal (Cockpit & Intelligence) */}
            <linearGradient id={legVioletId} x1="24" y1="20" x2="52" y2="82" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#6366F1" />
            </linearGradient>

            {/* Dégradé Branche 2 : Cyan Électrique (Radar & Flotte Livreur) */}
            <linearGradient id={legCyanId} x1="52" y1="82" x2="80" y2="35" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#00D2FF" />
            </linearGradient>

            {/* Dégradé Branche 3 : Or Ambré Solaire (Wari & Trésorerie Cash) */}
            <linearGradient id={legGoldId} x1="80" y1="35" x2="108" y2="82" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FCD34D" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>

            {/* Dégradé Branche 4 : Orange Solaire Vif (Closing WhatsApp & Ventes) */}
            <linearGradient id={legOrangeId} x1="108" y1="82" x2="136" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF7A1A" />
              <stop offset="1" stopColor="#EA580C" />
            </linearGradient>
          </defs>

          {/* Les 4 Pattes Ultra-Larges et Fermes du W (Stroke Épais 30px & Extrémités Arrondies) */}
          <g strokeWidth="30" strokeLinecap="round" strokeLinejoin="round">
            {/* 1. Violet : Branche descendante gauche */}
            <path d="M29 29L54 79" stroke={`url(#${legVioletId})`} />

            {/* 4. Orange : Branche ascendante droite */}
            <path d="M106 79L131 29" stroke={`url(#${legOrangeId})`} />

            {/* 3. Or : Branche descendante centre-droit */}
            <path d="M80 37L106 79" stroke={`url(#${legGoldId})`} />

            {/* 2. Cyan : Branche ascendante centre-gauche */}
            <path d="M54 79L80 37" stroke={`url(#${legCyanId})`} />
          </g>

          {/* Balise Radar / Apex Central (Cercle Blanc avec Pupille Noire) */}
          <circle cx="80" cy="37" r="9.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" strokeOpacity="0.2" />
          <circle cx="80" cy="37" r="4.6" fill="#07090F" />
        </svg>
      </div>

      {variant === "full" && (
        <div className="min-w-0 flex flex-col justify-center">
          <span className={`block truncate ${textSizes} font-black tracking-tight text-slate-900 dark:text-white leading-tight`}>
            wari<span className="font-extrabold text-slate-900 dark:text-white">track</span>
          </span>
          {subtitle && (
            <span className={`block truncate ${subSizes} font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400 mt-0.5 whitespace-nowrap`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
