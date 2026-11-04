import { useEffect, useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb, ConfirmDialog, buildWhatsAppLink } from "@ecomcod/shared";
import type { Team, Order } from "@ecomcod/shared";
import {
  Palette,
  Sliders,
  Store,
  Printer,
  Share2,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Check,
  RotateCcw,
  Save,
  AlertTriangle,
  Download,
  Copy,
  PhoneCall,
  Smartphone,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useTheme, ACCENT_PRESETS } from "../hooks/useTheme";
import MetaCapiConnector from "../components/MetaCapiConnector";
import ShopifyFluxManager from "../components/ShopifyFluxManager";
import PrintReceiptConfig from "../components/PrintReceiptConfig";
import WhiteLabelSettings from "../components/WhiteLabelSettings";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface ParametresProps {
  workspaceId: string;
  team: Team | null;
  teams?: Team[];
  orders?: Order[];
}

type SettingsTab = "general" | "rules" | "shopify" | "print" | "metacapi" | "phone_export" | "white_label";

const SOUND_KEY = "ecomcod-sound-notifications";

export default function Parametres({ workspaceId, team, teams = [], orders = [] }: ParametresProps) {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("shopify");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) return false;
    try {
      return localStorage.getItem("waritrack_settings_nav_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleNav = (targetState?: boolean) => {
    setNavCollapsed((prev) => {
      const next = typeof targetState === "boolean" ? targetState : !prev;
      try {
        localStorage.setItem("waritrack_settings_nav_collapsed", String(next));
      } catch {}
      return next;
    });
  };

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

  const navItems: { id: SettingsTab; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: "shopify",
      label: "Boutiques Shopify",
      desc: "Webhooks, routage multi-pays & suivi",
      icon: Store,
    },
    {
      id: "rules",
      label: "Règles & Rémunérations",
      desc: "Commissions, devise & seuils d'alerte",
      icon: Sliders,
    },
    {
      id: "print",
      label: "Impression & Bon 3D",
      desc: "En-tête bordereau, mentions & format",
      icon: Printer,
    },
    {
      id: "metacapi",
      label: "Meta Conversions API",
      desc: "Pixel Facebook & événements serveur",
      icon: Share2,
    },
    {
      id: "phone_export",
      label: "Export Numéros & SAV",
      desc: "Extraction complète des numéros sur une durée",
      icon: PhoneCall,
    },
    {
      id: "white_label",
      label: "Apps Employés & Marque Blanche",
      desc: "Nom, icônes & couleurs closeuses/livreurs",
      icon: Smartphone,
    },
    {
      id: "general",
      label: "Apparence & Audio",
      desc: "Thème, couleur d'accent & alertes",
      icon: Palette,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      {/* Top Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Configuration de l'espace de travail</h2>
          <p className="text-xs text-slate-500">
            Les paramètres opérationnels s'appliquent au marché sélectionné dans la barre supérieure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {team && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span>
                Marché actif : {team.name} ({team.defaultCountry})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-5">
        {/* Navigation verticale des Paramètres avec contrôle manuel élégant (sans rétractation automatique forcée) */}
        <nav
          className={`flex gap-1.5 overflow-x-auto rounded-2xl border border-surface-border bg-surface-raised p-2 transition-all duration-200 shrink-0 ${
            navCollapsed
              ? "lg:w-16 lg:flex-col lg:items-center"
              : "lg:w-72 lg:flex-col"
          }`}
        >
          {/* Bouton de contrôle manuel desktop */}
          <div className="hidden lg:flex w-full items-center justify-between px-2 py-1 mb-1 border-b border-surface-border/50">
            {!navCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Rubriques ({navItems.length})
              </span>
            )}
            <button
              type="button"
              onClick={() => handleToggleNav()}
              title={navCollapsed ? "Déplier le menu des paramètres" : "Réduire pour libérer l'espace"}
              className={`rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-surface transition ${
                navCollapsed ? "mx-auto" : ""
              }`}
            >
              {navCollapsed ? (
                <PanelLeftOpen className="h-4 w-4 text-brand" />
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white">
                  <span>Réduire</span>
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </div>
              )}
            </button>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={navCollapsed ? `${item.label} — ${item.desc}` : undefined}
                className={`flex shrink-0 items-center rounded-xl transition ${
                  navCollapsed
                    ? "lg:h-11 lg:w-11 lg:justify-center p-2"
                    : "gap-3 px-3.5 py-3 lg:w-full text-left"
                } ${
                  active
                    ? "bg-brand/15 text-slate-100 ring-1 ring-brand/40"
                    : "text-slate-400 hover:bg-surface hover:text-slate-200"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                    active
                      ? "border-brand/40 bg-brand text-white shadow-sm"
                      : "border-surface-border bg-surface text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {!navCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{item.label}</p>
                    <p className="hidden truncate text-[11px] text-slate-500 lg:block">{item.desc}</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone de contenu principale */}
        <div className="min-w-0 flex-1 w-full">
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* Theme & Accent Card */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Mode d'affichage</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Basculez entre l'interface sombre haute densité et le mode clair. Également accessible à tout moment dans l'en-tête.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                        theme === "dark"
                          ? "border-brand bg-brand/10 text-slate-100 ring-1 ring-brand/40"
                          : "border-surface-border bg-surface text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Moon className="h-4 w-4 text-brand" />
                        <div>
                          <p className="text-xs font-semibold">Mode Sombre</p>
                          <p className="text-[11px] text-slate-500">Contraste reposant</p>
                        </div>
                      </div>
                      {theme === "dark" && <Check className="h-4 w-4 text-brand" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                        theme === "light"
                          ? "border-brand bg-brand/10 text-slate-100 ring-1 ring-brand/40"
                          : "border-surface-border bg-surface text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sun className="h-4 w-4 text-amber-400" />
                        <div>
                          <p className="text-xs font-semibold">Mode Clair</p>
                          <p className="text-[11px] text-slate-500">Lecture plein jour</p>
                        </div>
                      </div>
                      {theme === "light" && <Check className="h-4 w-4 text-brand" />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-surface-border pt-5">
                  <h3 className="text-sm font-semibold text-slate-100">Palette d'ambiance complète (Fond + Barre + Accent)</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Chaque palette harmonise la couleur du fond, de la barre latérale et des boutons en mode clair comme en mode sombre.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {ACCENT_PRESETS.map((preset) => {
                      const active = accent === preset.id;
                      const surfaceBg = theme === "light" ? preset.lightSurface : preset.darkSurface;
                      const barBg = theme === "light" ? preset.lightBar : preset.darkBar;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setAccent(preset.id)}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                            active
                              ? "border-brand bg-brand/10 text-slate-100 ring-1 ring-brand/30"
                              : "border-surface-border bg-surface text-slate-300 hover:border-slate-500 hover:text-slate-100"
                          }`}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span
                              className="relative flex h-8 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-500/30 shadow-inner"
                              style={{ backgroundColor: surfaceBg }}
                            >
                              <span
                                className="h-full w-3.5 border-r border-slate-500/20"
                                style={{ backgroundColor: barBg }}
                              />
                              <span
                                className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full shadow-sm"
                                style={{ backgroundColor: preset.swatch }}
                              />
                            </span>
                            <span className="min-w-0 truncate">
                              <span className="block truncate font-semibold text-slate-100">{preset.label}</span>
                              <span className="block truncate text-[10px] text-slate-500">{preset.subtitle}</span>
                            </span>
                          </span>
                          {active && <Check className="h-4 w-4 shrink-0 text-brand" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-surface-border pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">Alertes sonores temps réel</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Émet un signal discret à la réception d'une nouvelle commande sur cet appareil.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={soundEnabled}
                      onClick={toggleSound}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        soundEnabled ? "bg-brand" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          soundEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={playTestSound}
                      className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
                    >
                      {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-brand" /> : <VolumeX className="h-3.5 w-3.5 text-slate-500" />}
                      <span>Tester la tonalité de notification</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "rules" && (
            team ? (
              <TeamSettingsForm key={team.id} workspaceId={workspaceId} team={team} />
            ) : (
              <EmptyTeamNotice />
            )
          )}

          {activeTab === "shopify" && (
            team ? (
              <ShopifyFluxManager workspaceId={workspaceId} team={team} allTeams={teams} />
            ) : (
              <EmptyTeamNotice />
            )
          )}

          {activeTab === "print" && (
            team ? (
              <PrintReceiptConfig workspaceId={workspaceId} team={team} />
            ) : (
              <EmptyTeamNotice />
            )
          )}

          {activeTab === "metacapi" && (
            team ? (
              <MetaCapiConnector workspaceId={workspaceId} team={team} allTeams={teams} />
            ) : (
              <EmptyTeamNotice />
            )
          )}

          {activeTab === "phone_export" && <PhoneExportManager team={team} orders={orders} />}

          {activeTab === "white_label" && <WhiteLabelSettings workspaceId={workspaceId} />}
        </div>
      </div>
    </div>
  );
}

