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

export default function NotificationBell({ workspaceId, userId }: { workspaceId: string; userId?: string }) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(workspaceId, userId ?? null);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-slate-300"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 max-h-96 w-80 overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <span className="text-sm font-medium text-slate-200">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-brand hover:underline">
                  Tout marquer lu
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Rien pour l'instant.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => !n.read && markAsRead(n.id)}
                      className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-surface"
                    >
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                      <div className={`min-w-0 flex-1 ${n.read ? "pl-4" : ""}`}>
                        <p className="text-sm text-slate-200">{n.title}</p>
                        <p className="truncate text-xs text-slate-500">{n.body}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600">{timeAgo(n.createdAt)}</p>
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
