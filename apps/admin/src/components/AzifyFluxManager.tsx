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
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Unlink,
  X,
  Zap,
} from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";

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
      label: "Déconnectée (En pause)",
      detail: "Flux Azify mis en pause. Cliquez sur Reconnecter pour réactiver la réception.",
      badgeClass: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
      dotClass: "bg-rose-400",
      isDisconnected: true,
    };
  }
  if (conn.lastOrderAt && Date.now() - conn.lastOrderAt < 2 * DAY) {
    return {
      label: "En direct",
      detail: `Dernière commande Azify reçue ${timeAgo(conn.lastOrderAt)}.`,
      badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
      dotClass: "bg-emerald-400",
      isDisconnected: false,
    };
  }
  if (conn.webhookVerifiedAt || conn.trackerVerifiedAt) {
    return {
      label: "Connectée",
      detail: "Passerelle Azify vérifiée — prête à recevoir vos commandes COD & signaux CAPI.",
      badgeClass: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
      dotClass: "bg-sky-400",
      isDisconnected: false,
    };
  }
  return {
    label: "À vérifier",
    detail: "Cliquez sur « Tester le flux » pour valider les signaux Azify → WariTrack.",
    badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
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
      className="h-4 w-5 shrink-0 rounded-[2px] object-cover shadow-sm"
    />
  );
}

