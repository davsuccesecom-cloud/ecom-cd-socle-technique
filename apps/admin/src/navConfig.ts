// Source unique de vérité pour la navigation Admin — utilisée par Sidebar.tsx
// (desktop) ET MobileNav.tsx (mobile). Corrige le bug où les deux listes
// désynchronisées donnaient un accès différent selon l'orientation de
// l'écran (Sidebar à jour vs MobileNav resté figé sur une ancienne liste).

export interface NavItem {
  key: string;
  label: string;
  /** Libellé compact pour la barre de nav mobile — évite le texte tassé
   * quand le nom complet est trop long ("Équipes & Sheets" → "Équipes"). */
  shortLabel?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Vue d'ensemble", shortLabel: "Accueil" },
  { key: "orders", label: "Commandes" },
  { key: "ai_assistant", label: "Analyste IA & Bilans", shortLabel: "IA Business" },
  { key: "performance", label: "Performance" },
  { key: "teams", label: "Équipes & Sheets", shortLabel: "Équipes" },
  { key: "users", label: "Utilisateurs & Accès", shortLabel: "Accès" },
  { key: "remuneration", label: "Rémunération" },
  { key: "settings", label: "Paramètres" },
];

// Pages réellement construites
export const ENABLED_KEYS = ["overview", "orders", "ai_assistant", "performance", "teams", "users", "remuneration", "settings"];
