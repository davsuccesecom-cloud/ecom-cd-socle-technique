import type * as admin from "firebase-admin";

export interface CodInsightFieldNote {
  orderId: string;
  orderNumber: string;
  city: string;
  product: string;
  outcome: string;
  reason?: string;
  note: string;
  createdAt: number;
}

type OrderData = admin.firestore.DocumentData;

function isTestOrderServer(order: OrderData): boolean {
  if (order.isTest) return true;
  const name = String(order.clientName || "").trim();
  const prod = String(order.product || "").trim();
  return /^test(\b|$)/i.test(name) || /^test(\b|$)/i.test(prod) || /\btest\s+client\b/i.test(name);
}

function getCoolingBucket(receivedAt: number, decidedAt: number): "<15m" | "15-45m" | "45m-2h" | ">2h" {
  const diffMin = Math.max(0, Math.round((decidedAt - receivedAt) / 60000));
  if (diffMin <= 15) return "<15m";
  if (diffMin <= 45) return "15-45m";
  if (diffMin <= 120) return "45m-2h";
  return ">2h";
}

function cleanCountryCode(country?: string | null): string {
  const raw = String(country || "TG").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "TG";
}

function bumpNestedBucket(
  map: Record<string, { total: number; delivered: number }>,
  key: string,
  deliveredIncrement: number
) {
  const curr = map[key] ?? { total: 0, delivered: 0 };
  map[key] = {
    total: curr.total + 1,
    delivered: curr.delivered + deliveredIncrement,
  };
}

/**
 * Agrège en temps réel les retours logistiques COD par pays dans
 * `workspaces/{workspaceId}/codInsights/{countryCode}` pour alimenter
 * l'IA décisionnelle et la formation des équipes.
 */
