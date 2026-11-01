import { useEffect, useRef, useState } from "react";
import { Sun, Moon, Palette, Check } from "lucide-react";
import { ACCENT_PRESETS, useTheme } from "../hooks/useTheme";

export default function ThemeQuickPicker() {
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const currentPreset = ACCENT_PRESETS.find((p) => p.id === accent) ?? ACCENT_PRESETS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Apparence et couleur d'accentuation"
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
      >
        <span
          className="h-2.5 w-2.5 rounded-full ring-2 ring-white/10"
          style={{ backgroundColor: currentPreset.swatch }}
        />
        {theme === "dark" ? <Moon className="h-3.5 w-3.5 text-slate-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
        <span className="hidden sm:inline">Apparence</span>
      </button>

      {open && (
        <div className="surface-popover absolute right-0 top-11 z-50 w-64 rounded-xl p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Palette className="h-3.5 w-3.5 text-slate-400" />
              Thème & Couleur
            </span>
            <span className="text-[11px] text-slate-500">{currentPreset.label}</span>
          </div>

          {/* Segmented control Clair / Sombre */}
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-surface-border bg-surface p-1">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                theme === "dark"
                  ? "bg-surface-raised text-slate-100 shadow-sm border border-surface-border"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              Sombre
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                theme === "light"
                  ? "bg-surface-raised text-slate-100 shadow-sm border border-surface-border"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              Clair
            </button>
          </div>

          <p className="mb-2 text-[11px] font-medium text-slate-400">Couleur d'accentuation</p>
          <div className="grid grid-cols-6 gap-1.5">
            {ACCENT_PRESETS.map((preset) => {
              const active = preset.id === accent;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => setAccent(preset.id)}
                  className={`group relative flex h-7 w-full items-center justify-center rounded-md border transition-transform active:scale-95 ${
                    active ? "border-white/60 scale-105" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: preset.swatch }}
                >
                  {active && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
