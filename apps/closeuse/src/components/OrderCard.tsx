import { useState } from "react";
import {
  buildTelLink,
  buildWhatsAppLink,
  CLOSEUSE_STATUS_LABELS,
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
  onChangeStatus: (status: CloseuseStatus, reminderAt?: number | null) => void;
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

  const whatsAppMessage = `Bonjour ${order.clientName}, je suis de la boutique suite à votre commande ${
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
          aria-label="WhatsApp"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.968.54 1.775.84 2.791.84h.005c3.18 0 5.767-2.586 5.768-5.766 0-1.543-.601-2.993-1.693-4.085-1.092-1.093-2.542-1.691-4.08-1.691zm0-2.172c4.418 0 8 3.582 8 8 0 1.77-.577 3.411-1.56 4.743l1.529 5.257-5.385-1.413c-1.28.847-2.81 1.413-4.584 1.413-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8z" />
          </svg>
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
    </div>
  );
}
