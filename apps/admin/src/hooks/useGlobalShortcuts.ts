import { useEffect, useState, useCallback, useRef } from "react";

export interface ShortcutAction {
  id: string;
  keys: string[];
  label: string;
  category: "Navigation" | "Recherche & Actions" | "Système";
  handler: () => void;
}

interface UseGlobalShortcutsOptions {
  onNavigate: (page: string) => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutsModal: () => void;
  onToggleTheme?: () => void;
  onAddMarket?: () => void;
  isModalOpen?: boolean;
  onCloseModals?: () => void;
}

export function useGlobalShortcuts({
  onNavigate,
  onOpenCommandPalette,
  onOpenShortcutsModal,
  onToggleTheme,
  onAddMarket,
  isModalOpen = false,
  onCloseModals,
}: UseGlobalShortcutsOptions) {
  const [pendingSequence, setPendingSequence] = useState<string | null>(null);
  const sequenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearSequence = useCallback(() => {
    setPendingSequence(null);
    if (sequenceTimerRef.current) {
      clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Détection si l'utilisateur est en train d'écrire dans un champ de formulaire
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable);

      // Si l'utilisateur tape dans un input :
      // On autorise uniquement Escape (pour quitter le champ) et les raccourcis avec modificateur (Cmd/Ctrl + K, Cmd/Ctrl + /)
      if (isInput) {
        if (e.key === "Escape") {
          (activeEl as HTMLElement).blur();
          clearSequence();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          onOpenCommandPalette();
        } else if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.key === "?")) {
          e.preventDefault();
          onOpenShortcutsModal();
        }
        return;
      }

      // 2. Touche Escape : ferme les modales ou annule une séquence en attente
      if (e.key === "Escape") {
        if (pendingSequence) {
          e.preventDefault();
          clearSequence();
          return;
        }
        if (isModalOpen && onCloseModals) {
          e.preventDefault();
          onCloseModals();
          return;
        }
      }

      // 3. Raccourcis avec modificateurs universels (Cmd / Ctrl)
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "k") {
          e.preventDefault();
          onOpenCommandPalette();
          return;
        }
        if (e.key === "/" || e.key === "?") {
          e.preventDefault();
          onOpenShortcutsModal();
          return;
        }
        return; // Ne pas intercepter les autres Cmd+quelque-chose natifs (Cmd+C, Cmd+V, Cmd+R...)
      }

      // Ne pas intercepter Alt ou les touches composées spéciales
      if (e.altKey) return;

      const key = e.key.toLowerCase();

      // 4. Si une séquence "G" est déjà active (Linear/Superhuman navigation style)
      if (pendingSequence === "g") {
        e.preventDefault();
        clearSequence();

        switch (key) {
          case "d": // G -> D (Dashboard / Overview)
            onNavigate("overview");
            break;
          case "o": // G -> O (Orders / Commandes)
            onNavigate("orders");
            break;
          case "c": // G -> C (Caisse Livreurs)
            onNavigate("caisse");
            break;
          case "t": // G -> T (Teams / Marchés)
            onNavigate("teams");
            break;
          case "u": // G -> U (Users / Utilisateurs)
            onNavigate("users");
            break;
          case "r": // G -> R (Remuneration / Paie)
            onNavigate("remuneration");
            break;
          case "a": // G -> A (AI Assistant / Analyste)
            onNavigate("ai_assistant");
            break;
          case "p": // G -> P (Performance)
            onNavigate("performance");
            break;
          case "s": // G -> S (Settings / Paramètres)
            onNavigate("settings");
            break;
          default:
            // Touche non reconnue, séquence annulée
            break;
        }
        return;
      }

      // 5. Amorçage de la séquence "G" (Go to...)
      if (key === "g") {
        e.preventDefault();
        setPendingSequence("g");
        if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
        sequenceTimerRef.current = setTimeout(() => {
          setPendingSequence(null);
        }, 1500); // 1.5s pour presser la seconde touche
        return;
      }

      // 6. Raccourcis à touche unique (hors saisie)
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        onOpenShortcutsModal();
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (key === "t" && onToggleTheme) {
        e.preventDefault();
        onToggleTheme();
        return;
      }

      if (key === "n" && onAddMarket) {
        e.preventDefault();
        onAddMarket();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
    };
  }, [
    pendingSequence,
    clearSequence,
    onNavigate,
    onOpenCommandPalette,
    onOpenShortcutsModal,
    onToggleTheme,
    onAddMarket,
    isModalOpen,
    onCloseModals,
  ]);

  return {
    pendingSequence,
    clearSequence,
  };
}
