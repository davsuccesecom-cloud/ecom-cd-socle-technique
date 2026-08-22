import { useState } from "react";
import {
  buildTelLink,
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
  onChangeStatus: (status: CloseuseStatus) => void;
  onAssignLivreur: (livreurId: string) => void;
}

const STATUS_BADGE_CLASS: Record<CloseuseStatus, string> = {
  nouveau: "bg-indigo-50 text-indigo-600",
  programme: "bg-amber-50 text-amber-600",
  en_cours: "bg-sky-50 text-sky-600",
  livre: "bg-green-50 text-green-700",
  rejete: "bg-red-50 text-red-600",
  injoignable: "bg-red-50 text-red-700",
  indisponible: "bg-slate-100 text-slate-600",
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
    { label: "Rejeter", target: "rejete", style: "bg-red-50 text-red-600" },
    { label: "Injoignable", target: "injoignable", style: "bg-red-50 text-red-600" },
  ],

  programme: [
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white" },
    { label: "Rejeter", target: "rejete", style: "bg-red-50 text-red-600" },
    { label: "Injoignable", target: "injoignable", style: "bg-red-50 text-red-600" },
  ],

  en_cours: [
    { label: "Rejeter", target: "rejete", style: "bg-red-50 text-red-600" },
    { label: "Injoignable", target: "injoignable", style: "bg-red-50 text-red-600" },
  ],

  injoignable: [
    { label: "Rappeler (reprogrammer)", target: "programme", style: "bg-amber-500 text-white" },
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white" },
    { label: "Rejeter définitivement", target: "rejete", style: "bg-red-50 text-red-600" },
  ],

  indisponible: [
    { label: "Rappeler (reprogrammer)", target: "programme", style: "bg-amber-500 text-white" },
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white" },
    { label: "Rejeter définitivement", target: "rejete", style: "bg-red-50 text-red-600" },
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

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      {isCallActive && <CallBar onEndCall={onEndCall} />}

      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[order.statutCloseuse]}`}>
          {CLOSEUSE_STATUS_LABELS[order.statutCloseuse]}
        </span>

        {order.statutLivreur === "en_route" && (
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-600">
            En livraison
          </span>
        )}
        {order.statutLivreur === "livre" && (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            Livrée
          </span>
        )}
        {order.statutLivreur === "injoignable" && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
            Client injoignable (livreur)
          </span>
        )}
        {order.statutLivreur === "recu" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            En attente du livreur
          </span>
        )}
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-medium text-brand">
          {order.clientName.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{order.clientName}</p>
          <p className="truncate text-sm text-slate-500">{order.product}</p>
        </div>

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

      <p className="mb-3 text-lg font-medium">{order.amount.toLocaleString("fr-FR")} F</p>

      {/* Assignation du livreur — visible uniquement une fois la commande
         confirmée (en_cours) et tant qu'aucun livreur n'est encore choisi. */}
      {needsLivreur && (
        <div className="mb-3 flex gap-2 rounded-xl bg-slate-50 p-2.5">
          <select
            value={selectedLivreur}
            onChange={(e) => setSelectedLivreur(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
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

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.target}
              onClick={() => onChangeStatus(action.target)}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium ${action.style}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
