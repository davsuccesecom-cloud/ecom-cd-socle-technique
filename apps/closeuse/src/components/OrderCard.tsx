import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import {
  AutoResizeTextarea,
  buildTelLink,
  buildWhatsAppLink,
  cleanClientName,
  cleanOrderNumber,
  CLOSEUSE_STATUS_LABELS,
  ConfirmDialog,
  formatCurrency,
  type AppUser,
  type CloseuseStatus,
  type CloseuseUpdateExtras,
  type Order,
  type Team,
} from "@ecomcod/shared";
import CallBar from "./CallBar";

interface OrderCardProps {
  order: Order;
  team?: Team | null;
  livreurs: AppUser[];
  activeDeliveriesByLivreur?: Record<string, number>;
  onCall: () => void;
  onEndCall: () => void;
  onChangeStatus: (status: CloseuseStatus, extras?: CloseuseUpdateExtras) => void;
  onAssignLivreur: (livreurId: string) => void;
}

const STATUS_BADGE_CLASS: Record<CloseuseStatus, string> = {
  nouveau: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  programme: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  en_cours: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400",
  livre: "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400",
  rejete: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  injoignable: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  indisponible: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
};

const ACTIONS_BY_STATUS: Partial<
  Record<
    CloseuseStatus,
    {
      label: string;
      shortLabel?: string;
      target: CloseuseStatus;
      style: string;
    }[]
  >
