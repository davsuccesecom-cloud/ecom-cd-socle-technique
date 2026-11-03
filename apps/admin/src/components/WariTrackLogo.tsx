import React from "react";

interface WariTrackLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "full";
  dynamicAccent?: boolean;
  className?: string;
  subtitle?: string;
}

export default function WariTrackLogo({
  size = "md",
  variant = "full",
  dynamicAccent = true,
  className = "",
  subtitle = "Pilotage Opérationnel",
}: WariTrackLogoProps) {
  const iconDimensions = {
    sm: "w-7 h-7",
    md: "w-8 h-8",
    lg: "w-10 h-10",
    xl: "w-14 h-14",
  }[size];

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-xl",
  }[size];

  const subSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-xs",
  }[size];

  const strokeColor = dynamicAccent ? "var(--brand)" : "url(#wariLogoGrad)";

  return (
    <div className={`flex items-center gap-2.5 overflow-hidden ${className}`}>
      {/* Emblème Vectoriel WariTrack avec Ondes Radar & Balise GPS */}
      <div
        className={`${iconDimensions} shrink-0 flex items-center justify-center rounded-xl border border-surface-border bg-surface p-1 shadow-sm relative overflow-hidden`}
      >
        <svg viewBox="0 0 64 64" fill="none" className="h-full w-full">
          {/* Ondes radar d'arrière-plan */}
          <circle cx="32" cy="32" r="27" stroke={dynamicAccent ? "var(--brand)" : "#10B981"} strokeWidth="1.2" strokeOpacity="0.22" />
          <circle cx="32" cy="32" r="18" stroke={dynamicAccent ? "var(--brand)" : "#06B6D4"} strokeWidth="1.2" strokeDasharray="3 3" strokeOpacity="0.3" />
          
          {/* Monogramme W cinétique */}
          <path
            d="M14 19L23 44L32 28L41 44L50 19"
            stroke={strokeColor}
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Balise de géolocalisation / Cash actif */}
          <circle cx="32" cy="28" r="4.5" fill={dynamicAccent ? "var(--brand)" : "#10B981"} />
          <circle cx="32" cy="28" r="2.2" fill="#FFFFFF" />

          {!dynamicAccent && (
            <defs>
              <linearGradient id="wariLogoGrad" x1="14" y1="19" x2="50" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34D399" />
                <stop offset="0.55" stopColor="#10B981" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          )}
        </svg>
      </div>

      {variant === "full" && (
        <div className="min-w-0">
          <span className={`block truncate ${textSizes} font-black tracking-tight text-slate-100`}>
            Wari<span className="text-brand">Track</span>
          </span>
          {subtitle && (
            <span className={`block truncate ${subSizes} font-medium text-slate-400`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
