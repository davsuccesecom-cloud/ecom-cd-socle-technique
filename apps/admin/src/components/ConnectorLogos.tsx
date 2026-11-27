import React from "react";

// Logo officiel Shopify avec le sac vert signature et le "S" blanc
export function ShopifyLogo({ className = "h-5 w-5", showWordmark = false }: { className?: string; showWordmark?: boolean }) {
  if (showWordmark) {
    return (
      <img
        src="/icons/shopify-logo.png"
        alt="Shopify"
        className={`${className} object-contain`}
      />
    );
  }

  return (
    <svg viewBox="0 0 109 124" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ombre et reflets du sac Shopify */}
      <path
        d="M79.294 17.514c-.37-.24-.81-.304-1.222-.178-.413.125-.74.423-.906.824l-3.328 8.077c-2.316-.764-4.81-1.185-7.464-1.185-1.929 0-3.642.274-5.267.75l-4.14-11.233c-.22-.596-.757-.999-1.387-1.042-.633-.043-1.22.28-1.516.837L40.94 48.067c-13.435 3.966-23.23 16.27-23.23 30.938 0 17.707 14.354 32.062 32.062 32.062 17.707 0 32.06-14.355 32.06-32.062 0-3.414-.54-6.697-1.53-9.76l.006-.013 1.954-13.432c.112-.773-.34-1.503-1.068-1.746l-1.9-.636z"
        fill="#95BF47"
      />
      <path
        d="M78.072 17.336c-.413.126-.74.424-.906.825l-3.328 8.076c-2.316-.763-4.81-1.184-7.464-1.184-1.929 0-3.642.274-5.267.75l-4.14-11.233c-.22-.596-.757-.999-1.387-1.042-.633-.043-1.22.28-1.516.837L40.94 48.067c-1.897.56-3.69 1.306-5.367 2.22l21.902 44.593 25.105-9.875 1.48-10.17c.112-.773-.34-1.503-1.068-1.746l-1.9-.636-2.92-14.94z"
        fill="#5E8E3E"
      />
      <path
        d="M54.024 14.502l-4.14-11.233c-.22-.596-.757-.999-1.387-1.042-.633-.043-1.22.28-1.516.837L40.94 48.067c-1.897.56-3.69 1.306-5.367 2.22l21.902 44.593 7.82-3.076-11.27-77.302z"
        fill="#3E6B27"
      />
      {/* S stylisé Shopify blanc officiel */}
      <path
        d="M57.65 85.5c-1.3 0-2.38-.34-3.23-1.03-.86-.68-1.42-1.63-1.68-2.83l4.77-1.26c.15.65.45 1.15.89 1.5.44.35 1.02.53 1.73.53 1.03 0 1.83-.3 2.4-.9.57-.6.85-1.37.85-2.3 0-.66-.18-1.22-.53-1.68-.36-.46-.96-.88-1.8-1.26l-3.35-1.5c-1.82-.82-3.13-1.78-3.92-2.88-.79-1.1-1.18-2.45-1.18-4.04 0-1.86.63-3.4 1.9-4.63 1.27-1.23 3.02-1.85 5.25-1.85 2.1 0 3.8.58 5.1 1.73 1.3 1.15 2 2.65 2.1 4.5l-4.8.8c-.1-.95-.45-1.68-1.05-2.2-.6-.52-1.38-.78-2.35-.78-.85 0-1.53.24-2.03.72-.5.48-.75 1.1-.75 1.86 0 .6.18 1.1.53 1.5.35.4.92.77 1.72 1.12l3.4 1.52c1.9.85 3.28 1.85 4.13 3 .85 1.15 1.28 2.55 1.28 4.2 0 2-.68 3.65-2.03 4.95-1.36 1.3-3.22 1.95-5.6 1.95z"
        fill="#FFFFFF"
      />
    </svg>
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
