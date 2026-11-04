import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb, ConfirmDialog } from "@ecomcod/shared";
import type { AppUser, CashSettlementEntry, Order, Team } from "@ecomcod/shared";
import {
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Plus,
  MinusCircle,
  FileText,
  Trash2,
  ArrowRight,
  Truck,
  Wallet,
} from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface CaisseLivreursProps {
  workspaceId: string;
  team: Team | null;
  livreurs: AppUser[];
  orders: Order[];
  onNavigateToRemuneration?: () => void;
}

export default function CaisseLivreurs({
  workspaceId,
  team,
  livreurs,
  orders,
  onNavigateToRemuneration,
}: CaisseLivreursProps) {
  const [entries, setEntries] = useState<CashSettlementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Modal d'ajout (Versement fin de journée OU Retenue / Imprévu avec note justificative)
  const [modalState, setModalState] = useState<{
    livreur: AppUser;
    mode: "remittance" | "deduction";
    defaultAmount: number;
  } | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [impactInput, setImpactInput] = useState<"caisse" | "remuneration">("caisse");
  const [noteInput, setNoteInput] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<CashSettlementEntry | null>(null);

  const currency = team?.currency || "XOF";

  useEffect(() => {
    if (!workspaceId || !team) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const db = getDb();
    const q = query(
      collection(db, "workspaces", workspaceId, "cashSettlements"),
      where("teamId", "==", team.id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CashSettlementEntry));
        setLoading(false);
      },
      () => {
        // Fallback sans orderBy si index non encore créé
        const fallbackQ = query(
          collection(db, "workspaces", workspaceId, "cashSettlements"),
          where("teamId", "==", team.id)
        );
        onSnapshot(fallbackQ, (snap2) => {
          const list = snap2.docs.map((d) => ({ id: d.id, ...d.data() }) as CashSettlementEntry);
          list.sort((a, b) => b.createdAt - a.createdAt);
          setEntries(list);
          setLoading(false);
        });
      }
    );
    return () => unsub();
  }, [workspaceId, team]);

  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.statutCloseuse === "livre" || o.statutLivreur === "livre"),
    [orders]
  );

  const livreurSummaries = useMemo(() => {
    return livreurs.map((livreur) => {
      const myDelivered = deliveredOrders.filter((o) => o.livreurId === livreur.id);
      const encaisseTerrain = myDelivered.reduce((s, o) => s + (o.amount || 0), 0);

      const myEntries = entries.filter((e) => e.livreurId === livreur.id);
      const totalRemitted = myEntries
        .filter((e) => e.type === "remittance")
        .reduce((s, e) => s + (e.amount || 0), 0);

      const deductionsCaisse = myEntries
        .filter((e) => e.type === "deduction" && e.impact === "caisse")
        .reduce((s, e) => s + (e.amount || 0), 0);

      const deductionsRemun = myEntries
        .filter((e) => e.type === "deduction" && e.impact === "remuneration")
        .reduce((s, e) => s + (e.amount || 0), 0);

      const netAttenduCaisse = Math.max(0, encaisseTerrain - deductionsCaisse);
      const resteAVerser = Math.max(0, netAttenduCaisse - totalRemitted);
      const isSettled = resteAVerser === 0;

      return {
        livreur,
        deliveredCount: myDelivered.length,
        encaisseTerrain,
        deductionsCaisse,
        deductionsRemun,
        netAttenduCaisse,
        totalRemitted,
        resteAVerser,
        isSettled,
        entries: myEntries,
      };
    });
  }, [livreurs, deliveredOrders, entries]);

  const globalTotals = useMemo(() => {
    return livreurSummaries.reduce(
      (acc, s) => {
        acc.encaisse += s.encaisseTerrain;
        acc.fraisTerrain += s.deductionsCaisse;
        acc.reverse += s.totalRemitted;
        acc.reste += s.resteAVerser;
        return acc;
      },
      { encaisse: 0, fraisTerrain: 0, reverse: 0, reste: 0 }
    );
  }, [livreurSummaries]);

  const openModal = (
    livreur: AppUser,
    mode: "remittance" | "deduction",
    defaultAmount: number
  ) => {
    setModalState({ livreur, mode, defaultAmount });
    setAmountInput(defaultAmount > 0 ? String(defaultAmount) : "");
    setImpactInput("caisse");
    setNoteInput(mode === "remittance" ? "Versement caisse fin de journée" : "");
    setError(null);
  };

  const handleExecuteSave = async () => {
    if (!modalState || !team) return;
    const numericAmount = Math.round(Number(amountInput) || 0);
    if (numericAmount <= 0) {
      setError("Veuillez saisir un montant supérieur à 0.");
      setConfirmSubmit(false);
      return;
    }
    if (!noteInput.trim()) {
      setError("La note justificative est obligatoire pour tracer cette opération.");
      setConfirmSubmit(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const db = getDb();
      const now = new Date();
      const dateKey = now.toISOString().slice(0, 10);
      await addDoc(collection(db, "workspaces", workspaceId, "cashSettlements"), {
        workspaceId,
        teamId: team.id,
        livreurId: modalState.livreur.id,
        livreurName: modalState.livreur.name,
        type: modalState.mode,
        impact: modalState.mode === "remittance" ? "caisse" : impactInput,
        amount: numericAmount,
        note: noteInput.trim(),
        dateKey,
        createdAt: Date.now(),
      });
      setConfirmSubmit(false);
      setModalState(null);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!confirmDeleteEntry) return;
    setBusy(true);
    setError(null);
    try {
      const db = getDb();
      await deleteDoc(doc(db, "workspaces", workspaceId, "cashSettlements", confirmDeleteEntry.id));
      setConfirmDeleteEntry(null);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!team) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 text-center text-sm text-slate-400">
        Sélectionnez d'abord un marché en haut de page.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Banner : Titre et action sobre */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised px-5 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand shadow-xs">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Caisse & Versements — {team.name}
            </h2>
            <p className="text-xs text-slate-500">
              Suivi du cash terrain encaissé, des dépenses justifiées et des versements reçus.
            </p>
          </div>
        </div>

        {onNavigateToRemuneration && (
          <button
            type="button"
            onClick={onNavigateToRemuneration}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-medium text-slate-300 transition-all hover:bg-surface-raised hover:text-white shadow-xs"
          >
            <Wallet className="h-4 w-4 text-brand" />
            <span>Voir les rémunérations</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* KPI Cards de Caisse (chiffres nets et typographie soignée) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <span className="truncate text-xs font-semibold text-slate-400">Total encaissé terrain</span>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {globalTotals.encaisse.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Montant total des colis livrés</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <span className="truncate text-xs font-semibold text-slate-400">Imprévus déduits</span>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {globalTotals.fraisTerrain > 0 ? (
              <span className="text-amber-400/95 font-semibold">
                − {globalTotals.fraisTerrain.toLocaleString("fr-FR")}
              </span>
            ) : (
              "0"
            )}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Dépenses terrain justifiées</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <span className="truncate text-xs font-semibold text-slate-400">Versements reçus</span>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-emerald-400 sm:text-2xl">
            {globalTotals.reverse.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Versements pointés et validés</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-xs">
          <span className="truncate text-xs font-semibold text-slate-400">Solde restant à verser</span>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-100 sm:text-2xl">
            {globalTotals.reste > 0 ? (
              <span className="text-rose-400/95 font-semibold">
                {globalTotals.reste.toLocaleString("fr-FR")}
              </span>
            ) : (
              "0"
            )}{" "}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Espèces en attente d'encaissement</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 shadow-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tableau de situation par livreur */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-100">Situation de caisse par livreur</h3>
          <p className="text-xs text-slate-500">
            Pointage des montants collectés, déductions validées et encaissement des versements.
          </p>
        </div>

        {livreurSummaries.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            Aucun livreur enregistré sur cette équipe.
          </p>
        ) : (
          <>
            {/* Tableau Desktop */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs text-slate-500 font-normal">
                    <th className="px-4 py-3 font-normal">Livreur</th>
                    <th className="px-4 py-3 font-normal">Colis livrés</th>
                    <th className="px-4 py-3 font-normal">Cash collecté</th>
                    <th className="px-4 py-3 font-normal">Imprévus déduits</th>
                    <th className="px-4 py-3 font-normal">Versements validés</th>
                    <th className="px-4 py-3 font-normal">Solde restant</th>
                    <th className="px-4 py-3 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {livreurSummaries.map((s) => (
                    <tr key={s.livreur.id} className="transition-colors hover:bg-surface/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface text-brand">
                            <Truck className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-200">{s.livreur.name}</p>
                            <p className="text-xs text-slate-500">{s.livreur.phone || "Sans numéro"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 tabular-nums">
                        {s.deliveredCount} colis
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-slate-200">
                        {s.encaisseTerrain.toLocaleString("fr-FR")} {currency}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {s.deductionsCaisse > 0 || s.deductionsRemun > 0 ? (
                          <div className="space-y-0.5">
                            {s.deductionsCaisse > 0 && (
                              <span className="block text-xs font-medium text-amber-400">
                                −{s.deductionsCaisse.toLocaleString("fr-FR")} {currency} (Caisse)
                              </span>
                            )}
                            {s.deductionsRemun > 0 && (
                              <span className="block text-xs font-medium text-rose-400">
                                −{s.deductionsRemun.toLocaleString("fr-FR")} {currency} (Prime)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-emerald-400">
                        {s.totalRemitted.toLocaleString("fr-FR")} {currency}
                      </td>
                      <td className="px-4 py-3">
                        {s.isSettled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Soldé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-amber-400">
                            {s.resteAVerser.toLocaleString("fr-FR")} {currency} à verser
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openModal(s.livreur, "deduction", 0)}
                            className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-300 transition-all hover:bg-surface hover:text-white"
                          >
                            Noter un imprévu
                          </button>
                          <button
                            type="button"
                            onClick={() => openModal(s.livreur, "remittance", s.resteAVerser)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white shadow-xs transition-all hover:bg-brand-hover active:scale-[0.98]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Encaisser versement
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes Mobile (ergonomie tactile propre) */}
            <div className="space-y-3 sm:hidden">
              {livreurSummaries.map((s) => (
                <div key={s.livreur.id} className="rounded-xl border border-surface-border bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-100">{s.livreur.name}</p>
                      <p className="text-xs text-slate-500">{s.livreur.phone || "Sans numéro"}</p>
                    </div>
                    {s.isSettled ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Soldé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 tabular-nums">
                        {s.resteAVerser.toLocaleString("fr-FR")} {currency}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-y border-surface-border/50 py-2.5 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Colis</span>
                      <span className="text-slate-300 font-medium">{s.deliveredCount}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Cash collecté</span>
                      <span className="text-slate-200 font-medium tabular-nums">{s.encaisseTerrain.toLocaleString("fr-FR")}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Reversé</span>
                      <span className="text-emerald-400 font-medium tabular-nums">{s.totalRemitted.toLocaleString("fr-FR")}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => openModal(s.livreur, "deduction", 0)}
                      className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-300 hover:bg-surface-raised"
                    >
                      Noter imprévu
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal(s.livreur, "remittance", s.resteAVerser)}
                      className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white"
                    >
                      Encaisser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Journal des versements & notes justificatives */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <FileText className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-100">
              Journal des versements & pièces justificatives ({entries.length})
            </h3>
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-xs text-slate-500">Chargement du journal de caisse…</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            Aucun versement ou montant retranché enregistré pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface/50 px-4 py-2.5 text-xs transition-colors hover:bg-surface/70"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-100">{entry.livreurName}</span>
                    {entry.type === "remittance" ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-emerald-400">
                        + {entry.amount.toLocaleString("fr-FR")} {currency} (Versement)
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-amber-400">
                        − {entry.amount.toLocaleString("fr-FR")} {currency} (
                        {entry.impact === "remuneration" ? "Retenue prime" : "Imprévu caisse"}
                        )
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500">
                      {new Date(entry.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500">Justification :</span> {entry.note}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteEntry(entry)}
                  title="Supprimer cette écriture"
                  className="rounded-lg border border-surface-border p-1.5 text-slate-400 transition-all hover:border-rose-500/30 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de saisie Versement ou Retenue avec note justificative */}
      {modalState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => !busy && setModalState(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
          >
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {modalState.mode === "remittance"
                  ? `Valider le versement de ${modalState.livreur.name}`
                  : `Retrancher un montant — ${modalState.livreur.name}`}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {modalState.mode === "remittance"
                  ? "Saisissez le montant effectivement remis par le livreur à la fin de sa tournée."
                  : "Indiquez le montant à retrancher (imprévu aller-retour, carburant, écart) et rédigez la note justificative obligatoire."}
              </p>
            </div>

            {modalState.mode === "deduction" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Où appliquer ce retranchement ?
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setImpactInput("caisse")}
                    className={`rounded-xl border p-3 text-left text-xs transition-all ${
                      impactInput === "caisse"
                        ? "border-brand bg-brand/10 text-slate-100 shadow-xs"
                        : "border-surface-border bg-surface text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <p className="font-semibold text-slate-100">1. Déduire de la caisse à reverser (Imprévu terrain / Carburant)</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Le livreur a consommé ce montant sur le terrain (ex: aller-retour client absent). Réduit le cash qu'il doit vous remettre.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImpactInput("remuneration")}
                    className={`rounded-xl border p-3 text-left text-xs transition-all ${
                      impactInput === "remuneration"
                        ? "border-brand bg-brand/10 text-slate-100 shadow-xs"
                        : "border-surface-border bg-surface text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <p className="font-semibold text-slate-100">2. Retrancher sur sa rémunération (Retenue sur prime)</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Sera directement déduit du solde de commissions à payer au livreur dans l'onglet Rémunération.
                    </p>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Montant ({currency})
              </label>
              <input
                type="number"
                min="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="ex: 2000"
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-base font-semibold tabular-nums text-slate-100 outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Note justificative obligatoire
              </label>
              <textarea
                rows={3}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={
                  modalState.mode === "remittance"
                    ? "ex: Versement espèces fin de journée vérifié / Virement Mobile Money reçu"
                    : "ex: Aller-retour pour client injoignable ayant reporté, 1 500 FCFA de carburant justifiés"
                }
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs text-slate-100 outline-none focus:border-brand"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="flex-1 rounded-xl border border-surface-border bg-surface py-2.5 text-xs font-semibold text-slate-300 transition-all hover:bg-surface-subtle hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy || !Number(amountInput) || !noteInput.trim()}
                onClick={() => setConfirmSubmit(true)}
                className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-brand-hover disabled:opacity-40"
              >
                Continuer & Valider
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmit && !!modalState}
        title={
          modalState?.mode === "remittance"
            ? "Confirmer la réception du versement ?"
            : "Confirmer le retranchement avec note justificative ?"
        }
        message={
          modalState
            ? `${
                modalState.mode === "remittance"
                  ? `Vous validez avoir reçu ${Number(amountInput).toLocaleString("fr-FR")} ${currency} de la part de ${modalState.livreur.name}.`
                  : `Vous retranchez ${Number(amountInput).toLocaleString("fr-FR")} ${currency} (${
                      impactInput === "remuneration" ? "sur la rémunération" : "sur la caisse à reverser"
                    }) pour ${modalState.livreur.name}.`
              } Note : « ${noteInput.trim()} »`
            : ""
        }
        confirmLabel="Confirmer et enregistrer"
        danger={modalState?.mode === "deduction"}
        loading={busy}
        onConfirm={handleExecuteSave}
        onCancel={() => setConfirmSubmit(false)}
      />

      <ConfirmDialog
        open={!!confirmDeleteEntry}
        title="Supprimer cette écriture de caisse ?"
        message={
          confirmDeleteEntry
            ? `L'écriture de ${confirmDeleteEntry.amount.toLocaleString("fr-FR")} ${currency} (${confirmDeleteEntry.livreurName} — « ${confirmDeleteEntry.note} ») sera retirée du calcul.`
            : ""
        }
        confirmLabel="Supprimer l'écriture"
        danger={true}
        loading={busy}
        onConfirm={handleDeleteEntry}
        onCancel={() => setConfirmDeleteEntry(null)}
      />
    </div>
  );
}
