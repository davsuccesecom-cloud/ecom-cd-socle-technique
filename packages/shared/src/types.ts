// Source unique de vérité pour les types de données.
// Toute app (admin/closeuse/livreur) importe ces types plutôt que de les redéfinir.

export type CloseuseStatus =
  | "nouveau"
  | "programme"
  | "en_cours"
  | "livre"
  | "rejete"
  | "injoignable"
  | "indisponible";

export type LivreurStatus = "recu" | "en_route" | "livre" | "injoignable";

export type UserRole = "admin" | "closeuse" | "livreur";

export interface Workspace {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: number;
}

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  sheetIds: string[]; // max 5, voir architecture section 4
  defaultCountry: string; // code ISO ex: "TG", "SN", "CI" — pour l'indicatif auto
  mergedFrom?: string[]; // équipes fusionnées dans celle-ci, historique
  maxClosseuses: number; // fixe: 10
  maxLivreurs: number; // fixe: 10
  reminderWindowStart: string; // "07:00"
  reminderWindowEnd: string; // "22:00"
  overloadAlertThreshold: number; // ex: 20 commandes actives
  digestIntervalMinutes: number; // ex: 120 (résumé périodique admin)
  remunerationCloseusePerOrder?: number;
  remunerationLivreurPerOrder?: number;
  createdAt: number;
}

export interface CallInProgress {
  active: boolean;
  by: string; // userId de la closeuse
  startedAt: number;
}

export interface Order {
  id: string;
  workspaceId: string;
  teamId: string;
  sheetId: string; // lequel des sheetIds de l'équipe est la source
  sourceRowId: string; // référence à la ligne du Sheet, pour la sync retour

  clientName: string;
  clientPhoneRaw: string; // tel que reçu du Sheet
  clientPhoneFormatted: string; // formaté via libphonenumber-js
  product: string;
  amount: number;

  closeuseId: string | null;
  livreurId: string | null;

  statutCloseuse: CloseuseStatus;
  statutLivreur: LivreurStatus | null;

  // Section 14 — sync à sens unique : ce champ n'est JAMAIS lu par l'app closeuse
  statutAdminOverride: CloseuseStatus | null;

  callInProgress: CallInProgress | null; // barre bleue "appel en cours"

  timestamps: {
    received: number;
    assignedToCloseuse: number | null;
    assignedToLivreur: number | null;
    // Posés automatiquement côté serveur (onOrderUpdated) au premier
    // changement de statut — mesurent la RÉACTIVITÉ réelle de chacun,
    // pas juste l'assignation. Base du module "Performance employés".
    closeuseDecidedAt: number | null; // 1re fois que statutCloseuse quitte "nouveau"
    livreurRespondedAt: number | null; // 1re fois que statutLivreur quitte "recu"
    delivered: number | null;
  };

  capiSent: boolean;
  purgeAt: number | null; // calculé = statut final + 3 jours
}

export interface AppUser {
  id: string;
  workspaceId: string;
  teamId: string;
  role: UserRole;
  name: string;
  phone: string;
  fcmTokens: string[];
  accessLinkId: string;
  status: "active" | "disabled";
  reminderWindowStart?: string; // personnalisation closeuse, bornée par l'équipe
  reminderWindowEnd?: string;
}

export interface AccessLink {
  id: string;
  workspaceId: string;
  userId: string;
  passwordHash: string; // jamais le mot de passe en clair
  createdAt: number;
  disabledAt: number | null;
  activeSessions: SessionInfo[]; // max 2, section 10.1
}

export interface SessionInfo {
  sessionToken: string;
  deviceLabel: string; // navigateur/appareil, best-effort
  connectedAt: number;
}

export interface RemunerationTotal {
  userId: string;
  workspaceId: string;
  role: "closeuse" | "livreur";
  totalOrders: number;
  totalAmount: number;
  updatedAt: number;
  // jamais purgé, contrairement aux commandes (section 15)
}
