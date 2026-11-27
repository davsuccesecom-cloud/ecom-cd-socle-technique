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
    <svg viewBox="0 0 256 292" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Corps principal vert clair signature (#95BF47) */}
      <path
        fill="#95BF47"
        d="M223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357a19614 19614 0 0 0-23.383-1.743s-15.507-15.395-17.209-17.099c-1.703-1.703-5.029-1.185-6.32-.805-.19.056-3.388 1.043-8.678 2.68-5.18-14.906-14.322-28.604-30.405-28.604-.444 0-.901.018-1.358.044C129.31 3.407 123.644.779 118.75.779c-37.465 0-55.364 46.835-60.976 70.635-14.558 4.511-24.9 7.718-26.221 8.133-8.126 2.549-8.383 2.805-9.45 10.462C21.3 95.806.038 260.235.038 260.235l165.678 31.042 89.77-19.42S223.973 58.8 223.775 57.34M156.49 40.848l-14.019 4.339c.005-.988.01-1.96.01-3.023 0-9.264-1.286-16.723-3.349-22.636 8.287 1.04 13.806 10.469 17.358 21.32M128.852 21.365c2.304 5.773 3.802 14.058 3.802 25.238 0 .572-.005 1.095-.01 1.624-9.117 2.824-19.024 5.89-28.953 8.966 5.575-21.516 16.025-31.908 25.161-35.828M117.721 10.828c1.617 0 3.246.549 4.805 1.622-12.007 5.65-24.877 19.88-30.312 48.297l-22.886 7.088C75.694 46.16 90.81 10.828 117.72 10.828z"
      />
      {/* Pli droit et ombre verte sombre (#5E8E3E) */}
      <path
        fill="#5E8E3E"
        d="M221.237 54.983a19614 19614 0 0 0-23.383-1.743s-15.507-15.395-17.209-17.099c-.637-.634-1.496-.959-2.394-1.099l-12.527 256.233 89.762-19.418S223.972 58.8 223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357"
      />
      {/* "S" emblématique blanc officiel Shopify (#FFFFFF) */}
      <path
        fill="#FFFFFF"
        d="m135.242 104.585-11.069 32.926s-9.698-5.176-21.586-5.176c-17.428 0-18.305 10.937-18.305 13.693 0 15.038 39.2 20.8 39.2 56.024 0 27.713-17.577 45.558-41.277 45.558-28.44 0-42.984-17.7-42.984-17.7l7.615-25.16s14.95 12.835 27.565 12.835c8.243 0 11.596-6.49 11.596-11.232 0-19.616-32.16-20.491-32.16-52.724 0-27.129 19.472-53.382 58.778-53.382 15.145 0 22.627 4.338 22.627 4.338"
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
