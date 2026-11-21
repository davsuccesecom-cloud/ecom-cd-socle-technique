import { useEffect, useState, useRef } from "react";
import { ShieldCheck, Bot, AlertTriangle } from "lucide-react";

interface AdminAntiBotGuardProps {
  onVerified: (passed: boolean) => void;
  className?: string;
}

/**
 * Bouclier Anti-Robot / Anti-Brute-Force dédié exclusivement au Cockpit Admin :
 * 1. Piège invisible Honeypot (attire et bloque les robots d'indexation et scripts automatisés).
 * 2. Vérification de latence humaine (bloque les soumissions automatiques < 1 seconde).
 * 3. Validation de motricité (mouvements curseur, frappe clavier ou touch mobile).
 * 4. STRICTEMENT NON PRÉSENT sur les applications Closeuse et Livreur pour ne pas ralentir le terrain.
 */
export default function AdminAntiBotGuard({ onVerified, className = "" }: AdminAntiBotGuardProps) {
  const [humanInteracted, setHumanInteracted] = useState(false);
  const [honeypotValue, setHoneypotValue] = useState("");
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    mountTimeRef.current = Date.now();

    const handleHumanSignal = () => {
      // Vérifier qu'au moins 600ms se sont écoulées depuis le montage
      if (Date.now() - mountTimeRef.current > 600) {
        setHumanInteracted(true);
        onVerified(true);
      }
    };

    window.addEventListener("mousemove", handleHumanSignal, { once: true, passive: true });
    window.addEventListener("touchstart", handleHumanSignal, { once: true, passive: true });
    window.addEventListener("keydown", handleHumanSignal, { once: true, passive: true });

    return () => {
      window.removeEventListener("mousemove", handleHumanSignal);
      window.removeEventListener("touchstart", handleHumanSignal);
      window.removeEventListener("keydown", handleHumanSignal);
    };
  }, [onVerified]);

  // Si le piège honeypot est rempli, c'est un bot
  const handleHoneypotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHoneypotValue(e.target.value);
    onVerified(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Piège Honeypot (invisible aux yeux des humains, détecté par les bots) */}
      <div style={{ opacity: 0, position: "absolute", top: 0, left: 0, height: 0, width: 0, zIndex: -1 }}>
        <label htmlFor="admin_security_token_field">Ne pas remplir ce champ de sécurité</label>
        <input
          id="admin_security_token_field"
          type="text"
          name="admin_bot_honeypot_trap"
          value={honeypotValue}
          onChange={handleHoneypotChange}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Badge de réassurance Anti-Robot Admin */}
      <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface px-3 py-2 text-[11px] text-slate-400 select-none">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>Protection anti-robot active</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          WariTrack Shield
        </span>
      </div>
    </div>
  );
}
