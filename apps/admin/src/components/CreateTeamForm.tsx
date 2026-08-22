import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";

interface CreateTeamFormProps {
  workspaceId: string;
  onCreated: (teamId: string) => void;
  /** Fourni uniquement quand le formulaire s'ouvre en popup depuis
   * MarketSelector (pas lors de l'onboarding initial, où il n'y a rien à
   * annuler puisqu'aucune équipe n'existe encore). */
  onCancel?: () => void;
}

const WEST_COUNTRIES = AFRICA_COUNTRIES.filter((c) => c.region === "ouest");
const OTHER_COUNTRIES = AFRICA_COUNTRIES.filter((c) => c.region === "autre");

/**
 * Onboarding : première équipe = premier pays/marché. Une équipe = un pays
 * — tout le reste (Sheets, closeuses, livreurs) se rattache à cette équipe
 * ensuite. Réutilisé aussi comme popup "Ajouter un marché" depuis
 * MarketSelector une fois qu'au moins une équipe existe déjà (onCancel
 * présent dans ce cas).
 */
export default function CreateTeamForm({ workspaceId, onCreated, onCancel }: CreateTeamFormProps) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState(WEST_COUNTRIES[0].code);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const db = getDb();
      const docRef = await addDoc(collection(db, "workspaces", workspaceId, "teams"), {
        workspaceId,
        name: name.trim(),
        sheetIds: [],
        defaultCountry: country,
        maxClosseuses: 10,
        maxLivreurs: 10,
        reminderWindowStart: "07:00",
        reminderWindowEnd: "22:00",
        overloadAlertThreshold: 20,
        digestIntervalMinutes: 120,
        createdAt: Date.now(),
      });
      onCreated(docRef.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6">
      <h2 className="mb-1 text-lg font-medium text-slate-100">
        {onCancel ? "Ajouter un marché" : "Crée ta première équipe"}
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        Une équipe correspond à un pays/marché. Tu pourras en ajouter d'autres ensuite.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Nom de l'équipe</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Ex : Équipe Sénégal"
            className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">Pays / Marché</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-base text-slate-100 outline-none focus:border-brand"
          >
            <optgroup label="Afrique de l'Ouest">
              {WEST_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Autres pays d'Afrique">
              {OTHER_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </optgroup>
          </select>
          {/* Note : dans un <select> natif, seul du texte est affiché — les
             drapeaux emoji ici peuvent apparaître en 2 lettres sur Windows,
             comme dans le menu principal avant ce correctif. Sans impact
             fonctionnel, juste cosmétique sur cette liste précise. */}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-surface-border py-3 text-base font-medium text-slate-300"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex-1 rounded-xl bg-brand py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Création..." : "Créer l'équipe"}
          </button>
        </div>
      </form>
    </div>
  );
}
