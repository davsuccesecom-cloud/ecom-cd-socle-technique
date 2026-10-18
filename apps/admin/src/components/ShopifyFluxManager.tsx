import { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  onSnapshot,
} from "firebase/firestore";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";
import type {
  Team,
  ShopifyConnection,
  ShopifyCountryRoute,
  ShopifyUnroutedOrder,
} from "@ecomcod/shared";

interface ShopifyFluxManagerProps {
  workspaceId: string;
  team: Team;
  allTeams: Team[];
}

// Champs de preuve écrits par les fonctions serveur (webhook / script de suivi)
type ConnExtra = {
  verifyToken?: string;
  trackerVerifiedAt?: number;
  webhookVerifiedAt?: number;
  lastOrderAt?: number;
  ordersCount?: number;
};
type Conn = ShopifyConnection & ConnExtra;

const isPending = (c: ShopifyConnection) => (c.status as string) === "pending";

const generateToken = (): string => {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }
};

const timeAgo = (ts: number): string => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
};

/** État réel d'une boutique, déduit des preuves reçues (jamais d'un simple lien). */
function getShopHealth(conn: Conn): {
  label: string;
  detail: string;
  badgeClass: string;
  dotClass: string;
  needsVerification: boolean;
} {
  const DAY = 24 * 60 * 60 * 1000;
  if (isPending(conn)) {
    return {
      label: "En attente de vérification",
      detail: "Boutique non activée : aucune commande n'est importée pour le moment.",
      badgeClass: "bg-amber-500/10 text-amber-400",
      dotClass: "bg-amber-400",
      needsVerification: true,
    };
  }
  if (conn.lastOrderAt && Date.now() - conn.lastOrderAt < 2 * DAY) {
    return {
      label: "En direct",
      detail: `Dernière commande reçue ${timeAgo(conn.lastOrderAt)}.`,
      badgeClass: "bg-emerald-500/10 text-emerald-400",
      dotClass: "bg-emerald-400",
      needsVerification: false,
    };
  }
  if (conn.lastOrderAt) {
    return {
      label: "Connectée",
      detail: `Aucune commande récente (dernière ${timeAgo(conn.lastOrderAt)}).`,
      badgeClass: "bg-sky-500/10 text-sky-400",
      dotClass: "bg-sky-400",
      needsVerification: false,
    };
  }
  if (conn.webhookVerifiedAt) {
    return {
      label: "Connectée",
      detail: "Webhook validé, en attente de la première commande.",
      badgeClass: "bg-sky-500/10 text-sky-400",
      dotClass: "bg-sky-400",
      needsVerification: false,
    };
  }
  return {
    label: "Non vérifiée",
    detail: "Cette connexion n'a jamais été testée : vérifiez qu'elle reçoit bien les commandes.",
    badgeClass: "bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400",
    needsVerification: true,
  };
}

function getCountryMeta(code: string) {
  const found = AFRICA_COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  if (found) return found;

  const flag = code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
  return { code: code.toUpperCase(), name: code.toUpperCase(), flag };
}

// Logo officiel Shopify SVG
function ShopifyLogoSvg({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 109 124" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M79.294 17.514c-.37-.24-.81-.304-1.222-.178-.413.125-.74.423-.906.824l-3.328 8.077c-2.316-.764-4.81-1.185-7.464-1.185-1.929 0-3.642.274-5.267.75l-4.14-11.233c-.22-.596-.757-.999-1.387-1.042-.633-.043-1.22.28-1.516.837L40.94 48.067c-13.435 3.966-23.23 16.27-23.23 30.938 0 17.707 14.354 32.062 32.062 32.062 17.707 0 32.06-14.355 32.06-32.062 0-3.414-.54-6.697-1.53-9.76l.006-.013 1.954-13.432c.112-.773-.34-1.503-1.068-1.746l-1.9-.636z" fill="#95BF47"/>
      <path d="M78.072 17.336c-.413.126-.74.424-.906.825l-3.328 8.076c-2.316-.763-4.81-1.184-7.464-1.184-1.929 0-3.642.274-5.267.75l-4.14-11.233c-.22-.596-.757-.999-1.387-1.042-.633-.043-1.22.28-1.516.837L40.94 48.067c-1.897.56-3.69 1.306-5.367 2.22l21.902 44.593 25.105-9.875 1.48-10.17c.112-.773-.34-1.503-1.068-1.746l-1.9-.636-2.92-14.94z" fill="#5E8E3E"/>
      <path d="M54.024 14.502l-4.14-11.233c-.22-.596-.757-.999-1.387-1.042-.633-.043-1.22.28-1.516.837L40.94 48.067c-1.897.56-3.69 1.306-5.367 2.22l21.902 44.593 7.82-3.076-11.27-77.302z" fill="#3E6B27"/>
      <path d="M68.804 53.647c-.573-.393-1.344-.336-1.854.14l-8.528 7.973-5.312-3.834a1.518 1.518 0 00-2.09.289l-11.95 14.678c-.463.568-.426 1.393.088 1.918.514.524 1.336.564 1.897.095l11.173-9.339 5.378 3.882c.67.483 1.597.382 2.155-.236l9.262-10.278a1.52 1.52 0 00-.22-2.288h-.001z" fill="#FFFFFF"/>
    </svg>
  );
}

