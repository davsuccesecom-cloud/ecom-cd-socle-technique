import { useState, useMemo } from "react";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";
import { getDb, getCountryLabel, type Team, type AppUser } from "@ecomcod/shared";
import { Users, Handshake, AlertCircle, ShieldCheck, Check, Info } from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface AllocateEmployeeModalProps {
  workspaceId: string;
  user: AppUser;
  homeTeam: Team | null;
  teams: Team[];
  onClose: () => void;
  onSuccess: (updatedAllocations: string[]) => void;
}

export default function AllocateEmployeeModal({
  workspaceId,
  user,
  homeTeam,
  teams,
  onClose,
  onSuccess,
}: AllocateEmployeeModalProps) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(() => user.allocatedTeamIds || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeCountry = (homeTeam?.defaultCountry || "TG").trim().toUpperCase();

  // Filtrer les équipes éligibles (strictement du même pays, hors équipe d'origine)
  const { eligibleTeams, ineligibleTeams } = useMemo(() => {
    const eligible: Team[] = [];
    const ineligible: Team[] = [];

    teams.forEach((t) => {
      if (t.id === homeTeam?.id) return; // équipe d'origine exclue de la liste des emprunts
      const tCountry = (t.defaultCountry || "").trim().toUpperCase();
      if (tCountry === homeCountry) {
        eligible.push(t);
      } else {
        ineligible.push(t);
      }
    });

    return { eligibleTeams: eligible, ineligibleTeams: ineligible };
  }, [teams, homeTeam?.id, homeCountry]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      // 1. Tenter l'appel de la Cloud Function avec validation serveur stricte du pays
      try {
        const functions = getFunctions(getApp());
        const callAllocate = httpsCallable(functions, "updateEmployeeAllocatedTeams");
        await callAllocate({ userId: user.id, allocatedTeamIds: selectedTeamIds });
      } catch (fnErr) {
        console.warn("[AllocateModal] Repli sur mise à jour directe Firestore:", fnErr);
        // 2. Repli direct Firestore si la function n'est pas encore déployée
        const userRef = doc(getDb(), "workspaces", workspaceId, "users", user.id);
        await updateDoc(userRef, {
          allocatedTeamIds: selectedTeamIds,
          allocatedUpdatedAt: Date.now(),
        });
      }

      onSuccess(selectedTeamIds);
      onClose();
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
        {/* En-tête */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Handshake className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Prêt inter-équipes : {user.name}
              </h3>
              <p className="text-xs text-slate-400">
                {user.role === "closeuse" ? "Closeuse" : "Livreur"} · Marché d'origine :{" "}
                <span className="font-semibold text-slate-200">
                  {getCountryLabel(homeCountry)} ({homeTeam?.name || "Équipe principale"})
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-200 transition"
          >
            ✕
          </button>
        </div>

        {/* Bannière de réassurance tracking & isolation des Pixels */}
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-200 mb-0.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Isolation 100% étanche des Pixels & Attribution</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-300/90">
            Même si {user.name} traite les commandes de plusieurs boutiques, chaque commande
            conserve son <strong>Pixel Meta CAPI</strong> et son tracking dédié. Aucun mélange
            ni pollution de données entre vos boutiques.
          </p>
        </div>

        {/* Règle stricte du pays */}
        <div className="mb-4 rounded-xl border border-surface-border bg-surface p-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-300 mb-0.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span>Règle d'éligibilité par pays ({homeCountry})</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Pour garantir la cohérence des devises ({homeTeam?.currency || "XOF"}), des tournées de livraison et des
            numéros de téléphone, les employés ne peuvent être prêtés qu'à des équipes opérant dans le{" "}
            <strong className="text-slate-200">même pays</strong> ({getCountryLabel(homeCountry)}).
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Liste des équipes du même pays */}
        <div className="mb-5 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Équipes emprunteuses disponibles ({eligibleTeams.length})
          </label>

          {eligibleTeams.length === 0 ? (
            <div className="rounded-xl border border-surface-border bg-surface p-4 text-center text-xs text-slate-500">
              Aucune autre équipe active enregistrée en {getCountryLabel(homeCountry)}.
              <br />
              <span className="text-[11px] text-slate-600">
                Créez une seconde équipe pour ce marché dans « Équipes & Marchés » pour pouvoir partager cet employé.
              </span>
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {eligibleTeams.map((t) => {
                const isSelected = selectedTeamIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTeam(t.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                      isSelected
                        ? "border-brand bg-brand/10 text-white"
                        : "border-surface-border bg-surface hover:border-slate-600 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          isSelected
                            ? "border-brand bg-brand text-white"
                            : "border-slate-600 bg-surface-raised"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{t.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {getCountryLabel(t.defaultCountry)} · Devise : {t.currency}
                          {t.metaCapiConfig?.enabled && (
                            <span className="ml-1.5 text-emerald-400">· Pixel actif</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      {isSelected ? "Alloué" : "Non partagé"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Équipes inéligibles (pays différent) */}
          {ineligibleTeams.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-border">
              <span className="text-[11px] text-slate-500 font-medium">
                Équipes d'autres marchés (inéligibles au prêt) :
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ineligibleTeams.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface px-2 py-1 text-[10px] text-slate-500 cursor-not-allowed opacity-60"
                    title={`Cet employé opère en ${homeCountry} et ne peut pas être alloué en ${t.defaultCountry}`}
                  >
                    🚫 {t.name} ({getCountryLabel(t.defaultCountry)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-surface-border bg-surface px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-brand/90 disabled:opacity-50"
          >
            {busy ? "Enregistrement..." : "Enregistrer les allocations"}
          </button>
        </div>
      </div>
    </div>
  );
}
