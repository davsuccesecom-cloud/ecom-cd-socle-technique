import { useState } from "react";

interface LoginProps {
  sendLoginLink: (email: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<boolean>;
  needsWorkspaceName: boolean;
  linkSent: boolean;
  busy: boolean;
  error: string | null;
}

/**
 * Connexion admin = lien magique par email, pas de mot de passe ni de
 * popup Google. Système multi-entreprises : n'importe quel email peut
 * créer son propre espace ; à la première connexion, on demande le nom
 * de l'espace à créer (section auto-signup).
 */
export default function Login({
  sendLoginLink,
  createWorkspace,
  needsWorkspaceName,
  linkSent,
  busy,
  error,
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  if (needsWorkspaceName) {
    return (
      <Shell title="Bienvenue 👋">
        <p className="mb-6 text-center text-sm text-slate-500">
          Premier passage ici — donne un nom à ton espace pour démarrer ton propre système
          COD, séparé de tout le monde.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (workspaceName.trim()) createWorkspace(workspaceName);
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm text-slate-400">Nom de ton entreprise / espace</label>
            <input
              autoFocus
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Ex : TG Mobile"
              className="w-full rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !workspaceName.trim()}
            className="w-full rounded-xl bg-brand py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {busy ? "Création..." : "Créer mon espace"}
          </button>
        </form>
      </Shell>
    );
  }

  if (linkSent) {
    return (
      <Shell title="Vérifie ta boîte mail 📩">
        <p className="text-center text-sm text-slate-500">
          Un lien de connexion a été envoyé à <span className="text-slate-300">{email}</span>.
          Ouvre-le depuis ce même appareil pour te connecter — pas de mot de passe à retenir.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="Ecom COD" subtitle="Espace admin">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) sendLoginLink(email.trim());
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm text-slate-400">Ton email</label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            className="w-full rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="w-full rounded-xl bg-brand py-3 text-base font-medium text-white disabled:opacity-50"
        >
          {busy ? "Envoi..." : "Recevoir mon lien de connexion"}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-slate-600">
        Pas de mot de passe : tu reçois un lien par email, tu cliques, tu es connecté.
        Première connexion : ton propre espace est créé automatiquement.
      </p>
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl">
            <img src="/icons/icon-192.png" alt="Ecom COD" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-xl font-medium text-slate-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
