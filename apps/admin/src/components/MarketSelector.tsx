import { useEffect, useRef, useState } from "react";
import { AFRICA_COUNTRIES } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";

interface MarketSelectorProps {
  teams: Team[];
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onAddMarket: () => void;
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
export default function MarketSelector({ teams, activeTeamId, onSelectTeam, onAddMarket }: MarketSelectorProps) {
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-4 py-2 text-sm text-slate-200 outline-none focus:border-brand"
      >
        {activeCountry && (
          <img src={flagUrl(activeCountry.code)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
        )}
        <span>{activeTeam ? activeTeam.name : "Sélectionner un marché"}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-surface-border bg-surface-raised p-1.5 shadow-2xl">
          <div className="max-h-64 overflow-y-auto">
            {teams.map((t) => {
              const c = countryFor(t.defaultCountry);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelectTeam(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    t.id === activeTeamId ? "bg-brand/15 text-brand" : "text-slate-200 hover:bg-surface"
                  }`}
                >
                  {c && <img src={flagUrl(c.code)} alt="" className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />}
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>

          <div className="my-1 border-t border-surface-border" />

          <button
            onClick={() => {
              setOpen(false);
              onAddMarket();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand hover:bg-surface"
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
