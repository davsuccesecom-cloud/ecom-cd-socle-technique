import type { Team } from "../types";

/**
 * Calcule le montant dû à la closeuse et au livreur pour UNE commande
 * confirmée livrée (côté livreur — pas juste "confirmée" par la closeuse).
 * Voir architecture section 15.
 */
export function computeOrderRemuneration(team: Team): {
  closeuseAmount: number;
  livreurAmount: number;
} {
  return {
    closeuseAmount: team.remunerationCloseusePerOrder ?? 0,
    livreurAmount: team.remunerationLivreurPerOrder ?? 0,
  };
}
