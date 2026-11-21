import { useEffect, useState, useMemo } from "react";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ConfirmDialog, AFRICAN_LOCAL_LANGUAGES, type Team, type AppUser } from "@ecomcod/shared";
import { Globe2 } from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";
import AllocateEmployeeModal from "../components/AllocateEmployeeModal";

interface UtilisateursProps {
  workspaceId: string;
  team: Team | null;
  teams?: Team[];
  closeuses: AppUser[];
  livreurs: AppUser[];
}

type Role = "closeuse" | "livreur";

interface AccessLink {
  userId: string;
  accessLinkId: string;
  disabledAt: number | null;
  sessionsCount: number;
}

const functions = getFunctions(getApp());
const callCreateAccessUser = httpsCallable(functions, "createAccessUser");
const callRegeneratePassword = httpsCallable(functions, "regenerateAccessPassword");
const callSetStatus = httpsCallable(functions, "setAccessLinkStatus");
const callListLinks = httpsCallable(functions, "listAccessLinks");
const callDeleteEmployee = httpsCallable(functions, "deleteEmployee");
const callUpdateEmployeeLanguages = httpsCallable(functions, "updateEmployeeLanguages");

const CLOSEUSE_URL = import.meta.env.VITE_CLOSEUSE_URL as string | undefined;
const LIVREUR_URL = import.meta.env.VITE_LIVREUR_URL as string | undefined;