function EmptyTeamNotice() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 text-center">
      <p className="text-sm font-medium text-slate-300">Aucun marché sélectionné</p>
      <p className="mt-1 text-xs text-slate-500">
        Sélectionnez une équipe en haut de page pour configurer ses paramètres.
      </p>
    </div>
  );
}

function TeamSettingsForm({ workspaceId, team }: { workspaceId: string; team: Team }) {
  const initial = useMemo(
    () => ({
      reminderStart: team.reminderWindowStart || "07:00",
      reminderEnd: team.reminderWindowEnd || "22:00",
      overloadThreshold: String(team.overloadAlertThreshold ?? 20),
      digestInterval: String(team.digestIntervalMinutes ?? 120),
      remunCloseuse: String(team.remunerationCloseusePerOrder ?? 0),
      remunLivreur: String(team.remunerationLivreurPerOrder ?? 0),
      currency: team.currency || team.metaCapiConfig?.currency || "XOF",
    }),
    [team]
  );

  const [reminderStart, setReminderStart] = useState(initial.reminderStart);
  const [reminderEnd, setReminderEnd] = useState(initial.reminderEnd);
  const [overloadThreshold, setOverloadThreshold] = useState(initial.overloadThreshold);
  const [digestInterval, setDigestInterval] = useState(initial.digestInterval);
  const [remunCloseuse, setRemunCloseuse] = useState(initial.remunCloseuse);
  const [remunLivreur, setRemunLivreur] = useState(initial.remunLivreur);
  const [currency, setCurrency] = useState(initial.currency);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSensitiveSave, setConfirmSensitiveSave] = useState(false);

  const isDirty =
    reminderStart !== initial.reminderStart ||
    reminderEnd !== initial.reminderEnd ||
    overloadThreshold !== initial.overloadThreshold ||
    digestInterval !== initial.digestInterval ||
    remunCloseuse !== initial.remunCloseuse ||
    remunLivreur !== initial.remunLivreur ||
    currency !== initial.currency;

  const isFinancialChange =
    remunCloseuse !== initial.remunCloseuse ||
    remunLivreur !== initial.remunLivreur ||
    currency !== initial.currency;

  const handleReset = () => {
    setReminderStart(initial.reminderStart);
    setReminderEnd(initial.reminderEnd);
    setOverloadThreshold(initial.overloadThreshold);
    setDigestInterval(initial.digestInterval);
    setRemunCloseuse(initial.remunCloseuse);
    setRemunLivreur(initial.remunLivreur);
    setCurrency(initial.currency);
    setError(null);
  };

  const executeSave = async () => {
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
        currency,
      });
      setConfirmSensitiveSave(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (isFinancialChange) {
      setConfirmSensitiveSave(true);
      return;
    }
    executeSave();
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-5">
      <div className="border-b border-surface-border pb-4">
        <h3 className="text-sm font-semibold text-slate-100">Règles Opérationnelles & Commissions — {team.name}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Définissez la devise locale, les commissions par livraison réussie et les seuils d'alerte de l'équipe.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Devise comptable du marché</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs font-medium text-slate-100 outline-none focus:border-brand"
          >
            <option value="XOF">XOF — Franc CFA (UEMOA : TG, BJ, CI, SN, BF, ML, NE)</option>
            <option value="XAF">XAF — Franc CFA (CEMAC : CM, GA, CG, TD)</option>
            <option value="GNF">GNF — Franc Guinéen (GN)</option>
            <option value="MAD">MAD — Dirham Marocain (MA)</option>
            <option value="NGN">NGN — Naira Nigérian (NG)</option>
            <option value="GHS">GHS — Cédi Ghanéen (GH)</option>
            <option value="EUR">EUR — Euro (€)</option>
            <option value="USD">USD — Dollar US ($)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-surface-border bg-surface/50 p-3.5">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Commission Closeuse / commande livrée
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                placeholder="ex: 500"
                value={remunCloseuse}
                onChange={(e) => setRemunCloseuse(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 pr-14 text-sm font-semibold tabular-nums text-slate-100 outline-none focus:border-brand"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
                {currency}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface/50 p-3.5">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Commission Livreur / commande livrée
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                placeholder="ex: 1500"
                value={remunLivreur}
                onChange={(e) => setRemunLivreur(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 pr-14 text-sm font-semibold tabular-nums text-slate-100 outline-none focus:border-brand"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
                {currency}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Plage horaire des relances clients
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={reminderStart}
                onChange={(e) => setReminderStart(e.target.value)}
                className="flex-1 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
              />
              <span className="text-xs text-slate-500">à</span>
              <input
                type="time"
                value={reminderEnd}
                onChange={(e) => setReminderEnd(e.target.value)}
                className="flex-1 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Seuil d'alerte surcharge closeuse
            </label>
            <input
              type="number"
              min="1"
              value={overloadThreshold}
              onChange={(e) => setOverloadThreshold(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Fréquence du rapport condensé</label>
          <select
            value={digestInterval}
            onChange={(e) => setDigestInterval(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-brand"
          >
            <option value="30">Toutes les 30 minutes</option>
            <option value="60">Toutes les heures</option>
            <option value="120">Toutes les 2 heures</option>
            <option value="240">Toutes les 4 heures</option>
          </select>
        </div>

        {/* Contextual Action Bar */}
        <div className="flex items-center justify-between gap-3 border-t border-surface-border pt-4">
          <div className="text-xs text-slate-500">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Modifications enregistrées
              </span>
            ) : isDirty ? (
              <span className="text-amber-400">Modifications non enregistrées</span>
            ) : (
              <span>À jour avec le serveur</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:text-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Annuler
              </button>
            )}
            <button
              type="button"
              disabled={saving || !isDirty}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSensitiveSave}
        title="Confirmer la modification des règles financières ?"
        message={`Vous modifiez la devise (${currency}) ou les barèmes de commissions (Closeuse : ${Number(remunCloseuse) || 0} ${currency}, Livreur : ${Number(remunLivreur) || 0} ${currency}) de l'équipe ${team.name}. Ce barème s'appliquera immédiatement au calcul de la paie.`}
        confirmLabel="Appliquer le barème"
        danger={false}
        loading={saving}
        onConfirm={executeSave}
        onCancel={() => setConfirmSensitiveSave(false)}
      />
    </div>
  );
}

type ExportRangePreset = "today" | "7d" | "30d" | "all" | "custom";
type ExportSegment = "all" | "livre" | "relance" | "duplicates";

function PhoneExportManager({ team, orders }: { team: Team | null; orders: Order[] }) {
  const [rangePreset, setRangePreset] = useState<ExportRangePreset>("30d");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [segment, setSegment] = useState<ExportSegment>("all");
  const [deduplicate, setDeduplicate] = useState(true);
  const [copied, setCopied] = useState(false);

  const currency = team?.currency || "XOF";

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    let startMs = 0;
    let endMs = now + 86400000;

    if (rangePreset === "today") {
      const d = new Date();
      startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    } else if (rangePreset === "7d") {
      startMs = now - 7 * 86400000;
    } else if (rangePreset === "30d") {
      startMs = now - 30 * 86400000;
    } else if (rangePreset === "custom") {
      startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
      endMs = endDate ? new Date(`${endDate}T23:59:59`).getTime() : now + 86400000;
    }

    // Comptage global des numéros pour identifier les doublons
    const phoneCounts = new Map<string, number>();
    for (const o of orders) {
      const p = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
      if (p && p !== "Non renseigné") {
        phoneCounts.set(p, (phoneCounts.get(p) ?? 0) + 1);
      }
    }

    const inRange = orders
      .filter((o) => o.timestamps.received >= startMs && o.timestamps.received <= endMs)
      .filter((o) => {
        const p = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
        if (!p || p === "Non renseigné") return false;
        if (segment === "livre") return o.statutCloseuse === "livre";
        if (segment === "relance") return o.statutCloseuse === "injoignable" || o.statutCloseuse === "rejete";
        if (segment === "duplicates") {
          return Boolean(o.isDuplicatePhone || o.capiIsolated || (phoneCounts.get(p) ?? 0) > 1);
        }
        return true;
      })
      .sort((a, b) => b.timestamps.received - a.timestamps.received);

    if (!deduplicate) {
      return inRange.map((o) => {
        const p = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
        const totalForPhone = phoneCounts.get(p) ?? 1;
        return {
          order: o,
          phone: p,
          ordersCount: totalForPhone,
          isDuplicate: Boolean(o.isDuplicatePhone || o.capiIsolated || totalForPhone > 1),
        };
      });
    }

    const seen = new Set<string>();
    const unique: { order: Order; phone: string; ordersCount: number; isDuplicate: boolean }[] = [];
    for (const o of inRange) {
      const p = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
      if (seen.has(p)) continue;
      seen.add(p);
      const totalForPhone = phoneCounts.get(p) ?? 1;
      unique.push({
        order: o,
        phone: p,
        ordersCount: totalForPhone,
        isDuplicate: Boolean(o.isDuplicatePhone || o.capiIsolated || totalForPhone > 1),
      });
    }
    return unique;
  }, [orders, rangePreset, startDate, endDate, segment, deduplicate]);

  const handleCopyNumbers = () => {
    const text = filteredEntries.map((e) => e.phone).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportCsv = () => {
    const headers = [
      "Téléphone Formaté",
      "Téléphone Brut",
      "Nom Client",
      "Ville",
      "Produit",
      "Quantité",
      `Montant (${currency})`,
      "Statut",
      "Nb Commandes Numéro",
      "Qualification Tracking",
      "Date Réception",
    ];
    const escapeCsv = (val: string | number) => {
      const s = String(val ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = filteredEntries.map(({ order: o, phone, ordersCount, isDuplicate }) => [
      escapeCsv(phone),
      escapeCsv(o.clientPhoneRaw || phone),
      escapeCsv(o.clientName),
      escapeCsv(o.city || o.shopifyData?.locationHint || ""),
      escapeCsv(o.product),
      escapeCsv(o.quantity || 1),
      escapeCsv(o.amount),
      escapeCsv(o.statutCloseuse),
      escapeCsv(ordersCount),
      escapeCsv(isDuplicate ? "Accès libre site (Isolé Meta)" : "Meta CAPI Standard"),
      escapeCsv(new Date(o.timestamps.received).toLocaleString("fr-FR")),
    ]);

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numeros-clients-${team?.name.toLowerCase().replace(/\s+/g, "-") || "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Exportation Complète des Numéros Clients & SAV {team ? `— ${team.name}` : ""}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Extrayez tous les numéros sur la durée de votre choix pour vos relances WhatsApp, SMS ou campagnes SAV.
          </p>
        </div>
        <span className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-1 font-mono text-xs font-bold text-brand">
          {filteredEntries.length} numéro{filteredEntries.length > 1 ? "s" : ""} prêt{filteredEntries.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Filtres de durée et segment */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Durée d'extraction</label>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {(
              [
                { id: "today", label: "Aujourd'hui" },
                { id: "7d", label: "7 jours" },
                { id: "30d", label: "30 jours" },
                { id: "all", label: "Tout" },
                { id: "custom", label: "Dates" },
              ] as { id: ExportRangePreset; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setRangePreset(p.id)}
                className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                  rangePreset === p.id
                    ? "border-brand bg-brand text-white"
                    : "border-surface-border bg-surface text-slate-400 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {rangePreset === "custom" && (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[11px] text-slate-500">Du</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-slate-500">Au</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Catégorie de clients</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as ExportSegment)}
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
          >
            <option value="all">Tous les numéros reçus sur la période</option>
            <option value="livre">Clients Livrés uniquement (Fidélisation & SAV)</option>
            <option value="relance">Injoignables & Rejetés (À relancer sur WhatsApp)</option>
            <option value="duplicates">Numéros Doublons uniquement (Accès libre site / Hors Meta)</option>
          </select>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={deduplicate}
              onChange={(e) => setDeduplicate(e.target.checked)}
              className="rounded border-surface-border text-brand focus:ring-brand"
            />
            <span>Dédupliquer automatiquement (garder 1 seule ligne par numéro unique)</span>
          </label>
        </div>
      </div>

      {/* Boutons d'exportation */}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-surface-border pt-4">
        <button
          type="button"
          disabled={filteredEntries.length === 0}
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Exporter en Excel / CSV ({filteredEntries.length})
        </button>

        <button
          type="button"
          disabled={filteredEntries.length === 0}
          onClick={handleCopyNumbers}
          className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-medium text-slate-200 transition hover:border-brand/50 disabled:opacity-40"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
          {copied ? "Numéros copiés dans le presse-papiers !" : "Copier uniquement la liste des numéros"}
        </button>
      </div>

      {/* Aperçu rapide avec bouton WhatsApp SAV direct */}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-surface-border bg-surface/50">
        {filteredEntries.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">Aucun numéro sur cette plage de dates.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-surface-border bg-surface-raised text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3.5 py-2.5">Numéro & SAV</th>
                <th className="px-3.5 py-2.5">Client</th>
                <th className="px-3.5 py-2.5">Produit</th>
                <th className="px-3.5 py-2.5">Attribution</th>
                <th className="px-3.5 py-2.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filteredEntries.slice(0, 60).map(({ order: o, phone, ordersCount, isDuplicate }) => (
                <tr key={o.id} className="hover:bg-surface/80">
                  <td className="px-3.5 py-2 text-slate-200 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span>{phone}</span>
                      <a
                        href={buildWhatsAppLink(
                          phone,
                          `Bonjour ${o.clientName}, ici le service client de la boutique concernant votre commande (${o.product}).`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Écrire sur WhatsApp"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
                      >
                        <WhatsAppIcon size={20} />
                      </a>
                    </div>
                  </td>
                  <td className="px-3.5 py-2 text-slate-300">{o.clientName}</td>
                  <td className="max-w-[160px] truncate px-3.5 py-2 text-slate-400">{o.product}</td>
                  <td className="px-3.5 py-2">
                    {isDuplicate ? (
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        Accès libre site ({ordersCount}x)
                      </span>
                    ) : (
                      <span className="rounded border border-surface-border bg-surface px-1.5 py-0.5 text-[10px] text-slate-400">
                        Standard (1x)
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2 text-right tabular-nums text-slate-500">
                    {new Date(o.timestamps.received).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
