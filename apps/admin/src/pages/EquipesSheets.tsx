import { useState, useEffect } from "react";
import { doc, updateDoc, collection, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, AFRICA_COUNTRIES, ConfirmDialog } from "@ecomcod/shared";
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
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Sliders,
  ChevronRight,
  Info,
  Unlink,
} from "lucide-react";
import CreateTeamForm from "../components/CreateTeamForm";
import CountryMapBackdrop, { getCountryMeta } from "../components/CountryMapBackdrop";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface EquipesSheetsProps {
  workspaceId: string;
  teams: Team[];
}

const MAX_SHEETS_PER_TEAM = 5;
const SERVICE_ACCOUNT_EMAIL = "meta-capi-app@appspot.gserviceaccount.com";

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

export interface TeamShopifyConnectionInfo {
  connectionId: string;
  shopDomain: string;
  isOwner: boolean;
  countryCode?: string;
  label: string;
}

export default function EquipesSheets({ workspaceId, teams }: EquipesSheetsProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [shopifyByTeam, setShopifyByTeam] = useState<Record<string, string>>({});
  const [shopifyDetailsByTeam, setShopifyDetailsByTeam] = useState<Record<string, TeamShopifyConnectionInfo>>({});

  useEffect(() => {
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const map: Record<string, string> = {};
      const details: Record<string, TeamShopifyConnectionInfo> = {};
      snap.forEach((d) => {
        const c = d.data();
        if (c.status === "active") {
          if (c.ownerTeamId) {
            map[c.ownerTeamId] = `${c.shopDomain} (Propriétaire)`;
            details[c.ownerTeamId] = {
              connectionId: d.id,
              shopDomain: c.shopDomain,
              isOwner: true,
              label: `${c.shopDomain} (Propriétaire)`,
            };
          }
          if (c.countryRoutes) {
            Object.entries(c.countryRoutes).forEach(([code, r]: any) => {
              if (r.assignedTeamId && r.status === "active") {
                map[r.assignedTeamId] = `${c.shopDomain} (Flux délégué ${code})`;
                details[r.assignedTeamId] = {
                  connectionId: d.id,
                  shopDomain: c.shopDomain,
                  isOwner: false,
                  countryCode: code,
                  label: `${c.shopDomain} (Flux délégué ${code})`,
                };
              }
            });
          }
        }
      });
      setShopifyByTeam(map);
      setShopifyDetailsByTeam(details);
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
            Supervisez les équipes pays et synchronisez vos feuilles de commandes Google Sheets en temps réel.
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
          const isSelected = team.id === (selectedTeam?.id ?? null);
          const shopifyInfo = shopifyByTeam[team.id] ?? null;

          return (
            <button
              key={team.id}
              onClick={() => setSelectedTeamId(team.id)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-brand bg-brand-light ring-1 ring-brand shadow-md"
                  : "border-surface-border bg-surface-raised hover:border-slate-600"
              }`}
            >
              <CountryMapBackdrop countryCode={team.defaultCountry} />

              <div className="relative z-10 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {country && (
                    <img
                      src={flagUrl(country.code)}
                      alt={country.name}
                      className="h-4 w-5 rounded object-cover shadow-sm"
                    />
                  )}
                  <div>
                    <h3 className="text-xs font-bold text-slate-100">{team.name}</h3>
                    <p className="text-[10px] text-slate-400">
                      Devise : <span className="font-mono font-semibold text-slate-300">{team.currency}</span>
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[9.5px] font-bold text-brand">
                    Actif
                  </span>
                )}
              </div>

              <div className="relative z-10 mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-surface-border/60 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{team.sheetIds.length} tableurs connectés</span>
                </div>
                {shopifyInfo && (
                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300">
                    Shopify
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Team Details & Google Sheets Manager */}
      {selectedTeam && (
        <TeamDetail
          key={selectedTeam.id}
          workspaceId={workspaceId}
          team={selectedTeam}
          shopifyActiveInfo={shopifyByTeam[selectedTeam.id] ?? null}
          shopifyDetail={shopifyDetailsByTeam[selectedTeam.id] ?? null}
        />
      )}

      {/* Modal Création Marché */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
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

interface TestResult {
  success: boolean;
  serviceEmail: string;
  title?: string;
  sheetName?: string;
  columnsCount?: number;
  totalRows?: number;
  statusColCreated?: boolean;
  statusColLetter?: string;
  detectedColumns?: {
    phone: boolean;
    clientName: boolean;
    city: boolean;
    product: boolean;
    amount: boolean;
    quantity: boolean;
    status: boolean;
    livreur: boolean;
    updatedAt: boolean;
  };
  message: string;
  errorCode?: string;
}

function TeamDetail({
  workspaceId,
  team,
  shopifyActiveInfo,
  shopifyDetail,
}: {
  workspaceId: string;
  team: Team;
  shopifyActiveInfo: string | null;
  shopifyDetail: TeamShopifyConnectionInfo | null;
}) {
  const [sheetInput, setSheetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveSheetId, setConfirmRemoveSheetId] = useState<string | null>(null);
  const [confirmDisconnectShopify, setConfirmDisconnectShopify] = useState(false);

  const handleDisconnectShopify = async () => {
    if (!shopifyDetail) return;
    setBusy(true);
    setError(null);
    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", shopifyDetail.connectionId);
      if (shopifyDetail.isOwner) {
        await updateDoc(connRef, {
          status: "inactive",
          ownerTeamId: "",
        });
      } else if (shopifyDetail.countryCode) {
        await updateDoc(connRef, {
          [`countryRoutes.${shopifyDetail.countryCode}.assignedTeamId`]: "",
          [`countryRoutes.${shopifyDetail.countryCode}.status`]: "inactive",
        });
      }
      setConfirmDisconnectShopify(false);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setBusy(false);
    }
  };

  const teamRef = () => doc(getDb(), "workspaces", workspaceId, "teams", team.id);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleTestConnection = async () => {
    setError(null);
    setTestResult(null);
    const id = extractSheetId(sheetInput);
    if (!id) {
      setError("ID ou URL Google Sheets invalide. Veuillez coller le lien complet de votre tableur.");
      return;
    }

    setTesting(true);
    try {
      const functions = getFunctions();
      const testFn = httpsCallable(functions, "testSheetConnection");
      const res = await testFn({ sheetId: id, workspaceId });
      setTestResult(res.data as TestResult);
    } catch (err: any) {
      console.error("Erreur test sheet:", err);
      setTestResult({
        success: false,
        serviceEmail: SERVICE_ACCOUNT_EMAIL,
        errorCode: "CALL_ERROR",
        message: err?.message || "Impossible de joindre le service de test.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAddSheetWithId = async (id: string) => {
    if (shopifyActiveInfo) {
      setError("La source Shopify est active pour cette équipe. La synchronisation Google Sheet est désactivée.");
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
      setTestResult(null);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAddSheet = async () => {
    const id = extractSheetId(sheetInput);
    if (!id) {
      setError("ID ou lien Google Sheets invalide. Collez l'URL complète de votre tableur.");
      return;
    }
    await handleAddSheetWithId(id);
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
    <div className="space-y-5">
      {/* 1. Carte Officielle du Compte de Service WariTrack */}
      <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-sky-500/10 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-100">
                  Connexion Immédiate par Compte de Service (Méthode A)
                </h4>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  24h/24 Actif
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Zéro validation Google requise, aucune expiration de token au bout de 7 jours, synchronisation automatique continue.
              </p>
            </div>
          </div>

          {/* Bouton de copie de l'adresse robot */}
          <div className="flex items-center gap-2 bg-surface/80 border border-surface-border rounded-xl p-1.5 shrink-0">
            <span className="font-mono text-xs text-slate-200 px-2 select-all truncate max-w-[240px] sm:max-w-none">
              {SERVICE_ACCOUNT_EMAIL}
            </span>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition shrink-0"
            >
              {copiedEmail ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Étapes Visuelles de Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-xl border border-surface-border bg-surface/50 p-2.5">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
              Étape 1
            </span>
            <p className="text-xs text-slate-300 font-medium">Ouvrez votre tableur Google Sheets</p>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface/50 p-2.5">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
              Étape 2
            </span>
            <p className="text-xs text-slate-300 font-medium">Cliquez sur <strong className="text-sky-300">Partager</strong> (en haut à droite)</p>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface/50 p-2.5">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
              Étape 3
            </span>
            <p className="text-xs text-slate-300 font-medium">Collez l'adresse robot en rôle <strong className="text-emerald-300">Éditeur</strong></p>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface/50 p-2.5">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
              Étape 4
            </span>
            <p className="text-xs text-slate-300 font-medium">Collez l'URL ci-dessous et lancez le <strong className="text-amber-300">Test</strong></p>
          </div>
        </div>
      </div>

      {shopifyDetail && (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand">
                <Store className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-100">
                  Flux Temps Réel Shopify Actif — {shopifyDetail.label}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Les commandes de <strong>{team.name}</strong> arrivent directement par webhook Shopify. La synchronisation Google Sheets est mise en veille pour éviter les doublons.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmDisconnectShopify(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition shadow-sm shrink-0"
              title="Déconnecter le flux Shopify pour ce marché et réactiver Google Sheets"
            >
              <Unlink className="h-3.5 w-3.5" />
              <span>Déconnecter Shopify</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Gestionnaire des Tableurs Connectés */}
      <div
        className={`rounded-2xl border border-surface-border bg-surface-raised p-5 transition-opacity ${
          shopifyActiveInfo ? "opacity-65" : ""
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Tableurs Google Sheets — {team.name}
              </h3>
              <p className="text-xs text-slate-400">
                WariTrack numérise automatiquement les colonnes de votre feuille et crée la colonne statut en temps réel si elle n'existe pas.
              </p>
            </div>
          </div>
          <span className="rounded-lg border border-surface-border bg-surface px-2.5 py-1 font-mono text-xs text-slate-400">
            {team.sheetIds.length} / {MAX_SHEETS_PER_TEAM} tableurs
          </span>
        </div>

        {team.sheetIds.length === 0 ? (
          <div className="mb-4 rounded-xl border border-dashed border-surface-border bg-surface/40 p-6 text-center">
            <p className="text-xs text-slate-400">
              Aucun tableur Google Sheets rattaché à {team.name}. Collez l'URL d'un tableur pour démarrer.
            </p>
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
                  onClick={() => setConfirmRemoveSheetId(id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Formulaire de saisie & Test de synchronisation */}
        {team.sheetIds.length < MAX_SHEETS_PER_TEAM && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={sheetInput}
                disabled={busy || !!shopifyActiveInfo || testing}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder={
                  shopifyActiveInfo
                    ? "Désactivé tant que le flux Shopify est actif"
                    : "Collez le lien : https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                }
                className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand disabled:opacity-50"
              />
              
              {/* Bouton Diagnostic / Test */}
              <button
                disabled={busy || !sheetInput.trim() || !!shopifyActiveInfo || testing}
                onClick={handleTestConnection}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                {testing ? "Analyse en direct…" : "Tester les Colonnes"}
              </button>

              {/* Bouton Connexion directe */}
              <button
                disabled={busy || !sheetInput.trim() || !!shopifyActiveInfo || testing}
                onClick={handleAddSheet}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-hover disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Connecter le Sheet
              </button>
            </div>

            {/* Résultat du Test de Connexion & Numérisation des colonnes */}
            {testResult && (
              <div
                className={`rounded-2xl border p-4 text-xs space-y-3 animate-in fade-in duration-200 ${
                  testResult.success
                    ? "border-emerald-500/30 bg-emerald-500/5 text-slate-200"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">
                        {testResult.success
                          ? `Feuille validée : "${testResult.title}"`
                          : "Échec de connexion au Google Sheet"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{testResult.message}</p>
                    </div>
                  </div>

                  {testResult.success && sheetInput.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = extractSheetId(sheetInput);
                        if (id) handleAddSheetWithId(id);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Valider &amp; Rattacher
                    </button>
                  )}
                </div>

                {testResult.success && testResult.detectedColumns && (
                  <div className="rounded-xl border border-surface-border bg-surface/70 p-3 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Numérisation des colonnes détectées sur la feuille :
                    </span>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                          testResult.detectedColumns.phone
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.phone ? "✓ Téléphone Client" : "— Téléphone"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                          testResult.detectedColumns.clientName
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.clientName ? "✓ Nom du Client" : "— Nom"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                          testResult.detectedColumns.city
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.city ? "✓ Ville / Adresse" : "— Adresse"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                          testResult.detectedColumns.product
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.product ? "✓ Produit Commandé" : "— Produit"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                          testResult.detectedColumns.amount
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.amount ? "✓ Montant COD" : "— Montant"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                          testResult.detectedColumns.status
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        ✓ Colonne Statut ({testResult.statusColLetter || "WariTrack"})
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                          testResult.detectedColumns.livreur
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        ✓ Livreur Assigné
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 3. Note Architecturale : Transition Production OAuth 2.0 */}
      <div className="rounded-2xl border border-surface-border bg-surface p-4 flex items-start gap-3 text-xs text-slate-400">
        <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Évolution vers la Méthode B (OAuth 2.0 &amp; Refresh Token) :</strong>{" "}
          Le socle technique WariTrack intègre la double architecture. Le compte de service est actif et opérationnel immédiatement sans aucune contrainte de quota ou de validation Google. Le flux OAuth 2.0 (avec écran de consentement Google et rafraîchissement automatique de token offline) sera déployé en option cette semaine pour les marchands préférant le bouton 1-clic « Se connecter avec Google ».
        </div>
      </div>

      <ConfirmDialog
        open={confirmDisconnectShopify}
        title="Déconnecter le flux Shopify de ce marché ?"
        message={`Voulez-vous vraiment déconnecter la boutique Shopify (${shopifyDetail?.shopDomain || ""}) de l'équipe ${team.name} ? La synchronisation Google Sheets sera immédiatement réactivée et vous pourrez reconnecter votre boutique à tout moment.`}
        confirmLabel="Déconnecter Shopify"
        danger={true}
        loading={busy}
        onConfirm={handleDisconnectShopify}
        onCancel={() => setConfirmDisconnectShopify(false)}
      />

      <ConfirmDialog
        open={!!confirmRemoveSheetId}
        title="Retirer ce tableur Google Sheets ?"
        message={`Le tableur ${confirmRemoveSheetId ? confirmRemoveSheetId.slice(0, 18) + "…" : ""} ne sera plus synchronisé avec l'équipe ${team.name}. Les nouvelles lignes ajoutées dans ce fichier ne remonteront plus.`}
        confirmLabel="Retirer le tableur"
        danger={true}
        loading={busy}
        onConfirm={async () => {
          if (!confirmRemoveSheetId) return;
          const target = confirmRemoveSheetId;
          setConfirmRemoveSheetId(null);
          await handleRemoveSheet(target);
        }}
        onCancel={() => setConfirmRemoveSheetId(null)}
      />
    </div>
  );
}
