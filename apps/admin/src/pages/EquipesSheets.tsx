import { useState, useEffect, useMemo, useRef } from "react";
import { doc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import CreateTeamForm from "../components/CreateTeamForm";
import { getCountryMeta } from "../components/CountryMapBackdrop";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface EquipesSheetsProps {
  workspaceId: string;
  teams: Team[];
}

const ROBOT = "meta-capi-app@appspot.gserviceaccount.com";
const MAX_SHEETS = 5;

function countryFor(code: string) {
  return AFRICA_COUNTRIES.find((c) => c.code === code) ?? null;
}

function flagUrl(code: string, size: "sm" | "lg" = "sm") {
  const c = (code || "tg").toLowerCase();
  return size === "lg"
    ? `https://flagcdn.com/40x30/${c}.png`
    : `https://flagcdn.com/24x18/${c}.png`;
}

function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/d\/([\w-]{20,})/);
  if (m) return m[1];
  if (/^[\w-]{25,}$/.test(trimmed)) return trimmed;
  return null;
}

// Composant icône vectoriel officiel Google Sheets exact
function GoogleSheetsIcon({ className = "w-10 h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 54" className={className} aria-hidden="true">
      <path d="M8 0h18l14 14v34a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6z" fill="#23A566" />
      <path d="M26 0l14 14h-8a6 6 0 0 1-6-6z" fill="#87CEAC" />
      <rect x="10" y="24" width="20" height="16" fill="#fff" />
      <g fill="#23A566">
        <rect x="11.5" y="25.5" width="7" height="3.5" />
        <rect x="21.5" y="25.5" width="7" height="3.5" />
        <rect x="11.5" y="30.5" width="7" height="3.5" />
        <rect x="21.5" y="30.5" width="7" height="3.5" />
        <rect x="11.5" y="35.5" width="7" height="3.5" />
        <rect x="21.5" y="35.5" width="7" height="3.5" />
      </g>
    </svg>
  );
}

