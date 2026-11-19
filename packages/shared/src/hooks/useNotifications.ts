import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getDb } from "../firebase";
import { triggerSystemNotification } from "../utils/systemNotification";

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
  source?: "fcm" | "firestore" | "tracker";
}

const DISPATCHED_STORAGE_KEY_PREFIX = "waritrack_os_dispatched_";

function getDispatchedSet(storageKey: string): Set<string> {
  if (typeof window === "undefined" || !storageKey) return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDispatchedSet(storageKey: string, set: Set<string>) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    const arr = Array.from(set).slice(-250);
    localStorage.setItem(storageKey, JSON.stringify(arr));
  } catch {}
}

function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("/notification-ping.mp3");
    audio.volume = 0.95;
    void audio.play().catch(() => {});
  } catch {}
}

/**
 * Écoute temps réel des notifications persistées côté serveur avec Trackeur "Méthode WhatsApp" :
 * - Synchronisation automatique au retour d'une connexion internet (mode offline rattrapé).
 * - Détection et injection des alertes non lues / commandes livrées / actions non faites dans la barre OS (Windows 11 / Android).
 * - Évite tout doublon grâce à un registre persistant (localStorage).
 */
export function useNotifications(workspaceId: string | null, userId: string | null = null, max = 30) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const notificationsRef = useRef<AppNotification[]>([]);
  notificationsRef.current = notifications;

  const storageKey = workspaceId
    ? `${DISPATCHED_STORAGE_KEY_PREFIX}${workspaceId}_${userId || "admin"}`
    : "";

  /**
   * Injecte les notifications manquées ou nouvelles dans le système d'exploitation natif
   * (Barre de notifications, Action Center Windows 11, sonnerie).
   */
  const dispatchToSystem = useCallback(
    (notifs: AppNotification[], isCatchUp: boolean = false) => {
      if (typeof window === "undefined" || !storageKey) return;
      const dispatched = getDispatchedSet(storageKey);

      // Filtrer les notifications non lues non encore affichées sur cette machine
      const unreadMissed = notifs.filter((n) => !n.read && !dispatched.has(n.id));
      if (unreadMissed.length === 0) return;

      console.log(
        `[WariTrack WhatsApp Sync] ${unreadMissed.length} notification(s) ${
          isCatchUp ? "manquée(s)" : "récente(s)"
        } détectée(s). Injection dans le Centre de notifications Windows...`
      );

      // Limiter à 5 notifications récentes (triées chronologiquement) pour une expérience fluide
      const toDispatch = unreadMissed.slice(0, 5).reverse();

      toDispatch.forEach((n, idx) => {
        setTimeout(async () => {
          // 1. Déclenchement de la VRAIE notification OS native (Bannière Windows 11 + Action Center)
          await triggerSystemNotification({
            title: n.title,
            body: n.body,
            orderId: n.orderId,
            url: n.orderId ? `/?orderId=${n.orderId}` : "/",
            tag: `waritrack-notif-${n.id}`,
            requireInteraction: true,
            image: "/icons/waritrack-brand-banner.jpg",
          });

          // 2. Jouer le son
          playNotificationSound();

          // 3. Déclencher le toast in-app
          window.dispatchEvent(
            new CustomEvent<IncomingPushDetail>("waritrack-push-message", {
              detail: {
                id: n.id,
                title: n.title,
                body: n.body,
                orderId: n.orderId,
                source: isCatchUp ? "tracker" : "firestore",
              },
            })
          );
        }, idx * 650);

        dispatched.add(n.id);
      });

      // Mémoriser tous les IDs traités pour ne pas les ré-injecter
      unreadMissed.forEach((n) => dispatched.add(n.id));
      saveDispatchedSet(storageKey, dispatched);
    },
    [storageKey]
  );

  // 1. Écoute Firestore en temps réel
  useEffect(() => {
    if (!workspaceId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    initializedRef.current = false;
    const db = getDb();
    const ref = collection(db, "workspaces", workspaceId, "notifications");
    const q = userId
      ? query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"), limit(max))
      : query(ref, orderBy("createdAt", "desc"), limit(max));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);
        setNotifications(mapped);
        setLoading(false);

        // Méthode WhatsApp : injecter immédiatement les notifications manquées ou nouvelles
        dispatchToSystem(mapped, !initializedRef.current);
        initializedRef.current = true;
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [workspaceId, userId, max, dispatchToSystem]);

  // 2. Trackeur d'événements offline / reconnexion réseau & reprise de session ("Méthode WhatsApp")
  useEffect(() => {
    if (typeof window === "undefined" || !workspaceId) return;

    // A. Reconnexion Internet ("Méthode WhatsApp")
    const handleOnline = () => {
      console.log("[WariTrack Tracker] Reconnexion au réseau détectée. Synchronisation des notifications manquées...");
      if (notificationsRef.current.length > 0) {
        dispatchToSystem(notificationsRef.current, true);
      }
    };

    // B. Reprise d'activité / Focus onglet
    const handleFocus = () => {
      if (notificationsRef.current.length > 0) {
        dispatchToSystem(notificationsRef.current, true);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);

    // C. Trackeur périodique en tâche de fond (toutes les 45 secondes)
    const heartbeatTimer = setInterval(() => {
      if (notificationsRef.current.length > 0) {
        dispatchToSystem(notificationsRef.current, true);
      }
    }, 45_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      clearInterval(heartbeatTimer);
    };
  }, [workspaceId, dispatchToSystem]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Synchroniser le badge PWA sur l'icône d'application
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
      // Non supporté sur certains navigateurs
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
