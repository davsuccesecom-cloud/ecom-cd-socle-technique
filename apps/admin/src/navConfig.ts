// Source unique de vérité pour la navigation Admin — utilisée par Sidebar.tsx
// (desktop) ET MobileNav.tsx (mobile). Corrige le bug où les deux listes
// désynchronisées donnaient un accès différent selon l'orientation de
// l'écran (Sidebar à jour vs MobileNav resté figé sur une ancienne liste).

export interface NavItem {
  key: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "orders", label: "Commandes" },
  { key: "deliveries", label: "Livraisons" },
  { key: "performance", label: "Performance" },
  { key: "teams", label: "Équipes & Sheets" },
  { key: "users", label: "Utilisateurs & Accès" },
  { key: "remuneration", label: "Rémunération" },
  { key: "settings", label: "Paramètres" },
];

// Pages réellement construites — ajoute une clé ici dès qu'une nouvelle
// page est branchée dans Dashboard.tsx, et elle apparaît automatiquement
// activée à la fois sur Sidebar (desktop) et MobileNav (mobile).
export const ENABLED_KEYS = ["overview", "performance", "users", "orders", "teams", "settings"];