export default function ShopifyFluxManager({
  workspaceId,
  team,
  allTeams,
}: ShopifyFluxManagerProps) {
  const [connections, setConnections] = useState<ShopifyConnection[]>([]);
  const [unroutedOrders, setUnroutedOrders] = useState<ShopifyUnroutedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Assistant de configuration (Wizard)
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [shopUrlInput, setShopUrlInput] = useState("");
  const [detectedDomain, setDetectedDomain] = useState("");
  const [storeFavicon, setStoreFavicon] = useState<string | null>(null);
  const [isValidDomain, setIsValidDomain] = useState(false);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Routes configurées dans l'assistant
  const [configuredRoutes, setConfiguredRoutes] = useState<Record<string, { teamId: string; teamName: string }>>({});

  // Confirm Route Modal (assignation / révocation manuelle)
  const [confirmModal, setConfirmModal] = useState<{
    connectionId: string;
    shopDomain: string;
    countryCode: string;
    targetTeamId: string;
    targetTeamName: string;
    action: "assign" | "revoke";
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Modal d'ajout de pays sur un flux existant
  const [addCountryModal, setAddCountryModal] = useState<{ connectionId: string } | null>(null);
  const [selectedCountryToAdd, setSelectedCountryToAdd] = useState("");

  // Feedback de copie
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const webhookUrl = "https://us-central1-meta-capi-app.cloudfunctions.net/shopifyWebhook";
  const trackerScriptSnippet = `<script src="https://us-central1-meta-capi-app.cloudfunctions.net/getStorefrontTrackerScript" async></script>`;

  // 1. Écouter les connexions Shopify du workspace
  useEffect(() => {
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const list: ShopifyConnection[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ShopifyConnection);
      });
      setConnections(list);
      setLoading(false);
    });
    return () => unsub();
  }, [workspaceId]);

  // 2. Écouter les commandes non routées
  useEffect(() => {
    const db = getDb();
    const unroutedCol = collection(db, "workspaces", workspaceId, "shopifyUnroutedOrders");
    const unsub = onSnapshot(unroutedCol, (snap) => {
      const list: ShopifyUnroutedOrder[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ShopifyUnroutedOrder);
      });
      setUnroutedOrders(list);
    });
    return () => unsub();
  }, [workspaceId]);

  // Analyse et validation de l'URL Shopify
  useEffect(() => {
    const trimmed = shopUrlInput.trim().toLowerCase();
    if (!trimmed) {
      setDetectedDomain("");
      setStoreFavicon(null);
      setIsValidDomain(false);
      return;
    }

    let clean = trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean.includes(".") && !clean.includes("myshopify.com")) {
      clean = `${clean}.myshopify.com`;
    }

    const domainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.[a-z]{2,}$/i;
    const isMyshopify = clean.endsWith(".myshopify.com");

    if (domainRegex.test(clean) || isMyshopify) {
      setDetectedDomain(clean);
      setStoreFavicon(`https://www.google.com/s2/favicons?domain=${clean}&sz=64`);
      // Simple contrôle de format : la vraie vérification se fait à l'étape 4
      setIsValidDomain(true);
    } else {
      setDetectedDomain("");
      setStoreFavicon(null);
      setIsValidDomain(false);
    }
  }, [shopUrlInput]);

  // Calcul des pays où l'utilisateur possède au moins une équipe
  const countriesWithTeams = Array.from(
    new Set(allTeams.map((t) => (t.defaultCountry || "BJ").toUpperCase()))
  );

  // Copier dans le presse-papier
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Connexion en cours d'assistant (suivie en direct via Firestore)
  const wizardConnId = detectedDomain ? detectedDomain.replace(/[^a-z0-9]/gi, "_") : "";
  const wizardConn = connections.find((c) => c.id === wizardConnId) as Conn | undefined;
  const verifyUrl =
    wizardConn?.verifyToken && detectedDomain
      ? `https://${detectedDomain}/?ecomcod_verify=${wizardConn.verifyToken}`
      : "";

  const closeWizard = () => {
    setShowWizard(false);
    setWizardStep(1);
    setShopUrlInput("");
    setDetectedDomain("");
    setConfiguredRoutes({});
    setWizardError(null);
  };

  const buildRoutesToSave = (): Record<string, ShopifyCountryRoute> => {
    const routes: Record<string, ShopifyCountryRoute> = {};
    Object.entries(configuredRoutes).forEach(([countryCode, dest]) => {
      routes[countryCode] = {
        countryCode,
        assignedTeamId: dest.teamId,
        assignedTeamName: dest.teamName,
        assignedAt: Date.now(),
        status: "active",
      };
    });

    // Si aucun pays sélectionné, on initialise avec le pays de l'équipe
    const defaultCountry = (team.defaultCountry || "BJ").toUpperCase();
    if (Object.keys(routes).length === 0) {
      routes[defaultCountry] = {
        countryCode: defaultCountry,
        assignedTeamId: team.id,
        assignedTeamName: team.name,
        assignedAt: Date.now(),
        status: "active",
      };
    }
    return routes;
  };

  // Étape 2 → 3 : la boutique est créée EN ATTENTE. Elle ne devient active qu'avec une vraie preuve.
  const createPendingConnection = async () => {
    if (!detectedDomain) return;
    setWizardBusy(true);
    setWizardError(null);

    try {
      const db = getDb();
      const ref = doc(db, "workspaces", workspaceId, "shopifyConnections", wizardConnId);
      const routes = buildRoutesToSave();

      if (wizardConn) {
        if (wizardConn.ownerTeamId !== team.id) {
          throw new Error("Cette boutique est déjà connectée par une autre équipe.");
        }
        if (!isPending(wizardConn)) {
          throw new Error("Cette boutique est déjà connectée. Déconnectez-la d'abord pour la reconfigurer.");
        }
        await updateDoc(ref, { countryRoutes: routes });
      } else {
        const connDoc = {
          id: wizardConnId,
          workspaceId,
          ownerTeamId: team.id,
          ownerTeamName: team.name,
          shopDomain: detectedDomain,
          shopName: detectedDomain.replace(".myshopify.com", ""),
          status: "pending",
          connectedAt: Date.now(),
          countryRoutes: routes,
          verifyToken: generateToken(),
        } as unknown as ShopifyConnection;
        await setDoc(ref, connDoc);
      }

      setWizardStep(3);
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : "Impossible de préparer la connexion.");
    } finally {
      setWizardBusy(false);
    }
  };

  // Ouvrir la vérification d'une boutique existante (en attente ou jamais testée)
  const openVerification = async (conn: Conn) => {
    try {
      if (!conn.verifyToken) {
        await updateDoc(doc(getDb(), "workspaces", workspaceId, "shopifyConnections", conn.id), {
          verifyToken: generateToken(),
        });
      }
    } catch {
      // L'écoute en direct affichera l'état réel
    }

    const routes: Record<string, { teamId: string; teamName: string }> = {};
    Object.entries(conn.countryRoutes || {}).forEach(([code, r]) => {
      routes[code] = { teamId: r.assignedTeamId, teamName: r.assignedTeamName };
    });
    setConfiguredRoutes(routes);
    setShopUrlInput(conn.shopDomain);
    setWizardError(null);
    setWizardStep(4);
    setShowWizard(true);
  };

  // Activation : impossible tant que Shopify n'a pas réellement joint le webhook
  const handleFinalizeConnection = async () => {
    if (!wizardConn) return;
    if (!isPending(wizardConn)) {
      closeWizard();
      return;
    }
    if (!wizardConn.webhookVerifiedAt) {
      setWizardError("Aucun signal reçu de Shopify pour l'instant : le webhook doit être validé avant l'activation.");
      return;
    }

    setWizardBusy(true);
    setWizardError(null);
    try {
      await updateDoc(doc(getDb(), "workspaces", workspaceId, "shopifyConnections", wizardConn.id), {
        status: "active",
        activatedAt: Date.now(),
        verifyToken: deleteField(),
      });
      closeWizard();
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : "Erreur lors de l'activation de la boutique.");
    } finally {
      setWizardBusy(false);
    }
  };

  // Déconnecter une boutique
  const handleDisconnectShop = async (connectionId: string, shopDomain: string) => {
    if (!window.confirm(`Voulez-vous vraiment déconnecter la boutique ${shopDomain} ? Les commandes entrantes ne seront plus synchronisées.`)) {
      return;
    }
    const db = getDb();
    await deleteDoc(doc(db, "workspaces", workspaceId, "shopifyConnections", connectionId));
  };

  // Révocation ou assignation d'une route pays
  const executeRouteAction = async () => {
    if (!confirmModal) return;
    setConfirmBusy(true);

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
        const ownerName = conn?.ownerTeamName || team.name;

        await updateDoc(connRef, {
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamId`]: team.id,
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamName`]: ownerName,
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

        // Débloquer les commandes non routées associées
        const pendingForCountry = unroutedOrders.filter(
          (u) =>
            u.connectionId === confirmModal.connectionId &&
            u.countryCode.toUpperCase() === confirmModal.countryCode.toUpperCase()
        );
        for (const unrouted of pendingForCountry) {
          await updateDoc(
            doc(db, "workspaces", workspaceId, "orders", unrouted.shopifyOrderId),
            {
              teamId: confirmModal.targetTeamId,
              isUnrouted: false,
            }
          );
          await deleteDoc(
            doc(db, "workspaces", workspaceId, "shopifyUnroutedOrders", unrouted.id)
          );
        }
      }

      setConfirmModal(null);
    } catch (err) {
      alert("Erreur: " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setConfirmBusy(false);
    }
  };

  // Ajouter un pays à une boutique déjà connectée
  const handleAddCountryToConnection = async () => {
    if (!addCountryModal || !selectedCountryToAdd) return;
    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", addCountryModal.connectionId);
      const code = selectedCountryToAdd.toUpperCase();

      // Par défaut, assigner à la première équipe qui opère dans ce pays
      const matchingTeam = allTeams.find((t) => (t.defaultCountry || "BJ").toUpperCase() === code) || team;

      await updateDoc(connRef, {
        [`countryRoutes.${code}`]: {
          countryCode: code,
          assignedTeamId: matchingTeam.id,
          assignedTeamName: matchingTeam.name,
          assignedAt: Date.now(),
          status: "active",
        },
      });

      setAddCountryModal(null);
      setSelectedCountryToAdd("");
    } catch (err) {
      alert("Erreur: " + (err instanceof Error ? err.message : "Inconnue"));
    }
  };

  // Séparer les boutiques possédées et les flux empruntés
  const myConnections = connections.filter((c) => c.ownerTeamId === team.id);
  const gatewayOk = myConnections.some((c) => !isPending(c) && !!(c as Conn).webhookVerifiedAt);
  const borrowedFlux: {
    connection: ShopifyConnection;
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
      {/* Alerte commandes orphelines (pays sans équipe) */}
      {unroutedOrders.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-300">
                Commandes en attente de routage pays ({unroutedOrders.length})
              </h4>
              <p className="text-xs text-amber-200/80">
                Des commandes proviennent de pays sans route configurée. Assignez ce pays à une équipe locale pour les faire basculer instantanément.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Carte Principale de Gestion Shopify */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5E8E3E]/10 border border-[#5E8E3E]/30">
              <ShopifyLogoSvg className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Boutiques & Flux Shopify</h2>
                {myConnections.length > 0 &&
                  (gatewayOk ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Passerelle active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Passerelle non vérifiée
                    </span>
                  ))}
              </div>
              <p className="text-xs text-slate-400">
                Centralisez vos boutiques Shopify, routez les pays vers vos équipes locales et enrichissez Meta CAPI.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowWizard(true);
              setWizardStep(1);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#5E8E3E] px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-[#5E8E3E]/90 transition-all shrink-0"
          >
            <span className="text-base leading-none">+</span>
            Connecter une boutique
          </button>
        </div>

        {/* Liste des boutiques administrées */}
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-400">Chargement des connexions Shopify...</p>
        ) : myConnections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface">
              <ShopifyLogoSvg className="h-6 w-6 opacity-40" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">Aucune boutique connectée pour cette équipe</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Connectez votre première boutique Shopify en quelques clics grâce à notre assistant pas-à-pas.
              </p>
            </div>
            <button
              onClick={() => {
                setShowWizard(true);
                setWizardStep(1);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-surface border border-surface-border px-3 py-2 text-xs font-medium text-slate-200 hover:border-[#5E8E3E] transition-colors"
            >
              Lancer l'assistant de connexion
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myConnections.map((conn) => {
              const routes = conn.countryRoutes || {};
              const routeEntries = Object.entries(routes);
              const health = getShopHealth(conn as Conn);

              return (
                <div
                  key={conn.id}
                  className="rounded-xl border border-surface-border bg-surface/50 p-4 space-y-4"
                >
                  {/* Ligne En-tête de la Boutique */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${conn.shopDomain}&sz=64`}
                        alt=""
                        className="h-8 w-8 rounded-lg bg-white p-1 border border-surface-border"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-100">{conn.shopName}</h3>
                          <span
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${health.dotClass}`} />
                            {health.label}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-400">{conn.shopDomain}</p>
                        <p className="text-[11px] text-slate-500">{health.detail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {health.needsVerification && (
                        <button
                          onClick={() => openVerification(conn as Conn)}
                          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                        >
                          {isPending(conn) ? "Reprendre la vérification" : "Vérifier"}
                        </button>
                      )}
                      <button
                        onClick={() => setAddCountryModal({ connectionId: conn.id })}
                        className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                      >
                        + Ajouter un pays
                      </button>
                      <button
                        onClick={() => handleDisconnectShop(conn.id, conn.shopDomain)}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Déconnecter
                      </button>
                    </div>
                  </div>

                  {/* Routes par Pays */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Routage des commandes par pays
                    </span>

                    {routeEntries.length === 0 ? (
                      <p className="text-xs text-amber-400">Aucun pays configuré. Ajoutez-en un ci-dessus.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {routeEntries.map(([code, r]) => {
                          const meta = getCountryMeta(code);
                          const isLocal = r.assignedTeamId === team.id;
                          const eligibleTeams = allTeams.filter(
                            (t) => (t.defaultCountry || "BJ").toUpperCase() === code.toUpperCase()
                          );

                          return (
                            <div
                              key={code}
                              className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised p-3"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl leading-none">{meta.flag}</span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-100">{meta.name}</span>
                                    <span className="rounded bg-surface px-1 py-0.2 text-[10px] font-mono text-slate-400">
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
                                      const targetTeam = allTeams.find((t) => t.id === e.target.value);
                                      if (!targetTeam) return;
                                      setConfirmModal({
                                        connectionId: conn.id,
                                        shopDomain: conn.shopDomain,
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
                                      Partager à...
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
                                    onClick={() =>
                                      setConfirmModal({
                                        connectionId: conn.id,
                                        shopDomain: conn.shopDomain,
                                        countryCode: code,
                                        targetTeamId: team.id,
                                        targetTeamName: team.name,
                                        action: "revoke",
                                      })
                                    }
                                    className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
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

        {/* Section Flux Empruntés */}
        {borrowedFlux.length > 0 && (
          <div className="pt-4 border-t border-surface-border space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>Flux de commandes empruntés ({borrowedFlux.length})</span>
              <span className="text-[10px] lowercase font-normal text-slate-400">
                (Assignés par une autre équipe)
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {borrowedFlux.map((bf) => {
                const meta = getCountryMeta(bf.countryCode);
                return (
                  <div
                    key={`${bf.connection.id}-${bf.countryCode}`}
                    className="flex items-center justify-between rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl leading-none">{meta.flag}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100">{bf.connection.shopName}</span>
                          <span className="rounded bg-indigo-500/20 px-1 py-0.2 text-[10px] font-semibold text-indigo-300">
                            {meta.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Boutique gérée par : <span className="text-slate-300">{bf.connection.ownerTeamName}</span>
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

      {/* ===================================================================== */}
      {/* ASSISTANT DE CONNEXION ÉTAPE PAR ÉTAPE (WIZARD) */}
      {/* ===================================================================== */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            {/* En-tête Wizard */}
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <ShopifyLogoSvg className="h-6 w-6" />
                <h3 className="text-base font-bold text-slate-100">
                  Assistant de connexion Shopify
                </h3>
              </div>
              <button
                onClick={closeWizard}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Stepper visuel */}
            <div className="flex items-center justify-between px-2">
              {[
                { step: 1, label: "Boutique" },
                { step: 2, label: "Routage Pays" },
                { step: 3, label: "Scripts & Webhook" },
                { step: 4, label: "Validation" },
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      wizardStep === s.step
                        ? "bg-[#5E8E3E] text-white ring-4 ring-[#5E8E3E]/20"
                        : wizardStep > s.step
                        ? "bg-emerald-500 text-white"
                        : "bg-surface border border-surface-border text-slate-400"
                    }`}
                  >
                    {wizardStep > s.step ? "✓" : s.step}
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">{s.label}</span>
                </div>
              ))}
            </div>

            {/* ÉTAPE 1 : Saisie et détection du domaine */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Adresse de votre boutique Shopify
                  </label>
                  <p className="text-xs text-slate-400">
                    Saisissez votre URL complète ou votre sous-domaine (ex : ma-boutique.myshopify.com ou maboutique.com).
                  </p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={shopUrlInput}
                    onChange={(e) => setShopUrlInput(e.target.value)}
                    placeholder="ex: ma-boutique.myshopify.com"
                    className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#5E8E3E]"
                  />
                  {storeFavicon && (
                    <img
                      src={storeFavicon}
                      alt=""
                      className="absolute right-3.5 top-3.5 h-5 w-5 rounded bg-white p-0.5 border border-surface-border"
                    />
                  )}
                </div>

                {isValidDomain && (
                  <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface p-3 text-xs text-slate-300">
                    <span>🔎</span>
                    <span>
                      Adresse détectée : <strong>{detectedDomain}</strong>. Elle sera réellement testée à l'étape 4.
                    </span>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    disabled={!isValidDomain}
                    onClick={() => {
                      // Initialiser les routes par défaut
                      const defaultC = (team.defaultCountry || "BJ").toUpperCase();
                      setConfiguredRoutes({
                        [defaultC]: { teamId: team.id, teamName: team.name },
                      });
                      setWizardStep(2);
                    }}
                    className="rounded-xl bg-[#5E8E3E] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40 hover:bg-[#5E8E3E]/90 transition-all"
                  >
                    Suivant : Configurer les pays →
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 2 : Sélection et filtrage des pays */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Dans quels pays vendez-vous sur cette boutique ?
                  </label>
                  <p className="text-xs text-slate-400">
                    Seuls les pays où vous possédez déjà une équipe opérationnelle sont proposés pour garantir l'acheminement des commandes.
                  </p>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {countriesWithTeams.map((countryCode) => {
                    const meta = getCountryMeta(countryCode);
                    const isChecked = !!configuredRoutes[countryCode];
                    const localTeams = allTeams.filter(
                      (t) => (t.defaultCountry || "BJ").toUpperCase() === countryCode
                    );

                    return (
                      <div
                        key={countryCode}
                        className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                          isChecked
                            ? "border-[#5E8E3E]/50 bg-[#5E8E3E]/5"
                            : "border-surface-border bg-surface"
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const target = localTeams[0] || team;
                                setConfiguredRoutes((prev) => ({
                                  ...prev,
                                  [countryCode]: { teamId: target.id, teamName: target.name },
                                }));
                              } else {
                                setConfiguredRoutes((prev) => {
                                  const copy = { ...prev };
                                  delete copy[countryCode];
                                  return copy;
                                });
                              }
                            }}
                            className="rounded border-slate-700 text-[#5E8E3E] focus:ring-0"
                          />
                          <span className="text-lg leading-none">{meta.flag}</span>
                          <span className="text-xs font-bold text-slate-200">{meta.name}</span>
                        </label>

                        {isChecked && (
                          <select
                            value={configuredRoutes[countryCode]?.teamId || team.id}
                            onChange={(e) => {
                              const t = allTeams.find((x) => x.id === e.target.value);
                              if (t) {
                                setConfiguredRoutes((prev) => ({
                                  ...prev,
                                  [countryCode]: { teamId: t.id, teamName: t.name },
                                }));
                              }
                            }}
                            className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs text-slate-200 outline-none"
                          >
                            {localTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                Équipe : {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-dashed border-surface-border p-3 text-xs text-slate-400">
                  💡 <strong>Besoin de vendre dans un autre pays ?</strong> Créez d'abord une équipe pour ce pays dans l'application Admin afin d'y affecter vos closeuses et livreurs.
                </div>

                {wizardError && <p className="text-xs text-red-400">{wizardError}</p>}

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface"
                  >
                    ← Retour
                  </button>
                  <button
                    disabled={Object.keys(configuredRoutes).length === 0 || wizardBusy}
                    onClick={createPendingConnection}
                    className="rounded-xl bg-[#5E8E3E] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40 hover:bg-[#5E8E3E]/90 transition-all"
                  >
                    {wizardBusy ? "Préparation..." : "Suivant : Scripts d'intégration →"}
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Copie des scripts et du webhook */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Intégration Shopify & EasySell
                  </label>
                  <p className="text-xs text-slate-400">
                    Copiez ces deux éléments dans vos paramètres Shopify pour activer la transmission instantanée.
                  </p>
                </div>

                {/* Webhook */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      1. URL Webhook (Commandes Shopify)
                    </span>
                    <button
                      onClick={() => copyToClipboard(webhookUrl, "webhook")}
                      className="text-xs text-[#5E8E3E] hover:underline font-semibold"
                    >
                      {copiedKey === "webhook" ? "✓ Copié !" : "Copier"}
                    </button>
                  </div>
                  <input
                    readOnly
                    value={webhookUrl}
                    className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-mono text-slate-300 select-all"
                  />
                  <p className="text-[11px] text-slate-500">
                    Shopify Admin → Paramètres → Notifications → Webhooks → Événement: <strong>Création de commande</strong> (JSON).
                  </p>
                </div>

                {/* Tracker JS */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      2. Script de capture CAPI (Thème Shopify / EasySell)
                    </span>
                    <button
                      onClick={() => copyToClipboard(trackerScriptSnippet, "tracker")}
                      className="text-xs text-[#5E8E3E] hover:underline font-semibold"
                    >
                      {copiedKey === "tracker" ? "✓ Copié !" : "Copier"}
                    </button>
                  </div>
                  <input
                    readOnly
                    value={trackerScriptSnippet}
                    className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs font-mono text-slate-300 select-all"
                  />
                  <p className="text-[11px] text-slate-500">
                    Collez cette ligne avant la balise <code>&lt;/head&gt;</code> dans votre fichier <code>theme.liquid</code>.
                  </p>
                </div>

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface"
                  >
                    ← Retour
                  </button>
                  <button
                    onClick={() => setWizardStep(4)}
                    className="rounded-xl bg-[#5E8E3E] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#5E8E3E]/90 transition-all"
                  >
                    Vérifier la connexion →
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 4 : Vérification réelle (preuves reçues en direct) */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200">
                    Vérification réelle de la connexion
                  </label>
                  <p className="text-xs text-slate-400">
                    La boutique ne sera activée qu'après une vraie preuve reçue de Shopify. Les coches se mettent à jour en direct.
                  </p>
                </div>

                {!wizardConn ? (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                    Connexion introuvable. Revenez à l'étape 2 pour la préparer.
                  </p>
                ) : (
                  <>
                    {/* Contrôle 1 : webhook de commandes (obligatoire) */}
                    <div
                      className={`rounded-xl border p-3 space-y-1.5 ${
                        wizardConn.webhookVerifiedAt
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-surface-border bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                        <span>{wizardConn.webhookVerifiedAt ? "✅" : "⏳"}</span>
                        <span>1. Webhook de commandes {wizardConn.webhookVerifiedAt ? "reçu" : "en attente"}</span>
                        <span className="ml-auto text-[10px] font-normal text-slate-400">obligatoire</span>
                      </div>
                      {wizardConn.webhookVerifiedAt ? (
                        <p className="text-[11px] text-emerald-300/80">
                          Dernier signal de Shopify : {timeAgo(wizardConn.webhookVerifiedAt)}.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Dans Shopify : Paramètres → Notifications → Webhooks → votre webhook « Création de commande » →{" "}
                          <strong>Envoyer une notification de test</strong>. Cette notification n'est pas importée comme une commande.
                        </p>
                      )}
                    </div>

                    {/* Contrôle 2 : script de suivi (recommandé) */}
                    <div
                      className={`rounded-xl border p-3 space-y-1.5 ${
                        wizardConn.trackerVerifiedAt
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-surface-border bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                        <span>{wizardConn.trackerVerifiedAt ? "✅" : "⏳"}</span>
                        <span>2. Script de suivi {wizardConn.trackerVerifiedAt ? "détecté" : "en attente"}</span>
                        <span className="ml-auto text-[10px] font-normal text-slate-400">recommandé</span>
                      </div>
                      {wizardConn.trackerVerifiedAt ? (
                        <p className="text-[11px] text-emerald-300/80">
                          Le script tourne sur votre vraie boutique ({timeAgo(wizardConn.trackerVerifiedAt)}).
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Une fois le script collé dans <code>theme.liquid</code>, ouvrez cette adresse dans votre navigateur.
                            Le script la reconnaît et confirme l'installation.
                          </p>
                          {verifyUrl && (
                            <>
                              <input
                                readOnly
                                value={verifyUrl}
                                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-[11px] font-mono text-slate-300 select-all"
                              />
                              <div className="flex gap-3">
                                <button
                                  onClick={() => copyToClipboard(verifyUrl, "verify")}
                                  className="text-xs text-[#5E8E3E] hover:underline font-semibold"
                                >
                                  {copiedKey === "verify" ? "✓ Copié !" : "Copier"}
                                </button>
                                <a
                                  href={verifyUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-[#5E8E3E] hover:underline font-semibold"
                                >
                                  Ouvrir ↗
                                </a>
                              </div>
                            </>
                          )}
                          <p className="text-[11px] text-slate-500">
                            Si la boutique est protégée par un mot de passe, le script ne peut pas être détecté.
                          </p>
                        </>
                      )}
                    </div>

                    {isPending(wizardConn) && wizardConn.webhookVerifiedAt && !wizardConn.trackerVerifiedAt && (
                      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
                        Le script n'a pas été détecté : la boutique recevra bien les commandes, mais sans enrichissement Meta (fbp/fbc).
                      </p>
                    )}
                  </>
                )}

                {wizardError && <p className="text-xs text-red-400">{wizardError}</p>}

                <div className="pt-2 flex justify-between">
                  <button
                    onClick={() => setWizardStep(3)}
                    className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface"
                  >
                    ← Retour
                  </button>
                  <button
                    disabled={
                      wizardBusy || !wizardConn || (isPending(wizardConn) && !wizardConn.webhookVerifiedAt)
                    }
                    onClick={handleFinalizeConnection}
                    className="rounded-xl bg-[#5E8E3E] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#5E8E3E]/90 transition-all disabled:opacity-40"
                  >
                    {wizardBusy
                      ? "Activation..."
                      : wizardConn && !isPending(wizardConn)
                      ? "Terminer"
                      : "Terminer et activer la boutique"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMATION D'ASSIGNATION / RÉVOCATION */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100">
              {confirmModal.action === "revoke" ? "Révoquer l'accès au flux" : "Partager le flux de commandes"}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmModal.action === "revoke" ? (
                <>
                  Voulez-vous révoquer l'accès de l'équipe pour les commandes venant de{" "}
                  <strong>{getCountryMeta(confirmModal.countryCode).name}</strong> ? Les futures commandes reviendront sous l'administration directe de votre équipe.
                </>
              ) : (
                <>
                  Voulez-vous assigner le flux des commandes de{" "}
                  <strong>{getCountryMeta(confirmModal.countryCode).name}</strong> à l'équipe{" "}
                  <strong>{confirmModal.targetTeamName}</strong> ? Leurs closeuses et livreurs traiteront ces commandes.
                </>
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface"
              >
                Annuler
              </button>
              <button
                disabled={confirmBusy}
                onClick={executeRouteAction}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white ${
                  confirmModal.action === "revoke"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-[#5E8E3E] hover:bg-[#5E8E3E]/90"
                }`}
              >
                {confirmBusy ? "Traitement..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJOUT RAPIDE D'UN PAYS SUR UNE BOUTIQUE EXISTANTE */}
      {addCountryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100">Ajouter un pays de vente</h3>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Choisir le pays parmi vos équipes :</label>
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
                      {meta.flag} {meta.name} ({c})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAddCountryModal(null)}
                className="rounded-xl border border-surface-border px-3 py-1.5 text-xs text-slate-400 hover:bg-surface"
              >
                Annuler
              </button>
              <button
                disabled={!selectedCountryToAdd}
                onClick={handleAddCountryToConnection}
                className="rounded-xl bg-[#5E8E3E] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
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
