import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type AccentColor = "indigo" | "cacao" | "emerald" | "blue" | "amber" | "rose" | "slate";

export interface AccentPreset {
  id: AccentColor;
  label: string;
  subtitle: string;
  swatch: string;
  lightSurface: string;
  lightBar: string;
  darkSurface: string;
  darkBar: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "indigo",
    label: "Indigo & Ardoise",
    subtitle: "Classique exécutif",
    swatch: "#6366F1",
    lightSurface: "#F3F5F9",
    lightBar: "#E6EBF4",
    darkSurface: "#090C15",
    darkBar: "#0D1220",
  },
  {
    id: "cacao",
    label: "Cacao & Latte",
    subtitle: "Fond moka / crème & barre cacao",
    swatch: "#D4874D",
    lightSurface: "#F6EFE7",
    lightBar: "#E6D5C3",
    darkSurface: "#18110C",
    darkBar: "#2C1E15",
  },
  {
    id: "emerald",
    label: "Émeraude & Sauge",
    subtitle: "Forêt boréale & sauge",
    swatch: "#10B981",
    lightSurface: "#EEF5F1",
    lightBar: "#DFECE5",
    darkSurface: "#081510",
    darkBar: "#142C22",
  },
  {
    id: "blue",
    label: "Océan & Glacier",
    subtitle: "Bleu abyssal & polaire",
    swatch: "#0EA5E9",
    lightSurface: "#EDF4FB",
    lightBar: "#DCE9F7",
    darkSurface: "#07121E",
    darkBar: "#132840",
  },
  {
    id: "amber",
    label: "Ambre & Ivoire",
    subtitle: "Obsidienne dorée & sable",
    swatch: "#F59E0B",
    lightSurface: "#F9F4E8",
    lightBar: "#EDE2C8",
    darkSurface: "#171208",
    darkBar: "#2D2210",
  },
  {
    id: "rose",
    label: "Velours & Quartz",
    subtitle: "Bordeaux nuit & rose poudré",
    swatch: "#F43F5E",
    lightSurface: "#F9EFF2",
    lightBar: "#EEDCE2",
    darkSurface: "#180A0F",
    darkBar: "#30151F",
  },
  {
    id: "slate",
    label: "Carbone & Craie",
    subtitle: "Monochrome graphite & craie",
    swatch: "#94A3B8",
    lightSurface: "#F1F3F5",
    lightBar: "#E2E6EA",
    darkSurface: "#0E0F12",
    darkBar: "#1D2026",
  },
];

const THEME_KEY = "ecomcod-theme";
const ACCENT_KEY = "ecomcod-accent";
const SYNC_EVENT = "ecomcod-theme-sync";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

function getStoredAccent(): AccentColor {
  if (typeof window === "undefined") return "indigo";
  const raw = window.localStorage.getItem(ACCENT_KEY) as AccentColor | null;
  return raw && ACCENT_PRESETS.some((p) => p.id === raw) ? raw : "indigo";
}

function applyDomTheme(theme: Theme, accent: AccentColor) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.setAttribute("data-accent", accent);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [accent, setAccentState] = useState<AccentColor>(getStoredAccent);

  useEffect(() => {
    applyDomTheme(theme, accent);
  }, [theme, accent]);

  useEffect(() => {
    const onSync = () => {
      setThemeState(getStoredTheme());
      setAccentState(getStoredAccent());
    };
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(THEME_KEY, next);
    setThemeState(next);
    applyDomTheme(next, getStoredAccent());
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  const setAccent = useCallback((next: AccentColor) => {
    window.localStorage.setItem(ACCENT_KEY, next);
    setAccentState(next);
    applyDomTheme(getStoredTheme(), next);
    window.dispatchEvent(new Event(SYNC_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, accent, setTheme, setAccent, toggleTheme };
}
