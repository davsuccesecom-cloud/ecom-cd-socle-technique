import type { BilanEmployee, BilanReport } from './types';

export function b64(u8: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
  }
  return btoa(s);
}

export const nf = (n: number) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');

export const rateOf = (e: BilanEmployee) => (e.total > 0 ? e.done / e.total : null);

export const dateFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

export const safeFileName = (r: BilanReport, ext: string) =>
  `Bilan_${r.team}_${r.periodLabel}`.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '') + `.${ext}`;

export const NOTE =
  'Les chiffres, tableaux et graphiques sont calculés par l’application à partir des données réelles. Le texte d’analyse est rédigé par l’assistant IA : vérifiez-le avant toute décision.';
