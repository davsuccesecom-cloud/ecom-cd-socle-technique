import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { AFRICA_COUNTRIES, ConfirmDialog, getDb } from "@ecomcod/shared";
import type {
  ShopifyConnection,
  ShopifyCountryRoute,
  ShopifyUnroutedOrder,
  Team,
} from "@ecomcod/shared";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Copy,
  ExternalLink,
  Globe2,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Unlink,
  X,
  Zap,
} from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";
import AzifyConnectionSheet from "./AzifyConnectionSheet";
import AzifyMarketplaceMarketing from "./AzifyMarketplaceMarketing";
import { BellRing } from "lucide-react";

interface AzifyFluxManagerProps {
  workspaceId: string;
  team: Team;
  allTeams: Team[];
}

type AzifyConnExtra = {
  sourcePlatform?: "shopify" | "azify";
  azifyStoreId?: string;
  azifyStoreSlug?: string;
  azifyAccountEmail?: string;
  azifyDefaultCurrency?: string;
  verifyToken?: string;
  trackerVerifiedAt?: number;
  webhookVerifiedAt?: number;
  lastOrderAt?: number;
  ordersCount?: number;
};

type AzifyConn = ShopifyConnection & AzifyConnExtra;

interface AzifyConnectPayload {
  storeId?: string;
  storeName: string;
  slug: string;
  shopDomain: string;
  myshopifyDomain?: string;
  customDomain?: string;
  domains?: string[];
  allowedCountries?: string[];
  defaultCountry?: string;
  defaultCurrency?: string;
  verifyToken: string;
  functionsBaseUrl?: string;
  accountEmail?: string;
  accountName?: string;
}

const AZIFY_CONNECT_ORIGIN = "https://azishop-pwa-studio.vercel.app";
const CLOUD_FUNCTIONS_BASE = "https://us-central1-meta-capi-app.cloudfunctions.net";

function generateToken(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch {
    return (
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 10)
    );
  }
}

function isAzifyConnection(conn: AzifyConn): boolean {
  if (conn.sourcePlatform === "azify") return true;
  if (conn.azifyStoreId || conn.azifyStoreSlug) return true;
  const domainMatch = (conn.domains || []).some((d) =>
    d.toLowerCase().includes("azishop-pwa-studio")
  );
  return domainMatch || (conn.shopDomain || "").toLowerCase().includes("azishop-pwa-studio");
}

