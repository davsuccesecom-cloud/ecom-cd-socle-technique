import { useState, useEffect } from "react";
import { doc, updateDoc, collection, onSnapshot } from "firebase/firestore";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import {
  Plus,
  Store,
  FileSpreadsheet,
  ExternalLink,
  Trash2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import CreateTeamForm from "../components/CreateTeamForm";
import CountryMapBackdrop, { getCountryMeta } from "../components/CountryMapBackdrop";
import { formatFirebaseError } from "../lib/firebaseErrors";

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
  const [shopifyByTeam, setShopifyByTeam] = useState<Record<string, string>>({});

  useEffect(() => {
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((d) => {
        const c = d.data();
        if (c.status === "active") {
          if (c.ownerTeamId) {
            map[c.ownerTeamId] = `${c.shopDomain} (Propriétaire)`;
          }
          if (c.countryRoutes) {
            Object.values(c.countryRoutes).forEach((r: any) => {
              if (r.assignedTeamId && r.status === "active") {
                map[r.assignedTeamId] = `${c.shopDomain} (Flux délégué)`;
              }
            });
          }
        }
      });
      setShopifyByTeam(map);
    });
    return () => unsub();
  }, [workspaceId]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Cartographie des Marchés ({teams.length})
          </h2>
          <p className="text-xs text-slate-500">
            Sélectionnez une équipe pays pour superviser son flux d'entrée (Shopify ou Google Sheets).
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" />
          Nouveau marché
        </button>
      </div>

      {/* Geographic Team Cards Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const country = countryFor(team.defaultCountry);
          const meta = getCountryMeta(team.defaultCountry);
          const active = team.id === selectedTeam?.id;
          const shopifyDomain = shopifyByTeam[team.id];
          const hasSheets = team.sheetIds.length > 0;

          return (
            <button
              key={team.id}
              type="button"
              onClick={() => setSelectedTeamId(team.id)}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                active
                  ? "border-brand bg-surface-raised ring-1 ring-brand/40 shadow-md"
                  : "border-surface-border bg-surface-raised/80 hover:border-slate-600 hover:bg-surface-raised"
              }`}
            >
              {/* Calm Country Map Silhouette Backdrop */}
              <CountryMapBackdrop countryCode={team.defaultCountry} />

              <div className="relative z-10 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {country && (
                      <img
                        src={flagUrl(country.code)}
                        alt={country.name}
                        className="h-4 w-6 shrink-0 rounded-[3px] object-cover shadow-sm"
                      />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{team.name}</h3>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>{country?.name ?? team.defaultCountry}</span>
                        {meta.capital && (
                          <>
                            <span>·</span>
                            <MapPin className="h-2.5 w-2.5 text-brand" />
                            <span>{meta.capital}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-md border border-surface-border bg-surface/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-300">
                    {team.currency || meta.currency}
                  </span>
                </div>

                {/* Operational Source Status Badge */}
                <div className="flex items-center justify-between border-t border-surface-border/60 pt-3">
                  {shopifyDomain ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Flux Shopify actif
                    </span>
                  ) : hasSheets ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-400">
                      <FileSpreadsheet className="h-3 w-3" />
                      {team.sheetIds.length} Sheet{team.sheetIds.length > 1 ? "s" : ""} actif{team.sheetIds.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                      <Clock className="h-3 w-3" />
                      Source à relier
                    </span>
                  )}

                  <span className="font-mono text-[10px] text-slate-500">{meta.dialCode}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Team Detail Panel */}
      {selectedTeam ? (
        <TeamDetail
          key={selectedTeam.id}
          workspaceId={workspaceId}
          team={selectedTeam}
          shopifyActiveInfo={shopifyByTeam[selectedTeam.id] ?? null}
        />
      ) : (
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 text-center text-sm text-slate-500">
          Sélectionnez une équipe ci-dessus pour gérer ses connexions.
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
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

function TeamDetail({
  workspaceId,
  team,
  shopifyActiveInfo,
}: {
  workspaceId: string;
  team: Team;
  shopifyActiveInfo: string | null;
}) {
  const [sheetInput, setSheetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamRef = () => doc(getDb(), "workspaces", workspaceId, "teams", team.id);

  const handleAddSheet = async () => {
    if (shopifyActiveInfo) {
      setError("La source Shopify est active pour cette équipe. La synchronisation Google Sheet est désactivée.");
      return;
    }
    const id = extractSheetId(sheetInput);
    if (!id) {
      setError("ID ou lien Google Sheets invalide. Collez l'URL complète de votre tableur.");
      return;
    }
    if (team.sheetIds.includes(id)) {
      setError("Ce tableur Google Sheets est déjà rattaché à cette équipe.");
      return;
    }
    if (team.sheetIds.length >= MAX_SHEETS_PER_TEAM) {
      setError(`Limite atteinte (${MAX_SHEETS_PER_TEAM} tableurs maximum par équipe).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateDoc(teamRef(), { sheetIds: [...team.sheetIds, id] });
      setSheetInput("");
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
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
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {shopifyActiveInfo && (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-100">
                Flux Temps Réel Shopify Actif — {shopifyActiveInfo}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Les commandes de <strong>{team.name}</strong> arrivent directement par webhook Shopify sécurisé. La synchronisation Google Sheets est mise en veille pour garantir zéro doublon.
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className={`rounded-2xl border border-surface-border bg-surface-raised p-5 transition-opacity ${
          shopifyActiveInfo ? "opacity-65" : ""
        }`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Tableurs Google Sheets — {team.name}
              </h3>
              <p className="text-xs text-slate-500">
                Collez l'URL complète ou l'identifiant du Google Sheet partagé en mode Éditeur.
              </p>
            </div>
          </div>
          <span className="rounded-lg border border-surface-border bg-surface px-2.5 py-1 font-mono text-xs text-slate-400">
            {team.sheetIds.length} / {MAX_SHEETS_PER_TEAM} tableurs
          </span>
        </div>

        {team.sheetIds.length === 0 ? (
          <div className="mb-4 rounded-xl border border-dashed border-surface-border bg-surface/40 p-6 text-center">
            <p className="text-xs text-slate-400">Aucun tableur Google Sheets connecté à ce marché.</p>
          </div>
        ) : (
          <ul className="mb-4 space-y-2">
            {team.sheetIds.map((id, idx) => (
              <li
                key={id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface/60 px-3.5 py-2.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-400">
                    #{idx + 1}
                  </span>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${id}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1.5 truncate font-mono text-slate-200 hover:text-brand"
                  >
                    <span className="truncate">{id}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" />
                  </a>
                </div>
                <button
                  disabled={busy}
                  onClick={() => handleRemoveSheet(id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}

        {team.sheetIds.length < MAX_SHEETS_PER_TEAM && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sheetInput}
              disabled={busy || !!shopifyActiveInfo}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder={
                shopifyActiveInfo
                  ? "Désactivé tant que le flux Shopify est actif"
                  : "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
              }
              className="flex-1 rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand disabled:opacity-50"
            />
            <button
              disabled={busy || !sheetInput.trim() || !!shopifyActiveInfo}
              onClick={handleAddSheet}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-hover disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Connecter le Sheet
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
