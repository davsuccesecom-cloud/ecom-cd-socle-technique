import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getDb } from "../firebase";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

/**
 * Écoute temps réel des notifications admin persistées côté serveur
 * (surcharge closeuse, retards, résumé périodique — voir notifyAdmins dans
 * les Cloud Functions). Contrairement au push FCM seul, ça donne un vrai
 * historique consultable dans l'app, pas seulement au moment où ça arrive.
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

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}