export default function Utilisateurs({
  workspaceId,
  team,
  teams = [],
  closeuses,
  livreurs,
}: UtilisateursProps) {
  const [tab, setTab] = useState<Role>("closeuse");
  const [selectedDialectFilter, setSelectedDialectFilter] = useState<string | null>(null);
  const [languageOverrides, setLanguageOverrides] = useState<Record<string, string[]>>({});
  const [allocatedOverrides, setAllocatedOverrides] = useState<Record<string, string[]>>({});
  const [allocatingUser, setAllocatingUser] = useState<AppUser | null>(null);
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<{ label: string; password: string } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState<AppUser | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<AppUser | null>(null);
  const [editingLanguagesUser, setEditingLanguagesUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseUsers = tab === "closeuse" ? closeuses : livreurs;
  const users = selectedDialectFilter
    ? baseUsers.filter((u) => {
        const langs = languageOverrides[u.id] ?? u.languages ?? [];
        return langs.some(
          (l) => l.toLowerCase() === selectedDialectFilter.toLowerCase()
        );
      })
    : baseUsers;

  // Calcul des dialectes disponibles dans l'équipe active
  const dialectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    baseUsers.forEach((u) => {
      const langs = languageOverrides[u.id] ?? u.languages ?? [];
      langs.forEach((l) => {
        counts[l] = (counts[l] || 0) + 1;
      });
    });
    return counts;
  }, [baseUsers, languageOverrides]);

  useEffect(() => {
    if (!team) {
      setLinks([]);
      return;
    }
    setLoadingLinks(true);
    callListLinks({ teamId: team.id })
      .then((res) => setLinks((res.data as { links: AccessLink[] }).links))
      .catch(() => setLinks([]))
      .finally(() => setLoadingLinks(false));
  }, [team, showCreate, revealedPassword]);

  const linkFor = (userId: string) => links.find((l) => l.userId === userId) ?? null;

  const handleRegenerate = async (user: AppUser) => {
    setBusyUserId(user.id);
    setError(null);
    try {
      const res = await callRegeneratePassword({ accessLinkId: linkFor(user.id)?.accessLinkId });
      setConfirmRegenerate(null);
      setRevealedPassword({ label: user.name, password: (res.data as { password: string }).password });
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    const link = linkFor(user.id);
    if (!link) return;
    setBusyUserId(user.id);
    setError(null);
    try {
      await callSetStatus({ accessLinkId: link.accessLinkId, disabled: !link.disabledAt });
      setLinks((prev) =>
        prev.map((l) => (l.userId === user.id ? { ...l, disabledAt: link.disabledAt ? null : Date.now() } : l))
      );
      setConfirmToggle(null);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusyUserId(confirmDelete.id);
    setError(null);
    try {
      await callDeleteEmployee({ userId: confirmDelete.id });
      setConfirmDelete(null);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusyUserId(null);
    }
  };

  const accessUrl = (userId: string) => {
    const link = linkFor(userId);
    if (!link) return null;
    const base = tab === "closeuse" ? CLOSEUSE_URL : LIVREUR_URL;
    const path = tab === "closeuse" ? "/c/" : "/l/";
    return base ? `${base}${path}${link.accessLinkId}` : `${path}${link.accessLinkId}`;
  };

  if (!team) {
    return <p className="text-sm text-slate-500">Sélectionne d'abord un marché en haut de page.</p>;
  }

  return (
    <div>
      {/* Bannière de Couverture Linguistique (Skill-Based Routing) */}
      <div className="mb-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-indigo-400 shrink-0" />
            <h3 className="text-xs font-bold text-slate-100">
              Couverture Linguistique & Routage par Dialectes ({team.name})
            </h3>
          </div>
          <span className="text-[11px] text-indigo-300 font-medium">
            Skill-Based Routing Actif
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Les commandes issues de vos pages produits avec une langue cible ou rédigées en dialectes locaux sont automatiquement attribuées en priorité aux collaborateurs maîtrisant ces langues.
        </p>

        {/* Filtre interactif par dialecte */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedDialectFilter(null)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
              selectedDialectFilter === null
                ? "bg-indigo-600 text-white shadow-xs"
                : "border border-surface-border bg-surface text-slate-400 hover:text-slate-200"
            }`}
          >
            Tous les collaborateurs ({baseUsers.length})
          </button>
          {Object.entries(dialectCounts).map(([dialect, count]) => {
            const isSelected = selectedDialectFilter === dialect;
            return (
              <button
                key={dialect}
                type="button"
                onClick={() =>
                  setSelectedDialectFilter(isSelected ? null : dialect)
                }
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "border border-surface-border bg-surface text-slate-300 hover:text-white"
                }`}
              >
                🗣️ {dialect} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-surface-border bg-surface-raised p-1">
          {(["closeuse", "livreur"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setTab(r)}
              className={`rounded-lg px-4 py-1.5 text-sm capitalize transition-colors ${
                tab === r ? "bg-brand text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {r === "closeuse" ? "Closeuses" : "Livreurs"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          + Nouvel utilisateur
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {users.length === 0 ? (
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 text-center text-sm text-slate-500">
          Aucun{tab === "livreur" ? "" : "e"} {tab} sur cette équipe pour l'instant.
        </div>
      ) : (
        <>
          {/* Vue tableau — desktop uniquement, colonnes trop nombreuses
             pour tenir proprement sur mobile */}
          <div className="hidden overflow-hidden rounded-2xl border border-surface-border bg-surface-raised sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-slate-500">
                  <th className="px-4 py-3 font-normal">Nom</th>
                  <th className="px-4 py-3 font-normal">Téléphone</th>
                  <th className="px-4 py-3 font-normal">Statut</th>
                  <th className="px-4 py-3 font-normal">Sessions</th>
                  <th className="px-4 py-3 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const link = linkFor(user.id);
                  const url = accessUrl(user.id);
                  const disabled = !!link?.disabledAt;
                  const isBorrowed = !!(user.teamId && team && user.teamId !== team.id);
                  const homeTeamObj = isBorrowed ? teams.find((t) => t.id === user.teamId) : null;
                  const allocatedIds = allocatedOverrides[user.id] ?? user.allocatedTeamIds ?? [];
                  return (
                    <tr key={user.id} className="border-b border-surface-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{user.name}</div>
                        {(() => {
                          const langs = languageOverrides[user.id] ?? user.languages ?? [];
                          return (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {langs.length > 0 ? (
                                langs.map((l) => (
                                  <span key={l} className="inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                                    🗣️ {l}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">Français par défaut</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingLanguagesUser(user)}
                                className="text-[10px] text-sky-400 hover:text-sky-300 underline ml-1 cursor-pointer"
                              >
                                Modifier
                              </button>
                            </div>
                          );
                        })()}
                        {isBorrowed && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                              🤝 Emprunté à l'équipe {homeTeamObj?.name || "partenaire"}
                            </span>
                          </div>
                        )}
                        {!isBorrowed && allocatedIds.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {allocatedIds.map((tid) => {
                              const t = teams.find((item) => item.id === tid);
                              return (
                                <span
                                  key={tid}
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"
                                  title={`Prêté à l'équipe ${t?.name || tid}`}
                                >
                                  🤝 Prêté à {t?.name || tid}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{user.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge disabled={disabled} />
                      </td>
                      <td className="px-4 py-3 text-slate-400">{link ? `${link.sessionsCount}/2` : "—"}</td>
                      <td className="px-4 py-3">
                        <UserActions
                          url={url}
                          busy={busyUserId === user.id}
                          disabled={disabled}
                          onRegenerate={() => setConfirmRegenerate(user)}
                          onToggle={() => (disabled ? handleToggleStatus(user) : setConfirmToggle(user))}
                          onDelete={() => setConfirmDelete(user)}
                          onAllocate={() => setAllocatingUser(user)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vue cartes — mobile uniquement, une carte empilée par employé */}
          <div className="space-y-3 sm:hidden">
            {users.map((user) => {
              const link = linkFor(user.id);
              const url = accessUrl(user.id);
              const disabled = !!link?.disabledAt;
              const isBorrowed = !!(user.teamId && team && user.teamId !== team.id);
              const homeTeamObj = isBorrowed ? teams.find((t) => t.id === user.teamId) : null;
              const allocatedIds = allocatedOverrides[user.id] ?? user.allocatedTeamIds ?? [];
              return (
                <div key={user.id} className="rounded-2xl border border-surface-border bg-surface-raised p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-200">{user.name}</p>
                      {(() => {
                        const langs = languageOverrides[user.id] ?? user.languages ?? [];
                        return (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {langs.length > 0 ? (
                              langs.map((l) => (
                                <span key={l} className="inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                                  🗣️ {l}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Français par défaut</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingLanguagesUser(user)}
                              className="text-[10px] text-sky-400 hover:text-sky-300 underline ml-1 cursor-pointer"
                            >
                              Modifier
                            </button>
                          </div>
                        );
                      })()}
                      {isBorrowed && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                            🤝 Emprunté à l'équipe {homeTeamObj?.name || "partenaire"}
                          </span>
                        </div>
                      )}
                      {!isBorrowed && allocatedIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {allocatedIds.map((tid) => {
                            const t = teams.find((item) => item.id === tid);
                            return (
                              <span
                                key={tid}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"
                                title={`Prêté à l'équipe ${t?.name || tid}`}
                              >
                                🤝 Prêté à {t?.name || tid}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <p className="truncate text-xs text-slate-500 mt-1">{user.phone || "Pas de téléphone"}</p>
                    </div>
                    <StatusBadge disabled={disabled} />
                  </div>
                  <p className="mb-3 text-xs text-slate-500">Sessions : {link ? `${link.sessionsCount}/2` : "—"}</p>
                  <UserActions
                    url={url}
                    busy={busyUserId === user.id}
                    disabled={disabled}
                    onRegenerate={() => setConfirmRegenerate(user)}
                    onToggle={() => (disabled ? handleToggleStatus(user) : setConfirmToggle(user))}
                    onDelete={() => setConfirmDelete(user)}
                    onAllocate={() => setAllocatingUser(user)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {loadingLinks && <p className="mt-2 text-xs text-slate-600">Mise à jour des accès…</p>}

      {showCreate && (
        <CreateAccessModal
          workspaceId={workspaceId}
          team={team}
          defaultRole={tab}
          onClose={() => setShowCreate(false)}
          onCreated={(label, password) => {
            setShowCreate(false);
            setRevealedPassword({ label, password });
          }}
        />
      )}

      {revealedPassword && (
        <PasswordRevealModal
          label={revealedPassword.label}
          password={revealedPassword.password}
          onClose={() => setRevealedPassword(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          name={confirmDelete.name}
          busy={busyUserId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      <ConfirmDialog
        open={!!confirmRegenerate}
        title={confirmRegenerate ? `Régénérer le mot de passe de ${confirmRegenerate.name} ?` : ""}
        message="L'ancien mot de passe sera immédiatement invalidé et les sessions actives de cet employé seront fermées. Vous devrez lui transmettre le nouveau code."
        confirmLabel="Régénérer le code"
        danger={false}
        loading={!!confirmRegenerate && busyUserId === confirmRegenerate.id}
        onConfirm={() => confirmRegenerate && handleRegenerate(confirmRegenerate)}
        onCancel={() => setConfirmRegenerate(null)}
      />

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle ? `Désactiver l'accès de ${confirmToggle.name} ?` : ""}
        message="Cet employé sera déconnecté immédiatement et ne recevra plus aucune nouvelle commande automatique tant que son compte restera désactivé."
        confirmLabel="Désactiver l'accès"
        danger={true}
        loading={!!confirmToggle && busyUserId === confirmToggle.id}
        onConfirm={() => confirmToggle && handleToggleStatus(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
      />

      {editingLanguagesUser && (
        <EditLanguagesModal
          user={editingLanguagesUser}
          onClose={() => setEditingLanguagesUser(null)}
          onSaved={(newLanguages) => {
            editingLanguagesUser.languages = newLanguages;
            setLanguageOverrides((prev) => ({
              ...prev,
              [editingLanguagesUser.id]: newLanguages,
            }));
            setEditingLanguagesUser(null);
          }}
        />
      )}

      {allocatingUser && (
        <AllocateEmployeeModal
          workspaceId={workspaceId}
          user={allocatingUser}
          homeTeam={teams.find((t) => t.id === (allocatingUser.teamId || team?.id)) || team}
          teams={teams}
          onClose={() => setAllocatingUser(null)}
          onSuccess={(newAllocations) => {
            setAllocatedOverrides((prev) => ({
              ...prev,
              [allocatingUser.id]: newAllocations,
            }));
            setAllocatingUser(null);
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ disabled }: { disabled: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
        disabled ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"
      }`}
    >
      {disabled ? "Désactivé" : "Actif"}
    </span>
  );
}

function UserActions({
  url,
  busy,
  disabled,
  onRegenerate,
  onToggle,
  onDelete,
  onAllocate,
}: {
  url: string | null;
  busy: boolean;
  disabled: boolean;
  onRegenerate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onAllocate?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {url && (
        <button
          type="button"
          onClick={handleCopy}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
            copied
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold"
              : "border-surface-border text-slate-300 hover:bg-surface"
          }`}
        >
          {copied ? "✓ Lien copié !" : "Copier le lien"}
        </button>
      )}
      <button
        disabled={busy}
        onClick={onRegenerate}
        className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-300 hover:bg-surface disabled:opacity-50"
      >
        Régénérer
      </button>
      <button
        disabled={busy}
        onClick={onToggle}
        className={`rounded-lg px-2.5 py-1 text-xs disabled:opacity-50 ${
          disabled
            ? "border border-green-500/30 text-green-400 hover:bg-green-500/10"
            : "border border-red-500/30 text-red-400 hover:bg-red-500/10"
        }`}
      >
        {disabled ? "Activer" : "Désactiver"}
      </button>
      {onAllocate && (
        <button
          type="button"
          disabled={busy}
          onClick={onAllocate}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1"
          title="Prêter ou allouer cet employé à une autre équipe du même pays"
        >
          <span>🤝</span>
          <span>Prêt équipe</span>
        </button>
      )}
      {disabled && (
        <button
          disabled={busy}
          onClick={onDelete}
          className="rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}

function ConfirmDeleteModal({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-surface-raised p-6 text-center">
        <h2 className="mb-2 text-lg font-medium text-slate-100">Supprimer {name} ?</h2>
        <p className="mb-6 text-sm text-slate-500">
          Action définitive et irréversible. Le compte, son lien d'accès et son historique de connexion seront
          supprimés. Es-tu sûr ?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm text-slate-300"
          >
            Annuler
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Suppression..." : "Oui, supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateAccessModal({
  workspaceId,
  team,
  defaultRole,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  team: Team;
  defaultRole: Role;
  onClose: () => void;
  onCreated: (label: string, password: string) => void;
}) {
  const [assignedTeamId, setAssignedTeamId] = useState(team.id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>(defaultRole);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["Français"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLanguage = (lang: string) => {
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await callCreateAccessUser({
        name: name.trim(),
        phone: phone.trim(),
        role,
        teamId: assignedTeamId || team.id,
        workspaceId,
        languages: selectedLanguages,
      });
      const { password } = res.data as { password: string };
      onCreated(name.trim(), password);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6">
        <h2 className="mb-1 text-lg font-medium text-slate-100">Nouvel accès employé</h2>
        <p className="mb-4 text-xs text-slate-400">
          Création d'un accès sécurisé avec routage par compétences linguistiques.
        </p>

        

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex rounded-xl border border-surface-border bg-surface p-1">
            {(["closeuse", "livreur"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 rounded-lg py-2 text-sm capitalize ${
                  role === r ? "bg-brand text-white" : "text-slate-400"
                }`}
              >
                {r === "closeuse" ? "Closeuse" : "Livreur"}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Téléphone (optionnel)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand"
            />
          </div>

          <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>Langues & Dialectes parlés (Skill-Based Routing)</span>
              </label>
              <p className="text-[11px] text-slate-500">
                WariTrack attribuera automatiquement les commandes des campagnes rédigées ou parlées dans ces langues à cette closeuse.
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-xl border border-surface-border bg-surface p-2.5">
                {AFRICAN_LOCAL_LANGUAGES.map((lang) => {
                  const active = selectedLanguages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                        active
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "border border-surface-border bg-surface-raised text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {active ? "✓ " : "+ "}
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-surface-border py-3 text-base font-medium text-slate-300"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 rounded-xl bg-brand py-3 text-base font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Création..." : "Créer l'accès"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordRevealModal({
  label,
  password,
  onClose,
}: {
  label: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-6 text-center">
        <h2 className="mb-1 text-lg font-medium text-slate-100">Mot de passe pour {label}</h2>
        <p className="mb-4 text-xs text-slate-500">
          Note-le maintenant — il ne sera plus jamais affiché après fermeture de cette fenêtre.
        </p>
        <div className="mb-4 rounded-xl border border-surface-border bg-surface py-4 text-2xl font-mono tracking-widest text-brand">
          {password}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(password)}
          className="mb-2 w-full rounded-xl border border-surface-border py-2.5 text-sm text-slate-300 hover:bg-surface"
        >
          Copier
        </button>
        <button onClick={onClose} className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white">
          J'ai noté, fermer
        </button>
      </div>
    </div>
  );
}

function EditLanguagesModal({
  user,
  onClose,
  onSaved,
}: {
  user: AppUser;
  onClose: () => void;
  onSaved: (languages: string[]) => void;
}) {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    Array.isArray(user.languages) && user.languages.length > 0 ? user.languages : ["Français"]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLanguage = (lang: string) => {
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await callUpdateEmployeeLanguages({
        userId: user.id,
        languages: selectedLanguages,
      });
      onSaved(selectedLanguages);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
        <h2 className="mb-1 text-base font-bold text-slate-100 flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-indigo-400" />
          <span>Langues de {user.name}</span>
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Cochez tous les dialectes parlés par cette closeuse pour le routage automatique par compétence.
        </p>

        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-surface-border bg-surface p-2.5 mb-4">
          {AFRICAN_LOCAL_LANGUAGES.map((lang) => {
            const active = selectedLanguages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "border border-surface-border bg-surface-raised text-slate-400 hover:text-slate-200"
                }`}
              >
                {active ? "✓ " : "+ "}
                {lang}
              </button>
            );
          })}
        </div>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-surface-border py-2 text-xs font-medium text-slate-300"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 rounded-xl bg-brand py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer les langues"}
          </button>
        </div>
      </div>
    </div>
  );
}
