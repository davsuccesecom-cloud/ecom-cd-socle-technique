import { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
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

function getCountryMeta(code: string) {
  const found = AFRICA_COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  if (found) return found;

  // Calcul emoji drapeau de secours
  const flag = code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
  return { code: code.toUpperCase(), name: code.toUpperCase(), flag };
}

export default function ShopifyFluxManager({
  workspaceId,
  team,
  allTeams,
}: ShopifyFluxManagerProps) {
  const [connections, setConnections] = useState<ShopifyConnection[]>([]);
  const [unroutedOrders, setUnroutedOrders] = useState<ShopifyUnroutedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newShopInput, setNewShopInput] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Confirm Route Modal
  const [confirmModal, setConfirmModal] = useState<{
    connectionId: string;
    shopDomain: string;
    countryCode: string;
    targetTeamId: string;
    targetTeamName: string;
    action: "assign" | "revoke";
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Add Country Route Modal
  const [addCountryModal, setAddCountryModal] = useState<{ connectionId: string } | null>(null);
  const [selectedCountryToAdd, setSelectedCountryToAdd] = useState("BJ");

  // Copy feedback
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = "https://us-central1-meta-capi-app.cloudfunctions.net/shopifyWebhook";
  const trackerScriptSnippet = `<script src="https://us-central1-meta-capi-app.cloudfunctions.net/getStorefrontTrackerScript" async></script>`;

  // 1. Écouter les connexions Shopify du workspace
  useEffect(() => {
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const list: ShopifyConnection[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<ShopifyConnection, "id">) });
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
        list.push({ id: d.id, ...(d.data() as Omit<ShopifyUnroutedOrder, "id">) });
      });
      setUnroutedOrders(list);
    });

    return () => unsub();
  }, [workspaceId]);

  // Flux administrés par l'équipe active
  const ownedConnections = connections.filter(
    (c) => c.ownerTeamId === team.id && c.status === "active"
  );

  // Flux empruntés : créés par une autre équipe, mais où un pays est assigné à l'équipe active
  const borrowedFluxList: {
    connection: ShopifyConnection;
    countryCode: string;
    route: ShopifyCountryRoute;
  }[] = [];

  connections.forEach((c) => {
    if (c.ownerTeamId !== team.id && c.status === "active" && c.countryRoutes) {
      Object.entries(c.countryRoutes).forEach(([countryCode, route]) => {
        if (route.assignedTeamId === team.id && route.status === "active") {
          borrowedFluxList.push({ connection: c, countryCode, route });
        }
      });
    }
  });

  // Ajouter une nouvelle boutique Shopify
  const handleAddShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    let domain = newShopInput.trim().toLowerCase();
    if (!domain) return;
    if (!domain.includes(".")) {
      domain = `${domain}.myshopify.com`;
    }
    domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    setAddBusy(true);
    setAddError(null);

    try {
      const db = getDb();
      const connectionId = domain.replace(/[^a-z0-9]/g, "_");

      // Route par défaut vers l'équipe créatrice pour son propre pays
      const defaultCode = team.defaultCountry || "TG";
      const initialRoutes: Record<string, ShopifyCountryRoute> = {
        [defaultCode]: {
          countryCode: defaultCode,
          assignedTeamId: team.id,
          assignedTeamName: team.name,
          assignedAt: Date.now(),
          status: "active",
        },
      };

      const connDoc: ShopifyConnection = {
        id: connectionId,
        workspaceId,
        ownerTeamId: team.id,
        ownerTeamName: team.name,
        shopDomain: domain,
        shopName: domain.replace(".myshopify.com", ""),
        status: "active",
        connectedAt: Date.now(),
        countryRoutes: initialRoutes,
      };

      await setDoc(
        doc(db, "workspaces", workspaceId, "shopifyConnections", connectionId),
        connDoc
      );

      setNewShopInput("");
      setShowAddModal(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setAddBusy(false);
    }
  };

  // Déconnecter / Supprimer une boutique
  const handleDisconnectShop = async (connectionId: string, shopDomain: string) => {
    if (!window.confirm(`Voulez-vous vraiment déconnecter la boutique ${shopDomain} ? Les webhooks entrants pour cette boutique cesseront d'être traités.`)) {
      return;
    }
    const db = getDb();
    await deleteDoc(doc(db, "workspaces", workspaceId, "shopifyConnections", connectionId));
  };

  // Exécuter l'assignation / révocation d'une route pays
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
        // Révocation : revient sous l'équipe propriétaire
        const conn = connections.find((c) => c.id === confirmModal.connectionId);
        const ownerName = conn?.ownerTeamName || team.name;

        await updateDoc(connRef, {
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamId`]: team.id,
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamName`]: ownerName,
          [`countryRoutes.${confirmModal.countryCode}.assignedAt`]: Date.now(),
          [`countryRoutes.${confirmModal.countryCode}.status`]: "active",
        });
      } else {
        // Assignation à une équipe
        await updateDoc(connRef, {
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamId`]: confirmModal.targetTeamId,
          [`countryRoutes.${confirmModal.countryCode}.assignedTeamName`]: confirmModal.targetTeamName,
          [`countryRoutes.${confirmModal.countryCode}.assignedAt`]: Date.now(),
          [`countryRoutes.${confirmModal.countryCode}.status`]: "active",
        });

        // Nettoyer d'éventuelles commandes non routées pour ce pays
        const pendingForCountry = unroutedOrders.filter(
          (u) =>
            u.connectionId === confirmModal.connectionId &&
            u.countryCode.toUpperCase() === confirmModal.countryCode.toUpperCase()
        );
        for (const unrouted of pendingForCountry) {
          // Déplacer la commande vers la bonne équipe
          await updateDoc(
            doc(db, "workspaces", workspaceId, "orders", unrouted.shopifyOrderId),
            {
              teamId: confirmModal.targetTeamId,
              isUnrouted: false,
            }
          );
          // Supprimer du panier non routé
          await deleteDoc(
            doc(db, "workspaces", workspaceId, "shopifyUnroutedOrders", unrouted.id)
          );
        }
      }

      setConfirmModal(null);
    } catch (err) {
      alert("Erreur lors de la mise à jour de la route : " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setConfirmBusy(false);
    }
  };

  // Ajouter un nouveau pays à une boutique
  const handleAddCountryRoute = async () => {
    if (!addCountryModal) return;
    const db = getDb();
    const countryCode = selectedCountryToAdd.toUpperCase();
    const connRef = doc(
      db,
      "workspaces",
      workspaceId,
      "shopifyConnections",
      addCountryModal.connectionId
    );

    await updateDoc(connRef, {
      [`countryRoutes.${countryCode}`]: {
        countryCode,
        assignedTeamId: team.id,
        assignedTeamName: team.name,
        assignedAt: Date.now(),
        status: "active",
      },
    });

    setAddCountryModal(null);
  };

  const copyToClipboard = (text: string, type: "script" | "webhook") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛍️</span>
            <h3 className="text-base font-bold text-slate-100">
              Flux Shopify & Multi-Boutiques
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Connectez vos boutiques Shopify, capturez le tracking réel et partagez les flux de commandes par pays entre vos équipes.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          + Connecter une boutique Shopify
        </button>
      </div>

      {/* Alerte Commandes non routées */}
      {unroutedOrders.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-200">
                {unroutedOrders.length} commande(s) Shopify en attente d'assignation pays
              </h4>
              <p className="mt-0.5 text-xs text-amber-300/80">
                Des commandes sont arrivées pour des pays qui ne sont pas encore configurés dans vos routes.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from(new Set(unroutedOrders.map((u) => u.countryCode))).map((code) => {
                  const meta = getCountryMeta(code);
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-100"
                    >
                      <span>{meta.flag}</span>
                      <span>{meta.name} ({code})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1 : BOUTIQUES ADMINISTRÉES PAR L'ÉQUIPE (PROPRIÉTAIRE DU FLUX) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span>👑</span> Boutiques administrées par {team.name}
            <span className="rounded-full bg-surface-border px-2 py-0.5 text-xs text-slate-400">
              {ownedConnections.length}
            </span>
          </h4>
        </div>

        {ownedConnections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/40 p-6 text-center">
            <p className="text-xs text-slate-400">
              Cette équipe n'administre aucune boutique Shopify pour le moment.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2.5 text-xs font-medium text-brand hover:underline"
            >
              Connecter la première boutique Shopify →
            </button>
          </div>
        ) : (
          ownedConnections.map((conn) => {
            const routes = Object.values(conn.countryRoutes || {});

            return (
              <div
                key={conn.id}
                className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised transition-all"
              >
                {/* Carte Boutique Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border bg-surface/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      🏪
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100">
                          {conn.shopDomain}
                        </span>
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          Admin du flux
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Connecté le {new Date(conn.connectedAt).toLocaleDateString("fr-FR")} · {routes.length} route(s) pays
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => setAddCountryModal({ connectionId: conn.id })}
                      className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-surface-border transition-colors"
                    >
                      + Ajouter un pays
                    </button>
                    <button
                      onClick={() => handleDisconnectShop(conn.id, conn.shopDomain)}
                      className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Déconnecter
                    </button>
                  </div>
                </div>

                {/* Grille des routes par pays */}
                <div className="p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-300">
                    Routage des commandes par pays :
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {routes.map((route) => {
                      const meta = getCountryMeta(route.countryCode);
                      const isSelf = route.assignedTeamId === team.id;
                      const assignedTeam = allTeams.find((t) => t.id === route.assignedTeamId);

                      return (
                        <div
                          key={route.countryCode}
                          className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                            isSelf
                              ? "border-surface-border bg-surface/50"
                              : "border-indigo-500/30 bg-indigo-950/20"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{meta.flag}</span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-slate-200">
                                  {meta.name}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ({route.countryCode})
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {isSelf ? (
                                  <span className="text-emerald-400 font-medium">
                                    ✅ Gardé pour {team.name}
                                  </span>
                                ) : (
                                  <span className="text-indigo-400 font-medium">
                                    🔗 Partagé avec {assignedTeam?.name || route.assignedTeamName}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Sélecteur d'équipe pour délégation */}
                          <div className="flex items-center gap-1.5">
                            <select
                              value={route.assignedTeamId}
                              onChange={(e) => {
                                const newTeamId = e.target.value;
                                if (newTeamId === route.assignedTeamId) return;
                                const targetTeam = allTeams.find((t) => t.id === newTeamId);
                                setConfirmModal({
                                  connectionId: conn.id,
                                  shopDomain: conn.shopDomain,
                                  countryCode: route.countryCode,
                                  targetTeamId: newTeamId,
                                  targetTeamName: targetTeam?.name || "Équipe",
                                  action: newTeamId === team.id ? "revoke" : "assign",
                                });
                              }}
                              className="rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs text-slate-200 outline-none focus:border-brand"
                            >
                              <option value={team.id}>Garder pour {team.name}</option>
                              <optgroup label="Partager avec une autre équipe :">
                                {allTeams
                                  .filter((t) => t.id !== team.id)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      → {t.name} ({t.defaultCountry})
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Accordéon Intégration / Script */}
                  <details className="mt-4 rounded-xl border border-surface-border bg-surface/30 p-3 text-xs text-slate-400">
                    <summary className="cursor-pointer font-medium text-slate-300 hover:text-white transition-colors">
                      📋 Instructions & Code de tracking pour {conn.shopDomain}
                    </summary>
                    <div className="mt-3 space-y-3 pt-2 border-t border-surface-border">
                      <div>
                        <span className="block font-medium text-slate-300 mb-1">
                          1. URL de Webhook Shopify (Commandes → orders/create) :
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={webhookUrl}
                            className="flex-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-slate-200"
                          />
                          <button
                            onClick={() => copyToClipboard(webhookUrl, "webhook")}
                            className="rounded-lg bg-surface-border px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            {copiedWebhook ? "✓ Copié" : "Copier"}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="block font-medium text-slate-300 mb-1">
                          2. Script de Tracking Réel (à insérer dans theme.liquid ou EasySell) :
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={trackerScriptSnippet}
                            className="flex-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-slate-200"
                          />
                          <button
                            onClick={() => copyToClipboard(trackerScriptSnippet, "script")}
                            className="rounded-lg bg-surface-border px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            {copiedScript ? "✓ Copié" : "Copier"}
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Ce script capture silencieusement fbp, fbc, UTM et numéro de téléphone pour un CAPI fiable sans ralentir la boutique.
                        </p>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SECTION 2 : FLUX EMPRUNTÉS (DÉLÉGUÉS PAR D'AUTRES ÉQUIPES) */}
      <div className="space-y-4 pt-2">
        <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span>🔗</span> Flux empruntés / délégués à {team.name}
          <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-xs text-indigo-300">
            {borrowedFluxList.length}
          </span>
        </h4>

        {borrowedFluxList.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface-raised/40 p-5 text-center text-xs text-slate-500">
            Aucun flux d'une autre équipe n'est délégué à {team.name} actuellement.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {borrowedFluxList.map(({ connection, countryCode }) => {
              const meta = getCountryMeta(countryCode);
              return (
                <div
                  key={`${connection.id}-${countryCode}`}
                  className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{meta.flag}</span>
                      <span className="text-xs font-bold text-slate-100">
                        {meta.name} ({countryCode})
                      </span>
                    </div>
                    <span className="rounded-full bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                      Flux emprunté
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">
                    Boutique : <span className="font-mono text-slate-100">{connection.shopDomain}</span>
                  </p>

                  <div className="rounded-xl bg-surface/60 p-2.5 border border-surface-border text-[11px] text-slate-400 space-y-1">
                    <p>
                      👑 <span className="text-slate-300">Administré par :</span> {connection.ownerTeamName}
                    </p>
                    <p className="text-slate-500">
                      ℹ️ Votre équipe reçoit directement les commandes {meta.name} de cette boutique. La configuration globale est gérée par {connection.ownerTeamName}.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1 : CONNECTER UNE BOUTIQUE SHOPIFY */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>🛍️</span> Connecter une boutique Shopify
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Saisissez l'adresse de votre boutique Shopify. {team.name} sera désignée comme l'équipe administratrice de ce flux.
            </p>

            <form onSubmit={handleAddShopify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nom ou domaine Shopify
                </label>
                <div className="flex items-center rounded-xl border border-surface-border bg-surface px-3 py-2.5 focus-within:border-brand">
                  <input
                    type="text"
                    required
                    placeholder="ex: ma-boutique.myshopify.com"
                    value={newShopInput}
                    onChange={(e) => setNewShopInput(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-slate-100 outline-none"
                  />
                </div>
              </div>

              {addError && <p className="text-xs text-red-400">{addError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addBusy}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {addBusy ? "Connexion..." : "Connecter la boutique"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2 : CONFIRMATION D'ASSIGNATION / RÉVOCATION DE ROUTE PAYS */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setConfirmModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h3 className="text-base font-bold text-slate-100">
                {confirmModal.action === "revoke"
                  ? "Confirmer la révocation du flux"
                  : "Confirmer l'assignation du flux"}
              </h3>
            </div>

            <div className="rounded-xl bg-surface p-4 border border-surface-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pays concerné :</span>
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="text-base">
                    {getCountryMeta(confirmModal.countryCode).flag}
                  </span>
                  {getCountryMeta(confirmModal.countryCode).name} ({confirmModal.countryCode})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Boutique source :</span>
                <span className="font-mono text-slate-200">{confirmModal.shopDomain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Équipe destinataire :</span>
                <span className="font-semibold text-brand">{confirmModal.targetTeamName}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              {confirmModal.action === "revoke"
                ? `Les commandes de ce pays cesseront d'être envoyées à l'autre équipe et reviendront sous la responsabilité de ${team.name}. Cette action est réversible.`
                : `Toutes les commandes entrantes pour ce pays sur cette boutique seront automatiquement assignées à ${confirmModal.targetTeamName}. Vous pouvez révoquer cette délégation à tout moment.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={executeRouteAction}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {confirmBusy ? "Traitement..." : "Confirmer l'action"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3 : AJOUTER UN PAYS À UNE BOUTIQUE */}
      {addCountryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setAddCountryModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>🌍</span> Ajouter un pays à cette boutique
            </h3>

            <p className="text-xs text-slate-400">
              Choisissez le pays dont les commandes doivent être routées depuis cette boutique.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Sélectionner le pays
              </label>
              <select
                value={selectedCountryToAdd}
                onChange={(e) => setSelectedCountryToAdd(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-brand"
              >
                {AFRICA_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddCountryModal(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-medium text-slate-300 hover:bg-surface transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAddCountryRoute}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                Ajouter la route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
