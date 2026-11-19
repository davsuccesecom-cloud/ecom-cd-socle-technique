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

function flagUrl(code: string) {
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

/**
 * Sélecteur d'équipe/marché haute précision pour la barre supérieure.
 * Permet de basculer en 1 clic entre :
 * - "Afrique Globale" (Tous les marchés consolidés)
 * - N'importe quel pays spécifique (Togo, Bénin, Côte d'Ivoire, etc.)
 */
export default function MarketSelector({
  teams,
  activeTeamId,
  onSelectTeam,
  onAddMarket,
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

  const isGlobal = !activeTeamId || activeTeamId === "all";
  const activeTeam = isGlobal ? null : teams.find((t) => t.id === activeTeamId) ?? null;
  const activeCountry = countryFor(activeTeam?.defaultCountry);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-slate-100 outline-none transition-all hover:border-brand/40 shadow-xs focus:border-brand h-9"
        title="Sélectionner le marché ou pays actif"
      >
        {isGlobal ? (
          <span className="text-sm">🌍</span>
        ) : activeCountry ? (
          <img
            src={flagUrl(activeCountry.code)}
            alt=""
            className="h-3.5 w-5 shrink-0 rounded-sm object-cover shadow-xs"
          />
        ) : null}
        <span className="max-w-[130px] truncate">
          {isGlobal ? "Afrique Globale" : activeTeam ? activeTeam.name : "Sélectionner un marché"}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-2xl border border-surface-border bg-surface-raised p-2 shadow-2xl backdrop-blur-md">
          {/* Option Consolidée : Tous les marchés (Afrique Globale) */}
          <button
            onClick={() => {
              onSelectTeam("all");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all ${
              isGlobal
                ? "bg-brand/15 text-brand font-bold"
                : "text-slate-200 hover:bg-surface"
            }`}
          >
            <span className="text-base">🌍</span>
            <div className="min-w-0">
              <span className="block truncate font-semibold">Afrique Globale</span>
              <span className="block text-[10px] text-slate-400">Tous les marchés consolidés</span>
            </div>
          </button>

          <div className="my-1.5 border-t border-surface-border" />

          {/* Liste des marchés individuels */}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {teams.map((t) => {
              const c = countryFor(t.defaultCountry);
              const isActive = !isGlobal && t.id === activeTeamId;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelectTeam(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all ${
                    isActive
                      ? "bg-brand/15 text-brand font-semibold"
                      : "text-slate-200 hover:bg-surface"
                  }`}
                >
                  {c && (
                    <img
                      src={flagUrl(c.code)}
                      alt=""
                      className="h-3.5 w-5 shrink-0 rounded-sm object-cover"
                    />
                  )}
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>

          <div className="my-1.5 border-t border-surface-border" />

          <button
            onClick={() => {
              setOpen(false);
              onAddMarket();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-brand transition-all hover:bg-brand/10"
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
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-slate-400"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
