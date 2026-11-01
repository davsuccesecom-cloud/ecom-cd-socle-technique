import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type AccentColor = "indigo" | "emerald" | "blue" | "amber" | "rose" | "slate";

export interface AccentPreset {
  id: AccentColor;
  label: string;
  swatch: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "indigo", label: "Indigo", swatch: "#6366F1" },
  { id: "emerald", label: "Émeraude", swatch: "#10B981" },
  { id: "blue", label: "Océan", swatch: "#0EA5E9" },
  { id: "amber", label: "Ambre", swatch: "#F59E0B" },
  { id: "rose", label: " Rubis", swatch: "#F43F5E" },
  { id: "slate", label: "Carbone", swatch: "#64748B" },
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
