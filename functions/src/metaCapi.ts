import * as crypto from "crypto";

export interface MetaCapiConfig {
  enabled: boolean;
  pixelId: string;
  accessToken: string;
  currency?: string;
  testEventCode?: string;
}

export interface MetaOrderData {
  id: string;
  sourceRowId?: string;
  orderNumber?: string;
  clientName?: string;
  clientPhoneFormatted?: string;
  clientPhoneRaw?: string;
  city?: string;
  country?: string;
  product?: string;
  quantity?: number;
  amount: number;
  // Tracking réel enrichi (fbp, fbc, IP, UA)
  fbp?: string;
  fbc?: string;
  browserIp?: string;
  userAgent?: string;
  pageUrl?: string;
  temperature?: "hot" | "medium" | "cold";
}

function sha256(str: string): string {
  if (!str) return "";
  return crypto
    .createHash("sha256")
    .update(str.trim().toLowerCase())
    .digest("hex");
}

function cleanPhoneForMeta(phone: string): string {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function buildUserData(order: MetaOrderData): Record<string, unknown> {
  const { firstName, lastName } = splitName(order.clientName || "");
  const phone = cleanPhoneForMeta(order.clientPhoneFormatted || order.clientPhoneRaw || "");

  const userData: Record<string, unknown> = {};
  if (phone) userData.ph = [sha256(phone)];
  if (firstName) userData.fn = [sha256(firstName)];
  if (lastName) userData.ln = [sha256(lastName)];
  if (order.city) userData.ct = [sha256(order.city)];
  if (order.country) userData.country = [sha256(order.country)];

  // Identifiant externe stable
  userData.external_id = [sha256(order.orderNumber || order.id)];

  // Signaux réels du navigateur (en clair selon spécification Meta CAPI)
  if (order.fbp) userData.fbp = order.fbp;
  if (order.fbc) userData.fbc = order.fbc;
  if (order.browserIp) userData.client_ip_address = order.browserIp;
  if (order.userAgent) userData.client_user_agent = order.userAgent;

  return userData;
}

/**
 * Envoi de l'événement "Purchase" lors de la livraison réelle encaissée par le livreur
 */
export async function sendMetaPurchaseEvent(
  config: MetaCapiConfig,
  order: MetaOrderData
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!config.enabled || !config.pixelId || !config.accessToken) {
    return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
  }

  const currency = (config.currency || "XOF").toUpperCase();
  const eventId = `${order.orderNumber || order.sourceRowId || order.id}_purchase`;
  const userData = buildUserData(order);
  const actionSource = (order.fbp || order.fbc || order.browserIp) ? "website" : "physical_store";

  const eventPayload = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: order.pageUrl || "https://easysell.app",
    action_source: actionSource,
    user_data: userData,
    custom_data: {
      currency,
      value: order.amount,
      content_name: order.product || "Produit",
      lead_quality: order.temperature || "medium",
      contents: [
        {
          id: order.product || "produit_cod",
          quantity: order.quantity || 1,
          item_price: order.quantity && order.quantity > 0 ? order.amount / order.quantity : order.amount,
        },
      ],
    },
  };

  return executeMetaApiCall(config, eventPayload, `Purchase (${order.id})`);
}

/**
 * Envoi de l'événement personnalisé "CommandeConfirmee" lors de la confirmation par la closeuse
 */
export async function sendMetaConfirmedEvent(
  config: MetaCapiConfig,
  order: MetaOrderData
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!config.enabled || !config.pixelId || !config.accessToken) {
    return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
  }

  const currency = (config.currency || "XOF").toUpperCase();
  const eventId = `${order.orderNumber || order.sourceRowId || order.id}_confirmed`;
  const userData = buildUserData(order);
  const actionSource = (order.fbp || order.fbc || order.browserIp) ? "website" : "physical_store";

  const eventPayload = {
    event_name: "CommandeConfirmee",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: order.pageUrl || "https://easysell.app",
    action_source: actionSource,
    user_data: userData,
    custom_data: {
      currency,
      value: order.amount,
      content_name: order.product || "Produit",
      lead_quality: order.temperature || "hot",
    },
  };

  return executeMetaApiCall(config, eventPayload, `CommandeConfirmee (${order.id})`);
}

async function executeMetaApiCall(
  config: MetaCapiConfig,
  eventPayload: Record<string, unknown>,
  label: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const body: Record<string, unknown> = {
    data: [eventPayload],
  };

  if (config.testEventCode && config.testEventCode.trim()) {
    body.test_event_code = config.testEventCode.trim();
  }

  const url = `https://graph.facebook.com/v19.0/${config.pixelId.trim()}/events?access_token=${encodeURIComponent(config.accessToken.trim())}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const resJson = await response.json();
    if (!response.ok) {
      console.error(`Erreur Meta CAPI ${label}:`, JSON.stringify(resJson));
      return { success: false, error: JSON.stringify(resJson) };
    }

    console.log(`Meta CAPI succès pour ${label}:`, JSON.stringify(resJson));
    return { success: true, data: resJson };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Exception Meta CAPI ${label}:`, msg);
    return { success: false, error: msg };
  }
}
