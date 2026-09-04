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
  // Meta attend un numéro au format E.164 sans espaces, tirets ou signe +
  return phone.replace(/[^\d]/g, "");
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function sendMetaPurchaseEvent(
  config: MetaCapiConfig,
  order: MetaOrderData
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!config.enabled || !config.pixelId || !config.accessToken) {
    return { success: false, error: "Meta CAPI non activé ou identifiants manquants." };
  }

  const { firstName, lastName } = splitName(order.clientName || "");
  const phone = cleanPhoneForMeta(order.clientPhoneFormatted || order.clientPhoneRaw || "");
  const currency = (config.currency || "XOF").toUpperCase();
  const eventId = order.orderNumber || order.sourceRowId || order.id;

  const userData: Record<string, string[]> = {};
  if (phone) userData.ph = [sha256(phone)];
  if (firstName) userData.fn = [sha256(firstName)];
  if (lastName) userData.ln = [sha256(lastName)];
  if (order.city) userData.ct = [sha256(order.city)];
  if (order.country) userData.country = [sha256(order.country)];

  const eventPayload = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: "https://easysell.app",
    action_source: "physical_store",
    user_data: userData,
    custom_data: {
      currency,
      value: order.amount,
      content_name: order.product || "Produit",
      contents: [
        {
          id: order.product || "produit_cod",
          quantity: order.quantity || 1,
          item_price: order.quantity && order.quantity > 0 ? order.amount / order.quantity : order.amount,
        },
      ],
    },
  };

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
      console.error("Erreur Meta CAPI :", JSON.stringify(resJson));
      return { success: false, error: JSON.stringify(resJson) };
    }

    console.log(`Meta CAPI succès pour commande ${order.id} :`, JSON.stringify(resJson));
    return { success: true, data: resJson };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Exception Meta CAPI :", msg);
    return { success: false, error: msg };
  }
}