function decodeAzifyPairingCode(raw: string): AzifyConnectPayload | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("AZIFY1:")) return null;
  try {
    const b64url = trimmed.slice("AZIFY1:".length);
    const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as AzifyConnectPayload;
    if (!parsed || typeof parsed.shopDomain !== "string" || !parsed.verifyToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

function getAzifyHealth(conn: AzifyConn) {
  const DAY = 24 * 60 * 60 * 1000;
  if (conn.status === "disconnected" || (conn.status as string) === "inactive") {
    return {
      label: "En pause",
      statusKey: "paused",
      detail: "Flux suspendu. Cliquez sur Reconnecter pour réactiver la synchronisation.",
      badgeClass: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
      dotClass: "bg-rose-500",
      isDisconnected: true,
    };
  }
  if (conn.lastOrderAt && Date.now() - conn.lastOrderAt < 2 * DAY) {
    return {
      label: "En direct",
      statusKey: "live",
      detail: `Dernière commande reçue ${timeAgo(conn.lastOrderAt)}.`,
      badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
      dotClass: "bg-emerald-400 animate-pulse",
      isDisconnected: false,
    };
  }
  if (conn.webhookVerifiedAt || conn.trackerVerifiedAt) {
    return {
      label: "Connectée",
      statusKey: "connected",
      detail: "Passerelle active — prête à recevoir vos commandes COD & signaux CAPI.",
      badgeClass: "bg-sky-500/10 text-sky-400 border border-sky-500/30",
      dotClass: "bg-sky-400",
      isDisconnected: false,
    };
  }
  return {
    label: "À vérifier",
    statusKey: "verify",
    detail: "Cliquez sur « Tester le flux » pour valider la réception vers WariTrack.",
    badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    dotClass: "bg-amber-400",
    isDisconnected: false,
  };
}

function getCountryMeta(code: string) {
  const found = AFRICA_COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  if (found) return found;
  return { code: code.toUpperCase(), name: code.toUpperCase(), flag: code.toUpperCase() };
}

function CountryFlag({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/24x18/${code.toLowerCase()}.png`}
      alt={code}
      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-xs border border-white/10"
      onError={(e) => {
        (e.target as HTMLElement).style.display = "none";
      }}
    />
  );
}

export default function AzifyFluxManager({
  workspaceId,
  team,
  allTeams,
}: AzifyFluxManagerProps) {
  const [connections, setConnections] = useState<AzifyConn[]>([]);
  const [azifySubTab, setAzifySubTab] = useState<"flux" | "marketing">("flux");
  const [unroutedOrders, setUnroutedOrders] = useState<ShopifyUnroutedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [azifyBusy, setAzifyBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [reconnectBusy, setReconnectBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showSheetModal, setShowSheetModal] = useState(false);
  const [sheetPayload, setSheetPayload] = useState<AzifyConnectPayload | null>(null);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const [disconnectTarget, setDisconnectTarget] = useState<{
    connectionId: string;
    shopDomain: string;
    shopName: string;
  } | null>(null);
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    connectionId: string;
    shopDomain: string;
    shopName: string;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [addCountryModal, setAddCountryModal] = useState<{ connectionId: string } | null>(null);
  const [selectedCountryToAdd, setSelectedCountryToAdd] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    connectionId: string;
    countryCode: string;
    targetTeamId: string;
    targetTeamName: string;
    action: "assign" | "revoke";
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const oauthStateRef = useRef<string>("");
  const connectionsRef = useRef<AzifyConn[]>([]);
  connectionsRef.current = connections;

  useEffect(() => {
    const db = getDb();
    const unsubConn = onSnapshot(
      collection(db, "workspaces", workspaceId, "shopifyConnections"),
      (snap) => {
        const list: AzifyConn[] = [];
        snap.forEach((d) => {
          const item = { id: d.id, ...d.data() } as AzifyConn;
          if (isAzifyConnection(item)) {
            list.push(item);
          }
        });
        setConnections(list);
        setLoading(false);
      }
    );

    const unsubUnrouted = onSnapshot(
      collection(db, "workspaces", workspaceId, "shopifyUnroutedOrders"),
      (snap) => {
        const list: ShopifyUnroutedOrder[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ShopifyUnroutedOrder);
        });
        setUnroutedOrders(list);
      }
    );

    return () => {
      unsubConn();
      unsubUnrouted();
    };
  }, [workspaceId]);

  const pingAzifyEndpoints = useCallback(
    async (
      params: {
        shopDomain: string;
        customDomain?: string;
        myshopifyDomain?: string;
        verifyToken?: string;
        functionsBaseUrl?: string;
      }
    ) => {
      const fnBase = (params.functionsBaseUrl || CLOUD_FUNCTIONS_BASE).replace(/\/$/, "");
      await Promise.allSettled([
        fetch(`${fnBase}/trackSession`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopDomain: params.shopDomain,
            customDomain: params.customDomain || params.shopDomain,
            myshopifyDomain: params.myshopifyDomain || params.shopDomain,
            verifyToken: params.verifyToken || "",
          }),
        }),
        fetch(`${fnBase}/shopifyWebhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-shopify-shop-domain": params.shopDomain,
            "x-shopify-test": "true",
          },
          body: JSON.stringify({
            id: 999999999,
            order_number: 9999,
            name: "#TEST_VERIF",
            total_price: "0",
          }),
        }),
      ]);
    },
    []
  );

  const applyAzifyPayload = useCallback(
    async (payload: AzifyConnectPayload) => {
      const cleanDomain = (payload.shopDomain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

      if (!cleanDomain) {
        setActionError("Domaine Azify manquant dans la réponse de connexion.");
        return;
      }

      const connId = cleanDomain.replace(/[^a-z0-9]/gi, "_");
      const existing = connectionsRef.current.find((c) => c.id === connId);
      if (existing && existing.ownerTeamId !== team.id) {
        setActionError("Cette boutique Azify est déjà rattachée à une autre équipe.");
        return;
      }

      setAzifyBusy(true);
      setActionError(null);
      setNotice(null);

      try {
        const db = getDb();
        const ref = doc(db, "workspaces", workspaceId, "shopifyConnections", connId);
        const now = Date.now();

        const routes: Record<string, ShopifyCountryRoute> = {};
        const targetCountries = Array.from(
          new Set(
            (payload.allowedCountries && payload.allowedCountries.length > 0
              ? payload.allowedCountries
              : [payload.defaultCountry || team.defaultCountry || "CI"]
            ).map((c) => c.toUpperCase())
          )
        );
        targetCountries.forEach((cc) => {
          const matchedTeam =
            allTeams.find((t) => (t.defaultCountry || "BJ").toUpperCase() === cc) || team;
          routes[cc] = {
            countryCode: cc,
            assignedTeamId: matchedTeam.id,
            assignedTeamName: matchedTeam.name,
            assignedAt: now,
            status: "active",
          };
        });

        const aliasDomains = Array.from(
          new Set(
            [
              ...(payload.domains || []),
              cleanDomain,
              payload.myshopifyDomain || "",
              payload.customDomain || "",
              cleanDomain.replace(/^www\./, ""),
            ]
              .map((d) =>
                d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
              )
              .filter(Boolean)
          )
        );

        const docPayload: Partial<AzifyConn> = {
          id: connId,
          workspaceId,
          ownerTeamId: team.id,
          ownerTeamName: team.name,
          shopDomain: cleanDomain,
          myshopifyDomain: payload.myshopifyDomain || "",
          customDomain: payload.customDomain || "",
          domains: aliasDomains,
          shopName: payload.storeName || cleanDomain,
          status: "active",
          connectedAt: existing?.connectedAt || now,
          activatedAt: now,
          countryRoutes: routes,
          verifyToken: payload.verifyToken,
          sourcePlatform: "azify",
          azifyStoreId: payload.storeId || "",
          azifyStoreSlug: payload.slug || "",
          azifyAccountEmail: payload.accountEmail || "",
          azifyDefaultCurrency: payload.defaultCurrency || "",
        };

        await setDoc(ref, docPayload as unknown as ShopifyConnection, { merge: true });
        await pingAzifyEndpoints({
          shopDomain: cleanDomain,
          customDomain: payload.customDomain,
          myshopifyDomain: payload.myshopifyDomain,
          verifyToken: payload.verifyToken,
          functionsBaseUrl: payload.functionsBaseUrl,
        });

        setShowCodeBox(false);
        setCodeInput("");
        setNotice(
          `Boutique Azify « ${payload.storeName} » (${cleanDomain}) connectée avec succès !`
        );
      } catch (err) {
        const f = formatFirebaseError(err);
        setActionError(`${f.title} : ${f.message}`);
      } finally {
        setAzifyBusy(false);
      }
    },
    [workspaceId, team, allTeams, pingAzifyEndpoints]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const isLocal =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const allowedOrigin =
        event.origin === AZIFY_CONNECT_ORIGIN ||
        (isLocal && event.origin === "http://localhost:3000");
      if (!allowedOrigin) return;

      const data = event.data as {
        type?: string;
        state?: string;
        payload?: AzifyConnectPayload;
      } | null;
      if (!data || data.type !== "AZIFY_WARITRACK_CONNECT") return;
      if (!oauthStateRef.current || data.state !== oauthStateRef.current) return;
      if (!data.payload || !data.payload.shopDomain) return;

      oauthStateRef.current = "";
      void applyAzifyPayload(data.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [applyAzifyPayload]);

  const openAzifyOneClick = () => {
    setActionError(null);
    setNotice(null);
    const state = generateToken() + generateToken();
    oauthStateRef.current = state;
    const popupUrl = `${AZIFY_CONNECT_ORIGIN}/connect/waritrack?origin=${encodeURIComponent(
      window.location.origin
    )}&state=${encodeURIComponent(state)}`;
    const popup = window.open(
      popupUrl,
      "azify_oauth_connect",
      "width=560,height=760,scrollbars=yes,resizable=yes"
    );
    if (!popup) {
      setShowCodeBox(true);
      setActionError(
        "Pop-up bloqué par le navigateur. Autorisez les pop-ups ou collez le code d'appairage Azify ci-dessous."
      );
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const decoded = decodeAzifyPairingCode(codeInput);
    if (!decoded) {
      setActionError("Code Azify invalide. Le code doit débuter par AZIFY1:...");
      return;
    }
    setSheetPayload(decoded);
    setShowSheetModal(true);
  };

  const handlePasteCode = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setCodeInput(text.trim());
          const decoded = decodeAzifyPairingCode(text.trim());
          if (decoded) {
            setSheetPayload(decoded);
            setShowSheetModal(true);
          }
        }
      }
    } catch {
      // Ignorer si permission presse-papier refusée
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTokenId(key);
      setTimeout(() => setCopiedTokenId(null), 2000);
    } catch {}
  };

  const handleTestDirectApi = async (conn: AzifyConn) => {
    setTestingId(conn.id);
    setActionError(null);
    setNotice(null);
    const start = performance.now();
    try {
      const res = await fetch(`${CLOUD_FUNCTIONS_BASE}/azifyGateway/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${conn.verifyToken || ""}`,
          "X-Azify-Key": conn.verifyToken || "",
          "X-Azify-Shop": conn.shopDomain,
        },
        body: JSON.stringify({
          test: true,
          orderNumber: `PING-${Date.now().toString().slice(-4)}`,
          clientName: "Direct API Live Ping",
          phone: "+22890000000",
          country: (conn as any).defaultCountry || team.defaultCountry || "TG",
          city: "Lomé",
          total: 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok && data.success) {
        setNotice(
          `⚡ API Directe Azify validée avec succès en ${latencyMs}ms ! (Équipe assignée : ${data.teamName || data.teamId || "Active"})`
        );
      } else {
        setNotice(
          `⚡ Signal API Directe reçu (${latencyMs}ms) : ${data.message || "Connexion opérationnelle."}`
        );
      }
    } catch {
      setActionError("Impossible de joindre la passerelle API Directe Azify.");
    } finally {
      setTestingId(null);
    }
  };

  const handleTestFlux = async (conn: AzifyConn) => {
    setTestingId(conn.id);
    setActionError(null);
    setNotice(null);
    try {
      await pingAzifyEndpoints({
        shopDomain: conn.shopDomain,
        customDomain: conn.customDomain,
        myshopifyDomain: conn.myshopifyDomain,
        verifyToken: conn.verifyToken,
      });
      setNotice(`Signal de test validé pour « ${conn.shopName || conn.shopDomain} ».`);
    } catch {
      setActionError("Échec lors de l'envoi du signal de test Azify.");
    } finally {
      setTestingId(null);
    }
  };

  const handleReconnect = async (connId: string) => {
    setReconnectBusy(connId);
    setActionError(null);
    try {
      await updateDoc(doc(getDb(), "workspaces", workspaceId, "shopifyConnections", connId), {
        status: "active",
        activatedAt: Date.now(),
      });
      setNotice("Boutique réactivée avec succès.");
    } catch (err) {
      const f = formatFirebaseError(err);
      setActionError(`${f.title} : ${f.message}`);
    } finally {
      setReconnectBusy(null);
    }
  };

  const confirmDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnectBusy(true);
    setActionError(null);
    try {
      await updateDoc(
        doc(getDb(), "workspaces", workspaceId, "shopifyConnections", disconnectTarget.connectionId),
        { status: "disconnected", ownerTeamId: null, ownerTeamName: null }
      );
      try {
        const azifyOrigins = ["https://azify.vercel.app", "https://azishop-pwa-studio.vercel.app"];
        for (const origin of azifyOrigins) {
          fetch(`${origin}/api/integrations/waritrack/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "connection.disconnected",
              shopDomain: disconnectTarget.shopDomain,
              status: "disconnected",
            }),
          }).catch(() => {});
        }
      } catch (_) {}
      setDisconnectTarget(null);
      setNotice(`Boutique « ${disconnectTarget.shopName} » dissociée avec succès.`);
    } catch (err) {
      const f = formatFirebaseError(err);
      setActionError(`${f.title} : ${f.message}`);
    } finally {
      setDisconnectBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setActionError(null);
    try {
      try {
        const azifyOrigins = ["https://azify.vercel.app", "https://azishop-pwa-studio.vercel.app"];
        for (const origin of azifyOrigins) {
          fetch(`${origin}/api/integrations/waritrack/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "connection.disconnected",
              shopDomain: deleteTarget.shopDomain,
              status: "disconnected",
            }),
          }).catch(() => {});
        }
      } catch (_) {}
      await deleteDoc(
        doc(getDb(), "workspaces", workspaceId, "shopifyConnections", deleteTarget.connectionId)
      );
      setDeleteTarget(null);
      setNotice(`Boutique « ${deleteTarget.shopName} » supprimée et dissociée.`);
    } catch (err) {
      const f = formatFirebaseError(err);
      setActionError(`${f.title} : ${f.message}`);
    } finally {
      setDeleteBusy(false);
    }
  };

  const executeRouteAction = async () => {
    if (!confirmModal) return;
    setConfirmBusy(true);
    setActionError(null);
    try {
      const db = getDb();
      const connRef = doc(
        db,
        "workspaces",
        workspaceId,
        "shopifyConnections",
        confirmModal.connectionId
      );

      if (confirmModal.action === "revoke") {
        const conn = connections.find((c) => c.id === confirmModal.connectionId);
        await updateDoc(connRef, {
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamId`]: team.id,
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamName`]:
            conn?.ownerTeamName || team.name,
          [`countryRoutes.${confirmModal.countryCode}.assignedAt`]: Date.now(),
          [`countryRoutes.${confirmModal.countryCode}.status`]: "active",
        });
        setNotice(`Commandes ${getCountryMeta(confirmModal.countryCode).name} reprises dans votre équipe.`);
      } else {
        await updateDoc(connRef, {
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamId`]: confirmModal.targetTeamId,
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamName`]: confirmModal.targetTeamName,
          [`countryRoutes.${confirmModal.countryCode}.assignedAt`]: Date.now(),
          [`countryRoutes.${confirmModal.countryCode}.status`]: "active",
        });

        const pendingForCountry = unroutedOrders.filter(
          (u) =>
            u.connectionId === confirmModal.connectionId &&
            u.countryCode.toUpperCase() === confirmModal.countryCode.toUpperCase()
        );
        for (const unrouted of pendingForCountry) {
          await updateDoc(doc(db, "workspaces", workspaceId, "orders", unrouted.shopifyOrderId), {
            teamId: confirmModal.targetTeamId,
            isUnrouted: false,
          });
          await deleteDoc(
            doc(db, "workspaces", workspaceId, "shopifyUnroutedOrders", unrouted.id)
          );
        }
        setNotice(`Routage ${getCountryMeta(confirmModal.countryCode).name} transféré vers « ${confirmModal.targetTeamName} ».`);
      }
      setConfirmModal(null);
    } catch (err) {
      const f = formatFirebaseError(err);
      setActionError(`${f.title} : ${f.message}`);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleAddCountry = async () => {
    if (!addCountryModal || !selectedCountryToAdd) return;
    setActionError(null);
    try {
      const code = selectedCountryToAdd.toUpperCase();
      const matchedTeam =
        allTeams.find((t) => (t.defaultCountry || "BJ").toUpperCase() === code) || team;
      await updateDoc(
        doc(getDb(), "workspaces", workspaceId, "shopifyConnections", addCountryModal.connectionId),
        {
          [`countryRoutes.${code}`]: {
            countryCode: code,
            assignedTeamId: matchedTeam.id,
            assignedTeamName: matchedTeam.name,
            assignedAt: Date.now(),
            status: "active",
          },
        }
      );
      setAddCountryModal(null);
      setSelectedCountryToAdd("");
      setNotice(`Pays ${getCountryMeta(code).name} (${code}) ajouté au routage.`);
    } catch (err) {
      const f = formatFirebaseError(err);
      setActionError(`${f.title} : ${f.message}`);
    }
  };

  const countriesWithTeams = Array.from(
    new Set(allTeams.map((t) => (t.defaultCountry || "BJ").toUpperCase()))
  );
  const myConnections = connections.filter((c) => c.ownerTeamId === team.id);
  const myConnectionIds = new Set(myConnections.map((c) => c.id));
  const azifyUnrouted = unroutedOrders.filter((u) => myConnectionIds.has(u.connectionId));
  const gatewayOk = myConnections.some(
    (c) =>
      c.status !== "disconnected" &&
      (Boolean(c.webhookVerifiedAt) || Boolean(c.trackerVerifiedAt) || Boolean(c.lastOrderAt))
  );

  const totalAssignedCountries = myConnections.reduce(
    (acc, c) => acc + Object.keys(c.countryRoutes || {}).length,
    0
  );

  const borrowedFlux: {
    connection: AzifyConn;
    countryCode: string;
    route: ShopifyCountryRoute;
  }[] = [];

  connections.forEach((c) => {
    if (c.ownerTeamId !== team.id && c.countryRoutes) {
      Object.entries(c.countryRoutes).forEach(([code, r]) => {
        if (r.assignedTeamId === team.id) {
          borrowedFlux.push({ connection: c, countryCode: code, route: r });
        }
      });
    }
  });

  return (
    <div className="space-y-6">
      {/* 1. Alerte commandes en attente de routage pays */}
      {azifyUnrouted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-300">
                {azifyUnrouted.length} commande(s) Azify en attente d&apos;attribution pays
              </p>
              <p className="text-[11px] text-amber-200/80">
                Ajoutez les pays correspondants ci-dessous pour que WariTrack les affecte immédiatement à vos closeuses et livreurs.
              </p>
            </div>
          </div>
          <span className="rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-300">
            {azifyUnrouted.length} en attente
          </span>
        </div>
      )}

      {/* 2. Messages de notification / erreurs */}
      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="rounded p-1 text-rose-400 transition hover:bg-rose-500/20 hover:text-rose-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-1 text-emerald-400 transition hover:bg-emerald-500/20 hover:text-emerald-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Navigation des sous-onglets Azify */}
      <div className="flex border-b border-surface-border">
        <button
          type="button"
          onClick={() => setAzifySubTab("flux")}
          className={`flex min-h-[46px] items-center gap-2 border-b-2 px-5 text-xs font-bold transition-colors cursor-pointer ${
            azifySubTab === "flux"
              ? "border-brand text-slate-100"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Boutiques & Routage Pays</span>
        </button>
        <button
          type="button"
          onClick={() => setAzifySubTab("marketing")}
          className={`flex min-h-[46px] items-center gap-2 border-b-2 px-5 text-xs font-bold transition-colors cursor-pointer ${
            azifySubTab === "marketing"
              ? "border-amber-400 text-amber-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BellRing className="h-4 w-4" />
          <span>Marketing Push & Paniers Abandonnés</span>
        </button>
      </div>

      {azifySubTab === "marketing" ? (
        <AzifyMarketplaceMarketing workspaceId={workspaceId} team={team} allTeams={allTeams} />
      ) : (
        <>
      {/* 3. Hero Card : Azify PWA Studio Connecteur */}
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-xs">
        {/* Header supérieur du connecteur */}
        <div className="border-b border-surface-border p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {/* Badge Azify Studio Icon */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-inner">
                <Zap className="h-6 w-6 fill-amber-400/20 stroke-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base font-bold text-slate-100">
                    Connecteur Azify PWA Studio
                  </h2>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
                    PWA COD Afrique
                  </span>
                  {myConnections.length > 0 && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        gatewayOk
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          gatewayOk ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                      {gatewayOk ? "Passerelle active" : "Vérification requise"}
                    </span>
                  )}
                </div>
                <p className="max-w-2xl text-xs leading-relaxed text-slate-400">
                  Liez vos boutiques Azify en 1 clic pour injecter automatiquement vos commandes COD dans WariTrack, synchroniser les événements Meta CAPI serveur et distribuer le flux par pays.
                </p>
              </div>
            </div>

            {/* Barre d'action rapide */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowCodeBox((v) => !v)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition ${
                  showCodeBox
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                    : "border-surface-border bg-surface text-slate-300 hover:border-slate-500 hover:text-slate-100"
                }`}
              >
                <Clipboard className="h-4 w-4" />
                <span>{showCodeBox ? "Masquer code" : "Code AZIFY1"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSheetPayload(null);
                  setShowSheetModal(true);
                }}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-xs font-bold text-white shadow-sm transition hover:opacity-95 active:translate-y-px cursor-pointer"
              >
                <Store className="h-4 w-4" />
                <span>Fiche de Connexion Équipe</span>
              </button>

              <button
                type="button"
                disabled={azifyBusy}
                onClick={openAzifyOneClick}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500 to-amber-600 px-5 text-xs font-bold text-slate-950 shadow-sm transition hover:brightness-110 active:translate-y-px disabled:opacity-60"
              >
                <Zap className={`h-4 w-4 fill-slate-950 ${azifyBusy ? "animate-pulse" : ""}`} />
                <span>{azifyBusy ? "Connexion en cours…" : "Connecter Azify en 1 clic"}</span>
              </button>
            </div>
          </div>

          {/* Formulaire de code d'appairage manuel AZIFY1 */}
          {showCodeBox && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Appairage manuel par code sécurisé
                </span>
                <span className="text-[11px] text-slate-400">
                  Copiez le code depuis votre tableau de bord Azify Studio
                </span>
              </div>
              <form onSubmit={handleCodeSubmit} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Coller ici votre code (ex: AZIFY1:eyJzdG9yZU5hbWUiOi...)"
                  className="min-w-[260px] flex-1 rounded-lg border border-surface-border bg-surface-raised px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handlePasteCode}
                  className="rounded-lg border border-surface-border bg-surface-subtle px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:text-slate-100"
                >
                  Coller
                </button>
                <button
                  type="submit"
                  disabled={azifyBusy || !codeInput.trim()}
                  className="rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  Valider l&apos;appairage
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Barre de métriques rapides si au moins une boutique */}
        {myConnections.length > 0 && (
          <div className="grid grid-cols-2 divide-x divide-surface-border border-b border-surface-border bg-surface/40 text-center sm:grid-cols-4">
            <div className="p-3.5">
              <p className="text-[11px] font-medium text-slate-400">Boutiques actives</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-100">
                {myConnections.length}
              </p>
            </div>
            <div className="p-3.5">
              <p className="text-[11px] font-medium text-slate-400">Pays configurés</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-100">
                {totalAssignedCountries}
              </p>
            </div>
            <div className="p-3.5">
              <p className="text-[11px] font-medium text-slate-400">Flux partagés</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-100">
                {borrowedFlux.length}
              </p>
            </div>
            <div className="p-3.5">
              <p className="text-[11px] font-medium text-slate-400">Équipe locale</p>
              <p className="mt-0.5 truncate text-xs font-bold text-slate-200">
                {team.name}
              </p>
            </div>
          </div>
        )}

        {/* Corps de la liste des boutiques */}
        <div className="p-5 md:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
              <p className="mt-3 text-xs font-medium">Chargement des boutiques Azify…</p>
            </div>
          ) : myConnections.length === 0 ? (
            /* État vide / Onboarding clair */
            <div className="rounded-xl border border-dashed border-surface-border bg-surface/30 p-8 text-center md:p-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <Store className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-100">
                Aucune boutique Azify connectée pour {team.name}
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                Associez votre boutique PWA Azify à WariTrack en 3 secondes. Vous pourrez ensuite router chaque pays vers vos équipes terrain respectives.
              </p>

              {/* Étapes claires du flux */}
              <div className="mx-auto my-6 grid max-w-lg grid-cols-1 gap-3 text-left sm:grid-cols-3">
                <div className="rounded-lg border border-surface-border bg-surface-raised p-3">
                  <span className="text-[10px] font-bold text-amber-400">ÉTAPE 1</span>
                  <p className="mt-1 text-xs font-semibold text-slate-200">Connexion 1-clic</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Authentification via OAuth Azify</p>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-raised p-3">
                  <span className="text-[10px] font-bold text-amber-400">ÉTAPE 2</span>
                  <p className="mt-1 text-xs font-semibold text-slate-200">Routage Pays</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Affectation CI, BJ, SN, TG...</p>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-raised p-3">
                  <span className="text-[10px] font-bold text-amber-400">ÉTAPE 3</span>
                  <p className="mt-1 text-xs font-semibold text-slate-200">Closing & Envois</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Commandes directes aux équipes</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={azifyBusy}
                  onClick={openAzifyOneClick}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 text-xs font-bold text-slate-950 transition hover:bg-amber-400 shadow-sm"
                >
                  <Zap className="h-4 w-4 fill-slate-950" />
                  <span>Connecter ma première boutique Azify</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCodeBox(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 text-xs font-semibold text-slate-300 transition hover:text-slate-100"
                >
                  <Clipboard className="h-4 w-4" />
                  <span>Saisir un code manuel</span>
                </button>
              </div>
            </div>
          ) : (
            /* Liste des boutiques connectées */
            <div className="space-y-5">
              {myConnections.map((conn) => {
                const routes = conn.countryRoutes || {};
                const routeEntries = Object.entries(routes);
                const health = getAzifyHealth(conn);
                const iconSlug = conn.azifyStoreSlug || "azishop";
                const isTesting = testingId === conn.id;

                return (
                  <div
                    key={conn.id}
                    className="overflow-hidden rounded-xl border border-surface-border bg-surface/40 transition hover:border-slate-700"
                  >
                    {/* En-tête de la boutique */}
                    <div className="border-b border-surface-border bg-surface-raised p-4 sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        {/* Identité boutique */}
                        <div className="flex items-start gap-3.5">
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-surface-border bg-white shadow-xs">
                            <img
                              src={`${AZIFY_CONNECT_ORIGIN}/api/pwa-icon/${encodeURIComponent(iconSlug)}/192`}
                              alt={conn.shopName || "Azify"}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                            <div className="flex h-full w-full items-center justify-center bg-surface-subtle text-xs font-bold text-amber-400">
                              {(conn.shopName || "AZ").slice(0, 2).toUpperCase()}
                            </div>
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-bold text-slate-100">
                                {conn.shopName}
                              </h3>
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                                Azify Studio
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.badgeClass}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${health.dotClass}`} />
                                {health.label}
                              </span>
                              {conn.azifyDefaultCurrency && (
                                <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-300">
                                  {conn.azifyDefaultCurrency}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              <a
                                href={`https://${conn.shopDomain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-amber-400 hover:underline"
                              >
                                <span>{conn.shopDomain}</span>
                                <ExternalLink className="h-3 w-3 opacity-70" />
                              </a>
                              {conn.azifyAccountEmail && (
                                <span className="text-slate-500">
                                  Compte : {conn.azifyAccountEmail}
                                </span>
                              )}
                              {conn.lastOrderAt && (
                                <span className="tabular-nums text-slate-400">
                                  {health.detail}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions pour cette boutique */}
                        <div className="flex flex-wrap items-center gap-2">
                          {health.isDisconnected ? (
                            <button
                              type="button"
                              onClick={() => handleReconnect(conn.id)}
                              disabled={reconnectBusy === conn.id}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 text-emerald-400 ${
                                  reconnectBusy === conn.id ? "animate-spin" : ""
                                }`}
                              />
                              <span>
                                {reconnectBusy === conn.id ? "Reconnexion…" : "Reconnecter"}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setDisconnectTarget({
                                  connectionId: conn.id,
                                  shopDomain: conn.shopDomain,
                                  shopName: conn.shopName || conn.shopDomain,
                                })
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 text-xs font-medium text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
                            >
                              <Unlink className="h-3.5 w-3.5 text-amber-400" />
                              <span>Mettre en pause</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isTesting}
                            onClick={() => handleTestFlux(conn)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-60"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 text-sky-400 ${isTesting ? "animate-spin" : ""}`}
                            />
                            <span>{isTesting ? "Test en cours…" : "Tester le flux"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAddCountryModal({ connectionId: conn.id })}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
                          >
                            <Plus className="h-3.5 w-3.5 text-amber-400" />
                            <span>Ajouter un pays</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                connectionId: conn.id,
                                shopDomain: conn.shopDomain,
                                shopName: conn.shopName || conn.shopDomain,
                              })
                            }
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-surface-border bg-surface p-2 text-xs text-rose-400 transition hover:border-rose-500/40 hover:bg-rose-500/10"
                            title="Supprimer la connexion"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* API Directe Azify (Synchronisation Haute Performance < 100ms) */}
                    <div className="border-t border-surface-border bg-surface/50 px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-400">
                            API Directe Azify (Temps Réel &lt; 100ms)
                          </span>
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/20">
                            Synchrone (Zéro Webhook)
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={isTesting}
                          onClick={() => handleTestDirectApi(conn)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <Zap className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{isTesting ? "Test en cours…" : "Tester l'API directe"}</span>
                        </button>
                      </div>
                      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                        <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
                          <div className="truncate mr-2">
                            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Endpoint Ingestion Directe</span>
                            <code className="text-[11px] font-mono text-slate-200 select-all">https://azifygateway-7sfexpcitq-uc.a.run.app/orders</code>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("https://azifygateway-7sfexpcitq-uc.a.run.app/orders", `ep_${conn.id}`)}
                            className="shrink-0 p-1 text-slate-400 hover:text-white"
                            title="Copier l'URL de l'API"
                          >
                            {copiedTokenId === `ep_${conn.id}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
                          <div className="truncate mr-2">
                            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Clé API d'Accès</span>
                            <code className="text-[11px] font-mono text-amber-300 select-all">{conn.verifyToken || "azify_sec_live_default"}</code>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(conn.verifyToken || "", `tk_${conn.id}`)}
                            className="shrink-0 p-1 text-slate-400 hover:text-white"
                            title="Copier la clé API"
                          >
                            {copiedTokenId === `tk_${conn.id}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Zone de routage par pays */}
                    <div className="p-4 sm:p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe2 className="h-4 w-4 text-amber-400" />
                          <h4 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                            Routage des commandes par pays ({routeEntries.length})
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddCountryModal({ connectionId: conn.id })}
                          className="text-xs font-semibold text-amber-400 hover:underline"
                        >
                          + Ajouter un autre pays
                        </button>
                      </div>

                      {routeEntries.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-4 text-center">
                          <p className="text-xs text-amber-300">
                            Aucun pays configuré pour cette boutique.
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Ajoutez votre premier marché pour que les commandes soient distribuées aux bonnes équipes.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {routeEntries.map(([code, r]) => {
                            const meta = getCountryMeta(code);
                            const isLocal = r.assignedTeamId === team.id;
                            const eligibleTeams = allTeams.filter(
                              (t) => (t.defaultCountry || "BJ").toUpperCase() === code.toUpperCase()
                            );

                            return (
                              <div
                                key={code}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised p-3.5 shadow-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <CountryFlag code={code} />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-100">
                                        {meta.name}
                                      </span>
                                      <span className="rounded bg-surface px-1.5 py-0.2 font-mono text-[10px] text-slate-400">
                                        {code}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-slate-400">
                                      Assigné à :{" "}
                                      <span
                                        className={`font-semibold ${
                                          isLocal ? "text-emerald-400" : "text-sky-300"
                                        }`}
                                      >
                                        {isLocal ? "Cette équipe (Propriétaire)" : r.assignedTeamName}
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  {isLocal ? (
                                    <select
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (!e.target.value) return;
                                        const targetTeam = allTeams.find(
                                          (t) => t.id === e.target.value
                                        );
                                        if (!targetTeam) return;
                                        setConfirmModal({
                                          connectionId: conn.id,
                                          countryCode: code,
                                          targetTeamId: targetTeam.id,
                                          targetTeamName: targetTeam.name,
                                          action: "assign",
                                        });
                                        e.target.value = "";
                                      }}
                                      className="h-8 rounded-lg border border-surface-border bg-surface px-2.5 text-xs font-medium text-slate-200 outline-none transition hover:border-slate-500 focus:border-amber-500"
                                    >
                                      <option value="" disabled>
                                        Transférer le routage…
                                      </option>
                                      {eligibleTeams
                                        .filter((t) => t.id !== team.id)
                                        .map((t) => (
                                          <option key={t.id} value={t.id}>
                                            Transférer à {t.name}
                                          </option>
                                        ))}
                                      {eligibleTeams.filter((t) => t.id !== team.id).length === 0 && (
                                        <option value="" disabled>
                                          Aucune autre équipe disponible
                                        </option>
                                      )}
                                    </select>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmModal({
                                          connectionId: conn.id,
                                          countryCode: code,
                                          targetTeamId: team.id,
                                          targetTeamName: team.name,
                                          action: "revoke",
                                        })
                                      }
                                      className="inline-flex h-8 items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                                    >
                                      Reprendre localement
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Flux partagés depuis d'autres équipes */}
          {borrowedFlux.length > 0 && (
            <div className="mt-8 border-t border-surface-border pt-6">
              <div className="mb-3 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-sky-400" />
                <h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                  Flux Azify partagés avec votre équipe ({borrowedFlux.length})
                </h3>
              </div>
              <p className="mb-4 text-xs text-slate-400">
                Ces boutiques appartiennent à d&apos;autres équipes du compte, mais leurs commandes pour ces pays sont automatiquement redirigées vers votre équipe locale.
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {borrowedFlux.map((bf) => {
                  const meta = getCountryMeta(bf.countryCode);
                  return (
                    <div
                      key={`${bf.connection.id}-${bf.countryCode}`}
                      className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <CountryFlag code={bf.countryCode} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">
                              {bf.connection.shopName}
                            </span>
                            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                              {meta.name}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Boutique gérée par :{" "}
                            <span className="font-semibold text-slate-200">
                              {bf.connection.ownerTeamName}
                            </span>
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        <Check className="h-3 w-3" />
                        Réception active
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modale de déconnexion (pause) */}
      <ConfirmDialog
        open={!!disconnectTarget}
        title="Mettre en pause cette boutique Azify ?"
        message={
          disconnectTarget
            ? `Voulez-vous suspendre temporairement la réception pour « ${disconnectTarget.shopName} » (${disconnectTarget.shopDomain}) ? La boutique restera enregistrée et vous pourrez la réactiver en 1 clic sans perdre vos configurations.`
            : ""
        }
        confirmLabel="Mettre en pause"
        danger={false}
        loading={disconnectBusy}
        onConfirm={confirmDisconnect}
        onCancel={() => setDisconnectTarget(null)}
      />

      {/* Modale de suppression définitive */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer définitivement cette boutique Azify ?"
        message={
          deleteTarget
            ? `Êtes-vous sûr de vouloir supprimer définitivement la liaison avec « ${deleteTarget.shopName} » (${deleteTarget.shopDomain}) de WariTrack ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer définitivement"
        danger={true}
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modale de confirmation de transfert de routage pays */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-surface-border pb-3">
              <CountryFlag code={confirmModal.countryCode} />
              <h3 className="text-sm font-bold text-slate-100">
                {confirmModal.action === "revoke"
                  ? "Reprendre le routage localement"
                  : "Déléguer le routage vers une autre équipe"}
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              {confirmModal.action === "revoke" ? (
                <>
                  Toutes les nouvelles commandes Azify en provenance de{" "}
                  <strong className="text-white">
                    {getCountryMeta(confirmModal.countryCode).name} ({confirmModal.countryCode})
                  </strong>{" "}
                  seront désormais gérées directement par votre équipe locale{" "}
                  <strong className="text-amber-400">« {team.name} »</strong>.
                </>
              ) : (
                <>
                  Transférer le routage des commandes Azify pour{" "}
                  <strong className="text-white">
                    {getCountryMeta(confirmModal.countryCode).name} ({confirmModal.countryCode})
                  </strong>{" "}
                  vers l&apos;équipe locale{" "}
                  <strong className="text-sky-400">« {confirmModal.targetTeamName} »</strong> ? Les commandes en attente pour ce pays seront également réassignées.
                </>
              )}
            </p>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="h-10 rounded-xl border border-surface-border bg-surface px-4 text-xs font-semibold text-slate-300 transition hover:bg-surface-subtle"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={executeRouteAction}
                className="h-10 rounded-xl bg-amber-500 px-5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {confirmBusy ? "Traitement…" : "Confirmer le routage"}
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}

      {/* Modale d'ajout d'un pays de routage */}
      {addCountryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-slate-100">Ajouter un pays de distribution</h3>
              <button
                type="button"
                onClick={() => setAddCountryModal(null)}
                className="rounded p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Sélectionnez le pays pour cette boutique Azify :
              </label>
              <select
                value={selectedCountryToAdd}
                onChange={(e) => setSelectedCountryToAdd(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none transition focus:border-amber-500"
              >
                <option value="">-- Choisir un pays parmi vos marchés --</option>
                {countriesWithTeams.map((c) => {
                  const meta = getCountryMeta(c);
                  return (
                    <option key={c} value={c}>
                      {meta.name} ({c})
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-400">
                Le pays sera automatiquement rattaché à l&apos;équipe WariTrack correspondante.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setAddCountryModal(null)}
                className="h-9 rounded-xl border border-surface-border bg-surface px-3.5 text-xs text-slate-400 transition hover:bg-surface-subtle hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!selectedCountryToAdd}
                onClick={handleAddCountry}
                className="h-9 rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
              >
                Ajouter ce pays
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Fiche de Connexion & Association d'Équipe Modale */}
      {showSheetModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-xl">
            <AzifyConnectionSheet
              workspaceId={workspaceId}
              userEmail={team.name}
              initialPayload={sheetPayload}
              onCompleted={(assignedTeam) => {
                setShowSheetModal(false);
                setNotice(`Boutique connectée avec succès à l'équipe « ${assignedTeam.name} » !`);
              }}
              onCancel={() => setShowSheetModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
