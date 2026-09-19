import { useEffect, useMemo, useState } from "react";
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

/**
 * Écoute temps réel des notifications persistées côté serveur.
 * Permet la suppression instantanée au clic pour faire disparaître
 * immédiatement la notification de la liste.
 */
export function useNotifications(workspaceId: string | null, userId: string | null = null, max = 30) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const db = getDb();
    const ref = collection(db, "workspaces", workspaceId, "notifications");
    const q = userId
      ? query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"), limit(max))
      : query(ref, orderBy("createdAt", "desc"), limit(max));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [workspaceId, userId, max]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAsRead = async (notifId: string) => {
    if (!workspaceId) return;
    const db = getDb();
    await updateDoc(doc(db, "workspaces", workspaceId, "notifications", notifId), { read: true });
  };

  const markAllAsRead = async () => {
    await Promise.all(notifications.filter((n) => !n.read).map((n) => markAsRead(n.id)));
  };

  // Fait disparaître la notification instantanément (optimiste) et la supprime en base
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

  // Supprime toutes les notifications d'un coup
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