export default function AzifyFluxManager({
  workspaceId,
  team,
  allTeams,
}: AzifyFluxManagerProps) {
  const [connections, setConnections] = useState<AzifyConn[]>([]);
  const [unroutedOrders, setUnroutedOrders] = useState<ShopifyUnroutedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [azifyBusy, setAzifyBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [reconnectBusy, setReconnectBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showCodeBox, setShowCodeBox] = useState(false);
  const [codeInput, setCodeInput] = useState("");

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
          `Boutique Azify « ${payload.storeName} » (${cleanDomain}) connectée${
            payload.accountEmail ? ` via le compte ${payload.accountEmail}` : ""
          } !`
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
      setActionError("Code Azify invalide. Il doit commencer par AZIFY1:...");
      return;
    }
    await applyAzifyPayload(decoded);
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
      setNotice(`Signaux Azify envoyés pour « ${conn.shopName || conn.shopDomain} ».`);
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
        { status: "disconnected" }
      );
      setDisconnectTarget(null);
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
      await deleteDoc(
        doc(getDb(), "workspaces", workspaceId, "shopifyConnections", deleteTarget.connectionId)
      );
      setDeleteTarget(null);
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
    <div className="space-y-5">
      {azifyUnrouted.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-300">
                Commandes Azify en attente de routage pays ({azifyUnrouted.length})
              </h4>
              <p className="text-xs text-slate-300">
                Assignez ces pays à vos équipes locales pour distribuer automatiquement les commandes.
              </p>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Carte Principale Connecteur Azify Studio (indépendant de Shopify) */}
      <div className="space-y-5 rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border pb-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/15 text-brand">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">
                  Boutiques &amp; Connecteur Azify PWA Studio
                </h2>
                {myConnections.length > 0 &&
                  (gatewayOk ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Connecteur Azify actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Synchronisation à vérifier
                    </span>
                  ))}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Connectez vos boutiques Azify en 1 clic par OAuth, sélectionnez votre compte puis la boutique, et routez automatiquement les pays vers vos équipes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCodeBox((v) => !v)}
              className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-medium text-slate-300 transition hover:text-slate-100"
            >
              {showCodeBox ? "Masquer code" : "Code AZIFY1"}
            </button>
            <button
              type="button"
              disabled={azifyBusy}
              onClick={openAzifyOneClick}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:brightness-110 disabled:opacity-60"
            >
              <Zap className={`h-3.5 w-3.5 ${azifyBusy ? "animate-pulse" : ""}`} />
              <span>{azifyBusy ? "Connexion Azify…" : "Connecter Azify en 1 clic"}</span>
            </button>
          </div>
        </div>

        {showCodeBox && (
          <form
            onSubmit={handleCodeSubmit}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3"
          >
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Coller un code d'appairage Azify (AZIFY1:...)"
              className="min-w-[220px] flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={azifyBusy || !codeInput.trim()}
              className="rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              Valider le code
            </button>
          </form>
        )}

        {loading ? (
          <p className="py-6 text-center text-xs text-slate-400">
            Chargement des boutiques Azify…
          </p>
        ) : myConnections.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed border-surface-border p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Zap className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-200">
                Aucune boutique Azify connectée sur cette équipe
              </p>
              <p className="mx-auto max-w-md text-xs text-slate-400">
                Ouvrez la fenêtre d&apos;autorisation Azify, choisissez votre compte puis la boutique à synchroniser avec WariTrack.
              </p>
            </div>
            <button
              type="button"
              disabled={azifyBusy}
              onClick={openAzifyOneClick}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-slate-950 transition hover:brightness-110"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Connecter ma première boutique Azify</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myConnections.map((conn) => {
              const routes = conn.countryRoutes || {};
              const routeEntries = Object.entries(routes);
              const health = getAzifyHealth(conn);
              const iconSlug = conn.azifyStoreSlug || "azishop";

              return (
                <div
                  key={conn.id}
                  className="space-y-4 rounded-xl border border-surface-border bg-surface/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={`${AZIFY_CONNECT_ORIGIN}/api/pwa-icon/${encodeURIComponent(iconSlug)}/192`}
                        alt={conn.shopName || "Azify"}
                        className="h-9 w-9 shrink-0 rounded-lg border border-surface-border bg-white object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-slate-100">
                            {conn.shopName}
                          </h3>
                          <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                            Azify Studio
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${health.dotClass}`} />
                            {health.label}
                          </span>
                        </div>
                        <p className="truncate font-mono text-xs text-slate-400">
                          {conn.shopDomain}
                          {conn.azifyAccountEmail ? ` · Compte ${conn.azifyAccountEmail}` : ""}
                        </p>
                        <p className="text-[11px] text-slate-500">{health.detail}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {health.isDisconnected ? (
                        <button
                          type="button"
                          onClick={() => handleReconnect(conn.id)}
                          disabled={reconnectBusy === conn.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
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
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                        >
                          <Unlink className="h-3.5 w-3.5 text-amber-400" />
                          <span>Déconnecter</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={testingId === conn.id}
                        onClick={() => handleTestFlux(conn)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 text-sky-400 ${
                            testingId === conn.id ? "animate-spin" : ""
                          }`}
                        />
                        <span>Tester le flux</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddCountryModal({ connectionId: conn.id })}
                        className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>

                  {/* Routes par Pays Azify -> Équipes locales */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Routage des commandes Azify par pays
                    </span>
                    {routeEntries.length === 0 ? (
                      <p className="text-xs text-amber-400">
                        Aucun pays configuré. Ajoutez-en un ci-dessus.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {routeEntries.map(([code, r]) => {
                          const meta = getCountryMeta(code);
                          const isLocal = r.assignedTeamId === team.id;
                          const eligibleTeams = allTeams.filter(
                            (t) =>
                              (t.defaultCountry || "BJ").toUpperCase() === code.toUpperCase()
                          );

                          return (
                            <div
                              key={code}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border bg-surface-raised p-3"
                            >
                              <div className="flex items-center gap-2.5">
                                <CountryFlag code={code} />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-100">
                                      {meta.name}
                                    </span>
                                    <span className="rounded bg-surface px-1 py-0.5 font-mono text-[10px] text-slate-400">
                                      {code}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400">
                                    Assigné à :{" "}
                                    <span className="font-semibold text-slate-200">
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
                                    className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs text-slate-300 outline-none hover:border-slate-500"
                                  >
                                    <option value="" disabled>
                                      Partager à…
                                    </option>
                                    {eligibleTeams
                                      .filter((t) => t.id !== team.id)
                                      .map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.name}
                                        </option>
                                      ))}
                                    {eligibleTeams.filter((t) => t.id !== team.id).length === 0 && (
                                      <option value="" disabled>
                                        Aucune autre équipe dans ce pays
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
                                    className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
                                  >
                                    Révoquer
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

        {borrowedFlux.length > 0 && (
          <div className="space-y-3 border-t border-surface-border pt-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span>Flux Azify partagés ({borrowedFlux.length})</span>
            </h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {borrowedFlux.map((bf) => {
                const meta = getCountryMeta(bf.countryCode);
                return (
                  <div
                    key={`${bf.connection.id}-${bf.countryCode}`}
                    className="flex items-center justify-between rounded-lg border border-brand/20 bg-brand/5 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <CountryFlag code={bf.countryCode} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100">
                            {bf.connection.shopName}
                          </span>
                          <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                            {meta.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Gérée par :{" "}
                          <span className="text-slate-300">{bf.connection.ownerTeamName}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!disconnectTarget}
        title="Déconnecter cette boutique Azify ?"
        message={
          disconnectTarget
            ? `Voulez-vous mettre en pause la boutique Azify « ${disconnectTarget.shopName} » (${disconnectTarget.shopDomain}) ? Vous pourrez la reconnecter en 1 clic sans perdre votre historique.`
            : ""
        }
        confirmLabel="Déconnecter"
        danger={false}
        loading={disconnectBusy}
        onConfirm={confirmDisconnect}
        onCancel={() => setDisconnectTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer cette connexion Azify ?"
        message={
          deleteTarget
            ? `Supprimer définitivement la liaison avec la boutique Azify « ${deleteTarget.shopName} » (${deleteTarget.shopDomain}) de WariTrack ?`
            : ""
        }
        confirmLabel="Supprimer définitivement"
        danger={true}
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100">
              {confirmModal.action === "revoke"
                ? "Révoquer le partage pays"
                : "Assigner ce pays à une autre équipe"}
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">
              {confirmModal.action === "revoke" ? (
                <>
                  Reprendre les commandes Azify venant de{" "}
                  <strong>{getCountryMeta(confirmModal.countryCode).name}</strong> dans votre équipe ?
                </>
              ) : (
                <>
                  Routage des commandes Azify pour{" "}
                  <strong>{getCountryMeta(confirmModal.countryCode).name}</strong> vers{" "}
                  <strong>{confirmModal.targetTeamName}</strong> ?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={executeRouteAction}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-slate-950"
              >
                {confirmBusy ? "Traitement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addCountryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100">Ajouter un pays Azify</h3>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Choisir le pays parmi vos équipes :
              </label>
              <select
                value={selectedCountryToAdd}
                onChange={(e) => setSelectedCountryToAdd(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 outline-none"
              >
                <option value="">-- Sélectionner un pays --</option>
                {countriesWithTeams.map((c) => {
                  const meta = getCountryMeta(c);
                  return (
                    <option key={c} value={c}>
                      {meta.name} ({c})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddCountryModal(null)}
                className="rounded-xl border border-surface-border px-3 py-1.5 text-xs text-slate-400 hover:bg-surface"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!selectedCountryToAdd}
                onClick={handleAddCountry}
                className="rounded-xl bg-brand px-4 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-40"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
