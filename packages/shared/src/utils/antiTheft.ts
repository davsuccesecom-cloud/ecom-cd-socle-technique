import { useEffect } from "react";

export interface AntiTheftOptions {
  enableAlert?: boolean;
  alertMessage?: string;
  disableSelection?: boolean;
}

/**
 * Initialise les verrous anti-vol de contenu et anti-« Save As » sur la page :
 * 1. Annule le menu contextuel clic droit.
 * 2. Bloque les raccourcis de téléchargement (Ctrl+S / Cmd+S).
 * 3. Bloque l'affichage du code source (Ctrl+U / Cmd+U).
 * 4. Bloque l'impression / export PDF pirate (Ctrl+P / Cmd+P).
 * 5. Bloque l'ouverture directe des DevTools (F12, Ctrl+Shift+I, Cmd+Option+I).
 * 6. Interdit le glisser-déposer des images sur le bureau (dragstart).
 */
export function initContentProtection(options: AntiTheftOptions = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const {
    enableAlert = false,
    alertMessage = "Le contenu et les visuels de cette page sont protégés par le droit d'auteur.",
    disableSelection = true,
  } = options;

  let lastNoticeTime = 0;
  const showNotice = () => {
    if (!enableAlert) return;
    const now = Date.now();
    if (now - lastNoticeTime > 3000) {
      lastNoticeTime = now;
      try {
        console.warn("[WariTrack Anti-Theft] Tentative de copie ou de sauvegarde interceptée.");
      } catch {}
    }
  };

  // 1. Clic droit désactivé
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    showNotice();
    return false;
  };

  // 2. Raccourcis clavier protégés (Save As, View Source, Print, DevTools)
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    const key = e.key ? e.key.toLowerCase() : "";
    const code = e.code ? e.code.toLowerCase() : "";

    // Ctrl+S / Cmd+S : Bloque "Save As" / "Enregistrer la page sous"
    if (modKey && (key === "s" || code === "keys")) {
      e.preventDefault();
      e.stopPropagation();
      showNotice();
      return false;
    }

    // Ctrl+U / Cmd+U : Bloque l'affichage du code source
    if (modKey && (key === "u" || code === "keyu")) {
      e.preventDefault();
      e.stopPropagation();
      showNotice();
      return false;
    }

    // Ctrl+P / Cmd+P : Bloque l'impression ou la conversion PDF
    if (modKey && (key === "p" || code === "keyp")) {
      e.preventDefault();
      e.stopPropagation();
      showNotice();
      return false;
    }

    // F12 : Bloque la touche inspection standard
    if (key === "f12" || code === "f12") {
      e.preventDefault();
      e.stopPropagation();
      showNotice();
      return false;
    }

    // Ctrl+Shift+I / Cmd+Option+I : Bloque l'ouverture de l'inspecteur
    if ((modKey && e.shiftKey && (key === "i" || code === "keyi")) ||
        (isMac && e.metaKey && e.altKey && (key === "i" || code === "keyi"))) {
      e.preventDefault();
      e.stopPropagation();
      showNotice();
      return false;
    }

    // Ctrl+Shift+J / Cmd+Option+J : Bloque la console développeur
    if ((modKey && e.shiftKey && (key === "j" || code === "keyj")) ||
        (isMac && e.metaKey && e.altKey && (key === "j" || code === "keyj"))) {
      e.preventDefault();
      e.stopPropagation();
      showNotice();
      return false;
    }
  };

  // 3. Glisser-déposer des images désactivé
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "IMG" || target.tagName === "PICTURE" || target.tagName === "VIDEO")) {
      e.preventDefault();
      return false;
    }
  };

  // 4. Désactivation de la sélection si demandée
  const handleSelectStart = (e: Event) => {
    if (disableSelection) {
      const target = e.target as HTMLElement | null;
      // Laisser libre la saisie dans les champs de formulaire (nom, téléphone, adresse)
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return true;
      }
      e.preventDefault();
      return false;
    }
  };

  document.addEventListener("contextmenu", handleContextMenu, { capture: true });
  window.addEventListener("keydown", handleKeyDown, { capture: true });
  document.addEventListener("dragstart", handleDragStart, { capture: true });
  if (disableSelection) {
    document.addEventListener("selectstart", handleSelectStart, { capture: true });
  }

  // Injecter le style CSS de protection anti-copie
  let styleEl: HTMLStyleElement | null = null;
  if (disableSelection) {
    styleEl = document.createElement("style");
    styleEl.id = "waritrack-anti-theft-style";
    styleEl.innerHTML = `
      img, picture, video {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
        pointer-events: auto;
      }
      body:not(input):not(textarea):not(select) {
        -webkit-touch-callout: none;
      }
    `;
    document.head.appendChild(styleEl);
  }

  return () => {
    document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
    window.removeEventListener("keydown", handleKeyDown, { capture: true });
    document.removeEventListener("dragstart", handleDragStart, { capture: true });
    if (disableSelection) {
      document.removeEventListener("selectstart", handleSelectStart, { capture: true });
    }
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
  };
}

/**
 * Hook React pour activer la protection anti-vol sur n'importe quel composant ou page produit
 */
export function useContentProtection(enabled = true, options?: AntiTheftOptions) {
  useEffect(() => {
    if (!enabled) return;
    const cleanup = initContentProtection(options);
    return cleanup;
  }, [enabled, options]);
}
