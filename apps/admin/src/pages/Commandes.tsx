import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { AppUser, CloseuseStatus, LivreurStatus, Order, Team } from "@ecomcod/shared";

interface CommandesProps {
  workspaceId: string;
  team: Team | null;
  orders: Order[];
  closeuses: AppUser[];
  livreurs: AppUser[];
}

const PAGE_SIZE = 10;

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
  nouveau: "bg-slate-500/15 text-slate-300",
  programme: "bg-accent-purple/15 text-accent-purple",
  en_cours: "bg-accent-blue/15 text-accent-blue",
  livre: "bg-accent-green/15 text-accent-green",
  rejete: "bg-accent-orange/15 text-accent-orange",
  injoignable: "bg-accent-red/15 text-accent-red",
  indisponible: "bg-slate-500/15 text-slate-400",
};

const LIVREUR_LABELS: Record<LivreurStatus, string> = {
  recu: "Reçu",
  en_route: "En route",
  livre: "Livré",
  injoignable: "Injoignable",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Commandes({ workspaceId, team, orders, closeuses, livreurs }: CommandesProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CloseuseStatus | "tous">("tous");
  const [closeuseFilter, setCloseuseFilter] = useState<string>("toutes");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders
      .filter((o) => (statusFilter === "tous" ? true : o.statutCloseuse === statusFilter))
      .filter((o) => (closeuseFilter === "toutes" ? true : o.closeuseId === closeuseFilter))
      .filter((o) =>
        term === ""
          ? true
          : o.clientName.toLowerCase().includes(term) || o.clientPhoneFormatted.toLowerCase().includes(term)
      )
      .sort((a, b) => b.timestamps.received - a.timestamps.received);
  }, [orders, search, statusFilter, closeuseFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const nameFor = (userId: string | null, list: AppUser[]) =>
    userId ? list.find((u) => u.id === userId)?.name ?? "—" : "—";

  const updateOrder = async (orderId: string, data: Partial<Order>) => {
    const db = getDb();
    await updateDoc(doc(db, "workspaces", workspaceId, "orders", orderId), data as Record<string, unknown>);
  };

  if (!team) {
    return <p className="text-sm text-slate-500">Sélectionne d'abord un marché en haut de page.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher (nom, téléphone)…"
          className="min-w-[220px] flex-1 rounded-xl border border-surface-border bg-surface-raised px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CloseuseStatus | "tous");
            setPage(1);
          }}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand"
        >
          <option value="tous">Tous les statuts</option>
          {(Object.keys(CLOSEUSE_LABELS) as CloseuseStatus[]).map((s) => (
            <option key={s} value={s}>
              {CLOSEUSE_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={closeuseFilter}
          onChange={(e) => {
            setCloseuseFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand"
        >
          <option value="toutes">Toutes les closeuses</option>
          {closeuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        {pageItems.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Aucune commande ne correspond à ces filtres.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-500">
                <th className="px-4 py-3 font-normal">Client</th>
                <th className="px-4 py-3 font-normal">Téléphone</th>
                <th className="px-4 py-3 font-normal">Montant</th>
                <th className="px-4 py-3 font-normal">Closeuse</th>
                <th className="px-4 py-3 font-normal">Statut</th>
                <th className="px-4 py-3 font-normal">Reçue</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelected(order)}
                  className="cursor-pointer border-b border-surface-border last:border-0 hover:bg-surface"
                >
                  <td className="px-4 py-3 text-slate-200">{order.clientName}</td>
                  <td className="px-4 py-3 text-slate-400">{order.clientPhoneFormatted}</td>
                  <td className="px-4 py-3 text-slate-300">{order.amount.toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-3 text-slate-400">{nameFor(order.closeuseId, closeuses)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${CLOSEUSE_COLORS[order.statutCloseuse]}`}>
                      {CLOSEUSE_LABELS[order.statutCloseuse]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(order.timestamps.received)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-border px-4 py-3 text-xs text-slate-500">
            <span>
              Page {page} / {totalPages} — {filtered.length} commande{filtered.length > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-surface-border px-2.5 py-1 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-surface-border px-2.5 py-1 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <OrderDetail
          order={selected}
          closeuses={closeuses}
          livreurs={livreurs}
          onClose={() => setSelected(null)}
          onSave={async (data) => {
            await updateOrder(selected.id, data);
            setSelected((prev) => (prev ? { ...prev, ...data } : prev));
          }}
        />
      )}
    </div>
  );
}

function OrderDetail({
  order,
  closeuses,
  livreurs,
  onClose,
  onSave,
}: {
  order: Order;
  closeuses: AppUser[];
  livreurs: AppUser[];
  onClose: () => void;
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

  const runSave = async (data: Partial<Order>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(data);
      after?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = () =>
    runSave(
      { clientName: clientName.trim(), amount: Number(amount) || 0 },
      () => setEditing(false)
    );

  const handleAssign = () =>
    runSave({
      closeuseId: closeuseId || null,
      livreurId: livreurId || null,
    });

  const handleOverride = () =>
    runSave({
      statutCloseuse: overrideStatus,
      statutAdminOverride: overrideStatus,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-100">Détail de la commande</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs ${CLOSEUSE_COLORS[order.statutCloseuse]}`}>
            {CLOSEUSE_LABELS[order.statutCloseuse]}
          </span>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {/* Infos client */}
        <div className="mb-5 space-y-3 rounded-xl border border-surface-border p-4">
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
                <label className="mb-1 block text-xs text-slate-500">Montant (FCFA)</label>
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
                  className="flex-1 rounded-lg border border-surface-border py-2 text-sm text-slate-300"
                >
                  Annuler
                </button>
                <button
                  disabled={busy}
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </>
          ) : (
            <>
              <Row label="Client" value={order.clientName} />
              <Row label="Téléphone" value={order.clientPhoneFormatted} />
              <Row label="Produit" value={order.product} />
              <Row label="Montant" value={`${order.amount.toLocaleString("fr-FR")} FCFA`} />
              <Row label="Reçue le" value={formatDate(order.timestamps.received)} />
              {order.statutLivreur && (
                <Row label="Statut livreur" value={LIVREUR_LABELS[order.statutLivreur]} />
              )}
              <button
                onClick={() => setEditing(true)}
                className="mt-1 w-full rounded-lg border border-surface-border py-2 text-sm text-slate-300 hover:bg-surface"
              >
                Modifier
              </button>
            </>
          )}
        </div>

        {/* Assignation */}
        <div className="mb-5 space-y-3 rounded-xl border border-surface-border p-4">
          <h3 className="text-sm font-medium text-slate-200">Assigner</h3>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Closeuse</label>
            <select
              value={closeuseId}
              onChange={(e) => setCloseuseId(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
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
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            >
              <option value="">Non assigné</option>
              {livreurs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={busy}
            onClick={handleAssign}
            className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Enregistrer l'assignation
          </button>
        </div>

        {/* Admin override */}
        <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <h3 className="text-sm font-medium text-red-400">Admin Override</h3>
          <p className="text-xs text-slate-500">
            Force le statut de la commande manuellement. À utiliser en dernier recours (ex : correction d'une
            erreur de la closeuse).
          </p>
          <select
            value={overrideStatus}
            onChange={(e) => setOverrideStatus(e.target.value as CloseuseStatus)}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-red-400"
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
            className="w-full rounded-lg border border-red-500/40 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Forcer ce statut
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full rounded-xl border border-surface-border py-2.5 text-sm text-slate-300">
          Fermer
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
