interface WhatsAppIconProps {
  size?: number;
  className?: string;
}

/**
 * Icône officielle WhatsApp parfaitement arrondie (sans bord blanc autour du cercle vert).
 */
export default function WhatsAppIcon({ size = 18, className = "" }: WhatsAppIconProps) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#25D366] shadow-xs ${className}`}
    >
      <img
        src="/icons/whatsapp.png"
        alt="WhatsApp"
        className="h-full w-full scale-[1.18] rounded-full object-cover"
        draggable={false}
      />
    </span>
  );
}
