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

export interface MetaCapiConfig {
  enabled: boolean;
  pixelId: string;
  accessToken: string;
  currency?: string;
  testEventCode?: string;
  adAccountId?: string;
  adAccountName?: string;
  pixelName?: string;
  businessId?: string;
  businessName?: string;
  systemUserId?: string;
  connectedAt?: number;
  isSystemUser?: boolean;
  tokenExpiresAt?: number;
  connectedUserName?: string;
}

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  sheetIds: string[]; // max 5, voir architecture section 4
  defaultCountry: string; // code ISO ex: "TG", "SN", "CI" — pour l'indicatif auto
  currency: string; // ex: "XOF", "GNF", "MAD" — devise locale de l'équipe
  mergedFrom?: string[]; // équipes fusionnées dans celle-ci, historique
  maxClosseuses: number; // fixe: 10
  maxLivreurs: number; // fixe: 10
  reminderWindowStart: string; // "07:00"
  reminderWindowEnd: string; // "22:00"
  overloadAlertThreshold: number; // ex: 20 commandes actives
  digestIntervalMinutes: number; // ex: 120 (résumé périodique admin)
  remunerationCloseusePerOrder?: number;
  remunerationLivreurPerOrder?: number;
  metaCapiConfig?: MetaCapiConfig;
  printReceiptConfig?: {
    enabled: boolean;
    autoPrintOnDelivery: boolean;
    companyName: string;
    companyPhone: string;
    companyAddress: string;
    footerNote: string;
    paperWidth: "58mm" | "80mm";
    receiptTitle?: string;
    enableWhatsAppShare?: boolean;
    showLivreurInfo?: boolean;
  };
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
  teamName?: string; // Nom de l'équipe/boutique d'origine pour affichage clair en multi-équipes
  sheetId: string; // lequel des sheetIds de l'équipe est la source
  sourceRowId: string; // référence à la ligne du Sheet, pour la sync retour

  clientName: string;
  clientPhoneRaw: string; // tel que reçu du Sheet
  clientPhoneFormatted: string; // formaté via libphonenumber-js
  city?: string;
  address?: string; // Rue, quartier, commune
  addressNote?: string;
  notes?: string; // Remarques & instructions de livraison client
  product: string;
  productImageUrl?: string;
  quantity?: number;
  amount: number;
  originalAmount?: number; // Montant initial avant code promo / réduction
  promoCode?: string; // Code promo / réduction appliqué (ex: PROMO10, RAMADAN)
  discountAmount?: number; // Valeur nette de la remise déduite du montant
  discountPercent?: number | null; // Pourcentage éventuel de la réduction
  orderNumber?: string;
  deliverySlipNumber?: string;
  items?: Array<{ product: string; quantity: number; price?: number }>; // Liste détaillée des articles / packs

  // Localisation Map & GPS Réelle (Azify / Google Maps)
  mapUrl?: string; // URL directe Google Maps ou lien pin
  googleMapsUrl?: string; // Alias pour compatibilité
  gpsCoordinates?: string; // Coordonnées formatées "lat,lng"
  latitude?: number;
  longitude?: number;
  mapAddress?: string; // Adresse textuelle précise issue de la carte;

  closeuseId: string | null;
  livreurId: string | null;
  assignedLivreurName?: string;

  statutCloseuse: CloseuseStatus;
  statutLivreur: LivreurStatus | null;

  // Section 14 — sync à sens unique : ce champ n'est JAMAIS lu par l'app closeuse
  statutAdminOverride: CloseuseStatus | null;

  callInProgress: CallInProgress | null; // barre bleue "appel en cours"
  reminderAt?: number | null; // date/heure de rappel quand statutCloseuse === 'programme'

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
  capiConfirmedSent?: boolean;
  capiIsolated?: boolean; // true si isolé du tracking Meta (ex: numéro doublon / accès libre site)
  trafficSource?: "meta_ads" | "tiktok_ads" | "google_ads" | "organique" | "acces_libre_site"; // qualification d'attribution multi-canaux
  isDuplicatePhone?: boolean; // true si ce numéro a déjà commandé
  previousOrdersCount?: number;
  previousRejectionsCount?: number;
  rejectionReason?: string | null; // motif rapide choisi lors d'un rejet / injoignable
  fieldNote?: string | null; // note terrain libre (closeuse : rejet, injoignable, rappel)
  rescheduleReason?: string | null; // raison de programmation/relance (closeuse)
  deliveryFailureReason?: string | null; // motif structuré échec terrain (livreur)
  deliveryFieldNote?: string | null; // note terrain libre (livreur : pas de porte, refus, cash manquant...)
  isTest?: boolean; // commande de test isolée des bilans & IA
  purgeAt: number | null; // calculé = statut final + 3 jours

  // Intégration Shopify & Tracking Réel
  sourceType?: "sheet" | "shopify";
  shopifyOrderId?: string;
  sessionId?: string;
  temperature?: "hot" | "medium" | "cold";
  shopifyData?: ShopifyOrderData;

  // Routage par langue & dialecte local (Skill-Based Routing)
  clientLanguage?: string; // ex: "Mina / Ewé", "Kabyè", "Dioula", "Baoulé", "Wolof"
  languagePriorityNotified?: boolean; // true si alerte supervision déclenchée si aucun agent disponible
}

