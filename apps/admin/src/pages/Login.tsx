import { useState } from "react";
import WariTrackLogo from "../components/WariTrackLogo";

interface LoginProps {
  sendLoginLink: (email: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<boolean>;
  needsWorkspaceName: boolean;
  linkSent: boolean;
  busy: boolean;
  error: string | null;
}

/**
 * Connexion administrateur par lien magique par e-mail (sans mot de passe).
 * Multi-espaces : chaque nouvel utilisateur peut initialiser son propre espace COD.
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
      <Shell title="Créer votre espace" subtitle="Première connexion à WariTrack">
        <p className="mb-5 text-center text-sm text-slate-400">
          Indiquez le nom de votre entreprise ou boutique pour initialiser votre cockpit COD isolé.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (workspaceName.trim()) createWorkspace(workspaceName);
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Nom de l'entreprise / espace
            </label>
            <input
              autoFocus
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Ex : WariExpress Lomé"
              className="w-full min-h-[48px] rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !workspaceName.trim()}
            className="w-full min-h-[48px] rounded-xl bg-brand py-3 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Création..." : "Créer mon espace"}
          </button>
        </form>
      </Shell>
    );
  }

  if (linkSent) {
    return (
      <Shell title="Vérifiez votre boîte mail" subtitle="Lien de connexion envoyé">
        <p className="text-center text-sm text-slate-400 leading-relaxed">
          Un lien de connexion sécurisé a été envoyé à{" "}
          <span className="font-medium text-slate-200">{email}</span>. Ouvrez-le depuis cet
          appareil pour accéder au cockpit.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="WariTrack" subtitle="Cockpit Direction — Cash & Logistique">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) sendLoginLink(email.trim());
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Adresse e-mail professionnelle</label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="direction@votre-boutique.com"
            className="w-full min-h-[48px] rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand"
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="w-full min-h-[48px] rounded-xl bg-brand py-3 text-base font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "Envoi..." : "Recevoir mon lien de connexion"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500 leading-relaxed">
        Connexion sans mot de passe par lien unique. Lors de votre première visite, votre espace est configuré automatiquement.
      </p>
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3">
            <WariTrackLogo size="lg" variant="icon" subtitle="" />
          </div>
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
