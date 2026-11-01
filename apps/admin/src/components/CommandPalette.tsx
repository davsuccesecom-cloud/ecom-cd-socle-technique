import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Users,
  Layers,
  Wallet,
  Landmark,
  Settings,
  Bot,
  ArrowRight,
  SunMoon,
} from "lucide-react";
import type { Order, Team } from "@ecomcod/shared";
import { useTheme } from "../hooks/useTheme";

interface CommandPaletteProps {
  orders: Order[];
  teams: Team[];
  activeTeamId: string | null;
  onNavigate: (page: string) => void;
  onSelectTeam: (teamId: string) => void;
  onInspectOrder?: (order: Order) => void;
}

export default function CommandPalette({
  orders,
  teams,
  activeTeamId,
  onNavigate,
  onSelectTeam,
  onInspectOrder,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toggleTheme, theme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const navActions = useMemo(
    () => [
      { key: "overview", label: "Vue d'ensemble & Live Analytics", icon: LayoutDashboard, group: "Navigation" },
      { key: "orders", label: "Commandes & Bons de livraison 3D", icon: ShoppingBag, group: "Navigation" },
      { key: "ai_assistant", label: "Analyste Direction & Bilans", icon: Bot, group: "Navigation" },
      { key: "performance", label: "Performance des employés", icon: BarChart3, group: "Navigation" },
      { key: "teams", label: "Équipes, Marchés & Google Sheets", icon: Layers, group: "Navigation" },
      { key: "users", label: "Utilisateurs & Accès", icon: Users, group: "Navigation" },
      { key: "caisse", label: "Caisse & Versements Livreurs", icon: Landmark, group: "Navigation" },
      { key: "remuneration", label: "Rémunération & Paie", icon: Wallet, group: "Navigation" },
      { key: "settings", label: "Paramètres, Shopify & Meta CAPI", icon: Settings, group: "Navigation" },
    ],
    []
  );

  const q = query.trim().toLowerCase();

  const matchingNav = useMemo(
    () => (q ? navActions.filter((a) => a.label.toLowerCase().includes(q)) : navActions),
    [q, navActions]
  );

  const matchingOrders = useMemo(() => {
    if (!q) return orders.slice(0, 4);
    return orders
      .filter(
        (o) =>
          o.clientName?.toLowerCase().includes(q) ||
          o.clientPhoneFormatted?.toLowerCase().includes(q) ||
          o.orderNumber?.toLowerCase().includes(q) ||
          o.product?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [orders, q]);

  const matchingTeams = useMemo(() => {
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q) || (t.defaultCountry || "").toLowerCase().includes(q));
  }, [teams, q]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2.5 rounded-lg border border-surface-border bg-surface-raised px-3 text-xs text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
      >
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <span className="hidden xl:inline">Rechercher une commande…</span>
        <span className="hidden sm:inline xl:hidden">Rechercher…</span>
        <kbd className="hidden rounded border border-surface-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 px-4 pt-16 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-popover w-full max-w-xl overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tapez un nom de client, téléphone, #commande ou page…"
                className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-surface-border px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-slate-200"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-2 space-y-3">
              {matchingOrders.length > 0 && (
                <div>
                  <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Commandes ({matchingOrders.length})
                  </p>
                  <div className="space-y-0.5">
                    {matchingOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          if (onInspectOrder) {
                            onInspectOrder(o);
                          } else {
                            onNavigate("orders");
                          }
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-surface"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-brand">
                              {o.orderNumber || `#${o.id.slice(-5)}`}
                            </span>
                            <span className="truncate font-medium text-slate-200">{o.clientName}</span>
                            <span className="text-slate-500">{o.clientPhoneFormatted}</span>
                          </div>
                          <p className="truncate text-[11px] text-slate-400">
                            {o.product} · {(o.amount || 0).toLocaleString("fr-FR")} FCFA
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchingNav.length > 0 && (
                <div>
                  <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Sections de l'application
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                    {matchingNav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            onNavigate(item.key);
                          }}
                          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-surface hover:text-slate-100"
                        >
                          <Icon className="h-4 w-4 text-slate-400" />
                          <span className="truncate font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {matchingTeams.length > 1 && (
                <div>
                  <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Changer d'équipe / marché
                  </p>
                  <div className="flex flex-wrap gap-1 px-2">
                    {matchingTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onSelectTeam(t.id);
                          setOpen(false);
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          t.id === activeTeamId
                            ? "border-brand bg-brand-light text-brand"
                            : "border-surface-border bg-surface text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {t.name} ({t.defaultCountry || "TG"})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-surface-border pt-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-slate-300 hover:bg-surface"
                >
                  <SunMoon className="h-4 w-4 text-slate-400" />
                  <span>Basculer en mode {theme === "dark" ? "clair" : "sombre"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