export interface ShopifyNoteAttribute {
  name: string;
  value: string;
}

export interface ShopifyOrderData {
  shopifyOrderId: string;
  orderNumber?: string;
  shopDomain: string;
  countryCode?: string;
  city?: string;
  province?: string;
  zip?: string;
  locationHint?: string;
  browserIp?: string;
  noteAttributes: ShopifyNoteAttribute[];
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  ttclid?: string;
  ttp?: string;
  gclid?: string;
  referrer?: string;
  landingSite?: string;
  referringSite?: string;
  attributionDetail?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  rawCustomerNotes?: string;
}

export interface ShopifyCountryRoute {
  countryCode: string; // ISO 2 lettres : "TG", "BJ", "CI", "SN"
  assignedTeamId: string;
  assignedTeamName?: string;
  assignedAt: number;
  assignedBy?: string;
  status: "active" | "revoked";
}

export interface ShopifyConnection {
  id: string; // connectionId
  workspaceId: string;
  ownerTeamId: string; // L'équipe administratrice/propriétaire du flux
  ownerTeamName: string;
  shopDomain: string; // ex: "montreshop.myshopify.com" ou "maboutique.com"
  myshopifyDomain?: string; // Domaine technique permanent (ex: "montreshop.myshopify.com")
  customDomain?: string; // Domaine personnalisé (ex: "maboutique.com")
  domains?: string[]; // Tous les alias de domaines connus pour cette boutique
  shopName?: string;
  logoUrl?: string; // Logo de la boutique pour affichage et confirmation
  status: "active" | "pending" | "pending_approval" | "rejected" | "revoked" | "disconnected";
  connectedAt: number;
  activatedAt?: number;
  requestedAt?: number;
  requestedTeamId?: string;
  requestedTeamName?: string;
  accessToken?: string;
  countryRoutes: Record<string, ShopifyCountryRoute>; // "TG" -> route
  verifyToken?: string;
  trackerVerifiedAt?: number;
  webhookVerifiedAt?: number;
  lastOrderAt?: number;
  ordersCount?: number;
  sourcePlatform?: "azify" | "shopify" | "custom";
  azifyStoreId?: string;
  azifyStoreSlug?: string;
  azifyAccountEmail?: string;
  azifyDefaultCurrency?: string;
  callbackUrl?: string;
}

export interface ShopifyUnroutedOrder {
  id: string;
  workspaceId: string;
  connectionId: string;
  shopDomain: string;
  shopifyOrderId: string;
  orderNumber?: string;
  clientName?: string;
  clientPhone?: string;
  amount: number;
  currency: string;
  countryCode: string;
  createdAt: number;
}

export interface TrackingSession {
  id: string;
  workspaceId: string;
  teamId?: string;
  shopDomain: string;
  phoneNormalized: string;
  phoneHash: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  pageUrl?: string;
  ip?: string;
  userAgent?: string;
  createdAt: number;
  linkedOrderId?: string;
}

