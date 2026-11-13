import { useEffect, useRef, useState } from "react";
import { AFRICA_COUNTRIES } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";

interface MarketSelectorProps {
  teams: Team[];
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onAddMarket: () => void;
  variant?: "default" | "sidebar";
  collapsed?: boolean;
}

function countryFor(code: string | undefined) {
  return AFRICA_COUNTRIES.find((c) => c.code === code) ?? null;
}

// flagcdn.com : service gratuit, pas de clé API, une vraie image PNG par
// pays (pas un emoji) — contourne le souci de rendu Windows où les emojis
// drapeaux s'affichent comme du texte brut ("TG") au lieu d'un drapeau.
function flagUrl(code: string) {
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

/**
 * Remplace le <select> natif du sélecteur d'équipe/marché. Un <option> HTML
 * ne peut afficher que du texte brut — ni image, ni bouton d'action dedans.
 * Ce menu custom permet les deux : vrais drapeaux + item "+ Ajouter un
 * marché" cliquable en bas de liste, qui ouvre CreateTeamForm en modal.
 */
export default function MarketSelector({
  teams,
  activeTeamId,
  onSelectTeam,
  onAddMarket,
  variant = "default",
  collapsed = false,
}: MarketSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;
  const activeCountry = countryFor(activeTeam?.defaultCountry);
  const isSidebar = variant === "sidebar";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={activeTeam ? `Marché actif : ${activeTeam.name}` : "Sélectionner un marché"}
        className={
          isSidebar
            ? `flex w-full items-center gap-2 rounded-lg border border-surface-border bg-surface text-xs font-semibold text-slate-100 transition-colors hover:border-brand/50 ${
                collapsed ? "justify-center p-2" : "justify-between px-2.5 py-2"
              }`
            : "flex min-h-[44px] md:min-h-0 md:h-9 items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 text-xs font-semibold text-slate-100 outline-none transition-colors hover:border-brand/50"
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          {activeCountry ? (
            <img src={flagUrl(activeCountry.code)} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />
          ) : null}
          {!collapsed && (
            <span className={isSidebar ? "truncate" : "max-w-[140px] truncate"}>
              {activeTeam ? activeTeam.name : "Sélectionner un marché"}
            </span>
          )}
        </div>
        {!collapsed && <ChevronIcon />}
      </button>

      {open && (
        <div
          className={`surface-popover z-50 rounded-xl border border-surface-border bg-surface-raised p-2 ${
            isSidebar && collapsed
              ? "fixed left-16 top-20 ml-2 w-60"
              : "absolute left-0 top-full mt-1.5 w-64"
          }`}
        >
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Marché actif
          </p>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {teams.map((t) => {
              const c = countryFor(t.defaultCountry);
              const isActive = t.id === activeTeamId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelectTeam(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                    isActive ? "bg-brand-light text-brand font-semibold" : "text-slate-200 hover:bg-surface"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {c && <img src={flagUrl(c.code)} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />}
                    <span className="truncate">{t.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">
                    {t.currency || "XOF"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="my-1.5 border-t border-surface-border" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddMarket();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-brand transition-colors hover:bg-brand-light"
          >
            <PlusIcon />
            Ajouter un marché
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
