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
    darkSurface: "#090B10",
    darkBar: "#111520",
  },
  {
    id: "cacao",
    label: "Cacao & Latte",
    subtitle: "Fond crème & barre marron",
    swatch: "#8B5A2B",
    lightSurface: "#F6EFE7",
    lightBar: "#E6D5C3",
    darkSurface: "#120C08",
    darkBar: "#1E140E",
  },
  {
    id: "emerald",
    label: "Émeraude & Sauge",
    subtitle: "Teinte nature apaisée",
    swatch: "#10B981",
    lightSurface: "#EEF5F1",
    lightBar: "#DFECE5",
    darkSurface: "#07110D",
    darkBar: "#0E1E17",
  },
  {
    id: "blue",
    label: "Océan & Glacier",
    subtitle: "Bleu polaire & abyssal",
    swatch: "#0EA5E9",
    lightSurface: "#EDF4FB",
    lightBar: "#DCE9F7",
    darkSurface: "#070D14",
    darkBar: "#0E1826",
  },
  {
    id: "amber",
    label: "Ambre & Ivoire",
    subtitle: "Sable chaud & or",
    swatch: "#D97706",
    lightSurface: "#F9F4E8",
    lightBar: "#EDE2C8",
    darkSurface: "#120F08",
    darkBar: "#1D170C",
  },
  {
    id: "rose",
    label: "Velours & Quartz",
    subtitle: "Rose poudré & bordeaux",
    swatch: "#E11D48",
    lightSurface: "#F9EFF2",
    lightBar: "#EEDCE2",
    darkSurface: "#13090C",
    darkBar: "#200F15",
  },
  {
    id: "slate",
    label: "Carbone & Craie",
    subtitle: "Monochrome architectural",
    swatch: "#475569",
    lightSurface: "#F1F3F5",
    lightBar: "#E2E6EA",
    darkSurface: "#0A0A0C",
    darkBar: "#131418",
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