export interface MetaEventLog {
  id: string;
  workspaceId: string;
  orderId: string;
  eventName: "CommandeConfirmee" | "Purchase";
  status: "sent" | "failed" | "retrying";
  response?: string;
  attempts: number;
  sentAt: number;
  eventId: string;
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
  languages?: string[]; // Langues et dialectes locaux parlés par l'employé
  allocatedTeamIds?: string[]; // IDs des équipes emprunteuses (strictement du même pays defaultCountry)
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

export interface CashSettlementEntry {
  id: string;
  workspaceId: string;
  teamId: string;
  livreurId: string;
  livreurName: string;
  type: "remittance" | "deduction";
  /**
   * "caisse" = frais terrain justifié (ex: aller-retour carburant) retranché du cash que le livreur doit reverser
   * "remuneration" = retenue retranchée sur la commission/paie du livreur
   */
  impact: "caisse" | "remuneration";
  amount: number;
  note: string;
  dateKey: string; // YYYY-MM-DD
  createdAt: number;
}

export interface CodCountryInsightNote {
  orderId: string;
  role: "closeuse" | "livreur";
  status: string;
  reason: string;
  note: string;
  city?: string;
  trafficSource?: string;
  product?: string;
  createdAt: number;
}

export interface CodCountryInsight {
  countryCode: string; // Code ISO ex: "TG", "CI", "SN"
  updatedAt: number;
  totalProcessed: number;
  deliveredCount: number;
  rejectedCount: number;
  unreachableCount: number;
  rejectionReasons: Record<string, number>;
  deliveryFailureReasons: Record<string, number>;
  recentFieldNotes: CodCountryInsightNote[];
  hourlyDeliverySuccess: Record<string, { delivered: number; failed: number }>;
  coolingBuckets: {
    under6h: { delivered: number; total: number };
    h6to24: { delivered: number; total: number };
    h24to48: { delivered: number; total: number };
    over48h: { delivered: number; total: number };
  };
}

// ---------------------------------------------------------------------------
// Référentiel des langues & dialectes locaux africains (Skill-Based Routing)
// ---------------------------------------------------------------------------

export const AFRICAN_LOCAL_LANGUAGES = [
  "Français",
  "Mina / Ewé",
  "Kabyè",
  "Kotokoli / Tem",
  "Haoussa",
  "Dioula",
  "Baoulé",
  "Bété",
  "Fon",
  "Yoruba",
  "Wolof",
  "Bambara",
  "Lingala",
  "Moré",
  "Anglais",
] as const;

export type AfricanLanguage = (typeof AFRICAN_LOCAL_LANGUAGES)[number];

// ---------------------------------------------------------------------------
// Gestion de Stock & Surveillance Anti-Fraude Terrain
// ---------------------------------------------------------------------------

export interface ProductStock {
  id: string;
  workspaceId: string;
  teamId: string;
  productName: string;
  sku?: string;
  initialStock?: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  totalSold: number;
  totalDelivered: number;
  totalReturned: number;
  // Unit Economics & Comptabilité COD
  cogsUnitPrice?: number; // Prix d'achat unitaire usine (ex: 3 500 XOF)
  transitTotalCost?: number; // Coût global transitaire / fret / douane
  transitQuantity?: number; // Quantité totale importée dans le lot
  transitUnitCost?: number; // Coût de fret unitaire calculé
  reinvestRatio?: number; // Pourcentage conseillé à réinjecter (défaut: 0.65)
  sellingPriceAvg?: number; // Prix de vente unitaire moyen
  imageUrl?: string;
  azifySyncedAt?: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Marketplace Push Marketing & Paniers Abandonnés (Azify / EasySell)
// ---------------------------------------------------------------------------

export interface MarketplaceCart {
  product: string;
  amount: number;
  quantity: number;
  productImageUrl?: string;
  checkoutUrl?: string;
  updatedAt: number;
  status: "active" | "abandoned" | "converted";
}

export interface MarketplaceSubscriber {
  id: string;
  token: string;
  workspaceId: string;
  shopDomain?: string;
  azifyStoreId?: string;
  teamId?: string;
  country?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  cart?: MarketplaceCart;
  cartRecoverySent?: boolean;
  cartRecoverySentAt?: number;
  tags?: string[];
  createdAt: number;
  lastSeenAt: number;
  userAgent?: string;
  deviceType?: "mobile" | "desktop" | "tablet";
}

export interface MarketplaceCampaign {
  id: string;
  workspaceId: string;
  title: string;
  body: string;
  clickUrl?: string;
  imageUrl?: string;
  targetCountry?: string;
  targetStoreId?: string;
  targetAudience: "all" | "abandoned_carts" | "vip";
  sentCount: number;
  successCount: number;
  failureCount: number;
  createdAt: number;
  createdByName?: string;
}

// ---------------------------------------------------------------------------
// Sécurité Passkeys FIDO2 / WebAuthn & CinetPay Ready
// ---------------------------------------------------------------------------

export interface PasskeyCredential {
  id: string;
  workspaceId: string;
  userId: string;
  label: string;
  createdAt: number;
  lastUsedAt?: number;
}
