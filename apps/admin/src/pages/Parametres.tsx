import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import { useTheme } from "../hooks/useTheme";
import MetaCapiConnector from "../components/MetaCapiConnector";

interface ParametresProps {
  workspaceId: string;
  team: Team | null;
}

const SOUND_KEY = "ecomcod-sound-notifications";

export default function Parametres({ workspaceId, team }: ParametresProps) {
  const { theme, setTheme } = useTheme();
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "off");
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
  };

  const playTestSound = () => {
    const audio = new Audio("/notification-ping.mp3");
    audio.play().catch(() => {});
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* En-tête Paramètres */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-surface-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Paramètres & Intégrations</h1>
          <p className="text-xs text-slate-400">
            Personnalisez vos préférences d'affichage, configurez les règles de l'équipe et connectez Meta CAPI.
          </p>
        </div>
        {team && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-brand/30 bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
            Équipe active : {team.name} ({team.defaultCountry})
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonne gauche (5 colonnes sur PC) : Apparence, Son & Règles Opérationnelles */}
        <div className="lg:col-span-5 space-y-6">
          {/* Carte Apparence & Notifications Sonores */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Apparence de l'interface</h3>
              <p className="mb-3 text-xs text-slate-400">Choisissez le thème visuel pour votre espace de travail.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTheme("dark")}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    theme === "dark"
                      ? "border-brand bg-brand-light text-brand shadow-sm"
                      : "border-surface-border text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🌙 Sombre
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    theme === "light"
                      ? "border-brand bg-brand-light text-brand shadow-sm"
                      : "border-surface-border text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ☀️ Clair
                </button>
              </div>
            </div>

            <div className="border-t border-surface-border pt-4">
              <h3 className="text-sm font-semibold text-slate-200">Notifications sonores</h3>
              <p className="mb-3 text-xs text-slate-400">
                Émet un bip sonore dès qu'une commande est reçue ou mise à jour sur cet appareil.
              </p>
              <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface/50 px-4 py-3">
                <span className="text-sm font-medium text-slate-300">Activer le son</span>
                <button
                  onClick={toggleSound}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    soundEnabled ? "bg-brand" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      soundEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <button
                onClick={playTestSound}
                className="mt-3 w-full rounded-xl border border-surface-border py-2 text-xs font-medium text-slate-300 hover:bg-surface transition-colors"
              >
                🔊 Tester le son
              </button>
            </div>
          </div>

          {/* Carte Réglages Équipe */}
          {team ? (
            <TeamSettingsForm workspaceId={workspaceId} team={team} />
          ) : (
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 text-center text-sm text-slate-400">
              Veuillez sélectionner une équipe pour configurer ses paramètres.
            </div>
          )}
        </div>

        {/* Colonne droite (7 colonnes sur PC) : Meta Conversions API (CAPI) */}
        <div className="lg:col-span-7 space-y-6">
          {team ? (
            <MetaCapiConnector workspaceId={workspaceId} team={team} />
          ) : (
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 text-center text-sm text-slate-400">
              Veuillez sélectionner une équipe pour configurer la liaison Meta Conversions API.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamSettingsForm({ workspaceId, team }: { workspaceId: string; team: Team }) {
  const [reminderStart, setReminderStart] = useState(team.reminderWindowStart);
  const [reminderEnd, setReminderEnd] = useState(team.reminderWindowEnd);
  const [overloadThreshold, setOverloadThreshold] = useState(String(team.overloadAlertThreshold));
  const [digestInterval, setDigestInterval] = useState(String(team.digestIntervalMinutes));
  const [remunCloseuse, setRemunCloseuse] = useState(String(team.remunerationCloseusePerOrder ?? ""));
  const [remunLivreur, setRemunLivreur] = useState(String(team.remunerationLivreurPerOrder ?? ""));

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamCurrency = team.metaCapiConfig?.currency || "XOF";

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", team.id), {
        reminderWindowStart: reminderStart,
        reminderWindowEnd: reminderEnd,
        overloadAlertThreshold: Number(overloadThreshold) || 0,
        digestIntervalMinutes: Number(digestInterval) || 0,
        remunerationCloseusePerOrder: Number(remunCloseuse) || 0,
        remunerationLivreurPerOrder: Number(remunLivreur) || 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Règles & Rémunérations — {team.name}</h3>
        <p className="text-xs text-slate-400">Rappels de relance, seuils de surcharge et barème par commande.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Plage horaire des rappels clients</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={reminderStart}
              onChange={(e) => setReminderStart(e.target.value)}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
            <span className="text-slate-500 font-medium">→</span>
            <input
              type="time"
              value={reminderEnd}
              onChange={(e) => setReminderEnd(e.target.value)}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Seuil de surcharge closeuse (nb commandes actives)
          </label>
          <input
            type="number"
            min="1"
            value={overloadThreshold}
            onChange={(e) => setOverloadThreshold(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Fréquence du résumé admin</label>
          <select
            value={digestInterval}
            onChange={(e) => setDigestInterval(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
          >
            <option value="30">Toutes les 30 minutes</option>
            <option value="60">Toutes les heures</option>
            <option value="120">Toutes les 2 heures</option>
            <option value="240">Toutes les 4 heures</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Rémun. closeuse / commande ({teamCurrency})
            </label>
            <input
              type="number"
              min="0"
              placeholder="ex: 500"
              value={remunCloseuse}
              onChange={(e) => setRemunCloseuse(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Rémun. livreur / commande ({teamCurrency})
            </label>
            <input
              type="number"
              min="0"
              placeholder="ex: 1500"
              value={remunLivreur}
              onChange={(e) => setRemunLivreur(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          disabled={saving}
          onClick={handleSave}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Enregistrement en cours..." : saved ? "✓ Enregistré avec succès" : "Enregistrer les réglages"}
        </button>
      </div>
    </div>
  );
}
