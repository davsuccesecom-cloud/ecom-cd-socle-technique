import { useEffect, useRef, useState } from 'react';
import { chartsFor, svgToPng } from '../lib/bilan/buildCharts';
import type { BilanReport } from '../lib/bilan/types';
import { safeFileName } from '../lib/bilan/util';

type Format = 'pdf' | 'docx' | 'xlsx';

const ITEMS: { id: Format; label: string; hint: string }[] = [
  { id: 'pdf', label: 'PDF', hint: 'À lire ou à envoyer' },
  { id: 'docx', label: 'Word', hint: 'À modifier' },
  { id: 'xlsx', label: 'Excel', hint: 'Tableaux et formules' },
];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Menu « Exporter ». `getReport` construit le bilan à partir des données réelles
 * (mêmes fonctions que les pages) et du texte d'analyse choisi, jamais de tout l'historique du chat.
 */
export default function ExportMenu({ getReport }: { getReport: () => Promise<BilanReport> | BilanReport }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function run(format: Format) {
    setBusy(format);
    setError(null);
    try {
      const report = await getReport();
      const charts = await Promise.all(chartsFor(report).map((c) => svgToPng(c)));
      // Chargés seulement au clic : pdfmake, docx et exceljs pèsent plusieurs centaines de Ko.
      const blob =
        format === 'pdf'
          ? await (await import('../lib/bilan/exportPdf')).exportPdf(report, charts)
          : format === 'docx'
            ? await (await import('../lib/bilan/exportDocx')).exportDocx(report, charts)
            : await (await import('../lib/bilan/exportXlsx')).exportXlsx(report, charts);
      download(blob, safeFileName(report, format));
      setOpen(false);
    } catch (e) {
      console.error("Export error:", e);
      setError('Export impossible. Réessayez.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={box} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-surface hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 shadow-sm"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>{busy ? "Génération..." : "Exporter le bilan"}</span>
        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1.5 w-60 rounded-xl border border-surface-border bg-surface-raised p-1.5 shadow-xl">
          {ITEMS.map((it) => (
            <button
              key={it.id}
              role="menuitem"
              type="button"
              disabled={busy !== null}
              onClick={() => run(it.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-surface hover:text-white disabled:opacity-50 transition-colors"
            >
              <span className="font-semibold">{busy === it.id ? 'Préparation…' : it.label}</span>
              <span className="text-[11px] text-slate-400">{it.hint}</span>
            </button>
          ))}
          {error && (
            <p role="alert" className="px-3 py-1.5 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