// Icône Shopify vectorielle propre
function ShopifyIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export default function EquipesSheets({ workspaceId, teams }: EquipesSheetsProps) {
  const [cur, setCur] = useState<string>(teams[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Modals
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardLink, setWizardLink] = useState("");
  const [wizardErr, setWizardErr] = useState<string | null>(null);
  const [wizardChecking, setWizardChecking] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editRemunCloseuse, setEditRemunCloseuse] = useState("500");
  const [editRemunLivreur, setEditRemunLivreur] = useState("1500");
  const [savingEdit, setSavingEdit] = useState(false);

  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [rawShopifyConnections, setRawShopifyConnections] = useState<any[]>([]);

  // Écoute des connexions Shopify
  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setRawShopifyConnections(list);
    });
    return () => unsub();
  }, [workspaceId]);

  // Synchronisation sélection courante
  useEffect(() => {
    if (cur && !teams.some((t) => t.id === cur)) {
      setCur(teams[0]?.id ?? "");
    } else if (!cur && teams.length > 0) {
      setCur(teams[0].id);
    }
  }, [teams, cur]);

  const team = useMemo(() => teams.find((t) => t.id === cur) ?? teams[0] ?? null, [teams, cur]);

  // Informations Shopify pour l'équipe courante
  const teamShopify = useMemo(() => {
    if (!team) return null;
    for (const c of rawShopifyConnections) {
      if (c.status === "active") {
        if (c.ownerTeamId === team.id) {
          return {
            connectionId: c.id,
            domain: c.shopDomain,
            label: `${c.shopDomain} (Principal)`,
            isOwner: true,
          };
        }
        if (c.countryRoutes) {
          for (const [code, r] of Object.entries<any>(c.countryRoutes)) {
            if (r.assignedTeamId === team.id && r.status === "active") {
              return {
                connectionId: c.id,
                domain: c.shopDomain,
                label: `${c.shopDomain} (Délégué ${code})`,
                isOwner: false,
                countryCode: code,
              };
            }
          }
        }
      }
    }
    return null;
  }, [team, rawShopifyConnections]);

  const healthy = (t: Team) => {
    const hasSheets = (t.sheetIds || []).length > 0;
    const hasShopify = rawShopifyConnections.some(
      (c) =>
        c.status === "active" &&
        (c.ownerTeamId === t.id ||
          (c.countryRoutes &&
            Object.values<any>(c.countryRoutes).some(
              (r) => r.assignedTeamId === t.id && r.status === "active"
            )))
    );
    return hasSheets || hasShopify;
  };

  const toast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 2500);
  };

  const copy = (text: string, label = "Copié !") => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast(label),
        () => toast("Sélectionnez le texte manuellement")
      );
    }
  };

  // Fermeture du menu déroulant au clic extérieur
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  // Actions Assistant Google Sheets
  const openWizard = () => {
    setWizardStep(1);
    setWizardLink("");
    setWizardErr(null);
    setWizardChecking(false);
    setShowWizard(true);
  };

  const handleWizardCheckAndConnect = async () => {
    if (!team) return;
    setWizardErr(null);
    const id = extractSheetId(wizardLink);
    if (!id) {
      setWizardErr("Ce lien n'est pas valide. Il doit contenir « docs.google.com/spreadsheets/d/ ».");
      return;
    }
    if (team.sheetIds.includes(id)) {
      setWizardErr("Ce tableur est déjà connecté à cette équipe.");
      return;
    }

    setWizardChecking(true);
    try {
      const functions = getFunctions();
      const testFn = httpsCallable(functions, "testSheetConnection");
      const res = (await testFn({ sheetId: id, workspaceId })) as { data: any };

      if (!res.data?.success) {
        setWizardErr(res.data?.message || "Accès refusé. Avez-vous bien partagé la feuille avec l'adresse robot ?");
        setWizardChecking(false);
        return;
      }

      // Connexion effective dans Firestore
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", team.id), {
        sheetIds: [...team.sheetIds, id],
      });

      setWizardStep(3);
    } catch (err: any) {
      setWizardErr(err?.message || "Erreur de connexion au service Google Sheets.");
    } finally {
      setWizardChecking(false);
    }
  };

  const handleRemoveSheet = async (sheetId: string) => {
    if (!team) return;
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", team.id), {
        sheetIds: team.sheetIds.filter((s) => s !== sheetId),
      });
      toast("Tableur retiré avec succès");
    } catch (err: any) {
      const formatted = formatFirebaseError(err);
      toast(`Erreur : ${formatted.message}`);
    }
  };

  // Dissociation Shopify
  const handleUnlinkShopify = async () => {
    if (!team || !teamShopify) return;
    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", teamShopify.connectionId);
      if (teamShopify.isOwner) {
        await updateDoc(connRef, { status: "inactive", ownerTeamId: "" });
      } else if (teamShopify.countryCode) {
        await updateDoc(connRef, {
          [`countryRoutes.${teamShopify.countryCode}.assignedTeamId`]: "",
          [`countryRoutes.${teamShopify.countryCode}.status`]: "inactive",
        });
      }
      toast("Shopify dissocié");
    } catch (err: any) {
      toast("Échec de dissociation Shopify");
    }
  };

  // Suppression d'équipe
  const handleDeleteTeam = async () => {
    if (!team) return;
    setDeleting(true);
    try {
      const db = getDb();
      await deleteDoc(doc(db, "workspaces", workspaceId, "teams", team.id));
      setShowDeleteModal(false);
      setDeleteInput("");
      const remaining = teams.filter((t) => t.id !== team.id);
      setCur(remaining[0]?.id ?? "");
      toast("Équipe supprimée");
    } catch (err: any) {
      toast("Échec lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  // Édition d'équipe
  const openEdit = () => {
    if (!team) return;
    setEditName(team.name);
    setEditCurrency(team.currency);
    setEditRemunCloseuse(String(team.remunerationCloseusePerOrder ?? 500));
    setEditRemunLivreur(String(team.remunerationLivreurPerOrder ?? 1500));
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    setSavingEdit(true);
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", team.id), {
        name: editName.trim() || team.name,
        currency: editCurrency.trim().toUpperCase() || team.currency,
        remunerationCloseusePerOrder: Number(editRemunCloseuse) || 0,
        remunerationLivreurPerOrder: Number(editRemunLivreur) || 0,
      });
      setShowEditModal(false);
      toast("Équipe mise à jour");
    } catch (err) {
      toast("Échec de mise à jour");
    } finally {
      setSavingEdit(false);
    }
  };

  // Rattacher une boutique Shopify existante
  const handleAttachShopify = async (connectionId: string) => {
    if (!team) return;
    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", connectionId);
      await updateDoc(connRef, {
        ownerTeamId: team.id,
        status: "active",
      });
      setShowShopifyModal(false);
      toast("Boutique Shopify rattachée à cette équipe !");
    } catch (err) {
      toast("Erreur lors de la liaison");
    }
  };

  const country = team ? countryFor(team.defaultCountry) : null;
  const countryMeta = team ? getCountryMeta(team.defaultCountry) : null;

  return (
    <div className="mx-auto max-w-[940px] px-2 py-4 sm:px-4 sm:py-6">
      {/* 1. Bar supérieure : Titre et bouton d'ajout */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
            Équipes &amp; marchés
          </h1>
          <p className="text-sm text-slate-400">
            Choisissez une équipe, puis connectez ses commandes.
          </p>
        </div>
        <button
          onClick={() => setShowCreateTeam(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          + Nouvelle équipe
        </button>
      </div>

      {/* 2. Onglets des équipes (Style Pilule avec Drapeau et Statut) */}
      <div className="mb-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Équipes">
        {teams.map((t) => {
          const isSelected = t.id === cur;
          const isHealthy = healthy(t);

          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setCur(t.id)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                isSelected
                  ? "border-brand bg-brand-light text-slate-100 ring-1 ring-brand"
                  : "border-surface-border bg-surface text-slate-300 hover:border-slate-500 hover:text-slate-100"
              }`}
            >
              <img
                src={flagUrl(t.defaultCountry, "sm")}
                alt=""
                className="h-3 w-4 rounded-[2px] object-cover"
              />
              <span>{t.name}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isHealthy ? "bg-emerald-500" : "bg-amber-500"
                }`}
                title={isHealthy ? "Connectée" : "À configurer"}
              />
            </button>
          );
        })}
      </div>

      {/* 3. Vue de l'équipe sélectionnée */}
      {team && countryMeta ? (
        <section className="space-y-4">
          {/* En-tête de l'équipe avec drapeau large et menu ⋯ */}
          <div className="relative flex items-center gap-3.5 border-b border-surface-border pb-4">
            <img
              src={flagUrl(team.defaultCountry, "lg")}
              alt={country?.name || team.defaultCountry}
              className="h-7 w-10 rounded-md object-cover border border-surface-border shadow-sm shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-extrabold text-slate-100">
                {team.name}
              </h2>
              <div className="truncate text-xs text-slate-400">
                {country?.name || team.defaultCountry} · Hub {countryMeta.capital} · {team.currency} ({countryMeta.dialCode})
              </div>
            </div>

            {/* Menu More ⋯ */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                aria-label="Plus d'actions"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface text-sm font-bold text-slate-300 hover:border-slate-500 hover:text-slate-100 transition"
              >
                ⋯
              </button>

              {menuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-10 z-20 min-w-[220px] rounded-xl border border-surface-border bg-surface-raised p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      openEdit();
                    }}
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-surface transition"
                  >
                    Modifier la devise ou le nom
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowDeleteModal(true);
                    }}
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    Supprimer l'équipe
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4. Grille à 2 cartes : Shopify & Google Sheets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CARTE SHOPIFY */}
            <article className="flex min-h-[300px] flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-5">
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
                      <ShopifyIcon />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-100">Shopify</h3>
                      <p className="text-xs text-slate-400">Commandes en temps réel</p>
                    </div>
                  </div>
                  {teamShopify ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      Actif
                    </span>
                  ) : null}
                </div>

                {teamShopify ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs">
                      <span className="truncate font-mono text-slate-200">{teamShopify.domain}</span>
                      <button
                        type="button"
                        onClick={() => copy(teamShopify.domain, "Domaine copié")}
                        className="rounded-lg border border-surface-border px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:border-slate-500"
                      >
                        Copier
                      </button>
                    </div>
                    <div className="rounded-xl border border-surface-border bg-surface/50 p-3 text-xs">
                      <b className="text-slate-200 font-semibold block mb-0.5">
                        Flux direct actif ({teamShopify.label})
                      </b>
                      <small className="text-slate-400 block">
                        Chaque commande passée sur la boutique arrive directement dans WariTrack pour {team.name}.
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <p className="max-w-[32ch] text-xs text-slate-400">
                      Recevez chaque commande de votre boutique automatiquement par webhook, sans tableur.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-auto">
                {teamShopify ? (
                  <button
                    type="button"
                    onClick={handleUnlinkShopify}
                    className="w-full rounded-xl border border-surface-border py-2.5 text-xs font-semibold text-slate-300 hover:border-rose-500/40 hover:text-rose-400 transition"
                  >
                    Dissocier Shopify
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowShopifyModal(true)}
                    className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow transition hover:opacity-95"
                  >
                    Connecter Shopify
                  </button>
                )}
              </div>
            </article>

            {/* CARTE GOOGLE SHEETS */}
            <article className="flex min-h-[300px] flex-col justify-between rounded-2xl border border-surface-border bg-surface-raised p-5">
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <GoogleSheetsIcon className="h-9 w-auto shrink-0" />
                    <div>
                      <h3 className="text-base font-extrabold text-slate-100">Google Sheets</h3>
                      <p className="text-xs text-slate-400">
                        {team.sheetIds.length} / {MAX_SHEETS} tableurs
                      </p>
                    </div>
                  </div>
                  {team.sheetIds.length > 0 ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      Synchronisé
                    </span>
                  ) : null}
                </div>

                {team.sheetIds.length > 0 ? (
                  <div className="space-y-2">
                    {team.sheetIds.map((sId, idx) => (
                      <div
                        key={sId}
                        className="flex items-center justify-between gap-2.5 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs"
                      >
                        <GoogleSheetsIcon className="h-4 w-auto shrink-0" />
                        <div className="min-w-0 flex-1 truncate font-mono">
                          <b className="text-slate-200">Tableur {idx + 1}</b>
                          <small className="text-slate-400 block truncate">…{sId.slice(-8)}</small>
                        </div>
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${sId}/edit`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-brand hover:underline"
                        >
                          Ouvrir
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveSheet(sId)}
                          aria-label={`Retirer tableur ${idx + 1}`}
                          className="rounded p-1 text-slate-400 hover:text-rose-400 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <GoogleSheetsIcon className="h-10 w-auto mb-2 opacity-80" />
                    <p className="max-w-[32ch] text-xs text-slate-400">
                      Aucun tableur connecté. Les ventes hors campagne (WhatsApp, influenceurs) arrivent ici.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={openWizard}
                  disabled={team.sheetIds.length >= MAX_SHEETS}
                  className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow transition hover:opacity-95 disabled:opacity-40"
                >
                  {team.sheetIds.length >= MAX_SHEETS ? "Limite atteinte (5 tableurs)" : "Connecter un tableur"}
                </button>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {/* 5. Assistant de Connexion Google Sheets (Modal pas à pas) */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-[460px] rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4">
            {/* Barre de progression des 3 étapes */}
            <div className="flex gap-1.5" aria-hidden="true">
              {[1, 2, 3].map((stepIdx) => (
                <i
                  key={stepIdx}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    stepIdx <= wizardStep ? "bg-brand" : "bg-surface-border"
                  }`}
                />
              ))}
            </div>

            {/* Étape 1 : Partage avec le robot */}
            {wizardStep === 1 && (
              <div className="space-y-3.5">
                <div className="flex items-center gap-3">
                  <GoogleSheetsIcon className="h-7 w-auto shrink-0" />
                  <h3 className="text-lg font-extrabold text-slate-100">
                    Invitez le robot WariTrack
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Dans votre Google Sheet, cliquez sur <strong className="text-brand">Partager</strong>, collez cette adresse et choisissez le rôle <strong className="text-emerald-400">Éditeur</strong>.
                </p>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface p-2.5 text-xs">
                  <span className="truncate select-all font-mono text-slate-200">{ROBOT}</span>
                  <button
                    type="button"
                    onClick={() => copy(ROBOT, "Adresse du robot copiée")}
                    className="shrink-0 rounded-lg bg-surface-raised border border-surface-border px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                  >
                    Copier
                  </button>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWizard(false)}
                    className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-95"
                  >
                    C’est fait
                  </button>
                </div>
              </div>
            )}

            {/* Étape 2 : Coller le lien du tableur */}
            {wizardStep === 2 && (
              <div className="space-y-3.5">
                <h3 className="text-lg font-extrabold text-slate-100">
                  Collez le lien du tableur
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Copiez l’adresse depuis la barre de votre navigateur, ouvert sur le Google Sheet.
                </p>
                <input
                  type="text"
                  value={wizardLink}
                  onChange={(e) => {
                    setWizardLink(e.target.value);
                    if (wizardErr) setWizardErr(null);
                  }}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  autoFocus
                  className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand"
                />
                {wizardErr ? (
                  <p className="text-xs font-semibold text-rose-400" role="alert">
                    {wizardErr}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    disabled={wizardChecking}
                    className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface disabled:opacity-50"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={handleWizardCheckAndConnect}
                    disabled={wizardChecking || !wizardLink.trim()}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-95 disabled:opacity-50"
                  >
                    {wizardChecking ? "Vérification en cours…" : "Vérifier et connecter"}
                  </button>
                </div>
              </div>
            )}

            {/* Étape 3 : Succès */}
            {wizardStep === 3 && (
              <div className="flex flex-col items-center gap-3 py-4 text-center space-y-1">
                <svg
                  className="h-12 w-12 text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12.5l3 3 5-6" />
                </svg>
                <h3 className="text-lg font-extrabold text-slate-100">
                  Tableur connecté
                </h3>
                <p className="text-xs text-slate-300 max-w-[32ch]">
                  Les nouvelles commandes de ce tableur arrivent dans {team?.name} en temps réel.
                </p>
                <div className="pt-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWizard(false);
                      toast("Tableur synchronisé !");
                    }}
                    className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow hover:opacity-95"
                  >
                    Terminer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Modal Confirmation Suppression d'Équipe (Tapez le nom exact) */}
      {showDeleteModal && team && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-[440px] rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-3.5">
            <h3 className="text-lg font-extrabold text-slate-100">
              Supprimer {team.name} ?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Les tableurs et la connexion Shopify de cette équipe seront dissociés. Tapez{" "}
              <b className="text-slate-100 underline select-all">{team.name}</b> pour confirmer.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={team.name}
              autoFocus
              className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteInput("");
                }}
                disabled={deleting}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteTeam}
                disabled={deleting || deleteInput.trim().toLowerCase() !== team.name.toLowerCase()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rose-500 disabled:opacity-40"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Modification Équipe (Nom, Devise, Primes) */}
      {showEditModal && team && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-[480px] rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-base font-extrabold text-slate-100">
                Modifier {team.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nom de l'équipe</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-slate-100 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Devise du marché (ex: KES, XOF, USD)</label>
                <input
                  type="text"
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 font-mono font-bold text-brand outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Prime Closeuse ({editCurrency || team.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editRemunCloseuse}
                    onChange={(e) => setEditRemunCloseuse(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 font-mono tabular-nums text-slate-100 outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Prime Livreur ({editCurrency || team.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editRemunLivreur}
                    onChange={(e) => setEditRemunLivreur(e.target.value)}
                    className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 font-mono tabular-nums text-slate-100 outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-95 disabled:opacity-50"
              >
                {savingEdit ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. Modal Connexion Shopify */}
      {showShopifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-[480px] rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2.5">
                <ShopifyIcon className="text-sky-400" />
                <h3 className="text-base font-extrabold text-slate-100">
                  Connecter Shopify à {team?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShopifyModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {rawShopifyConnections.length === 0 ? (
              <div className="py-4 text-center space-y-2">
                <p className="text-xs text-slate-300">
                  Aucune connexion Shopify n'est encore configurée dans ce compte.
                </p>
                <p className="text-[11px] text-slate-400">
                  Rendez-vous dans <strong className="text-slate-200">Paramètres &amp; Flux</strong> pour installer le webhook de votre boutique Shopify.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-300 mb-2">
                  Sélectionnez une boutique active pour router ses commandes vers {team?.name} :
                </p>
                {rawShopifyConnections.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-surface-border bg-surface p-3 text-xs"
                  >
                    <div>
                      <b className="text-slate-100 font-semibold">{c.shopDomain}</b>
                      <small className="text-slate-400 block">Statut : {c.status}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAttachShopify(c.id)}
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                    >
                      Associer
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setShowShopifyModal(false)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-surface"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal Création Nouveau Marché */}
      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
            <CreateTeamForm
              workspaceId={workspaceId}
              onCreated={(newTeamId) => {
                setCur(newTeamId);
                setShowCreateTeam(false);
                toast("Marché créé avec succès !");
              }}
              onCancel={() => setShowCreateTeam(false)}
            />
          </div>
        </div>
      )}

      {/* 10. Toast Notification Flottant */}
      <div
        className={`fixed left-1/2 bottom-6 z-50 -translate-x-1/2 rounded-xl bg-slate-900 border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-100 shadow-2xl transition-all duration-200 pointer-events-none ${
          toastMsg ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        role="status"
      >
        {toastMsg}
      </div>
    </div>
  );
}
