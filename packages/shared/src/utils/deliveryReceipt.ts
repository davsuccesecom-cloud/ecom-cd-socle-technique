import type { Order, Team } from "../types";
import { buildWhatsAppLink } from "./phone";

export function generateDeliverySlipNumber(order: { id: string; orderNumber?: string }): string {
  if (order.orderNumber) {
    return `BL-${order.orderNumber}`;
  }
  return `BL-${order.id.slice(0, 8).toUpperCase()}`;
}

export interface ReceiptOptions {
  livreurName?: string;
  livreurPhone?: string;
}

export function buildThermalReceiptHtml(
  order: Order,
  team?: Team | null,
  options?: ReceiptOptions
): string {
  const cfg = team?.printReceiptConfig;
  const paperWidth = cfg?.paperWidth || "58mm";
  const company = cfg?.companyName || team?.name || "Boutique";
  const phone = cfg?.companyPhone || "";
  const address = cfg?.companyAddress || "";
  const footer = cfg?.footerNote || "Colis vérifié et remis en main propre. Retours acceptés sous 48h avec ce bon.";
  const receiptTitle = cfg?.receiptTitle || "BON DE LIVRAISON & REÇU";
  const currency = team?.currency || team?.metaCapiConfig?.currency || "XOF";
  const slipNumber = order.deliverySlipNumber || generateDeliverySlipNumber(order);
  const livreurName = options?.livreurName || order.assignedLivreurName || (order as any).livreurName || "Livreur Assigné";

  const dateStr = order.timestamps?.delivered
    ? new Date(order.timestamps.delivered).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  const widthCss = paperWidth === "58mm" ? "54mm" : "76mm";

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${slipNumber} - ${company}</title>
        <style>
          @page { margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", monospace;
            width: ${widthCss};
            margin: 0 auto;
            padding: 8px 4px;
            color: #000;
            font-size: 11px;
            line-height: 1.35;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .title { font-size: 12px; letter-spacing: 0.5px; margin: 4px 0; }
          .company { font-size: 14px; font-weight: 800; text-transform: uppercase; }
          .line { border-top: 1px dashed #000; margin: 6px 0; }
          .double-line { border-top: 2px solid #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 2.5px 0; }
          .row span:first-child { color: #333; }
          .row span:last-child { text-align: right; }
          .total-box {
            border: 1.5px solid #000;
            padding: 6px 8px;
            margin: 6px 0;
            text-align: center;
          }
          .total-amount {
            font-size: 15px;
            font-weight: 900;
          }
          .footer-note {
            font-size: 10px;
            margin-top: 6px;
            color: #222;
            text-align: center;
          }
          .watermark {
            font-size: 8.5px;
            color: #777;
            text-align: center;
            margin-top: 6px;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="center company">${company}</div>
        ${phone ? `<div class="center bold">${phone}</div>` : ""}
        ${address ? `<div class="center">${address}</div>` : ""}
        
        <div class="line"></div>
        <div class="center bold title">${receiptTitle}</div>
        <div class="row">
          <span>N° Bon :</span>
          <span class="bold">${slipNumber}</span>
        </div>
        <div class="row">
          <span>Date :</span>
          <span>${dateStr}</span>
        </div>
        ${
          cfg?.showLivreurInfo !== false
            ? `<div class="row">
                 <span>Livreur :</span>
                 <span class="bold">${livreurName}</span>
               </div>`
            : ""
        }

        <div class="line"></div>
        <div class="row bold">
          <span>Client :</span>
          <span>${order.clientName}</span>
        </div>
        <div class="row">
          <span>Téléphone :</span>
          <span>${order.clientPhoneRaw || order.clientPhoneFormatted}</span>
        </div>
        ${
          order.city || order.shopifyData?.locationHint
            ? `<div class="row">
                 <span>Destination :</span>
                 <span>${order.city || order.shopifyData?.locationHint}</span>
               </div>`
            : ""
        }
        ${
          order.addressNote
            ? `<div class="row">
                 <span>Repère :</span>
                 <span>${order.addressNote}</span>
               </div>`
            : ""
        }

        <div class="line"></div>
        <div class="row bold">
          <span>Articles</span>
          <span>Montant</span>
        </div>
        <div class="row">
          <span>${order.product} ${order.quantity && order.quantity > 1 ? `x${order.quantity}` : ""}</span>
          <span class="bold">${order.amount.toLocaleString("fr-FR")} ${currency}</span>
        </div>

        <div class="total-box">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Total Encaissé (Espèces)</div>
          <div class="total-amount">${order.amount.toLocaleString("fr-FR")} ${currency}</div>
          <div style="font-size: 9px; color: #333;">Statut : Payé à la livraison ✓</div>
        </div>

        <div class="footer-note">${footer}</div>
        <div class="watermark">Certification WariTrack • Trace # ${order.id.slice(0, 8)}</div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 750);
          };
        </script>
      </body>
    </html>
  `;
}

export function buildWhatsAppReceiptMessage(
  order: Order,
  team?: Team | null,
  options?: ReceiptOptions
): string {
  const cfg = team?.printReceiptConfig;
  const company = cfg?.companyName || team?.name || "Notre Boutique";
  const phone = cfg?.companyPhone || "";
  const footer = cfg?.footerNote || "Colis vérifié et remis en main propre. Retours acceptés sous 48h avec ce bon.";
  const currency = team?.currency || team?.metaCapiConfig?.currency || "XOF";
  const slipNumber = order.deliverySlipNumber || generateDeliverySlipNumber(order);
  const livreurName = options?.livreurName || order.assignedLivreurName || (order as any).livreurName || "Votre livreur";

  const dateStr = order.timestamps?.delivered
    ? new Date(order.timestamps.delivered).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    `🧾 *BON DE LIVRAISON & REÇU D'ENCAISSEMENT*\n` +
    `*${company}*\n` +
    `----------------------------------------\n` +
    `📄 *N° de Bon* : *${slipNumber}*\n` +
    `📅 *Date* : ${dateStr}\n` +
    `🛵 *Remis par* : ${livreurName}\n` +
    `----------------------------------------\n` +
    `👤 *Client* : ${order.clientName}\n` +
    `📦 *Colis* : ${order.product} ${order.quantity && order.quantity > 1 ? `(x${order.quantity})` : ""}\n` +
    `💰 *TOTAL PAYÉ (CASH)* : *${order.amount.toLocaleString("fr-FR")} ${currency}*\n` +
    `✅ *Statut* : Livré & Encaissé\n` +
    `----------------------------------------\n` +
    `ℹ️ _${footer}_\n` +
    (phone ? `📞 Service Client : ${phone}\n` : "") +
    `\nMerci pour votre confiance !`
  );
}

export function openPrintDialog(
  order: Order,
  team?: Team | null,
  options?: ReceiptOptions
) {
  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) {
    alert("Veuillez autoriser les fenêtres pop-up pour imprimer le bon de livraison.");
    return;
  }
  const html = buildThermalReceiptHtml(order, team, options);
  win.document.write(html);
  win.document.close();
}

export function openWhatsAppReceipt(
  order: Order,
  team?: Team | null,
  options?: ReceiptOptions
) {
  const message = buildWhatsAppReceiptMessage(order, team, options);
  const phone = order.clientPhoneRaw || order.clientPhoneFormatted;
  const link = buildWhatsAppLink(phone, message);
  window.open(link, "_blank");
}
