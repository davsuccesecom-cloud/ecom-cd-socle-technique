import React from "react";

interface WariTrackLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "full";
  className?: string;
  subtitle?: string;
}

export default function WariTrackLogo({
  size = "md",
  variant = "full",
  className = "",
  subtitle = "LOGISTICS PLATFORM",
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
    sm: "text-[8.5px]",
    md: "text-[9.5px]",
    lg: "text-[11px]",
    xl: "text-xs",
  }[size];

  return (
    <div className={`flex items-center gap-2.5 overflow-hidden ${className}`}>
      {/* Monogramme 'W' Multi-Couleurs Polyvalent WariTrack */}
      <div
        className={`${iconDimensions} shrink-0 flex items-center justify-center relative select-none`}
        title="WariTrack — Cash & Logistics OS"
      >
        <svg viewBox="0 0 72 72" fill="none" className="h-full w-full drop-shadow-sm">
          <defs>
            {/* Branche 1 : Violet Royal (Cockpit & Intelligence) */}
            <linearGradient id="wtWViolet" x1="16" y1="16" x2="28" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#6366F1" />
            </linearGradient>

            {/* Branche 2 : Cyan Électrique (Radar & Flotte Livreur) */}
            <linearGradient id="wtWCyan" x1="28" y1="54" x2="40" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#00D2FF" />
            </linearGradient>

            {/* Branche 3 : Or Ambré Solaire (Wari & Trésorerie Cash) */}
            <linearGradient id="wtWGold" x1="40" y1="24" x2="52" y2="54" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FDE047" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>

            {/* Branche 4 : Orange Vif (Closing WhatsApp & Ventes) */}
            <linearGradient id="wtWOrange" x1="52" y1="54" x2="64" y2="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF7A1A" />
              <stop offset="1" stopColor="#EA580C" />
            </linearGradient>
          </defs>

          {/* Les 4 segments du W multi-couleurs */}
          <g strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            {/* 1. Violet : Branche descendante gauche */}
            <path d="M16 19L27 53" stroke="url(#wtWViolet)" />

            {/* 4. Orange : Branche ascendante droite */}
            <path d="M53 53L64 19" stroke="url(#wtWOrange)" />

            {/* 3. Or : Branche descendante centre-droit */}
            <path d="M40 25L53 53" stroke="url(#wtWGold)" />

            {/* 2. Cyan : Branche ascendante centre-gauche */}
            <path d="M27 53L40 25" stroke="url(#wtWCyan)" />
          </g>

          {/* Nœud Central Apex : Balise GPS & Convergence du Cash */}
          <circle cx="40" cy="25" r="3.2" fill="#FFFFFF" />
          <circle cx="40" cy="25" r="1.6" fill="#0F172A" />

          {/* Points de terminaisons douces */}
          <circle cx="16" cy="19" r="2.4" fill="#A78BFA" />
          <circle cx="27" cy="53" r="2.4" fill="#38BDF8" />
          <circle cx="53" cy="53" r="2.4" fill="#FBBF24" />
          <circle cx="64" cy="19" r="2.4" fill="#FB923C" />
        </svg>
      </div>

      {variant === "full" && (
        <div className="min-w-0 flex flex-col justify-center">
          <span className={`block truncate ${textSizes} font-bold tracking-tight text-white leading-tight`}>
            wari<span className="font-extrabold text-white">track</span>
          </span>
          {subtitle && (
            <span className={`block truncate ${subSizes} font-semibold uppercase tracking-[0.16em] text-slate-400 mt-0.5`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
