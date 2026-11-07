import { useEffect, useState, useCallback, type ReactNode } from "react";
import { ShieldCheck, Lock } from "lucide-react";

interface SecurityShieldProps {
  children?: ReactNode;
}

export default function SecurityShield({ children }: SecurityShieldProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showSecurityToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    // 0. Anti-Save As & Anti-Cloning Shield
    const proto = window.location.protocol;
    const host = (window.location.hostname || "").toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    const isAuthorized = isLocal || host.endsWith(".vercel.app") || host.endsWith("waritrack.com") || host.endsWith("waritrack.net");
    if (proto === "file:" || proto === "about:" || !isAuthorized) {
      document.body.innerHTML = "";
      window.location.href = "https://ecom-cd-socle-technique-admin.vercel.app";
      return;
    }

    // 1. Anti-Clickjacking (Frame Buster)
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = window.self.location.href;
      }
    } catch {
      document.body.style.display = "none";
    }

    // 2. Avertissement dissuasif dans la console du navigateur
    console.log(
      "%c⚠️ ZONE SÉCURISÉE WARITRACK ⚠️\n" +
        "%cCette application est protégée par un protocole de sécurité strict.\n" +
        "Toute tentative d'usurpation de session, d'injection de script ou de vol de données est formellement interdite.",
      "color: #EF4444; font-size: 18px; font-weight: 800; background: #0F172A; padding: 6px 12px; border-radius: 6px;",
      "color: #94A3B8; font-size: 12px; padding: 4px;"
    );

    // 3. Blocage ciblé uniquement des raccourcis de téléchargement brut de page et de code source
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+S / Cmd+S : Bloquer uniquement "Enregistrer la page sous..."
      if (isCtrlOrMeta && key === "s") {
        e.preventDefault();
        showSecurityToast("🔒 Enregistrement brut de la page désactivé pour la sécurité de vos données.");
        return false;
      }

      // Ctrl+U / Cmd+U : Bloquer l'affichage direct du code source HTML
      if (isCtrlOrMeta && key === "u") {
        e.preventDefault();
        showSecurityToast("🔒 Affichage direct du code source désactivé.");
        return false;
      }
    };

    // 4. Blocage du glisser-déposer sauvage des images et logos
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "IMG" || target?.tagName === "SVG" || target?.closest?.("svg, a, img")) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("dragstart", handleDragStart, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("dragstart", handleDragStart, { capture: true });
    };
  }, [showSecurityToast]);

  return (
    <>
      {children}

      {/* Toast d'avertissement de sécurité discret et élégant */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[9999] flex max-w-sm items-center gap-3 rounded-2xl border border-rose-500/30 bg-slate-950/95 px-4 py-3 text-xs font-semibold text-rose-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <Lock className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-rose-100 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              WariTrack Security Shield
            </p>
            <p className="mt-0.5 text-[11px] font-normal text-slate-300 leading-snug">{toastMessage}</p>
          </div>
        </div>
      )}
    </>
  );
}
