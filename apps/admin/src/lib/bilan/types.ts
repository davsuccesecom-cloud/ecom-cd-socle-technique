export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export interface BilanKpi {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  /** Valeur numérique brute (pour Excel) et son unité */
  num?: number;
  unit?: string;
}

export interface BilanEmployee {
  name: string;
  role: 'closeuse' | 'livreur';
  /** commandes réussies (confirmées pour une closeuse, livrées pour un livreur) */
  done: number;
  /** commandes traitées au total */
  total: number;
  /** délai moyen avant traitement, en minutes (closeuses) */
  avgDelayMin?: number | null;
}

export interface BilanProduct {
  name: string;
  sales: number;
}

export interface BilanDay {
  /** YYYY-MM-DD */
  date: string;
  ca: number;
  livraisons: number;
  rejetees: number;
  injoignables: number;
}

/** Tout ce qui est chiffré vient du code (mêmes fonctions que les pages). L'IA ne fournit que le texte d'analyse. */
export interface BilanReport {
  title: string;
  team: string;
  periodLabel: string;
  /** ISO */
  generatedAt: string;
  currency: string;
  /** Question posée à l'IA (facultatif) */
  question?: string;
  kpis: BilanKpi[];
  funnel: { label: string; value: number }[];
  employees: BilanEmployee[];
  products: BilanProduct[];
  days?: BilanDay[];
  analysisMarkdown: string;
}

export interface ChartImage {
  title: string;
  png: Uint8Array;
  width: number;
  height: number;
}

export interface ChartSvg {
  title: string;
  svg: string;
  width: number;
  height: number;
}

/** Calcule les KPI avec les bons dénominateurs, écrits noir sur blanc. */
export function makeKpis(t: {
  ca: number;
  recues: number;
  confirmees: number;
  livrees: number;
  injoignables: number;
  rejetees: number;
  currency: string;
}): BilanKpi[] {
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
  const conf = pct(t.confirmees, t.recues);
  const liv = pct(t.livrees, t.confirmees);
  const inj = pct(t.injoignables, t.recues);
  return [
    { label: 'Chiffre d’affaires livré', value: `${fmt(t.ca)} ${t.currency}`, num: t.ca, unit: t.currency, tone: 'neutral' },
    { label: 'Commandes reçues', value: fmt(t.recues), num: t.recues, tone: 'neutral' },
    { label: 'Confirmées', value: fmt(t.confirmees), num: t.confirmees, hint: conf === null ? undefined : `${conf} % des commandes reçues`, tone: 'neutral' },
    { label: 'Livrées et encaissées', value: fmt(t.livrees), num: t.livrees, hint: liv === null ? undefined : `${liv} % des confirmées`, tone: 'neutral' },
    { label: 'Injoignables', value: fmt(t.injoignables), num: t.injoignables, hint: inj === null ? undefined : `${inj} % des commandes reçues`, tone: t.injoignables > 0 ? 'warn' : 'neutral' },
    { label: 'Rejetées / annulées', value: fmt(t.rejetees), num: t.rejetees, tone: t.rejetees > 0 ? 'bad' : 'good' },
  ];
}
