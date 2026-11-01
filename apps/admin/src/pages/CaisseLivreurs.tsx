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
      {/* Top Banner : Explication du flux de contrôle avant rémunération */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Contrôle de Caisse & Versements Fin de Journée — {team.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Vérifiez les espèces encaissées par chaque livreur, retranchez les imprévus (aller-retour, carburant, manquant) avec note justificative, puis validez la caisse avant de verser sa rémunération.
            </p>
          </div>
        </div>

        {onNavigateToRemuneration && (
          <button
            type="button"
            onClick={onNavigateToRemuneration}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand/50 hover:text-brand"
          >
            <Wallet className="h-3.5 w-3.5 text-brand" />
            <span>Passer aux Rémunérations</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* KPI Strip de Caisse */}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Cash encaissé terrain
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-100">
            {globalTotals.encaisse.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal text-slate-500">{currency}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Total des commandes livrées</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-amber-400">
            Imprévus / Frais retranchés
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-amber-400">
            − {globalTotals.fraisTerrain.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal opacity-75">{currency}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Allers-retours & dépenses justifiées</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">
            Déjà reversé à la caisse
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-emerald-400">
            {globalTotals.reverse.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal opacity-75">{currency}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Versements validés par l'admin</p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-rose-400">
            Reste entre les mains livreurs
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-rose-400">
            {globalTotals.reste.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-normal opacity-75">{currency}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">À encaisser avant de payer la prime</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tableau de vérification par livreur */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Situation de caisse par livreur</h3>
            <p className="text-xs text-slate-500">
              Validez le versement du livreur ou retranchez un montant avec une note justificative.
            </p>
          </div>
        </div>

        {livreurSummaries.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            Aucun livreur enregistré sur cette équipe.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-3">Livreur</th>
                  <th className="pb-3 px-3">Colis Livrés</th>
                  <th className="pb-3 px-3">Encaissé Terrain</th>
                  <th className="pb-3 px-3">Montants Retranchés</th>
                  <th className="pb-3 px-3">Déjà Versé</th>
                  <th className="pb-3 px-3">Reste à Verser</th>
                  <th className="pb-3 pl-3 text-right">Actions de Contrôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {livreurSummaries.map((s) => (
                  <tr key={s.livreur.id} className="hover:bg-surface/40">
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-brand" />
                        <div>
                          <p className="font-semibold text-slate-100">{s.livreur.name}</p>
                          <p className="text-[10px] text-slate-500">{s.livreur.phone || "Sans numéro"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-300">{s.deliveredCount}</td>
                    <td className="py-3.5 px-3 font-semibold tabular-nums text-slate-200">
                      {s.encaisseTerrain.toLocaleString("fr-FR")} {currency}
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      {s.deductionsCaisse > 0 || s.deductionsRemun > 0 ? (
                        <div className="space-y-0.5">
                          {s.deductionsCaisse > 0 && (
                            <span className="block font-medium text-amber-400">
                              −{s.deductionsCaisse.toLocaleString("fr-FR")} {currency} (Caisse)
                            </span>
                          )}
                          {s.deductionsRemun > 0 && (
                            <span className="block font-medium text-rose-400">
                              −{s.deductionsRemun.toLocaleString("fr-FR")} {currency} (Sur prime)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">0 {currency}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-semibold tabular-nums text-emerald-400">
                      {s.totalRemitted.toLocaleString("fr-FR")} {currency}
                    </td>
                    <td className="py-3.5 px-3">
                      {s.isSettled ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Caisse soldée ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                          {s.resteAVerser.toLocaleString("fr-FR")} {currency} à verser
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openModal(s.livreur, "deduction", 0)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
                        >
                          <MinusCircle className="h-3.5 w-3.5" />
                          Retrancher (Imprévu / Note)
                        </button>
                        <button
                          type="button"
                          onClick={() => openModal(s.livreur, "remittance", s.resteAVerser)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Valider versement
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Journal des versements & notes justificatives */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-semibold text-slate-100">
              Registre des Versements & Notes Justificatives ({entries.length})
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface/60 px-4 py-3 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-100">{entry.livreurName}</span>
                    {entry.type === "remittance" ? (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                        + {entry.amount.toLocaleString("fr-FR")} {currency} (Versement caisse)
                      </span>
                    ) : (
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                        − {entry.amount.toLocaleString("fr-FR")} {currency} (
                        {entry.impact === "remuneration" ? "Retenue sur rémunération" : "Frais / Imprévu déduit caisse"}
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
                  <p className="text-xs text-slate-300">
                    <span className="font-medium text-slate-400">Justification :</span> {entry.note}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteEntry(entry)}
                  title="Supprimer cette écriture"
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-400 transition hover:bg-rose-500/20"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => !busy && setModalState(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
          >
            <div>
              <h3 className="text-base font-semibold text-slate-100">
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
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Où appliquer ce retranchement ?
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setImpactInput("caisse")}
                    className={`rounded-xl border p-3 text-left text-xs transition ${
                      impactInput === "caisse"
                        ? "border-brand bg-brand/10 text-slate-100"
                        : "border-surface-border bg-surface text-slate-400"
                    }`}
                  >
                    <p className="font-semibold">1. Déduire de la caisse à reverser (Imprévu terrain / Carburant)</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Le livreur a consommé ce montant sur le terrain (ex: aller-retour client absent). Réduit le cash qu'il doit vous remettre.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImpactInput("remuneration")}
                    className={`rounded-xl border p-3 text-left text-xs transition ${
                      impactInput === "remuneration"
                        ? "border-brand bg-brand/10 text-slate-100"
                        : "border-surface-border bg-surface text-slate-400"
                    }`}
                  >
                    <p className="font-semibold">2. Retrancher sur sa rémunération (Retenue sur paie)</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Sera directement déduit du solde de commissions à payer au livreur dans l'onglet Rémunération.
                    </p>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Montant ({currency})
              </label>
              <input
                type="number"
                min="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="ex: 2000"
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-slate-100 outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Note justificative obligatoire
              </label>
              <textarea
                rows={3}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={
                  modalState.mode === "remittance"
                    ? "ex: Versement espèces fin de journée vérifié / Flooz reçu"
                    : "ex: Aller-retour Agoè pour client ayant repoussé la livraison, 1 500 F de carburant pris sur la caisse"
                }
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-brand"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalState(null)}
                className="flex-1 rounded-xl border border-surface-border bg-surface py-2.5 text-xs font-medium text-slate-300"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy || !Number(amountInput) || !noteInput.trim()}
                onClick={() => setConfirmSubmit(true)}
                className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-semibold text-white disabled:opacity-40"
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
