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

    const isInputOrSelectable = (el: HTMLElement | null | undefined): boolean => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) return true;
      if (el.closest?.("input, textarea, [contenteditable='true'], .select-text, .select-all, [data-allow-copy='true']")) {
        return true;
      }
      return false;
    };

    // 3. Blocage total de la sélection de texte au curseur (selectstart)
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!isInputOrSelectable(target)) {
        e.preventDefault();
        try {
          window.getSelection()?.removeAllRanges();
        } catch {}
        return false;
      }
    };

    // 4. Surveillance continue de la sélection (selectionchange)
    const handleSelectionChange = () => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (!isInputOrSelectable(activeEl)) {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) {
          const anchor = sel.anchorNode?.parentElement;
          if (!isInputOrSelectable(anchor)) {
            sel.removeAllRanges();
          }
        }
      }
    };

    // 5. Blocage du Clic Droit (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.closest?.("[data-allow-context='true']")) {
        return;
      }
      e.preventDefault();
      showSecurityToast("🔒 Clic droit désactivé — Interface & données protégées.");
      return false;
    };

    // 6. Blocage des raccourcis clavier de vol de code, sélection et copie
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const isInput = isInputOrSelectable(target);

      // Ctrl+A / Cmd+A : Tout sélectionner
      if (isCtrlOrMeta && key === "a") {
        if (!isInput) {
          e.preventDefault();
          try {
            window.getSelection()?.removeAllRanges();
          } catch {}
          showSecurityToast("🔒 Sélection globale désactivée.");
          return false;
        }
      }

      // Ctrl+C / Cmd+C : Copier
      if (isCtrlOrMeta && key === "c") {
        if (!isInput) {
          e.preventDefault();
          try {
            window.getSelection()?.removeAllRanges();
          } catch {}
          showSecurityToast("🔒 Copie désactivée — Utilisez les boutons d'export officiels.");
          return false;
        }
      }

      // Ctrl+X / Cmd+X : Couper
      if (isCtrlOrMeta && key === "x") {
        if (!isInput) {
          e.preventDefault();
          return false;
        }
      }

      // Ctrl+S / Cmd+S : Enregistrer la page sous...
      if (isCtrlOrMeta && key === "s") {
        e.preventDefault();
        showSecurityToast("🔒 Téléchargement direct de la page désactivé pour la sécurité de vos données.");
        return false;
      }

      // Ctrl+U / Cmd+U : Afficher le code source
      if (isCtrlOrMeta && key === "u") {
        e.preventDefault();
        showSecurityToast("🔒 Affichage du code source désactivé.");
        return false;
      }

      // F12 : Outils de développement
      if (e.key === "F12") {
        e.preventDefault();
        showSecurityToast("🔒 Outils d'inspection désactivés sur le cockpit sécurisé.");
        return false;
      }

      // Ctrl+Shift+I / Cmd+Opt+I : Inspecter
      // Ctrl+Shift+J / Cmd+Opt+J : Console
      // Ctrl+Shift+C / Cmd+Opt+C : Inspect element
      if (isCtrlOrMeta && e.shiftKey && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        showSecurityToast("🔒 Inspection d'éléments restreinte sur cette plateforme.");
        return false;
      }

      // Ctrl+P / Cmd+P : Impression sauvage de la page entière
      if (isCtrlOrMeta && key === "p") {
        const isReceiptOpen = Boolean(document.querySelector(".printable-receipt"));
        if (!isReceiptOpen) {
          e.preventDefault();
          showSecurityToast("🔒 Utilisez le bouton dédié « Imprimer Bon » pour générer les reçus officiels.");
          return false;
        }
      }
    };

    // 7. Blocage du glisser-déposer sauvage des images et logos
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "IMG" || target?.tagName === "SVG" || target?.closest?.("svg, a, img")) {
        e.preventDefault();
        return false;
      }
    };

    // 8. Blocage strict de l'événement copy
    const handleCopy = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (!isInputOrSelectable(activeEl)) {
        e.preventDefault();
        if (e.clipboardData) {
          e.clipboardData.setData("text/plain", "");
        }
        try {
          window.getSelection()?.removeAllRanges();
        } catch {}
        showSecurityToast("🔒 Copie désactivée — Contenu protégé.");
        return false;
      }
    };

    // 9. Blocage de cut
    const handleCut = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (!isInputOrSelectable(activeEl)) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener("selectstart", handleSelectStart, { capture: true });
    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("dragstart", handleDragStart, { capture: true });
    document.addEventListener("copy", handleCopy, { capture: true });
    document.addEventListener("cut", handleCut, { capture: true });

    return () => {
      document.removeEventListener("selectstart", handleSelectStart, { capture: true });
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("dragstart", handleDragStart, { capture: true });
      document.removeEventListener("copy", handleCopy, { capture: true });
      document.removeEventListener("cut", handleCut, { capture: true });
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
