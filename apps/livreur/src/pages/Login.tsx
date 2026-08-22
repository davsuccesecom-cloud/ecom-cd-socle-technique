import { useState } from "react";
import { useAccessLinkAuth } from "@ecomcod/shared";

interface LoginProps {
  accessLinkId: string;
}

export default function Login({ accessLinkId }: LoginProps) {
  const { login, error } = useAccessLinkAuth();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await login(accessLinkId, password);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-medium text-white">
            E
          </div>
          <h1 className="text-xl font-medium">Ecom COD</h1>
          <p className="text-sm text-slate-500">Espace livreur</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-slate-600">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              inputMode="text"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-brand"
              placeholder="Reçu de ton admin"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded-xl bg-brand py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
