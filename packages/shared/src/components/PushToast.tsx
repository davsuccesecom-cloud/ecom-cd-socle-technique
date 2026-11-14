import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import type { IncomingPushDetail } from "../hooks/useNotifications";

interface PushToastProps {
  customLogoUrl?: string | null;
  fallbackIcon?: string;
  onOpenOrder?: (orderId: string) => void;
}

interface ActiveToast extends IncomingPushDetail {
  key: string;
}

/**
 * Bannière toast temps réel pour les notifications reçues lorsque l'application est ouverte.
 * Déduplique les événements identiques (FCM onMessage vs Firestore onSnapshot).
 */
export default function PushToast({
  customLogoUrl,
  fallbackIcon = "/icons/icon-192.png",
  onOpenOrder,
}: PushToastProps) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const recentKeysRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<IncomingPushDetail>).detail;
      if (!detail?.title) return;

      const dedupKey = `${detail.orderId || ""}|${detail.title}|${detail.body}`;
      const now = Date.now();
      const prevTs = recentKeysRef.current.get(dedupKey);
      if (prevTs && now - prevTs < 8000) return;

      recentKeysRef.current.set(dedupKey, now);
      if (recentKeysRef.current.size > 30) {
        const firstKey = recentKeysRef.current.keys().next().value;
        if (firstKey) recentKeysRef.current.delete(firstKey);
      }

      setToast({ ...detail, key: `${now}` });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), 6500);
    };

    window.addEventListener("waritrack-push-message", handler);
    return () => {
      window.removeEventListener("waritrack-push-message", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  const iconSrc = customLogoUrl || fallbackIcon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-3 right-3 z-50 mx-auto max-w-md rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt="Notification"
            className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Bell className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{toast.title}</p>
          {toast.body && (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{toast.body}</p>
          )}
          {toast.orderId && onOpenOrder && (
            <button
              type="button"
              onClick={() => {
                onOpenOrder(toast.orderId!);
                setToast(null);
              }}
              className="mt-1.5 inline-flex items-center rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-95"
            >
              Ouvrir la commande
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Fermer la notification"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