> = {
  nouveau: [
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white hover:bg-green-700" },
    { label: "Programmer", target: "programme", style: "bg-amber-500 text-white hover:bg-amber-600" },
    { label: "Rejeter", target: "rejete", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
    { label: "Injoignable", target: "injoignable", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
  ],
  programme: [
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white hover:bg-green-700" },
    { label: "Rejeter", target: "rejete", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
    { label: "Injoignable", target: "injoignable", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
  ],
  en_cours: [
    { label: "Rejeter", target: "rejete", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
    { label: "Injoignable", target: "injoignable", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
  ],
  injoignable: [
    { label: "Rappeler (reprogrammer)", shortLabel: "Rappeler", target: "programme", style: "bg-amber-500 text-white hover:bg-amber-600" },
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white hover:bg-green-700" },
    { label: "Rejeter", target: "rejete", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
  ],
  indisponible: [
    { label: "Rappeler (reprogrammer)", shortLabel: "Rappeler", target: "programme", style: "bg-amber-500 text-white hover:bg-amber-600" },
    { label: "Confirmer", target: "en_cours", style: "bg-green-600 text-white hover:bg-green-700" },
    { label: "Rejeter", target: "rejete", style: "border border-red-100 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60" },
  ],
};

const REJECTION_REASONS = [
  "Client a annulé / changé d'avis",
  "Prix ou frais jugés trop élevés",
  "Numéro erroné / Faux client",
  "Doublon de commande",
  "Hors zone de livraison",
  "Autre motif (préciser)",
];

const RESCHEDULE_REASONS = [
  "Client en déplacement",
  "Attente de paie / budget",
  "Demande rappel en fin de journée",
  "Doit confirmer avec un proche",
];

function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        try {
          el.showModal();
        } catch {
          // Ignore si non supporté
        }
      }
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const isOutside = (e: React.PointerEvent<HTMLDialogElement>, el: HTMLDialogElement) => {
    const r = el.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  return {
    ref,
    dialogProps: {
      ...({ closedby: "any" } as Record<string, unknown>),
      onCancel: (e: React.SyntheticEvent<HTMLDialogElement>) => {
        e.preventDefault();
        onClose();
      },
      onPointerDown: (e: React.PointerEvent<HTMLDialogElement>) => {
        const el = ref.current;
        if (!el) return;
        if (!("closedBy" in HTMLDialogElement.prototype)) {
          pressedOutsideRef.current = isOutside(e, el);
        }
      },
      onPointerUp: (e: React.PointerEvent<HTMLDialogElement>) => {
        const el = ref.current;
        if (!el) return;
        if (!("closedBy" in HTMLDialogElement.prototype) && pressedOutsideRef.current && isOutside(e, el)) {
          pressedOutsideRef.current = false;
          onClose();
        } else {
          pressedOutsideRef.current = false;
        }
      },
    },
  };
}

export default function OrderCard({
  order,
  team,
  livreurs,
  activeDeliveriesByLivreur = {},
  onCall,
  onEndCall,
  onChangeStatus,
  onAssignLivreur,
}: OrderCardProps) {
  const currency = team?.currency || "XOF";
  const displayName = cleanClientName(order.clientName);
  const cleanNum = cleanOrderNumber(order.orderNumber);
  const orderCode = cleanNum ? `#${cleanNum}` : `#${order.id.slice(-6).toUpperCase()}`;
  const formattedAmount = formatCurrency(order.amount, currency);

  const cityClean = (order.city || "").trim();
  const noteClean = (order.addressNote || "").trim();
  const distinctAddressNote =
    noteClean && noteClean.toLowerCase() !== cityClean.toLowerCase() ? noteClean : "";

  const actions = ACTIONS_BY_STATUS[order.statutCloseuse] ?? [];
  const isCallActive = order.callInProgress?.active;

  const activeLivreurs = useMemo(
    () => livreurs.filter((l) => l.status === "active"),
    [livreurs]
  );
  const assignedLivreur = useMemo(
    () => (order.livreurId ? livreurs.find((l) => l.id === order.livreurId) : undefined),
    [livreurs, order.livreurId]
  );

  // Dialog states
  const [livreurDialogMode, setLivreurDialogMode] = useState<"confirm" | "reassign" | null>(null);
  const [modalLivreurId, setModalLivreurId] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");

  const [pendingFinalStatus, setPendingFinalStatus] = useState<"rejete" | "injoignable" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectionError, setRejectionError] = useState("");
  const [injoignableNote, setInjoignableNote] = useState("");

  const livreurDialog = useNativeDialog(livreurDialogMode !== null, () => {
    setLivreurDialogMode(null);
    setModalLivreurId("");
  });

  const scheduleDialog = useNativeDialog(showScheduleModal, () => {
    setShowScheduleModal(false);
  });

  const rejectDialog = useNativeDialog(pendingFinalStatus === "rejete", () => {
    setPendingFinalStatus(null);
    setRejectionReason("");
    setRejectionNote("");
    setRejectionError("");
  });

  const openLivreurPicker = (mode: "confirm" | "reassign") => {
    const initial =
      mode === "reassign" && order.livreurId && activeLivreurs.some((l) => l.id === order.livreurId)
        ? order.livreurId
        : activeLivreurs.length === 1
        ? activeLivreurs[0].id
        : "";
    setModalLivreurId(initial);
    setLivreurDialogMode(mode);
  };

  const commitLivreurPicker = () => {
    if (!modalLivreurId) return;
    if (livreurDialogMode === "confirm") {
      onChangeStatus("en_cours", { livreurId: modalLivreurId });
    } else if (livreurDialogMode === "reassign") {
      onAssignLivreur(modalLivreurId);
    }
    setLivreurDialogMode(null);
    setModalLivreurId("");
  };

  const commitSchedule = (reminderAt: number) => {
    onChangeStatus("programme", {
      reminderAt,
      rescheduleReason: rescheduleReason || null,
      fieldNote: scheduleNote.trim() || null,
    });
    setShowScheduleModal(false);
    setRescheduleReason("");
    setScheduleNote("");
    setCustomDateTime("");
  };

  const handleCustomSchedule = () => {
    if (!customDateTime) return;
    const timestamp = new Date(customDateTime).getTime();
    if (!Number.isNaN(timestamp)) {
      commitSchedule(timestamp);
    }
  };

  const whatsAppMessage =
    order.statutCloseuse === "injoignable"
      ? `Bonjour ${displayName}, nous avons essayé de vous joindre par téléphone concernant votre commande ${orderCode} (${order.product} — ${formattedAmount}). À quelle heure pouvons-nous vous livrer ?`
      : order.statutCloseuse === "programme"
      ? `Bonjour ${displayName}, comme convenu nous revenons vers vous pour votre livraison ${orderCode} (${order.product} — ${formattedAmount}). Êtes-vous disponible pour recevoir le livreur ?`
      : order.isDuplicatePhone
      ? `Bonjour ${displayName}, nous avons bien reçu votre commande (${order.product} — ${formattedAmount}). Votre numéro apparaissant deux fois, souhaitez-vous recevoir 1 seul ou 2 articles ?`
      : `Bonjour ${displayName}, je vous contacte pour confirmer votre commande ${orderCode} (${order.quantity && order.quantity > 1 ? `${order.quantity}x ` : ""}${order.product}) d'un montant de ${formattedAmount} payable en espèces à la livraison.`;

  const actionsGridClass =
    actions.length >= 4 ? "grid-cols-4" : actions.length === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <article
      id={`order-${order.id}`}
      className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm transition-shadow"
    >
      {isCallActive && <CallBar onEndCall={onEndCall} />}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[order.statutCloseuse]}`}>
          {CLOSEUSE_STATUS_LABELS[order.statutCloseuse]}
        </span>

        {order.statutLivreur === "en_route" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/40 px-2.5 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            <Truck className="h-3 w-3" />
            En tournée
          </span>
        )}
        {order.statutLivreur === "livre" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-950/40 px-2.5 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" />
            Livrée
          </span>
        )}
        {order.statutLivreur === "injoignable" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Échec terrain livreur
          </span>
        )}
        {order.statutLivreur === "recu" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-300">
            Assignée au livreur
          </span>
        )}
      </div>

      {order.isDuplicatePhone && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <strong>Doublon détecté ({(order.previousOrdersCount ?? 1) + 1}x) :</strong> vérifiez avec le client s'il souhaite 1 ou 2 colis.
          </p>
        </div>
      )}

      {/* Client + Actions circulaires compactes WhatsApp & Téléphone */}
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
          {displayName.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {order.quantity && order.quantity > 1 ? `${order.quantity}x ` : ""}
            {order.product}
          </p>
        </div>

        <a
          href={buildWhatsAppLink(order.clientPhoneFormatted, whatsAppMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#25D366] shadow-xs transition-transform hover:scale-105"
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
          onClick={onCall}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand hover:opacity-90 transition-opacity"
          aria-label={`Appeler ${displayName}`}
        >
          <Phone className="h-4 w-4" />
        </a>
      </div>

      {/* Bloc métadonnées compact */}
      <div className="mb-2 space-y-1 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-2.5 text-[11px] text-slate-600 dark:text-slate-300">
        <div className="flex items-center justify-between gap-2">
          <span>
            Commande <strong className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{orderCode}</strong>
          </span>
          {order.clientPhoneFormatted && (
            <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {order.clientPhoneFormatted}
            </span>
          )}
        </div>

        {(cityClean || distinctAddressNote) && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">{cityClean || distinctAddressNote}</span>
            {cityClean && distinctAddressNote && (
              <span className="truncate text-slate-500 dark:text-slate-400">— {distinctAddressNote}</span>
            )}
          </p>
        )}

        {order.reminderAt && (
          <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Rappel prévu :{" "}
              {new Date(order.reminderAt).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
        )}
      </div>

      {/* Notes / motifs terrain enregistrés */}
      {(order.rejectionReason || order.fieldNote || order.rescheduleReason || order.deliveryFailureReason || order.deliveryFieldNote) && (
        <div className="mb-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
          {(order.rejectionReason || order.rescheduleReason || order.deliveryFailureReason) && (
            <p className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              <MessageSquareText className="h-3 w-3 shrink-0 text-slate-400" />
              <span>{order.deliveryFailureReason || order.rejectionReason || order.rescheduleReason}</span>
            </p>
          )}
          {(order.fieldNote || order.deliveryFieldNote) && (
            <p className="pl-4.5 text-slate-500 dark:text-slate-400 italic">
              « {order.deliveryFieldNote || order.fieldNote} »
            </p>
          )}
        </div>
      )}

      {/* Prix net en tabular-nums */}
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
          {formattedAmount}
        </p>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Cash à la livraison
        </span>
      </div>

      {/* Bloc livreur assigné / réassignation compact */}
      {order.statutCloseuse === "en_cours" && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <Truck className={`h-3.5 w-3.5 shrink-0 ${order.livreurId ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"}`} />
            <div className="min-w-0">
              {order.livreurId ? (
                <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                  {assignedLivreur ? assignedLivreur.name : "Livreur archivé"}
                  {assignedLivreur && assignedLivreur.status !== "active" && (
                    <span className="ml-1.5 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                      (désactivé)
                    </span>
                  )}
                </p>
              ) : (
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Aucun livreur assigné
                </p>
              )}
            </div>
          </div>

          {order.statutLivreur !== "livre" && (
            <button
              type="button"
              onClick={() => openLivreurPicker("reassign")}
              className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>{order.livreurId ? "Réassigner" : "Assigner"}</span>
            </button>
          )}
        </div>
      )}

      {/* Boutons d'action alignés sur 1 seule ligne */}
      {actions.length > 0 && (
        <div className={`grid ${actionsGridClass} gap-1.5`}>
          {actions.map((action) => (
            <button
              key={action.target}
              type="button"
              title={action.label}
              onClick={() => {
                if (action.target === "en_cours") {
                  openLivreurPicker("confirm");
                } else if (action.target === "programme") {
                  setShowScheduleModal(true);
                } else if (action.target === "rejete" || action.target === "injoignable") {
                  setPendingFinalStatus(action.target);
                } else {
                  onChangeStatus(action.target);
                }
              }}
              className={`min-h-[38px] rounded-xl px-1.5 py-1.5 text-[11px] sm:text-xs font-semibold truncate transition-colors ${action.style}`}
            >
              {action.shortLabel || action.label}
            </button>
          ))}
        </div>
      )}

      {/* Dialog natif 1 : Choix obligatoire / Réassignation du livreur */}
      <dialog
        ref={livreurDialog.ref}
        {...livreurDialog.dialogProps}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-slate-900 dark:text-slate-100 shadow-2xl open:block"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">
              {livreurDialogMode === "confirm" ? "Confirmer & assigner un livreur" : "Réassigner la livraison"}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {displayName} · {cityClean || "Adresse client"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLivreurDialogMode(null)}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-0.5">
          {activeLivreurs.length === 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              Aucun livreur actif dans cette équipe. Demandez à votre responsable d'activer un livreur avant de confirmer.
            </div>
          ) : (
            activeLivreurs.map((livreur) => {
              const selected = modalLivreurId === livreur.id;
              const load = activeDeliveriesByLivreur[livreur.id] || 0;
              return (
                <button
                  key={livreur.id}
                  type="button"
                  onClick={() => setModalLivreurId(livreur.id)}
                  className={`flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-brand bg-indigo-50 text-indigo-950 dark:bg-indigo-950/60 dark:text-slate-100"
                      : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{livreur.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {load} colis en cours{livreur.phone ? ` · ${livreur.phone}` : ""}
                    </p>
                  </div>
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected ? "border-brand bg-brand text-white" : "border-slate-300 dark:border-slate-500"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={() => setLivreurDialogMode(null)}
            className="min-h-[48px] flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!modalLivreurId || activeLivreurs.length === 0}
            onClick={commitLivreurPicker}
            className="min-h-[48px] flex-1 rounded-xl bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {livreurDialogMode === "confirm" ? "Confirmer & envoyer" : "Valider le livreur"}
          </button>
        </div>
      </dialog>

      {/* Dialog natif 2 : Programmer un rappel */}
      <dialog
        ref={scheduleDialog.ref}
        {...scheduleDialog.dialogProps}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-slate-900 dark:text-slate-100 shadow-2xl open:block"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-semibold">Programmer un rappel</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowScheduleModal(false)}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-3.5">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Raison du report (optionnel)</p>
            <div className="flex flex-wrap gap-1.5">
              {RESCHEDULE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRescheduleReason(rescheduleReason === r ? "" : r)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    rescheduleReason === r
                      ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <AutoResizeTextarea
            label="Note terrain (optionnel)"
            value={scheduleNote}
            onChange={setScheduleNote}
            placeholder="Ex : Rappeler après 17h30 sur son second numéro..."
            maxLength={400}
          />

          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => commitSchedule(Date.now() + 60 * 60 * 1000)}
              className="min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Dans 1 heure
            </button>
            <button
              type="button"
              onClick={() => commitSchedule(Date.now() + 120 * 60 * 1000)}
              className="min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Dans 2 heures
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setHours(15, 0, 0, 0);
                if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
                commitSchedule(d.getTime());
              }}
              className="min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cet après-midi (15h)
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                d.setHours(10, 0, 0, 0);
                commitSchedule(d.getTime());
              }}
              className="min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Demain matin (10h)
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Date et heure précise
            </label>
            <input
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
            />
            <button
              type="button"
              disabled={!customDateTime}
              onClick={handleCustomSchedule}
              className="mt-2.5 min-h-[48px] w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirmer l'heure personnalisée
            </button>
          </div>
        </div>
      </dialog>

      {/* Dialog natif 3 : Rejet avec raison + note extensible IA */}
      <dialog
        ref={rejectDialog.ref}
        {...rejectDialog.dialogProps}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-slate-900 dark:text-slate-100 shadow-2xl open:block"
      >
        <h3 className="text-base font-semibold">Rejeter la commande de {displayName} ?</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Choisissez le motif exact pour améliorer vos analyses COD :
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {REJECTION_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRejectionReason(r);
                setRejectionError("");
              }}
              className={`min-h-[38px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                rejectionReason === r
                  ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300"
                  : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-3.5">
          <AutoResizeTextarea
            label="Précision terrain (alimente l'IA logistique)"
            value={rejectionNote}
            onChange={(val) => {
              setRejectionNote(val);
              if (val.trim()) setRejectionError("");
            }}
            placeholder="Ex : Client trouve les frais de livraison trop chers, ou préfère commander le mois prochain..."
            maxLength={500}
            error={rejectionError}
          />
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              setPendingFinalStatus(null);
              setRejectionReason("");
              setRejectionNote("");
              setRejectionError("");
            }}
            className="min-h-[48px] flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (rejectionReason === "Autre motif (préciser)" && !rejectionNote.trim()) {
                setRejectionError("Merci de préciser le motif dans le champ ci-dessus.");
                return;
              }
              onChangeStatus("rejete", {
                rejectionReason: rejectionReason || "Rejeté à l'appel",
                fieldNote: rejectionNote.trim() || null,
              });
              setPendingFinalStatus(null);
              setRejectionReason("");
              setRejectionNote("");
              setRejectionError("");
            }}
            className="min-h-[48px] flex-1 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
          >
            Confirmer le rejet
          </button>
        </div>
      </dialog>

      {/* Dialog natif 4 : Injoignable avec note d'appel extensible */}
      <ConfirmDialog
        open={pendingFinalStatus === "injoignable"}
        title={`Marquer ${displayName} injoignable ?`}
        message="La commande sera classée en injoignable tout en restant relançable."
        confirmLabel="Confirmer injoignable"
        danger={false}
        onConfirm={() => {
          onChangeStatus("injoignable", {
            fieldNote: injoignableNote.trim() || null,
          });
          setPendingFinalStatus(null);
          setInjoignableNote("");
        }}
        onCancel={() => {
          setPendingFinalStatus(null);
          setInjoignableNote("");
        }}
      >
        <AutoResizeTextarea
          label="Observation d'appel (optionnel)"
          value={injoignableNote}
          onChange={setInjoignableNote}
          placeholder="Ex : Ne décroche pas après 3 appels, numéro éteint sur Moov/Yas..."
          maxLength={400}
        />
      </ConfirmDialog>
    </article>
  );
}
