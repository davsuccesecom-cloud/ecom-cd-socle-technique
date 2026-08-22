import type { AppUser } from "../types";

export interface CloseuseLoad {
  user: AppUser;
  activeOrderCount: number; // commandes en nouveau + programme + en_cours
}

/**
 * Choisit la closeuse à qui assigner une nouvelle commande : celle de
 * l'équipe avec la charge active la plus basse. Aucun plafond ne bloque
 * l'assignation — voir architecture section 8 (décision explicite de
 * l'utilisateur : pas de blocage, juste une alerte admin séparée).
 *
 * Fonction pure et testable, partagée entre la Cloud Function d'assignation
 * et un éventuel simulateur côté admin.
 */
export function pickLeastLoadedCloseuse(loads: CloseuseLoad[]): AppUser | null {
  const active = loads.filter((l) => l.user.status === "active");
  if (active.length === 0) return null;

  return active.reduce((lowest, current) =>
    current.activeOrderCount < lowest.activeOrderCount ? current : lowest
  ).user;
}

/**
 * Indique si une closeuse dépasse le seuil d'alerte de l'équipe — sert
 * uniquement à déclencher une notification admin, jamais à bloquer l'envoi
 * d'une commande (section 8).
 */
export function isOverloaded(activeOrderCount: number, threshold: number): boolean {
  return activeOrderCount >= threshold;
}
