// 0. Suivi des fenêtres PWA standalone installées
const standaloneClientIds = new Set();

self.addEventListener("message", (event) => {
  if (event.data?.type === "WARITRACK_CLIENT_IDENTITY") {
    if (event.data.isStandalone && event.source?.id) {
      standaloneClientIds.add(event.source.id);
    }
  }
});

// 1. Enregistrement PRIORITAIRE du listener de clic pour focaliser instantanément la PWA installée
function toAbsolute(path) {
  if (!path) return self.location.origin + "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = self.location.origin;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();

  const rawData = event.notification.data || {};
  const fcmMsg = rawData.FCM_MSG || {};
  const fcmData = fcmMsg.data || {};
  const orderId = rawData.orderId || fcmData.orderId || "";
  const targetUrl = toAbsolute(
    rawData.url ||
    fcmData.url ||
    (orderId ? `/?orderId=${orderId}` : "/")
  );

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 1. Chercher en priorité absolue une fenêtre PWA standalone installée
      let targetClient = windowClients.find(
        (c) => c.url && c.url.startsWith(self.location.origin) && standaloneClientIds.has(c.id)
      );

      // 2. Si aucune fenêtre explicitement marquée standalone n'est trouvée, chercher toute fenêtre du même origin
      if (!targetClient) {
        targetClient = windowClients.find(
          (c) => c.url && c.url.startsWith(self.location.origin)
        );
      }

      // 3. Repli si une fenêtre waritrack existe
      if (!targetClient) {
        targetClient = windowClients.find(
          (c) => c.url && c.url.includes("waritrack")
        );
      }

      // 4. Si une fenêtre active existe : la focaliser et naviguer dedans
      if (targetClient && "focus" in targetClient) {
        const focused = await targetClient.focus();
        const activeClient = focused || targetClient;
        if (activeClient && "navigate" in activeClient) {
          try {
            await activeClient.navigate(targetUrl);
          } catch {}
        }
        if (orderId) {
          activeClient.postMessage({ type: "NAVIGATE_ORDER", orderId, url: targetUrl });
        }
        return;
      }

      // 5. Si aucune fenêtre n'est ouverte : ouvrir la PWA installée
      if (clients.openWindow) {
        return await clients.openWindow(targetUrl);
      }
    })()
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

function resolveSafeIcon(url, fallback) {
  return typeof url === "string" && url.startsWith("https://") ? url : fallback;
}

async function getWhiteLabelBranding() {
  try {
    const cache = await caches.open("waritrack-whitelabel");
    const res = await cache.match("/whitelabel.json");
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// 2. Import et initialisation du SDK Firebase Cloud Messaging
try {
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU",
      authDomain: "meta-capi-app.firebaseapp.com",
      projectId: "meta-capi-app",
      storageBucket: "meta-capi-app.firebasestorage.app",
      messagingSenderId: "972779076968",
      appId: "1:972779076968:web:d682a4902fd83891a82add",
    });
  }

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(async (payload) => {
    const wl = await getWhiteLabelBranding();
    const title =
      payload?.notification?.title ||
      payload?.data?.title ||
      (wl?.brandName ? `${wl.brandName} — Livreur` : "WariTrack — Livreur");
    const body = payload?.notification?.body || payload?.data?.body || "";
    const orderId = payload?.data?.orderId || "";
    const targetUrl = toAbsolute(payload?.data?.url || (orderId ? `/?orderId=${orderId}` : "/"));
    const icon = resolveSafeIcon(wl?.logoUrl, toAbsolute("/icons/app-livreur-native.png"));
    const badge = toAbsolute("/icons/badge-96.png");

    // N'afficher de grande image que s'il s'agit d'une vraie image produit en HTTP/HTTPS
    const rawImage =
      payload?.notification?.imageUrl ||
      payload?.notification?.image ||
      payload?.data?.imageUrl ||
      payload?.data?.image ||
      payload?.data?.productImageUrl;
    const hasProductImage =
      typeof rawImage === "string" &&
      rawImage.startsWith("http") &&
      !rawImage.includes("waritrack-brand-banner");
    const image = hasProductImage ? rawImage : undefined;

    const tag = payload?.data?.tag || (orderId ? `waritrack-order-${orderId}` : `waritrack-livreur-${Date.now()}`);

    const notificationOptions = {
      body,
      icon: image || icon,
      badge,
      tag,
      renotify: true,
      requireInteraction: true,
      data: { orderId, url: targetUrl },
      ...(image ? { image } : {}),
    };

    try {
      await self.registration.showNotification(title, notificationOptions);
    } catch {
      await self.registration.showNotification(title, {
        ...notificationOptions,
        icon: toAbsolute("/icons/icon-192.png"),
      });
    }
  });
} catch (err) {
  console.warn("[WariTrack SW Livreur] Initialisation Firebase SW:", err);
}
