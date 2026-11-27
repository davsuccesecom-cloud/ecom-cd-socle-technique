import React from "react";

// Logo officiel Shopify avec le sac vert signature et le "S" blanc officiel (non déformé, ratio exact)
export function ShopifyLogo({ className = "h-5 w-5", showWordmark = false }: { className?: string; showWordmark?: boolean }) {
  return (
    <img
      src={showWordmark ? "/icons/shopify-full.png" : "/icons/shopify-bag.png"}
      alt="Shopify"
      className={`${className} object-contain shrink-0 select-none`}
      loading="eager"
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/icons/shopify-logo.png";
      }}
    />
  );
}

// Logo officiel Azify / Azyshop (Symbole officiel officiel haute résolution)
export function AzifyLogo({ className = "h-5 w-5", showWordmark = false }: { className?: string; showWordmark?: boolean }) {
  return (
    <img
      src="/icons/azify-symbol-transparent.png"
      alt="Azify Studio"
      className={`${className} object-contain`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/icons/azify-logo.png";
      }}
    />
  );
}

// Logo officiel Meta Conversions API (Boucle infinie Meta officielle)
export function MetaLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.07 6.5C3.82 6.5 2 8.4 2 10.75c0 3.03 2.5 5.56 5.8 7.07 1.1.51 2.3.83 3.5.95-.5-1.07-.8-2.26-.8-3.52 0-.8.12-1.57.34-2.3-1.63-.5-2.92-1.42-3.6-2.52-.45-.73-.55-1.54-.28-2.28.27-.74.88-1.29 1.67-1.51.79-.22 1.63-.07 2.3.4.67.47 1.13 1.2 1.27 2.02.32 1.83 1.7 4.7 4.2 7.08 1.4.38 2.87.56 4.3.56 3.6 0 6.6-1.87 7.7-4.78.3-.8.3-1.67 0-2.47-.3-.8-1-1.47-1.9-1.83-.9-.37-1.9-.37-2.8 0-.9.37-1.6 1.04-2 1.9-.9 2.06-2.5 4.7-4.6 6.84-.7-.14-1.4-.38-2.1-.7-2.6-1.2-4.5-3.1-4.5-5.2 0-1.4 1-2.5 2.2-2.5 1 0 1.9.7 2.2 1.7.3 1.1 1.2 2 2.3 2.2 1.1.2 2.2-.4 2.6-1.4.5-1.1.2-2.4-.6-3.3-1.3-1.3-3.2-2.1-5.2-2.1z"
        fill="#0081FB"
      />
    </svg>
  );
}

// Logo officiel Google Sheets
export function GoogleSheetsLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <img
      src="/icons/google-sheets.png"
      alt="Google Sheets"
      className={`${className} object-contain`}
    />
  );
}
