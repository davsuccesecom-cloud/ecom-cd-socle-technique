import { useMemo } from "react";
import {
  Keyboard,
  X,
  LayoutDashboard,
  ShoppingBag,
  Landmark,
  Layers,
  Users,
  Wallet,
  Bot,
  BarChart3,
  Settings,
  Search,
  SunMoon,
  PlusCircle,
  HelpCircle,
} from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (page: string) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  pageKey?: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  onNavigate,
}: KeyboardShortcutsModalProps) {
  const isMac = useMemo(() => {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);

  const modKey = isMac ? "⌘" : "Ctrl";

  const sections: ShortcutSection[] = useMemo(
    () => [
      {
        title: "Navigation Rapide (Séquence G)",
        items: [
          { keys: ["G", "D"], description: "Poste de pilotage / Cockpit", icon: LayoutDashboard, pageKey: "overview" },
          { keys: ["G", "O"], description: "Registre des commandes", icon: ShoppingBag, pageKey: "orders" },
          { keys: ["G", "C"], description: "Caisse & Versements livreurs", icon: Landmark, pageKey: "caisse" },
          { keys: ["G", "T"], description: "Marchés & Google Sheets", icon: Layers, pageKey: "teams" },
          { keys: ["G", "U"], description: "Utilisateurs & Accès employés", icon: Users, pageKey: "users" },
          { keys: ["G", "R"], description: "Rémunération & Paie", icon: Wallet, pageKey: "remuneration" },
          { keys: ["G", "A"], description: "Analyste IA Direction", icon: Bot, pageKey: "ai_assistant" },
          { keys: ["G", "P"], description: "Performance des opérateurs", icon: BarChart3, pageKey: "performance" },
          { keys: ["G", "S"], description: "Paramètres & Intégrations", icon: Settings, pageKey: "settings" },
        ],
      },
      {
        title: "Recherche & Création Rapide",
        items: [
          { keys: [modKey, "K"], description: "Ouvrir la palette universelle", icon: Search },
          { keys: ["/"], description: "Rechercher une commande ou un client", icon: Search },
          { keys: ["N"], description: "Ajouter un nouveau marché / équipe", icon: PlusCircle },
          { keys: ["?"], description: "Afficher cette aide des raccourcis", icon: HelpCircle },
        ],
      },
      {
        title: "Affichage & Contrôles",
        items: [
          { keys: ["T"], description: "Basculer le thème (Clair / Sombre)", icon: SunMoon },
          { keys: ["Esc"], description: "Fermer les modales et tiroirs actifs", icon: X },
        ],
      },
    ],
    [modKey]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-popover relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border bg-surface text-brand">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Raccourcis Clavier Pro</h2>
              <p className="text-xs text-slate-400">
                Navigation instantanée inspirée des standards Linear &amp; Superhuman
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border bg-surface text-slate-400 transition-colors hover:text-slate-100"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </h3>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isNavigable = item.pageKey && onNavigate;
                  return (
                    <div
                      key={item.description}
                      onClick={() => {
                        if (isNavigable && item.pageKey) {
                          onNavigate(item.pageKey);
                          onClose();
                        }
                      }}
                      className={`flex min-h-[44px] items-center justify-between rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs transition-colors ${
                        isNavigable
                          ? "cursor-pointer hover:border-brand/40 hover:bg-surface-raised"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
                        <span className="truncate text-slate-200">{item.description}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.keys.map((k, idx) => (
                          <kbd
                            key={idx}
                            className="inline-flex min-w-[22px] items-center justify-center rounded-md border border-surface-border bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-200 shadow-2xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border bg-surface px-5 py-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Mode séquence actif : appuyez sur <strong>G</strong> puis la lettre de votre choix.</span>
          </div>
          <div className="hidden sm:block font-mono text-[10px] text-slate-400">
            Tapez <strong>ESC</strong> pour quitter
          </div>
        </div>
      </div>
    </div>
  );
}
