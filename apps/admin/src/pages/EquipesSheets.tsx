import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import CreateTeamForm from "../components/CreateTeamForm";

interface EquipesSheetsProps {
  workspaceId: string;
  teams: Team[];
}

const MAX_SHEETS_PER_TEAM = 5;

function countryFor(code: string) {
  return AFRICA_COUNTRIES.find((c) => c.code === code) ?? null;
}

function flagUrl(code: string) {
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

// Accepte soit un ID brut, soit une URL complète Google Sheets collée —
// évite d'obliger l'admin à extraire l'ID lui-même de l'URL.
function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export default function EquipesSheets({ workspaceId, teams }: EquipesSheetsProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-400">
          {teams.length} équipe{teams.length > 1 ? "s" : ""}
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          + Nouvelle équipe
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Liste des équipes */}
        <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
          {teams.map((team) => {
            const country = countryFor(team.defaultCountry);
            const active = team.id === selectedTeamId;
            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`flex w-full items-center gap-2.5 border-b border-surface-border px-4 py-3 text-left text-sm last:border-0 ${
                  active ? "bg-brand-light text-brand" : "text-slate-300 hover:bg-surface"
                }`}
              >
                {country && <img src={flagUrl(country.code)} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />}
                <span className="flex-1 truncate">{team.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{team.sheetIds.length}/{MAX_SHEETS_PER_TEAM}</span>
              </button>
            );
          })}
        </div>

        {/* Détail équipe sélectionnée */}
        {selectedTeam ? (
          <TeamDetail key={selectedTeam.id} workspaceId={workspaceId} team={selectedTeam} />
        ) : (
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 text-center text-sm text-slate-500">
            Sélectionne une équipe pour gérer ses Sheets.
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowCreate(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
            <CreateTeamForm
              workspaceId={workspaceId}
              onCreated={(newTeamId) => {
                setSelectedTeamId(newTeamId);
                setShowCreate(false);
              }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TeamDetail({ workspaceId, team }: { workspaceId: string; team: Team }) {
  const [sheetInput, setSheetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamRef = () => doc(getDb(), "workspaces", workspaceId, "teams", team.id);

  const handleAddSheet = async () => {
    const id = extractSheetId(sheetInput);
    if (!id) {
      setError("ID ou lien Google Sheets invalide.");
      return;
    }
    if (team.sheetIds.includes(id)) {
      setError("Ce Sheet est déjà connecté à cette équipe.");
      return;
    }
    if (team.sheetIds.length >= MAX_SHEETS_PER_TEAM) {
      setError(`Maximum ${MAX_SHEETS_PER_TEAM} Sheets par équipe.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateDoc(teamRef(), { sheetIds: [...team.sheetIds, id] });
      setSheetInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSheet = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await updateDoc(teamRef(), { sheetIds: team.sheetIds.filter((s) => s !== id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retrait impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sheets connectés */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <h3 className="mb-1 text-sm font-medium text-slate-200">Google Sheets connectés</h3>
        <p className="mb-4 text-xs text-slate-500">
          Colle l'ID ou le lien complet du Sheet. Pense à le partager au préalable, en Éditeur, avec le compte de
          service (demande l'adresse à l'équipe technique si besoin).
        </p>

        {team.sheetIds.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">Aucun Sheet connecté pour l'instant.</p>
        ) : (
          <ul className="mb-3 space-y-2">
            {team.sheetIds.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm"
              >
                <a
                  href={`https://docs.google.com/spreadsheets/d/${id}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-slate-300 hover:text-brand"
                >
                  {id}
                </a>
                <button
                  disabled={busy}
                  onClick={() => handleRemoveSheet(id)}
                  className="shrink-0 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}

        {team.sheetIds.length < MAX_SHEETS_PER_TEAM && (
          <div className="flex gap-2">
            <input
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder="ID ou lien du Sheet…"
              className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand"
            />
            <button
              disabled={busy || !sheetInput.trim()}
              onClick={handleAddSheet}
              className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {/* Fusion d'équipes — pas encore disponible */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 opacity-60">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-200">Fusion d'équipes</h3>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-slate-500">bientôt</span>
        </div>
        <p className="text-xs text-slate-500">
          Fusionner ou archiver des équipes existantes pour partager leurs ressources — arrive dans une prochaine
          mise à jour.
        </p>
      </div>
    </div>
  );
}