export async function recordCodOrderOutcome(
  db: admin.firestore.Firestore,
  params: {
    workspaceId: string;
    orderId: string;
    before: OrderData;
    after: OrderData;
  }
) {
  const { workspaceId, orderId, before, after } = params;
  if (isTestOrderServer(after)) return;

  const deliveredNow = before.statutLivreur !== "livre" && after.statutLivreur === "livre" && !before.timestamps?.delivered;
  const rejectedNow = before.statutCloseuse !== "rejete" && after.statutCloseuse === "rejete";
  const injoignableCloseuseNow = before.statutCloseuse !== "injoignable" && after.statutCloseuse === "injoignable";
  const injoignableLivreurNow = before.statutLivreur !== "injoignable" && after.statutLivreur === "injoignable";

  const newRejectionReason =
    after.rejectionReason && after.rejectionReason !== before.rejectionReason
      ? String(after.rejectionReason).trim()
      : null;
  const newDeliveryFailureReason =
    after.deliveryFailureReason && after.deliveryFailureReason !== before.deliveryFailureReason
      ? String(after.deliveryFailureReason).trim()
      : null;

  const newCloseuseNote =
    after.fieldNote && after.fieldNote !== before.fieldNote ? String(after.fieldNote).trim() : null;
  const newLivreurNote =
    after.deliveryFieldNote && after.deliveryFieldNote !== before.deliveryFieldNote
      ? String(after.deliveryFieldNote).trim()
      : null;

  const hasTerminalOutcome =
    deliveredNow || rejectedNow || injoignableCloseuseNow || injoignableLivreurNow;

  if (!hasTerminalOutcome && !newRejectionReason && !newDeliveryFailureReason && !newCloseuseNote && !newLivreurNote) {
    return;
  }

  let countryCode = cleanCountryCode(after.shopifyData?.countryCode);
  let currency = "XOF";
  if (after.teamId) {
    try {
      const teamSnap = await db.collection("workspaces").doc(workspaceId).collection("teams").doc(after.teamId).get();
      const teamData = teamSnap.data();
      if (teamData) {
        if (!after.shopifyData?.countryCode && teamData.defaultCountry) {
          countryCode = cleanCountryCode(teamData.defaultCountry);
        }
        if (teamData.currency) {
          currency = String(teamData.currency);
        }
      }
    } catch {
      // Conservation du fallback TG/XOF
    }
  }

  const insightRef = db.collection("workspaces").doc(workspaceId).collection("codInsights").doc(countryCode);
  const now = Date.now();
  const receivedAt = Number(after.timestamps?.received || now);
  const decidedAt = Number(after.timestamps?.closeuseDecidedAt || now);
  const cityKey = String(after.city || after.shopifyData?.locationHint || "Non précisée").trim() || "Non précisée";
  const hourStr = `${String(new Date(receivedAt).getUTCHours()).padStart(2, "0")}h`;
  const coolingKey = getCoolingBucket(receivedAt, decidedAt);
  const cleanOrderRef = String(after.orderNumber || orderId.slice(-6).toUpperCase()).replace(/^#+/, "");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(insightRef);
    const prev = snap.exists ? snap.data()! : {};

    const rejectionReasons: Record<string, number> = { ...(prev.rejectionReasons || {}) };
    const deliveryFailureReasons: Record<string, number> = { ...(prev.deliveryFailureReasons || {}) };
    const coolingCurve: Record<string, { total: number; delivered: number }> = { ...(prev.coolingCurve || {}) };
    const hourlyStats: Record<string, { total: number; delivered: number }> = { ...(prev.hourlyStats || {}) };
    const cityStats: Record<string, { total: number; delivered: number; rejected: number; injoignable: number }> = {
      ...(prev.cityStats || {}),
    };
    const recentFieldNotes: CodInsightFieldNote[] = Array.isArray(prev.recentFieldNotes)
      ? [...prev.recentFieldNotes]
      : [];

    let totalDecided = Number(prev.totalDecided || 0);
    let deliveredCount = Number(prev.deliveredCount || 0);
    let rejectedCount = Number(prev.rejectedCount || 0);
    let injoignableCount = Number(prev.injoignableCount || 0);

    if (hasTerminalOutcome) {
      const delInc = deliveredNow ? 1 : 0;
      const rejInc = rejectedNow ? 1 : 0;
      const injInc = injoignableCloseuseNow || injoignableLivreurNow ? 1 : 0;

      totalDecided += 1;
      deliveredCount += delInc;
      rejectedCount += rejInc;
      injoignableCount += injInc;

      bumpNestedBucket(coolingCurve, coolingKey, delInc);
      bumpNestedBucket(hourlyStats, hourStr, delInc);

      const cityCurr = cityStats[cityKey] ?? { total: 0, delivered: 0, rejected: 0, injoignable: 0 };
      cityStats[cityKey] = {
        total: cityCurr.total + 1,
        delivered: cityCurr.delivered + delInc,
        rejected: cityCurr.rejected + rejInc,
        injoignable: cityCurr.injoignable + injInc,
      };
    }

    if (newRejectionReason) {
      rejectionReasons[newRejectionReason] = (rejectionReasons[newRejectionReason] ?? 0) + 1;
    }
    if (newDeliveryFailureReason) {
      deliveryFailureReasons[newDeliveryFailureReason] = (deliveryFailureReasons[newDeliveryFailureReason] ?? 0) + 1;
    }

    const pushNote = (noteText: string, outcome: string, reason?: string) => {
      recentFieldNotes.unshift({
        orderId,
        orderNumber: `#${cleanOrderRef}`,
        city: cityKey,
        product: String(after.product || "Produit"),
        outcome,
        reason,
        note: noteText.slice(0, 400),
        createdAt: now,
      });
    };

    if (newLivreurNote) {
      pushNote(
        newLivreurNote,
        String(after.statutLivreur || after.statutCloseuse || "terrain"),
        after.deliveryFailureReason || undefined
      );
    } else if (newCloseuseNote) {
      pushNote(
        newCloseuseNote,
        String(after.statutCloseuse || "appel"),
        after.rejectionReason || after.rescheduleReason || undefined
      );
    }

    tx.set(
      insightRef,
      {
        countryCode,
        currency,
        totalDecided,
        deliveredCount,
        rejectedCount,
        injoignableCount,
        rejectionReasons,
        deliveryFailureReasons,
        coolingCurve,
        hourlyStats,
        cityStats,
        recentFieldNotes: recentFieldNotes.slice(0, 40),
        updatedAt: now,
      },
      { merge: true }
    );
  });
}
