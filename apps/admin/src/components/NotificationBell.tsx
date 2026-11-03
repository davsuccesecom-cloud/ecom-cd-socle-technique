import { useState } from "react";
import { useNotifications, type AppNotification } from "@ecomcod/shared";
import { ShoppingBag, Bot } from "lucide-react";

function timeAgo(ts: number) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  return `il y a ${Math.round(diffH / 24)} j`;
}

interface NotificationBellProps {
  workspaceId: string;
  userId?: string;
  onNotificationClick?: (notif: AppNotification) => void;
}

function getNotificationVisual(title: string, body: string) {
  const t = `${title} ${body}`.toLowerCase();
  // Livreur en moto
  if (
    t.includes("livreur") ||
    t.includes("livraison") ||
    t.includes("colis") ||
    t.includes("tournée") ||
    t.includes("expédié") ||
    t.includes("assigné")
  ) {
    return {
      type: "livreur",
      src: "/icons/app-livreur-native.png",
      label: "Livreur en Moto",
    };
  }
  // Sac avec appel (Closeuse)
  if (
    t.includes("closeuse") ||
    t.includes("appel") ||
    t.includes("rappel") ||
    t.includes("confirmation") ||
    t.includes("confirmer") ||
    t.includes("whatsapp")
  ) {
    return {
      type: "closeuse",
      src: "/icons/app-closeuse-native.png",
      label: "Sac avec Appel",
    };
  }
  // Vigie IA
  if (t.includes("🤖") || t.includes("ia") || t.includes("vigie")) {
    return {
      type: "ai",
      src: null,
      label: "Vigie IA",
    };
  }
  // Sac avec le trait (Commande)
  return {
    type: "order",
    src: null,
    label: "Commande",
  };
}

export default function NotificationBell({
  workspaceId,
  userId,
  onNotificationClick,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
  } = useNotifications(workspaceId, userId ?? null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-slate-300 transition-colors hover:border-brand/40 hover:text-slate-100"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="surface-popover absolute right-0 top-11 z-50 max-h-[460px] w-84 sm:w-96 overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-surface-raised/95 px-4 py-3 backdrop-blur-md">
              <span className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent-red/20 px-2 py-0.2 text-[10px] font-bold text-accent-red">
                    {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-brand transition-colors hover:underline"
                  >
                    Tout marquer lu
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    className="text-xs font-medium text-rose-400 transition-colors hover:text-rose-300 hover:underline"
                  >
                    Tout effacer
                  </button>
                )}
              </div>
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Rien pour l'instant.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {notifications.map((n) => {
                  const visual = getNotificationVisual(n.title, n.body);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          dismissNotification(n.id);
                          if (onNotificationClick) {
                            onNotificationClick(n);
                            setOpen(false);
                          }
                        }}
                        className={`flex w-full items-start gap-3.5 px-4 py-3 text-left transition-colors hover:bg-surface/80 active:bg-surface ${
                          !n.read ? "bg-brand/5" : ""
                        }`}
                      >
                        {/* Emblème visuel agrandi : Livreur en moto, Sac avec appel, Sac avec trait */}
                        <div className="relative shrink-0 mt-0.5">
                          {visual.src ? (
                            <img
                              src={visual.src}
                              alt={visual.label}
                              className="h-10 w-10 rounded-xl object-cover border border-white/10 bg-slate-900 shadow-md"
                            />
                          ) : visual.type === "ai" ? (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400 shadow-md">
                              <Bot className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-md">
                              <ShoppingBag className="h-5 w-5" />
                            </div>
                          )}
                          {!n.read && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-brand ring-2 ring-surface-raised animate-pulse" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-100 flex items-center justify-between gap-1">
                            <span className="truncate">{n.title}</span>
                            <span className="text-[10px] text-slate-500 shrink-0 font-normal">
                              {timeAgo(n.createdAt)}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-300 leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
