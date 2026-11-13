import { useState } from "react";
import { useNotifications } from "../hooks/useNotifications";

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
  onNotificationClick?: (orderId: string) => void;
}

function getNotificationVisual(title: string, body: string) {
  const t = `${title} ${body}`.toLowerCase();
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
  return {
    type: "order",
    src: null,
    label: "Commande",
  };
}

export default function NotificationBell({ workspaceId, userId, onNotificationClick }: NotificationBellProps) {
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
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-slate-700 dark:text-slate-200 hover:bg-surface-subtle transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-40 max-h-[460px] w-84 sm:w-96 overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border bg-surface-subtle px-4 py-3 rounded-t-2xl">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.2 text-[10px] font-bold text-red-400">
                    {unreadCount}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-brand hover:underline transition-colors"
                  >
                    Tout marquer lu
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline transition-colors"
                  >
                    Tout effacer
                  </button>
                )}
              </div>
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Rien pour l'instant.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {notifications.map((n) => {
                  const visual = getNotificationVisual(n.title, n.body);
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          dismissNotification(n.id);
                          if (n.orderId && onNotificationClick) {
                            onNotificationClick(n.orderId);
                            setOpen(false);
                          }
                        }}
                        className={`flex w-full items-start gap-3.5 px-4 py-3 text-left hover:bg-surface-subtle transition-colors ${
                          !n.read ? "bg-brand/5 dark:bg-brand/10" : ""
                        }`}
                      >
                        {/* Emblème visuel agrandi : Livreur en moto ou Sac avec appel */}
                        <div className="relative shrink-0 mt-0.5">
                          {visual.src ? (
                            <img
                              src={visual.src}
                              alt={visual.label}
                              className="h-10 w-10 rounded-xl object-cover border border-surface-border bg-surface-subtle shadow-sm"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-md">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                                <path d="M3 6h18" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                              </svg>
                            </div>
                          )}
                          {!n.read && (
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface-raised" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between gap-1">
                            <span className="truncate">{n.title}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-normal tabular-nums">
                              {timeAgo(n.createdAt)}
                            </span>
                          </p>
                          <p className="truncate text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
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
