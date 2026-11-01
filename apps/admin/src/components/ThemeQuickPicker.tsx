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
        title="Personnaliser le thème et l'ambiance visuelle"
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-surface-border bg-surface-raised px-3 text-xs font-medium text-slate-300 transition-colors hover:border-brand/50 hover:text-slate-100"
      >
        <span className="flex h-3.5 w-3.5 overflow-hidden rounded-full border border-surface-border shadow-sm">
          <span
            className="h-full w-1/2"
            style={{ backgroundColor: theme === "light" ? currentPreset.lightBar : currentPreset.darkBar }}
          />
          <span className="h-full w-1/2" style={{ backgroundColor: currentPreset.swatch }} />
        </span>
        {theme === "dark" ? (
          <Moon className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span className="hidden sm:inline">{currentPreset.label.split(" ")[0]}</span>
      </button>

      {open && (
        <div className="surface-popover absolute right-0 top-11 z-50 w-72 rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
              <Palette className="h-3.5 w-3.5 text-brand" />
              Ambiance & Palette
            </span>
            <span className="text-[11px] font-medium text-brand">{currentPreset.label}</span>
          </div>

          {/* Segmented control Clair / Sombre */}
          <div className="mb-3.5 grid grid-cols-2 gap-1.5 rounded-xl border border-surface-border bg-surface p-1">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                theme === "dark"
                  ? "border border-surface-border bg-surface-raised text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              Mode Noir
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                theme === "light"
                  ? "border border-surface-border bg-surface-raised text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              Mode Clair
            </button>
          </div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Harmonie d'ensemble (Fond + Barre + Accent)
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
            {ACCENT_PRESETS.map((preset) => {
              const active = preset.id === accent;
              const bgPreview = theme === "light" ? preset.lightSurface : preset.darkSurface;
              const barPreview = theme === "light" ? preset.lightBar : preset.darkBar;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAccent(preset.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-brand bg-brand-light text-slate-100"
                      : "border-surface-border bg-surface/60 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Mini aperçu combiné : Barre latérale + Fond + Accent */}
                    <span className="flex h-6 w-9 shrink-0 overflow-hidden rounded-md border border-black/15 shadow-sm">
                      <span className="h-full w-3" style={{ backgroundColor: barPreview }} />
                      <span
                        className="flex h-full flex-1 items-center justify-center"
                        style={{ backgroundColor: bgPreview }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.swatch }} />
                      </span>
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-100">{preset.label}</p>
                      <p className="text-[10px] text-slate-400">{preset.subtitle}</p>
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-brand" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
