import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb, ConfirmDialog, buildWhatsAppLink, openBatchPrintDialog } from "@ecomcod/shared";
import type { AppUser, CloseuseStatus, LivreurStatus, Order, Team } from "@ecomcod/shared";
import {
  Search,
  Printer,
  Box,
  Phone,
  MapPin,
  Store,
  UserCheck,
  Truck,
  AlertTriangle,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCheck,
} from "lucide-react";
import OrderReceipt3DModal from "../components/OrderReceipt3DModal";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface CommandesProps {
  workspaceId: string;
  team: Team | null;
  orders: Order[];
  closeuses: AppUser[];
  livreurs: AppUser[];
}

const PAGE_SIZE = 12;

const CLOSEUSE_LABELS: Record<CloseuseStatus, string> = {
  nouveau: "Nouveau",
  programme: "Programmé",
  en_cours: "En cours",
  livre: "Livré",
  rejete: "Rejeté",
  injoignable: "Injoignable",
  indisponible: "Indisponible",
};

const CLOSEUSE_COLORS: Record<CloseuseStatus, string> = {
  nouveau: "bg-slate-500/15 text-slate-300 border border-slate-500/25",
  programme: "bg-purple-500/15 text-purple-300 border border-purple-500/25",
  en_cours: "bg-sky-500/15 text-sky-300 border border-sky-500/25",
  livre: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
  rejete: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
  injoignable: "bg-rose-500/15 text-rose-300 border border-rose-500/25",
  indisponible: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
};

