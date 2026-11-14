import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getDb } from "../firebase";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  orderId?: string;
}

export interface IncomingPushDetail {
  id?: string;
  title: string;
  body: string;
  orderId?: string;
  source?: "fcm" | "firestore";
}

/**
 * Écoute temps réel des notifications persistées côté serveur.
 * Déclenche une notification visuelle in-app propre (sans sonnerie imposée)
 * et permet la suppression instantanée au clic.
 */
export function useNotifications(workspaceId: string | null, userId: string | null = null, max = 30) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    initializedRef.current = false;
    seenIdsRef.current.clear();
    const db = getDb();
    const ref = collection(db, "workspaces", workspaceId, "notifications");
    const q = userId
      ? query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"), limit(max))
      : query(ref, orderBy("createdAt", "desc"), limit(max));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);
        if (initializedRef.current) {
          const freshUnread = mapped.filter((n) => !n.read && !seenIdsRef.current.has(n.id));
          if (freshUnread.length > 0 && typeof window !== "undefined") {
            const latest = freshUnread[0];
            window.dispatchEvent(
              new CustomEvent<IncomingPushDetail>("waritrack-push-message", {
                detail: {
                  id: latest.id,
                  title: latest.title,
                  body: latest.body,
                  orderId: latest.orderId,
                  source: "firestore",
                },
              })
            );
          }
        }
        mapped.forEach((n) => seenIdsRef.current.add(n.id));
        initializedRef.current = true;
        setNotifications(mapped);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [workspaceId, userId, max]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Synchroniser le badge PWA sur l'icone d'application (arriere-plan / bureau)
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (unreadCount > 0 && typeof nav.setAppBadge === "function") {
        void nav.setAppBadge(unreadCount).catch(() => {});
      } else if (unreadCount === 0 && typeof nav.clearAppBadge === "function") {
        void nav.clearAppBadge().catch(() => {});
      }
    } catch {
      // Non supporte sur certains navigateurs
    }
  }, [unreadCount]);

  const markAsRead = async (notifId: string) => {
    if (!workspaceId) return;
    const db = getDb();
    await updateDoc(doc(db, "workspaces", workspaceId, "notifications", notifId), { read: true });
  };

  const markAllAsRead = async () => {
    await Promise.all(notifications.filter((n) => !n.read).map((n) => markAsRead(n.id)));
  };

  const dismissNotification = async (notifId: string) => {
    if (!workspaceId) return;
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    try {
      const db = getDb();
      await deleteDoc(doc(db, "workspaces", workspaceId, "notifications", notifId));
    } catch (err) {
      console.warn("dismissNotification: erreur suppression Firestore", err);
    }
  };

  const clearAllNotifications = async () => {
    if (!workspaceId) return;
    const toDelete = [...notifications];
    setNotifications([]);
    const db = getDb();
    await Promise.all(
      toDelete.map((n) => deleteDoc(doc(db, "workspaces", workspaceId, "notifications", n.id)).catch(() => {}))
    );
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
  };
}
