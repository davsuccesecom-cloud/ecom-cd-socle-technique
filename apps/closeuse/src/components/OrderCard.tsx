import { useState } from "react";
import {
  buildTelLink,
  buildWhatsAppLink,
  CLOSEUSE_STATUS_LABELS,
  ConfirmDialog,
  type AppUser,
  type CloseuseStatus,
  type Order,
} from "@ecomcod/shared";
import CallBar from "./CallBar";

interface OrderCardProps {
  order: Order;
  livreurs: AppUser[];
  onCall: () => void;
  onEndCall: () => void;
  onChangeStatus: (status: CloseuseStatus, reminderAt?: number | null, rejectionReason?: string | null) => void;
  onAssignLivreur: (livreurId: string) => void;
}

const STATUS_BADGE_CLASS: Record<CloseuseStatus, string> = {
  nouveau: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  programme: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  en_cours: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400",
  livre: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  rejete: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  injoignable: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  indisponible: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

const ACTIONS_BY_STATUS: Partial<
  Record<
    CloseuseStatus,
    {
      label: string;
      target: CloseuseStatus;
      style: string;
    }[]
  >
> = {
  nouveau: [
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white" },
    { label: "Programmer", target: "programme", style: "bg-amber-500 text-white" },
    { label: "Rejeter", target: "rejete", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
    { label: "Injoignable", target: "injoignable", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
  ],

  programme: [
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white" },
    { label: "Rejeter", target: "rejete", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
    { label: "Injoignable", target: "injoignable", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
  ],

  en_cours: [
    { label: "Rejeter", target: "rejete", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
    { label: "Injoignable", target: "injoignable", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
  ],

  injoignable: [
    { label: "Rappeler (reprogrammer)", target: "programme", style: "bg-amber-500 text-white" },
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white" },
    { label: "Rejeter définitivement", target: "rejete", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
  ],

  indisponible: [
    { label: "Rappeler (reprogrammer)", target: "programme", style: "bg-amber-500 text-white" },
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white" },
    { label: "Rejeter définitivement", target: "rejete", style: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
  ],
};

export default function OrderCard({
  order,
  livreurs,
  onCall,
  onEndCall,
  onChangeStatus,
  onAssignLivreur,
}: OrderCardProps) {
  const actions = ACTIONS_BY_STATUS[order.statutCloseuse] ?? [];
  const isCallActive = order.callInProgress?.active;
  const needsLivreur = order.statutCloseuse === "en_cours" && !order.livreurId;
  const [selectedLivreur, setSelectedLivreur] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");
  const [pendingFinalStatus, setPendingFinalStatus] = useState<CloseuseStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const REJECTION_REASONS = [
    "Doublon / Déjà commandé",
    "Client a annulé",
    "Numéro erroné / Faux numéro",
    "Hors zone de livraison",
    "Prix / Frais refusés",
  ];

  const handleQuickSchedule = (minutesFromNow: number) => {
    const reminderTime = Date.now() + minutesFromNow * 60 * 1000;
    onChangeStatus("programme", reminderTime);
    setShowScheduleModal(false);
  };

  const handleCustomSchedule = () => {
    if (!customDateTime) return;
    const timestamp = new Date(customDateTime).getTime();
    if (!isNaN(timestamp)) {
      onChangeStatus("programme", timestamp);
      setShowScheduleModal(false);
    }
  };

  const whatsAppMessage =
    order.statutCloseuse === "injoignable"
      ? `Bonjour ${order.clientName}, nous avons essayé de vous joindre par téléphone concernant votre commande de ${order.product} (${order.amount.toLocaleString("fr-FR")} F). À quelle heure pouvons-nous vous livrer aujourd'hui ?`
      : order.statutCloseuse === "programme"
      ? `Bonjour ${order.clientName}, comme convenu nous revenons vers vous pour votre livraison de ${order.product} (${order.amount.toLocaleString("fr-FR")} F). Êtes-vous disponible pour recevoir le livreur ?`
      : order.isDuplicatePhone
      ? `Bonjour ${order.clientName}, nous avons reçu votre commande de ${order.product} (${order.amount.toLocaleString("fr-FR")} F). Comme votre numéro figure deux fois, souhaitiez-vous 1 seul produit ou 2 produits pour la livraison ?`
      : `Bonjour ${order.clientName}, je suis de la boutique suite à votre commande ${
          order.orderNumber ? `(#${order.orderNumber}) ` : ""
        }de ${order.quantity && order.quantity > 1 ? `${order.quantity}x ` : ""}${order.product} d'un montant de ${order.amount.toLocaleString(
          "fr-FR"
        )} F. Êtes-vous disponible pour confirmer la livraison ?`;

  return (
    <div id={`order-${order.id}`} className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-slate-100 dark:border-slate-700 transition-all">
      {isCallActive && <CallBar onEndCall={onEndCall} />}

      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[order.statutCloseuse]}`}>
          {CLOSEUSE_STATUS_LABELS[order.statutCloseuse]}
        </span>

        {order.statutLivreur === "en_route" && (
          <span className="rounded-full bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
            En livraison
          </span>
        )}
        {order.statutLivreur === "livre" && (
          <span className="rounded-full bg-green-50 dark:bg-green-950/40 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
            Livrée
          </span>
        )}
        {order.statutLivreur === "injoignable" && (
          <span className="rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">
            Client injoignable (livreur)
          </span>
        )}
        {order.statutLivreur === "recu" && (
          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            En attente du livreur
          </span>
        )}
      </div>

      {order.isDuplicatePhone && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <strong>⚠️ Numéro doublon ({(order.previousOrdersCount ?? 1) + 1}x) :</strong> Vérifier à l'appel si le client souhaite <strong>1 seul produit</strong> (commande en double) ou <strong>2 produits</strong>.
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-medium text-brand">
          {order.clientName.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{order.clientName}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{order.product}</p>
        </div>

        {/* Bouton WhatsApp */}
        <a
          href={buildWhatsAppLink(order.clientPhoneFormatted, whatsAppMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#25D366] shadow-xs transition-transform hover:scale-105"
          aria-label="WhatsApp"
        >
          <img
            src="/icons/whatsapp.png"
            alt="WhatsApp"
            className="h-full w-full scale-[1.18] rounded-full object-cover"
            draggable={false}
          />
        </a>

        {/* Bouton Appel téléphonique */}
        <a
          href={buildTelLink(order.clientPhoneFormatted)}
          onClick={onCall}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand"
          aria-label="Appeler"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </a>
      </div>

      {/* Détails EasySell (Ville, Note, Quantité, Commande) */}
      {(order.city || order.addressNote || (order.quantity && order.quantity > 1) || order.orderNumber || order.reminderAt) && (
        <div className="mb-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          {order.orderNumber && (
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Commande : <span className="font-mono text-brand">#{order.orderNumber}</span>
            </p>
          )}
          {order.city && (
            <p className="flex items-center gap-1.5">
              <span>📍</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">{order.city}</span>
              {order.addressNote && <span className="text-slate-500 dark:text-slate-400">— {order.addressNote}</span>}
            </p>
          )}
          {order.quantity && order.quantity > 1 && (
            <p>
              Quantité : <span className="font-semibold text-brand">{order.quantity}</span>
            </p>
          )}
          {order.reminderAt && (
            <p className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
              <span>⏰</span> Rappel prévu :{" "}
              {new Date(order.reminderAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}

      <p className="mb-3 text-lg font-medium text-slate-900 dark:text-slate-100">{order.amount.toLocaleString("fr-FR")} F</p>

      {/* Assignation du livreur */}
      {needsLivreur && (
        <div className="mb-3 flex gap-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-2.5">
          <select
            value={selectedLivreur}
            onChange={(e) => setSelectedLivreur(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none"
          >
            <option value="">Choisir un livreur…</option>
            {livreurs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedLivreur}
            onClick={() => onAssignLivreur(selectedLivreur)}
            className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Assigner
          </button>
        </div>
      )}

      {/* Boutons d'actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.target}
              onClick={() => {
                if (action.target === "programme") {
                  setShowScheduleModal(true);
                } else if (action.target === "rejete" || action.target === "injoignable") {
                  setPendingFinalStatus(action.target);
                } else {
                  onChangeStatus(action.target);
                }
              }}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${action.style}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Boîte de dialogue de programmation de rappel */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl border border-slate-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Programmer un rappel ⏰</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choisissez quand rappeler <strong>{order.clientName}</strong>. Vous recevrez une notification sonore au moment venu.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                onClick={() => handleQuickSchedule(60)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Dans 1 heure
              </button>
              <button
                onClick={() => handleQuickSchedule(120)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Dans 2 heures
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setHours(15, 0, 0, 0);
                  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
                  onChangeStatus("programme", d.getTime());
                  setShowScheduleModal(false);
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cet après-midi (15h)
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(10, 0, 0, 0);
                  onChangeStatus("programme", d.getTime());
                  setShowScheduleModal(false);
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Demain matin (10h)
              </button>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Date et heure précise</label>
              <input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-brand"
              />
              <button
                disabled={!customDateTime}
                onClick={handleCustomSchedule}
                className="mt-2 w-full rounded-xl bg-brand py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                Confirmer l'heure personnalisée
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFinalStatus === "rejete" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl border border-slate-100 dark:border-slate-700 space-y-3.5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Rejeter la commande de {order.clientName} ?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sélectionnez le motif du rejet en 1 clic pour l'historique Admin :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRejectionReason(r)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    rejectionReason === r
                      ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-400"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingFinalStatus(null);
                  setRejectionReason("");
                }}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeStatus("rejete", undefined, rejectionReason || "Rejeté à l'appel");
                  setPendingFinalStatus(null);
                  setRejectionReason("");
                }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmDialog
          open={pendingFinalStatus === "injoignable"}
          title={`Marquer ${order.clientName} comme injoignable ?`}
          message="La commande sera classée dans les clients injoignables à relancer."
          confirmLabel="Marquer injoignable"
          danger={false}
          onConfirm={() => {
            onChangeStatus("injoignable");
            setPendingFinalStatus(null);
          }}
          onCancel={() => setPendingFinalStatus(null)}
        />
      )}
    </div>
  );
}
