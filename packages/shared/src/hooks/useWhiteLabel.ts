import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "../firebase";

export interface WhiteLabelConfig {
  brandName?: string;
  namingOption?: "standard" | "action" | "custom";
  customCloseuseTitle?: string;
  customLivreurTitle?: string;
  closeuseTitle?: string;
  livreurTitle?: string;
  customLogoUrl?: string | null;
  useNativeIcons?: boolean;
  updatedAt?: number;
}

export type AppWhiteLabelRole = "admin" | "closeuse" | "livreur";

const STORAGE_PREFIX = "ecomcod_whitelabel_";
const STORAGE_LAST_KEY = "ecomcod_whitelabel_last";

const DEFAULTS: Record<
  AppWhiteLabelRole,
  { title: string; shortName: string; themeColor: string; bgColor: string; fallbackIcon: string; badgeIcon: string }
> = {
  closeuse: {
    title: "WariTrack — Espace Closeuse",
    shortName: "Closeuse",
    themeColor: "#4F46E5",
    bgColor: "#F8FAFC",
    fallbackIcon: "/icons/icon-192.png",
    badgeIcon: "/icons/badge-96.png",
  },
  livreur: {
    title: "WariTrack — Espace Livreur",
    shortName: "Livreur",
    themeColor: "#0EA5E9",
    bgColor: "#F8FAFC",
    fallbackIcon: "/icons/icon-192.png",
    badgeIcon: "/icons/badge-96.png",
  },
  admin: {
    title: "WariTrack — Cockpit Admin",
    shortName: "WariTrack",
    themeColor: "#07090F",
    bgColor: "#07090F",
    fallbackIcon: "/icons/waritrack-3d-192.png",
    badgeIcon: "/icons/badge-96.png",
  },
};

export function getCachedWhiteLabel(workspaceId?: string | null): WhiteLabelConfig | null {
  try {
    const key = workspaceId ? `${STORAGE_PREFIX}${workspaceId}` : STORAGE_LAST_KEY;
    const raw = localStorage.getItem(key) || (workspaceId ? localStorage.getItem(STORAGE_LAST_KEY) : null);
    return raw ? (JSON.parse(raw) as WhiteLabelConfig) : null;
  } catch {
    return null;
  }
}

function updateDomLink(rel: string, href: string, type?: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  if (type) link.type = type;
}

/**
 * Synchronise en direct la personnalisation marque blanche (titre, logo, favicon, manifeste PWA)
 * configurée dans Admin → Paramètres vers les apps Closeuse, Livreur et Admin.
 */
export function useWhiteLabel(
  workspaceId?: string | null,
  role: AppWhiteLabelRole = "closeuse"
): WhiteLabelConfig | null {
  const [whiteLabel, setWhiteLabel] = useState<WhiteLabelConfig | null>(() => getCachedWhiteLabel(workspaceId));

  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const unsub = onSnapshot(
      doc(db, "workspaces", workspaceId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { whiteLabel?: WhiteLabelConfig; name?: string };
        const wl: WhiteLabelConfig = {
          ...(data.whiteLabel || {}),
          brandName: data.whiteLabel?.brandName || data.name,
        };
        setWhiteLabel(wl);
        try {
          const serialized = JSON.stringify(wl);
          localStorage.setItem(`${STORAGE_PREFIX}${workspaceId}`, serialized);
          localStorage.setItem(STORAGE_LAST_KEY, serialized);
        } catch {
          // Ignore quota issues
        }
      },
      () => {
        // Ignore silent read error on offline startup
      }
    );
    return () => unsub();
  }, [workspaceId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = DEFAULTS[role];
    const hasCustomLogo = Boolean(whiteLabel?.customLogoUrl && whiteLabel?.useNativeIcons !== true);
    const activeLogo = hasCustomLogo ? whiteLabel!.customLogoUrl! : meta.fallbackIcon;

    const resolvedTitle =
      role === "closeuse"
        ? whiteLabel?.closeuseTitle || (whiteLabel?.brandName ? `${whiteLabel.brandName} • Closeuse` : meta.title)
        : role === "livreur"
        ? whiteLabel?.livreurTitle || (whiteLabel?.brandName ? `${whiteLabel.brandName} • Livreur` : meta.title)
        : whiteLabel?.brandName
        ? `${whiteLabel.brandName} — WariTrack Admin`
        : meta.title;

    document.title = resolvedTitle;

    if (hasCustomLogo) {
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((el) => {
        el.href = activeLogo;
      });
      updateDomLink("icon", activeLogo);
      updateDomLink("apple-touch-icon", activeLogo);
    } else {
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((el) => {
        el.href = meta.fallbackIcon;
      });
      updateDomLink("icon", meta.fallbackIcon, "image/png");
      updateDomLink("apple-touch-icon", meta.fallbackIcon);
    }

    // Met à jour le manifeste PWA dynamique pour la ré-installation ou raccourcis
    let manifestBlobUrl: string | null = null;
    try {
      const origin = window.location.origin;
      const absLogo = activeLogo.startsWith("data:") || activeLogo.startsWith("http") ? activeLogo : `${origin}${activeLogo}`;
      const iconMime = absLogo.startsWith("data:")
        ? absLogo.slice(5, absLogo.indexOf(";")) || "image/png"
        : "image/png";
      const manifestData = {
        name: resolvedTitle,
        short_name:
          role === "closeuse"
            ? whiteLabel?.closeuseTitle?.slice(0, 20) || whiteLabel?.brandName?.slice(0, 20) || meta.shortName
            : role === "livreur"
            ? whiteLabel?.livreurTitle?.slice(0, 20) || whiteLabel?.brandName?.slice(0, 20) || meta.shortName
            : whiteLabel?.brandName?.slice(0, 20) || meta.shortName,
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: meta.themeColor,
        background_color: meta.bgColor,
        icons: [
          { src: absLogo, sizes: "192x192", type: iconMime, purpose: "any" },
          { src: absLogo, sizes: "512x512", type: iconMime, purpose: "any" },
        ],
      };
      const blob = new Blob([JSON.stringify(manifestData)], { type: "application/manifest+json" });
      manifestBlobUrl = URL.createObjectURL(blob);
      updateDomLink("manifest", manifestBlobUrl);
    } catch {
      // Ignore si navigateur ne supporte pas blob manifest
    }

    // Stocke aussi le logo et titre dans CacheStorage pour firebase-messaging-sw.js (arrière-plan)
    if ("caches" in window) {
      caches
        .open("waritrack-whitelabel")
        .then((cache) =>
          cache.put(
            "/whitelabel.json",
            new Response(
              JSON.stringify({
                appTitle: resolvedTitle,
                brandName: whiteLabel?.brandName || "WariTrack",
                logoUrl: hasCustomLogo ? activeLogo : null,
              }),
              { headers: { "Content-Type": "application/json" } }
            )
          )
        )
        .catch(() => {});
    }

    return () => {
      if (manifestBlobUrl) {
        URL.revokeObjectURL(manifestBlobUrl);
      }
    };
  }, [whiteLabel, role]);

  return whiteLabel;
}
