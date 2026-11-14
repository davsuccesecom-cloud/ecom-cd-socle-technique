import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Printer,
  Share2,
} from "lucide-react";
import {
  AutoResizeTextarea,
  buildTelLink,
  buildWhatsAppLink,
  cleanClientName,
  cleanOrderNumber,
  ConfirmDialog,
  formatCurrency,
  generateDeliverySlipNumber,
  LIVREUR_STATUS_LABELS,
  openPrintDialog,
  openWhatsAppReceipt,
  type LivreurStatus,
  type LivreurUpdateExtras,
  type Order,
  type Team,
} from "@ecomcod/shared";

interface OrderCardProps {
  order: Order;
  team?: Team | null;
  livreurName?: string;
  onChangeStatus: (status: LivreurStatus, extras?: LivreurUpdateExtras) => void;
}

const STATUS_BADGE_CLASS: Record<LivreurStatus, string> = {
  recu: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400",
  en_route: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  livre: "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400",
  injoignable: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
};

const DELIVERY_FAILURE_REASONS = [
  "Client ne répond plus sur place",
  "Adresse introuvable / client absent",
  "Refus au contrôle du colis",
  "Client demande un report de livraison",
  "Budget indisponible à l'arrivée",
];

export default function OrderCard({ order, team, livreurName, onChangeStatus }: OrderCardProps) {
  const status = order.statutLivreur ?? "recu";
  const isFinal = status === "livre" || status === "injoignable";
  const currency = team?.currency || "XOF";
  const displayName = cleanClientName(order.clientName);
  const cleanNum = cleanOrderNumber(order.orderNumber);
  const orderCode = cleanNum ? `#${cleanNum}` : `#${order.id.slice(-6).toUpperCase()}`;
  const formattedAmount = formatCurrency(order.amount, currency);

  const [pendingFinalStatus, setPendingFinalStatus] = useState<LivreurStatus | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [failureNote, setFailureNote] = useState("");

  const displayLocation = (order.shopifyData?.locationHint || order.city || "").trim();
  const noteClean = (order.addressNote || "").trim();
  const distinctAddressNote =
    noteClean && noteClean.toLowerCase() !== displayLocation.toLowerCase() ? noteClean : "";
  const mapsQuery = displayLocation
    ? encodeURIComponent(`${displayLocation} ${distinctAddressNote}`.trim())
    : null;

  const whatsAppMessage = `Bonjour ${displayName}, je suis votre livreur WariTrack en route pour votre colis ${orderCode} (${
    order.quantity && order.quantity > 1 ? `${order.quantity}x ` : ""
  }${order.product} — ${formattedAmount}). Êtes-vous disponible à ${displayLocation || "votre adresse"} ?`;

  return (
    <article
      id={`order-${order.id}`}
      className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-shadow"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
          {LIVREUR_STATUS_LABELS[status]}
        </span>
        <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">
          {orderCode}
        </span>
      </div>

      {/* Client + Actions circulaires WhatsApp & Téléphone (48px tactile) */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-slate-900 dark:text-slate-100">{displayName}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {order.quantity && order.quantity > 1 ? `${order.quantity}x ` : ""}
            {order.product}
          </p>
        </div>

        {!isFinal && (
          <div className="flex items-center gap-2">
            <a
              href={buildWhatsAppLink(order.clientPhoneFormatted, whatsAppMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#25D366] shadow-xs transition-transform hover:scale-105"
              aria-label={`Contacter ${displayName} sur WhatsApp`}
            >
              <img
                src="/icons/whatsapp.png"
                alt="WhatsApp"
                className="h-full w-full scale-[1.18] rounded-full object-cover"
                draggable={false}
              />
            </a>

            <a
              href={buildTelLink(order.clientPhoneFormatted)}
              className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full bg-brand-light text-brand hover:opacity-90 transition-opacity"
              aria-label={`Appeler ${displayName}`}
            >
              <Phone className="h-5 w-5" />
            </a>
          </div>
        )}
      </div>

      {/* Localisation et repères sans doublons */}
      {(displayLocation ||
        distinctAddressNote ||
        order.clientPhoneFormatted ||
        (order.quantity && order.quantity > 1) ||
        (order.shopifyData?.noteAttributes && order.shopifyData.noteAttributes.length > 0)) && (
        <div className="mb-3 space-y-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 text-xs text-slate-600 dark:text-slate-300">
          {order.clientPhoneFormatted && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Téléphone client</span>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                {order.clientPhoneFormatted}
              </span>
            </div>
          )}

          {displayLocation && (
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{displayLocation}</span>
                {order.sourceType === "shopify" && (
                  <span className="shrink-0 rounded bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-300">
                    Shopify
                  </span>
                )}
              </p>
              {mapsQuery && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <span>Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {distinctAddressNote && (
            <p className="pl-5 text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-700 dark:text-slate-200">Repère :</span> {distinctAddressNote}
            </p>
          )}

          {order.quantity && order.quantity > 1 && (
            <p className="pl-5 text-slate-600 dark:text-slate-300">
              Quantité à remettre :{" "}
              <strong className="font-semibold text-sky-600 dark:text-sky-400 tabular-nums">{order.quantity}</strong>
            </p>
          )}

          {order.shopifyData?.noteAttributes && order.shopifyData.noteAttributes.length > 0 && (
            <div className="space-y-1 border-t border-slate-200 dark:border-slate-600 pt-2">
              {order.shopifyData.noteAttributes.map((attr, idx) => (
                <div key={idx} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">{attr.name} :</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{attr.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note closeuse / échec terrain */}
      {(order.fieldNote || order.deliveryFailureReason || order.deliveryFieldNote) && (
        <div className="mb-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          {order.deliveryFailureReason && (
            <p className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
              <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
              <span>{order.deliveryFailureReason}</span>
            </p>
          )}
          {(order.deliveryFieldNote || order.fieldNote) && (
            <p className="text-slate-500 dark:text-slate-400 italic">
              Note : « {order.deliveryFieldNote || order.fieldNote} »
            </p>
          )}
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
          {formattedAmount}
        </p>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          À encaisser en cash
        </span>
      </div>

      {status === "recu" && (
        <button
          type="button"
          onClick={() => onChangeStatus("en_route")}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:opacity-95 transition-opacity"
        >
          <Navigation className="h-4 w-4" />
          <span>Démarrer la livraison</span>
        </button>
      )}

      {status === "en_route" && (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setPendingFinalStatus("livre")}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 px-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Livré & encaissé</span>
          </button>
          <button
            type="button"
            onClick={() => setPendingFinalStatus("injoignable")}
            className="min-h-[48px] flex-1 rounded-xl border border-red-100 bg-red-50 px-3 text-sm font-medium text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
          >
            Échec / Injoignable
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pendingFinalStatus === "livre"}
        title={`Confirmer l'encaissement pour ${displayName} ?`}
        message={`Vous confirmez avoir remis le colis et encaissé ${formattedAmount} en espèces. Cette validation clôture la tournée et crédite votre commission.`}
        confirmLabel="Oui, livré et encaissé"
        danger={false}
        onConfirm={() => {
          setPendingFinalStatus(null);
          onChangeStatus("livre");
          if (team?.printReceiptConfig?.enabled && team?.printReceiptConfig?.autoPrintOnDelivery) {
            openPrintDialog(order, team, { livreurName });
          }
        }}
        onCancel={() => setPendingFinalStatus(null)}
      />

      <ConfirmDialog
        open={pendingFinalStatus === "injoignable"}
        title={`Signaler un échec pour ${displayName} ?`}
        message="La closeuse et l'admin seront alertés immédiatement."
        confirmLabel="Confirmer l'échec"
        danger
        onConfirm={() => {
          onChangeStatus("injoignable", {
            deliveryFailureReason: failureReason || "Client injoignable sur le terrain",
            deliveryFieldNote: failureNote.trim() || null,
            rejectionReason: failureReason || null,
          });
          setPendingFinalStatus(null);
          setFailureReason("");
          setFailureNote("");
        }}
        onCancel={() => {
          setPendingFinalStatus(null);
          setFailureReason("");
          setFailureNote("");
        }}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {DELIVERY_FAILURE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFailureReason(failureReason === r ? "" : r)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  failureReason === r
                    ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300"
                    : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <AutoResizeTextarea
            label="Observation terrain (optionnel — alimente l'IA logistique)"
            value={failureNote}
            onChange={setFailureNote}
            placeholder="Ex : Gardien absent à Agbalépédogan, client joignable uniquement après 18h..."
            maxLength={400}
          />
        </div>
      </ConfirmDialog>

      {status === "livre" && team?.printReceiptConfig?.enabled && (
        <div className="mt-3 space-y-2.5 border-t border-slate-100 dark:border-slate-700 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>
                Bon :{" "}
                <strong className="font-mono text-sky-600 dark:text-sky-400">
                  {order.deliverySlipNumber || generateDeliverySlipNumber(order)}
                </strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Encaissé
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openPrintDialog(order, team, { livreurName })}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimer Bon</span>
            </button>

            {team?.printReceiptConfig?.enableWhatsAppShare !== false && (
              <button
                type="button"
                onClick={() => openWhatsAppReceipt(order, team, { livreurName })}
                className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 hover:opacity-90"
              >
                <Share2 className="h-4 w-4" />
                <span>Reçu WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