const LIVREUR_LABELS: Record<LivreurStatus, string> = {
  recu: "Reçu",
  en_route: "En route",
  livre: "Livré",
  injoignable: "Injoignable",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Commandes({ workspaceId, team, orders, closeuses, livreurs }: CommandesProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CloseuseStatus | "tous">("tous");
  const [closeuseFilter, setCloseuseFilter] = useState<string>("toutes");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const currency = team?.currency || team?.metaCapiConfig?.currency || "FCFA";

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = { tous: orders.length };
    for (const key of Object.keys(CLOSEUSE_LABELS)) map[key] = 0;
    for (const o of orders) {
      map[o.statutCloseuse] = (map[o.statutCloseuse] || 0) + 1;
    }
    return map;
  }, [orders]);

  // Comptage des commandes par numéro pour identifier les doublons et l'isolation Meta ("Accès libre site")
  const phoneStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; rejected: number; firstOrderId: string }>();
    const chronological = [...orders].sort((a, b) => a.timestamps.received - b.timestamps.received);
    for (const o of chronological) {
      const key = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
      if (!key) continue;
      const cur = map.get(key) ?? { total: 0, rejected: 0, firstOrderId: o.id };
      cur.total += 1;
      if (o.statutCloseuse === "rejete" || o.statutCloseuse === "injoignable") {
        cur.rejected += 1;
      }
      map.set(key, cur);
    }
    return map;
  }, [orders]);

  const buildSavWhatsAppMessage = (o: Order) => {
    const ref = o.shopifyData?.orderNumber || o.orderNumber ? ` (#${o.shopifyData?.orderNumber || o.orderNumber})` : "";
    if (o.statutCloseuse === "livre") {
      return `Bonjour ${o.clientName}, ici le service après-vente de la boutique concernant votre commande${ref} (${o.product}). Tout se passe-t-il bien avec votre produit ?`;
    }
    if (o.statutCloseuse === "injoignable" || o.statutCloseuse === "rejete") {
      return `Bonjour ${o.clientName}, nous avons tenté de vous joindre pour la livraison de votre commande${ref} (${o.product} — ${o.amount.toLocaleString("fr-FR")} ${currency}). Souhaitez-vous que l'on reprogramme votre livraison ?`;
    }
    return `Bonjour ${o.clientName}, ici la direction de la boutique concernant votre commande${ref} de ${o.product} (${o.amount.toLocaleString("fr-FR")} ${currency}).`;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders
      .filter((o) => (statusFilter === "tous" ? true : o.statutCloseuse === statusFilter))
      .filter((o) => (closeuseFilter === "toutes" ? true : o.closeuseId === closeuseFilter))
      .filter((o) =>
        term === ""
          ? true
          : o.clientName.toLowerCase().includes(term) ||
            o.clientPhoneFormatted.toLowerCase().includes(term) ||
            (o.product || "").toLowerCase().includes(term) ||
            String(o.shopifyData?.orderNumber || "").includes(term)
      )
      .sort((a, b) => b.timestamps.received - a.timestamps.received);
  }, [orders, search, statusFilter, closeuseFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // État de sélection groupée (Batch actions)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [batchAssigning, setBatchAssigning] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const allPageSelected = pageItems.length > 0 && pageItems.every((o) => selectedOrderIds.has(o.id));

  const toggleSelectAllPage = () => {
    const next = new Set(selectedOrderIds);
    if (allPageSelected) {
      pageItems.forEach((o) => next.delete(o.id));
    } else {
      pageItems.forEach((o) => next.add(o.id));
    }
    setSelectedOrderIds(next);
  };

  const toggleOrderSelect = (orderId: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    setSelectedOrderIds(next);
  };

  const selectedOrdersList = useMemo(() => {
    return orders.filter((o) => selectedOrderIds.has(o.id));
  }, [orders, selectedOrderIds]);

  const selectedOrdersTotal = useMemo(() => {
    return selectedOrdersList.reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [selectedOrdersList]);

  const handleBatchAssignLivreur = async (livreurId: string) => {
    if (!livreurId || selectedOrderIds.size === 0) return;
    const targetLivreur = livreurs.find((l) => l.id === livreurId);
    const livreurName = targetLivreur?.name || "Livreur";
    setBatchAssigning(true);
    setBatchNotice(null);
    try {
      const db = getDb();
      const count = selectedOrderIds.size;
      const updates = Array.from(selectedOrderIds).map((orderId) =>
        updateDoc(doc(db, "workspaces", workspaceId, "orders", orderId), {
          livreurId,
          assignedLivreurName: livreurName,
          statutLivreur: "recu",
          "timestamps.dispatched": Date.now(),
        })
      );
      await Promise.all(updates);
      setBatchNotice(`${count} commande(s) assignée(s) avec succès à ${livreurName}.`);
      setSelectedOrderIds(new Set());
      setTimeout(() => setBatchNotice(null), 4500);
    } catch (err) {
      const f = formatFirebaseError(err);
      setBatchNotice(`Erreur : ${f.message}`);
    } finally {
      setBatchAssigning(false);
    }
  };

  const nameFor = (userId: string | null, list: AppUser[]) =>
    userId ? list.find((u) => u.id === userId)?.name ?? "—" : "—";

  const updateOrder = async (orderId: string, data: Partial<Order>) => {
    const db = getDb();
    await updateDoc(doc(db, "workspaces", workspaceId, "orders", orderId), data as Record<string, unknown>);
  };

  if (!team) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 text-center">
        <p className="text-sm text-slate-400">Sélectionnez d'abord un marché en haut de page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Tabs Bar (Shopify-style quick filters) */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-surface-border bg-surface-raised p-1.5">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("tous");
            setPage(1);
          }}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            statusFilter === "tous"
              ? "bg-brand text-white shadow-sm"
              : "text-slate-400 hover:bg-surface hover:text-slate-200"
          }`}
        >
          <span>Toutes</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
              statusFilter === "tous" ? "bg-white/20 text-white" : "bg-surface text-slate-500"
            }`}
          >
            {statusCounts.tous || 0}
          </span>
        </button>

        {(Object.keys(CLOSEUSE_LABELS) as CloseuseStatus[]).map((s) => {
          const active = statusFilter === s;
          const count = statusCounts[s] || 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "text-slate-400 hover:bg-surface hover:text-slate-200"
              }`}
            >
              <span>{CLOSEUSE_LABELS[s]}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                  active
                    ? "bg-white/20 text-white"
                    : s === "nouveau" && count > 0
                      ? "bg-amber-500/20 text-amber-400 font-semibold"
                      : "bg-surface text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Operator Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un client, téléphone, produit ou #commande…"
            className="w-full rounded-xl border border-surface-border bg-surface-raised py-2 pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-3 py-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={closeuseFilter}
            onChange={(e) => {
              setCloseuseFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-xs font-medium text-slate-200 outline-none"
          >
            <option value="toutes" className="bg-surface-raised">
              Toutes les closeuses
            </option>
            {closeuses.map((c) => (
              <option key={c.id} value={c.id} className="bg-surface-raised">
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {batchNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 shadow-sm animate-in fade-in">
          <CheckCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{batchNotice}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        {pageItems.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-300">Aucune commande trouvée</p>
            <p className="mt-1 text-xs text-slate-500">
              Modifiez vos filtres ou recherchez un autre terme.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      title="Sélectionner toutes les commandes de cette page"
                      className="h-4 w-4 rounded border-surface-border bg-surface accent-brand cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Client & Produit</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Closeuse / Livreur</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Reçue</th>
                  <th className="px-4 py-3 text-right">Bon 3D</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {pageItems.map((order) => {
                  const phoneKey = (order.clientPhoneFormatted || order.clientPhoneRaw || "").trim();
                  const pStats = phoneStatsMap.get(phoneKey);
                  const isDup =
                    Boolean(order.isDuplicatePhone || order.capiIsolated) ||
                    Boolean(pStats && pStats.total > 1 && pStats.firstOrderId !== order.id);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelected(order)}
                      className={`group cursor-pointer transition-colors ${
                        selectedOrderIds.has(order.id) ? "bg-brand/10 hover:bg-brand/15" : "hover:bg-surface/60"
                      }`}
                    >
                      <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(order.id)}
                          onChange={() => toggleOrderSelect(order.id)}
                          className="h-4 w-4 rounded border-surface-border bg-surface accent-brand cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-100">{order.clientName}</span>
                          {order.shopifyData?.orderNumber && (
                            <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand">
                              #{order.shopifyData.orderNumber}
                            </span>
                          )}

                          {/* Badge d'Attribution & Canal */}
                          {order.trafficSource === "meta_ads" && (
                            <span
                              title={`Attribué Meta Ads · fbc: ${order.shopifyData?.fbc || "oui"} · fbp: ${order.shopifyData?.fbp || "oui"} (Éligible Meta CAPI)`}
                              className="inline-flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300"
                            >
                              🎯 Meta Ads
                            </span>
                          )}
                          {order.trafficSource === "tiktok_ads" && (
                            <span
                              title={`Attribué TikTok Ads · ttclid: ${order.shopifyData?.ttclid || "oui"} (Isolé de Meta CAPI)`}
                              className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300"
                            >
                              🎵 TikTok Ads
                            </span>
                          )}
                          {order.trafficSource === "google_ads" && (
                            <span
                              title={`Attribué Google Ads · gclid: ${order.shopifyData?.gclid || "oui"} (Isolé de Meta CAPI)`}
                              className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300"
                            >
                              🔍 Google Ads
                            </span>
                          )}
                          {order.trafficSource === "organique" && !isDup && (
                            <span
                              title="Trafic organique / Hors campagne (SEO, direct ou bouche-à-oreille sans clic publicitaire). Isolé de Meta CAPI pour préserver votre budget."
                              className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300"
                            >
                              🌿 Organique · Hors Campagne
                            </span>
                          )}
                          {isDup && (
                            <span
                              title="Numéro doublon : isolé du tracking Meta CAPI et comptabilisé en Accès libre site. Vérifier avec le client s'il souhaite 1 ou 2 produits."
                              className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400"
                            >
                              🔄 Doublon N° ({pStats?.total ?? 2}x) · Accès libre site
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-slate-500">
                          {order.product || "Article standard"}
                        </p>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-300 tabular-nums">{order.clientPhoneFormatted}</span>
                          {order.clientPhoneFormatted && order.clientPhoneFormatted !== "Non renseigné" && (
                            <a
                              href={buildSavWhatsAppMessage ? buildWhatsAppLink(order.clientPhoneFormatted, buildSavWhatsAppMessage(order)) : "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Écrire au client sur WhatsApp (SAV / Relance)"
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
                            >
                              <WhatsAppIcon size={22} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-slate-200">
                        {order.amount.toLocaleString("fr-FR")}{" "}
                        <span className="text-[11px] font-normal text-slate-500">{currency}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-slate-300">{nameFor(order.closeuseId, closeuses)}</div>
                        {order.livreurId && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                            <Truck className="h-3 w-3" />
                            <span>{nameFor(order.livreurId, livreurs)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${CLOSEUSE_COLORS[order.statutCloseuse]}`}
                          >
                            {CLOSEUSE_LABELS[order.statutCloseuse]}
                          </span>
                          {order.rejectionReason && (
                            <span className="text-[10px] text-slate-400">Motif : {order.rejectionReason}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-500">
                        {formatDate(order.timestamps.received)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setReceiptOrder(order)}
                          title="Ouvrir le Bon de Livraison 3D & Imprimer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-brand/50 hover:text-brand"
                        >
                          <Box className="h-3.5 w-3.5 text-brand" />
                          <span className="hidden sm:inline">Bon 3D</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-border px-4 py-3 text-xs text-slate-500">
            <span>
              Page <strong className="text-slate-300">{page}</strong> sur {totalPages} — {filtered.length} commande
              {filtered.length > 1 ? "s" : ""}
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-slate-300 hover:bg-surface-border/40 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Précédent
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-slate-300 hover:bg-surface-border/40 disabled:opacity-40"
              >
                Suivant
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barre d'actions groupées flottante (Batch Operations) */}
      {selectedOrderIds.size > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-xs font-bold text-white shadow-sm">
              {selectedOrderIds.size}
            </span>
            <div>
              <p className="text-xs font-bold text-slate-100">
                {selectedOrderIds.size} commande{selectedOrderIds.size > 1 ? "s" : ""} sélectionnée{selectedOrderIds.size > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-slate-400">
                Total à percevoir : <strong className="text-emerald-400 tabular-nums">{selectedOrdersTotal.toLocaleString("fr-FR")} {currency}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bouton Impression Groupée */}
            <button
              type="button"
              onClick={() => openBatchPrintDialog(selectedOrdersList, team)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:opacity-95 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimer {selectedOrderIds.size} bordereaux (80mm)</span>
            </button>

            {/* Assigner en masse à un livreur */}
            <div className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-2.5 py-1.5">
              <Truck className="h-3.5 w-3.5 text-slate-400" />
              <select
                disabled={batchAssigning}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchAssignLivreur(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer"
              >
                <option value="" disabled className="bg-slate-900">
                  {batchAssigning ? "Assignation en cours..." : "Assigner au livreur…"}
                </option>
                {livreurs.map((l) => (
                  <option key={l.id} value={l.id} className="bg-slate-900">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bouton Tout désélectionner */}
            <button
              type="button"
              onClick={() => setSelectedOrderIds(new Set())}
              className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {selected && (
        <OrderDetail
          order={selected}
          currency={currency}
          closeuses={closeuses}
          livreurs={livreurs}
          onClose={() => setSelected(null)}
          onOpenReceipt3D={() => {
            const ord = selected;
            setSelected(null);
            setReceiptOrder(ord);
          }}
          onSave={async (data) => {
            await updateOrder(selected.id, data);
            setSelected((prev) => (prev ? { ...prev, ...data } : prev));
          }}
        />
      )}

      {receiptOrder && (
        <OrderReceipt3DModal
          order={receiptOrder}
          team={team}
          closeuses={closeuses}
          livreurs={livreurs}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
}

function OrderDetail({
  order,
  currency,
  closeuses,
  livreurs,
  onClose,
  onOpenReceipt3D,
  onSave,
}: {
  order: Order;
  currency: string;
  closeuses: AppUser[];
  livreurs: AppUser[];
  onClose: () => void;
  onOpenReceipt3D: () => void;
  onSave: (data: Partial<Order>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [clientName, setClientName] = useState(order.clientName);
  const [amount, setAmount] = useState(String(order.amount));
  const [closeuseId, setCloseuseId] = useState(order.closeuseId ?? "");
  const [livreurId, setLivreurId] = useState(order.livreurId ?? "");
  const [overrideStatus, setOverrideStatus] = useState<CloseuseStatus>(order.statutCloseuse);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const runSave = async (data: Partial<Order>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(data);
      after?.();
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = () => {
    const newAmount = Number(amount) || 0;
    const newName = clientName.trim();
    if (newAmount !== order.amount) {
      setConfirmAction({
        title: "Modifier le montant de la commande ?",
        message: `Le montant passera de ${order.amount.toLocaleString("fr-FR")} ${currency} à ${newAmount.toLocaleString("fr-FR")} ${currency}. Cette modification impactera directement le calcul du chiffre d'affaires.`,
        confirmLabel: "Valider le nouveau montant",
        danger: false,
        onConfirm: async () => {
          setConfirmAction(null);
          await runSave({ clientName: newName, amount: newAmount }, () => setEditing(false));
        },
      });
      return;
    }
    runSave({ clientName: newName, amount: newAmount }, () => setEditing(false));
  };

  const handleAssign = () => {
    const nextCloseuse = closeuseId || null;
    const nextLivreur = livreurId || null;
    const isReassigningCloseuse = !!order.closeuseId && order.closeuseId !== nextCloseuse;
    const isReassigningLivreur = !!order.livreurId && order.livreurId !== nextLivreur;

    if (isReassigningCloseuse || isReassigningLivreur) {
      setConfirmAction({
        title: "Confirmer la réassignation ?",
        message:
          "Cette commande est déjà attribuée à un opérateur. Le changement transférera le suivi et les futures commissions au nouvel opérateur sélectionné.",
        confirmLabel: "Confirmer le transfert",
        danger: false,
        onConfirm: async () => {
          setConfirmAction(null);
          await runSave({ closeuseId: nextCloseuse, livreurId: nextLivreur });
        },
      });
      return;
    }

    runSave({
      closeuseId: nextCloseuse,
      livreurId: nextLivreur,
    });
  };

  const handleOverride = () => {
    if (overrideStatus === order.statutCloseuse) return;
    const isFinal = overrideStatus === "livre" || overrideStatus === "rejete" || overrideStatus === "injoignable";
    setConfirmAction({
      title: `Forcer le statut « ${CLOSEUSE_LABELS[overrideStatus]} » ?`,
      message: isFinal
        ? `Attention : passer cette commande en statut final « ${CLOSEUSE_LABELS[overrideStatus]} » met à jour les statistiques définitives, déclenche le calcul des commissions / événements Meta CAPI et programme sa purge.`
        : `Le statut de la commande passera de « ${CLOSEUSE_LABELS[order.statutCloseuse]} » à « ${CLOSEUSE_LABELS[overrideStatus]} ».`,
      confirmLabel: "Forcer le statut",
      danger: true,
      onConfirm: async () => {
        setConfirmAction(null);
        await runSave({
          statutCloseuse: overrideStatus,
          statutAdminOverride: overrideStatus,
        });
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Détail de la commande</h2>
            <p className="font-mono text-xs text-slate-500">
              {order.shopifyData?.orderNumber ? `#${order.shopifyData.orderNumber}` : `ID: ${order.id.slice(0, 10)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenReceipt3D}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/25"
            >
              <Printer className="h-3.5 w-3.5" />
              Bon 3D / Imprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border p-1.5 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Infos client */}
        <div className="mb-4 space-y-2.5 rounded-xl border border-surface-border bg-surface/40 p-4">
          {editing ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Nom du client</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Montant ({currency})</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-lg border border-surface-border py-2 text-xs font-medium text-slate-300"
                >
                  Annuler
                </button>
                <button
                  disabled={busy}
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </>
          ) : (
            <>
              <Row label="Client" value={order.clientName} />
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500">Téléphone</span>
                <span className="flex items-center gap-2 font-medium text-slate-200">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span className="tabular-nums">{order.clientPhoneFormatted}</span>
                  {order.clientPhoneFormatted && order.clientPhoneFormatted !== "Non renseigné" && (
                    <a
                      href={buildWhatsAppLink(
                        order.clientPhoneFormatted,
                        `Bonjour ${order.clientName}, ici le service client de la boutique concernant votre commande (${order.product}).`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 py-0.5 pl-1 pr-2.5 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                    >
                      <WhatsAppIcon size={18} />
                      <span>WhatsApp SAV</span>
                    </a>
                  )}
                </span>
              </div>
              <Row label="Produit" value={order.product} />
              <Row label="Montant" value={`${order.amount.toLocaleString("fr-FR")} ${currency}`} />
              <Row label="Reçue le" value={formatDate(order.timestamps.received)} />
              {order.sourceType === "shopify" && (
                <Row
                  label="Source"
                  value={`Shopify (${order.shopifyData?.shopDomain || ""})`}
                  icon={<Store className="h-3.5 w-3.5 text-brand" />}
                />
              )}
              {order.shopifyData?.locationHint && (
                <Row
                  label="Localisation"
                  value={order.shopifyData.locationHint}
                  icon={<MapPin className="h-3.5 w-3.5 text-amber-400" />}
                />
              )}
              {order.shopifyData?.noteAttributes && order.shopifyData.noteAttributes.length > 0 && (
                <div className="mt-2 space-y-1.5 rounded-lg border border-surface-border bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Attributs Formulaire COD
                  </p>
                  {order.shopifyData.noteAttributes.map((attr, idx) => (
                    <div key={idx} className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-500">{attr.name}</span>
                      <span className="font-medium text-slate-200 text-right">{attr.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Attribution & Tracking Réel Multi-Canaux */}
              <div className="mt-2 space-y-2 rounded-lg border border-surface-border bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Attribution & Canal Publicitaire
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                      order.trafficSource === "meta_ads"
                        ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                        : order.trafficSource === "tiktok_ads"
                        ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        : order.trafficSource === "google_ads"
                        ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                        : order.trafficSource === "acces_libre_site"
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {order.trafficSource === "meta_ads"
                      ? "🎯 Meta Ads"
                      : order.trafficSource === "tiktok_ads"
                      ? "🎵 TikTok Ads"
                      : order.trafficSource === "google_ads"
                      ? "🔍 Google Ads"
                      : order.trafficSource === "acces_libre_site"
                      ? "🔄 Accès Libre Site (Doublon)"
                      : "🌿 Organique / Hors Campagne"}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-2 text-slate-400">
                    <span>Statut Meta CAPI :</span>
                    <span className={order.capiIsolated ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
                      {order.capiIsolated ? "Isolé du Pixel (Non envoyé à Meta)" : "Éligible Meta CAPI (Purchase / Confirmé)"}
                    </span>
                  </div>

                  {order.shopifyData?.fbc && (
                    <div className="flex justify-between gap-2 text-slate-400">
                      <span className="font-mono text-[11px]">_fbc (Clic Meta) :</span>
                      <span className="font-mono text-[11px] text-indigo-300 truncate max-w-[180px]">{order.shopifyData.fbc}</span>
                    </div>
                  )}

                  {order.shopifyData?.fbp && (
                    <div className="flex justify-between gap-2 text-slate-400">
                      <span className="font-mono text-[11px]">_fbp (Pixel navigateur) :</span>
                      <span className="font-mono text-[11px] text-slate-300 truncate max-w-[180px]">{order.shopifyData.fbp}</span>
                    </div>
                  )}

                  {order.shopifyData?.ttclid && (
                    <div className="flex justify-between gap-2 text-slate-400">
                      <span className="font-mono text-[11px]">ttclid (TikTok Clic) :</span>
                      <span className="font-mono text-[11px] text-rose-300 truncate max-w-[180px]">{order.shopifyData.ttclid}</span>
                    </div>
                  )}

                  {order.shopifyData?.utm?.source && (
                    <div className="flex justify-between gap-2 text-slate-400">
                      <span>Source UTM :</span>
                      <span className="font-medium text-slate-200">{order.shopifyData.utm.source}</span>
                    </div>
                  )}

                  {order.shopifyData?.utm?.campaign && (
                    <div className="flex justify-between gap-2 text-slate-400">
                      <span>Campagne :</span>
                      <span className="font-medium text-slate-200">{order.shopifyData.utm.campaign}</span>
                    </div>
                  )}
                </div>
              </div>
              {order.statutLivreur && <Row label="Statut livreur" value={LIVREUR_LABELS[order.statutLivreur]} />}
              <button
                onClick={() => setEditing(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Modifier les informations
              </button>
            </>
          )}
        </div>

        {/* Assignation */}
        <div className="mb-4 space-y-3 rounded-xl border border-surface-border bg-surface/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <UserCheck className="h-3.5 w-3.5 text-brand" />
            <span>Assignation Opérationnelle</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Closeuse</label>
              <select
                value={closeuseId}
                onChange={(e) => setCloseuseId(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
              >
                <option value="">Non assignée</option>
                {closeuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Livreur</label>
              <select
                value={livreurId}
                onChange={(e) => setLivreurId(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
              >
                <option value="">Non assigné</option>
                {livreurs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            disabled={busy}
            onClick={handleAssign}
            className="w-full rounded-lg bg-brand py-2 text-xs font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
          >
            Enregistrer l'assignation
          </button>
        </div>

        {/* Admin override */}
        <div className="space-y-2.5 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-400">Correction Statut Admin</h3>
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${CLOSEUSE_COLORS[order.statutCloseuse]}`}>
              {CLOSEUSE_LABELS[order.statutCloseuse]}
            </span>
          </div>
          <div className="flex gap-2">
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value as CloseuseStatus)}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-rose-400"
            >
              {(Object.keys(CLOSEUSE_LABELS) as CloseuseStatus[]).map((s) => (
                <option key={s} value={s}>
                  {CLOSEUSE_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={handleOverride}
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              Appliquer
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={!!confirmAction}
          title={confirmAction?.title ?? ""}
          message={confirmAction?.message ?? ""}
          confirmLabel={confirmAction?.confirmLabel ?? "Confirmer"}
          danger={confirmAction?.danger}
          loading={busy}
          onConfirm={() => confirmAction?.onConfirm()}
          onCancel={() => setConfirmAction(null)}
        />
      </div>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-slate-200 text-right">
        {icon}
        <span>{value}</span>
      </span>
    </div>
  );
}
