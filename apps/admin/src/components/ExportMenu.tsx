import { useEffect, useRef, useState } from 'react';
import { chartsFor, svgToPng } from '../lib/bilan/buildCharts';
import type { BilanReport, BilanSectionsConfig } from '../lib/bilan/types';
import { DEFAULT_BILAN_SECTIONS } from '../lib/bilan/types';
import { safeFileName } from '../lib/bilan/util';
import {
  FileText,
  Sliders,
  Check,
  X,
  TrendingUp,
  Package,
  AlertTriangle,
  PieChart,
  Users,
  Calendar,
  Sparkles,
  Download,
} from 'lucide-react';

type Format = 'pdf' | 'docx' | 'xlsx';

const ITEMS: { id: Format; label: string; hint: string }[] = [
  { id: 'pdf', label: 'PDF Certifié', hint: 'Prêt à lire ou archiver' },
  { id: 'xlsx', label: 'Excel (.xlsx)', hint: 'Tableaux & formules calculées' },
  { id: 'docx', label: 'Word (.docx)', hint: 'Édition & présentation modifiable' },
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

interface ExportMenuProps {
  getReport: () => Promise<BilanReport> | BilanReport;
  buttonLabel?: string;
  className?: string;
}

export default function ExportMenu({ getReport, buttonLabel = 'Exporter le bilan', className }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Configuration des sous-catégories modifiables
  const [sections, setSections] = useState<BilanSectionsConfig>({ ...DEFAULT_BILAN_SECTIONS });
  const [reinvestRate, setReinvestRate] = useState<number>(65);

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

  async function run(format: Format, customSections?: BilanSectionsConfig) {
    setBusy(format);
    setError(null);
    try {
      const rawReport = await getReport();
      const activeSections = customSections || sections;

      // Appliquer les sous-catégories choisies et ajuster la trésorerie si modifiée
      const report: BilanReport = {
        ...rawReport,
        sectionsConfig: activeSections,
      };

      if (report.treasurySplit) {
        const rev = report.treasurySplit.totalRevenue;
        const reRate = reinvestRate;
        const divRate = Math.max(0, 100 - reRate);
        report.treasurySplit = {
          ...report.treasurySplit,
          reinvestmentRate: reRate,
          reinvestmentAmount: Math.round((rev * reRate) / 100),
          dividendRate: divRate,
          dividendAmount: Math.round((rev * divRate) / 100),
        };
      }

      const charts = activeSections.showCharts
        ? await Promise.all(chartsFor(report).map((c) => svgToPng(c)))
        : [];

      const blob =
        format === 'pdf'
          ? await (await import('../lib/bilan/exportPdf')).exportPdf(report, charts)
          : format === 'docx'
            ? await (await import('../lib/bilan/exportDocx')).exportDocx(report, charts)
            : await (await import('../lib/bilan/exportXlsx')).exportXlsx(report, charts);

      download(blob, safeFileName(report, format));
      setOpen(false);
      setShowConfigModal(false);
    } catch (e) {
      console.error('Export error:', e);
      setError('Export impossible. Vérifiez vos données et réessayez.');
    } finally {
      setBusy(null);
    }
  }

  const toggleSection = (key: keyof BilanSectionsConfig) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <div ref={box} className={`relative inline-block text-left ${className || ''}`}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-surface hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 shadow-sm cursor-pointer"
        >
          <FileText className="w-4 h-4 text-slate-400" />
          <span>{busy ? 'Génération…' : buttonLabel}</span>
          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1.5 w-64 rounded-xl border border-surface-border bg-surface-raised p-1.5 shadow-xl"
          >
            {/* Option de personnalisation des sous-catégories */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowConfigModal(true);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5" />
                <span>Modifier les sous-catégories…</span>
              </span>
              <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[10px] text-emerald-300">Sur mesure</span>
            </button>

            <div className="my-1 border-t border-surface-border" />

            {ITEMS.map((it) => (
              <button
                key={it.id}
                role="menuitem"
                type="button"
                disabled={busy !== null}
                onClick={() => run(it.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-surface hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
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

      {/* Modal de personnalisation et modification des sous-catégories */}
      {showConfigModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => !busy && setShowConfigModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Personnaliser les Sous-Catégories du Bilan
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cochez les sections à inclure dans vos exports PDF, Excel et Word
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setShowConfigModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-surface transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Liste des sous-catégories modifiables */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* 1. Bilan Compta Produits & Marges */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  sections.showProductProfitability
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.showProductProfitability}
                  onChange={() => toggleSection('showProductProfitability')}
                  className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Bilan Comptable & Marges Nettes par Produit
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Unit economics, prix de vente moyen, landed cost usine + transit, commissions COD, marge nette par pièce et totale.
                  </p>
                </div>
              </label>

              {/* 2. Stocks à prévenir & alertes rupture */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  sections.showStockAlerts
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.showStockAlerts}
                  onChange={() => toggleSection('showStockAlerts')}
                  className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Stocks à Prévenir & Alertes Rupture
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Stocks restants, vélocité journalière (pcs/j), jours d'autonomie et recommandation de réapprovisionnement à 30 jours.
                  </p>
                </div>
              </label>

              {/* 3. Ventilation de trésorerie (65% / 35%) */}
              <div
                className={`rounded-xl border p-3 transition ${
                  sections.showTreasurySplit
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sections.showTreasurySplit}
                    onChange={() => toggleSection('showTreasurySplit')}
                    className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        Ventilation Trésorerie Stratégique (Règle 65% / 35%)
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Séparation du cash encaissé : fonds de roulement & réapprovisionnement vs bénéfice net distribuable en dividendes.
                    </p>
                  </div>
                </label>

                {sections.showTreasurySplit && (
                  <div className="mt-2.5 pt-2.5 border-t border-surface-border/60 pl-6 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Part Réinvestissement :</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReinvestRate(65)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          reinvestRate === 65 ? 'bg-blue-500 text-white' : 'bg-surface text-slate-400'
                        }`}
                      >
                        65% / 35%
                      </button>
                      <button
                        type="button"
                        onClick={() => setReinvestRate(70)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          reinvestRate === 70 ? 'bg-blue-500 text-white' : 'bg-surface text-slate-400'
                        }`}
                      >
                        70% / 30%
                      </button>
                      <button
                        type="button"
                        onClick={() => setReinvestRate(60)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          reinvestRate === 60 ? 'bg-blue-500 text-white' : 'bg-surface text-slate-400'
                        }`}
                      >
                        60% / 40%
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Courbes & Graphiques */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  sections.showCharts
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.showCharts}
                  onChange={() => toggleSection('showCharts')}
                  className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Courbes & Graphiques Visuels
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Histogrammes de CA journalier, courbe de moyenne mobile 7 jours et entonnoir de conversion.
                  </p>
                </div>
              </label>

              {/* 5. Chiffres Clés & Entonnoir */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  sections.showKpis
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.showKpis}
                  onChange={() => toggleSection('showKpis')}
                  className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Chiffres Clés & Entonnoir des Commandes
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    CA global encaissé, commandes reçues, confirmées, livrées, injoignables et rejetées.
                  </p>
                </div>
              </label>

              {/* 6. Performance Équipes Terrain */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  sections.showEmployees
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.showEmployees}
                  onChange={() => toggleSection('showEmployees')}
                  className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Performance Équipes Terrain (Closeuses & Livreurs)
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Taux individuels de confirmation, taux de livraison, délais moyens et montants dus.
                  </p>
                </div>
              </label>

              {/* 7. Évolution Chronologique Journalière */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  sections.showDailyTrends
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.showDailyTrends}
                  onChange={() => toggleSection('showDailyTrends')}
                  className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Évolution Chronologique Journalière
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Détail jour par jour avec horodatage, chiffre d'affaires, livraisons et rejets.
                  </p>
                </div>
              </label>

              {/* 8. Analyse IA */}
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  sections.showAiAnalysis
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-surface-border bg-surface/50 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.showAiAnalysis}
                  onChange={() => toggleSection('showAiAnalysis')}
                  className="mt-0.5 rounded border-surface-border text-brand focus:ring-brand"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span className="text-xs font-semibold text-slate-200">
                      Audit Stratégique & Analyse de Direction IA
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Recommandations opérationnelles, diagnostic des blocages et plans d'actions chiffrés.
                  </p>
                </div>
              </label>
            </div>

            {/* Actions de téléchargement immédiat */}
            <div className="border-t border-surface-border pt-3">
              <p className="mb-2 text-[11px] font-semibold text-slate-400">
                Télécharger le bilan personnalisé :
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('pdf')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{busy === 'pdf' ? 'Export…' : 'PDF Certifié'}</span>
                </button>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('xlsx')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 py-2.5 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{busy === 'xlsx' ? 'Export…' : 'Excel (.xlsx)'}</span>
                </button>

                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run('docx')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface hover:bg-surface/80 text-slate-200 py-2.5 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{busy === 'docx' ? 'Export…' : 'Word (.docx)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
