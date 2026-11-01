import { useState } from "react";
import { useNotifications, type AppNotification } from "@ecomcod/shared";

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
          <div className="surface-popover absolute right-0 top-11 z-50 max-h-96 w-80 overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-surface-raised/95 px-4 py-3 backdrop-blur-md">
              <span className="text-sm font-semibold text-slate-100">Notifications</span>
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
                {notifications.map((n) => (
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
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/80 active:bg-surface"
                    >
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      )}
                      <div className={`min-w-0 flex-1 ${n.read ? "pl-5" : ""}`}>
                        <p className="text-sm font-medium text-slate-100">{n.title}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{n.body}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
