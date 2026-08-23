import { useEffect, useState } from "react";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { Team, AppUser } from "@ecomcod/shared";

interface UtilisateursProps {
  workspaceId: string;
  team: Team | null;
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

const CLOSEUSE_URL = import.meta.env.VITE_CLOSEUSE_URL as string | undefined;
const LIVREUR_URL = import.meta.env.VITE_LIVREUR_URL as string | undefined;

export default function Utilisateurs({ workspaceId, team, closeuses, livreurs }: UtilisateursProps) {
  const [tab, setTab] = useState<Role>("closeuse");
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<{ label: string; password: string } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const users = tab === "closeuse" ? closeuses : livreurs;

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
      setRevealedPassword({ label: user.name, password: (res.data as { password: string }).password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Régénération impossible.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
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
      // La liste closeuses/livreurs vient des props (useTeamUsers en temps
      // réel côté parent) — elle se mettra à jour toute seule dès que
      // Firestore reflète la suppression.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
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
      <div className="mb-4 flex items-center justify-between gap-3">
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

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        {users.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Aucun{tab === "livreur" ? "" : "e"} {tab} sur cette équipe pour l'instant.
          </p>
        ) : (
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
                return (
                  <tr key={user.id} className="border-b border-surface-border last:border-0">
                    <td className="px-4 py-3 text-slate-200">{user.name}</td>
                    <td className="px-4 py-3 text-slate-400">{user.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          disabled ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"
                        }`}
                      >
                        {disabled ? "Désactivé" : "Actif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{link ? `${link.sessionsCount}/2` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {url && (
                          <button
                            onClick={() => navigator.clipboard.writeText(url)}
                            className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-300 hover:bg-surface"
                          >
                            Copier le lien
                          </button>
                        )}
                        <button
                          disabled={busyUserId === user.id}
                          onClick={() => handleRegenerate(user)}
                          className="rounded-lg border border-surface-border px-2.5 py-1 text-xs text-slate-300 hover:bg-surface disabled:opacity-50"
                        >
                          Régénérer
                        </button>
                        <button
                          disabled={busyUserId === user.id}
                          onClick={() => handleToggleStatus(user)}
                          className={`rounded-lg px-2.5 py-1 text-xs disabled:opacity-50 ${
                            disabled
                              ? "border border-green-500/30 text-green-400 hover:bg-green-500/10"
                              : "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                          }`}
                        >
                          {disabled ? "Activer" : "Désactiver"}
                        </button>
                        {/* Suppression visible UNIQUEMENT une fois l'accès
                           révoqué — garde-fou pour ne jamais supprimer un
                           employé encore actif par erreur. */}
                        {disabled && (
                          <button
                            disabled={busyUserId === user.id}
                            onClick={() => setConfirmDelete(user)}
                            className="rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {loadingLinks && <p className="px-4 py-2 text-xs text-slate-600">Mise à jour des accès…</p>}
      </div>

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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>(defaultRole);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        teamId: team.id,
        workspaceId,
      });
      const { password } = res.data as { password: string };
      onCreated(name.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6">
        <h2 className="mb-1 text-lg font-medium text-slate-100">Nouvel utilisateur</h2>
        <p className="mb-6 text-sm text-slate-500">Équipe : {team.name}</p>

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
