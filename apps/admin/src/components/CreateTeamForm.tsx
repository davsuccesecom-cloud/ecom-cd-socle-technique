import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";
import { Globe2, CheckCircle2, AlertTriangle } from "lucide-react";
import CountryMapBackdrop, { getCountryMeta } from "./CountryMapBackdrop";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface CreateTeamFormProps {
  workspaceId: string;
  onCreated: (teamId: string) => void;
  onCancel?: () => void;
}

const WEST_COUNTRIES = AFRICA_COUNTRIES.filter((c) => c.region === "ouest");
const OTHER_COUNTRIES = AFRICA_COUNTRIES.filter((c) => c.region === "autre");

export default function CreateTeamForm({ workspaceId, onCreated, onCancel }: CreateTeamFormProps) {
  const [country, setCountry] = useState(WEST_COUNTRIES[0].code);
  const [name, setName] = useState(`Équipe ${WEST_COUNTRIES[0].name}`);
  const [currency, setCurrency] = useState(getCountryMeta(WEST_COUNTRIES[0].code).currency);
  const [remunCloseuse, setRemunCloseuse] = useState("500");
  const [remunLivreur, setRemunLivreur] = useState("1500");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = getCountryMeta(country);
  const selectedCountryObj = AFRICA_COUNTRIES.find((c) => c.code === country);

  const handleSelectCountry = (code: string) => {
    setCountry(code);
    const cObj = AFRICA_COUNTRIES.find((c) => c.code === code);
    const countryMeta = getCountryMeta(code);
    setCurrency(countryMeta.currency);
    if (cObj && (!name.trim() || name.startsWith("Équipe "))) {
      setName(`Équipe ${cObj.name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const db = getDb();
      const finalCurrency = currency.trim().toUpperCase() || meta.currency;
      const docRef = await addDoc(collection(db, "workspaces", workspaceId, "teams"), {
        workspaceId,
        name: name.trim(),
        sheetIds: [],
        defaultCountry: country,
        currency: finalCurrency,
        remunerationCloseusePerOrder: Number(remunCloseuse) || 0,
        remunerationLivreurPerOrder: Number(remunLivreur) || 0,
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
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl border border-surface-border bg-white dark:bg-surface-raised p-6 shadow-2xl">
      <CountryMapBackdrop countryCode={country} className="opacity-70" />

      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <Globe2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {onCancel ? "Déployer un nouveau marché" : "Créer votre premier marché"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chaque équipe dispose de sa devise, ses opérateurs et son routage pays.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Prêt
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Country Selector + Geographic Summary */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Pays / Territoire</label>
            <select
              value={country}
              onChange={(e) => handleSelectCountry(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-surface px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
            >
              <optgroup label="Afrique de l'Ouest">
                {WEST_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Autres marchés d'Afrique">
                {OTHER_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </optgroup>
            </select>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-slate-100/80 dark:bg-surface/80 px-2.5 py-1">
                <img
                  src={`https://flagcdn.com/20x15/${country.toLowerCase()}.png`}
                  alt=""
                  className="h-3 w-4 rounded-[2px] object-cover"
                />
                <strong className="text-slate-900 dark:text-slate-200">{selectedCountryObj?.name}</strong>
              </span>
              {meta.capital && (
                <span className="rounded-lg border border-surface-border bg-slate-100/80 dark:bg-surface/80 px-2.5 py-1">
                  Hub : <strong className="text-slate-900 dark:text-slate-200">{meta.capital}</strong>
                </span>
              )}
              <span className="rounded-lg border border-surface-border bg-slate-100/80 dark:bg-surface/80 px-2.5 py-1 font-mono">
                Indicatif : <strong className="text-slate-900 dark:text-slate-200">{meta.dialCode}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 font-mono text-brand">
                Devise :
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="w-16 rounded border border-brand/40 bg-white dark:bg-surface/90 px-1.5 py-0.5 text-center text-[11px] font-bold text-brand outline-none focus:ring-1 focus:ring-brand"
                  placeholder={meta.currency}
                  title="Devise du marché (ex: KES, XOF, XAF, NGN, USD)"
                />
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Nom de l'équipe opérationnelle</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Équipe Togo"
              className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-surface px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 focus:border-brand"
            />
          </div>

          {/* Default Commissions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Prime Closeuse ({currency || meta.currency})
              </label>
              <input
                type="number"
                min="0"
                value={remunCloseuse}
                onChange={(e) => setRemunCloseuse(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-surface px-3 py-2 text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                Prime Livreur ({currency || meta.currency})
              </label>
              <input
                type="number"
                min="0"
                value={remunLivreur}
                onChange={(e) => setRemunLivreur(e.target.value)}
                className="w-full rounded-xl border border-surface-border bg-slate-50 dark:bg-surface px-3 py-2 text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-surface-border bg-slate-100 dark:bg-surface py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:text-slate-100"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting ? "Initialisation du marché…" : "Activer cette équipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
