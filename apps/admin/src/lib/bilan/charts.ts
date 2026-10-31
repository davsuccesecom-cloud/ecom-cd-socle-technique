import type { BilanDay, BilanEmployee, ChartSvg } from './types';

const BLUE = '#2a78d6';
const ORANGE = '#eb6834';
const GREEN = '#1baf7a';
const INK = '#0f172a';
const MUTED = '#64748b';
const GRID = '#e2e8f0';
const FONT = "Helvetica, Arial, sans-serif";
const W = 760;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nf = (n: number) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(Math.round(n)));

const head = (h: number, title: string, sub?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="${FONT}">` +
  `<rect width="${W}" height="${h}" fill="#ffffff"/>` +
  `<text x="0" y="22" font-size="16" font-weight="700" fill="${INK}">${esc(title)}</text>` +
  (sub ? `<text x="0" y="42" font-size="12" fill="${MUTED}">${esc(sub)}</text>` : '');

/** Entonnoir : reçues → confirmées → livrées, avec le % par rapport à l'étape précédente. */
export function funnelChart(steps: { label: string; value: number }[]): ChartSvg {
  const rowH = 54;
  const h = 64 + steps.length * rowH;
  const max = Math.max(1, ...steps.map((s) => s.value));
  const x0 = 190;
  const maxW = 420;
  let g = '';
  steps.forEach((s, i) => {
    const y = 60 + i * rowH;
    const w = Math.max(2, (s.value / max) * maxW);
    const prev = i > 0 ? steps[i - 1].value : 0;
    const sub = i > 0 && prev > 0 ? `${Math.round((s.value / prev) * 100)} % de l’étape précédente` : '';
    g += `<text x="0" y="${y + 20}" font-size="13" fill="${INK}">${esc(s.label)}</text>`;
    g += `<rect x="${x0}" y="${y}" width="${w}" height="30" rx="4" fill="${BLUE}" fill-opacity="${1 - i * 0.18}"/>`;
    g += `<text x="${x0 + w + 10}" y="${y + 20}" font-size="14" font-weight="700" fill="${INK}">${nf(s.value)}</text>`;
    if (sub) g += `<text x="${x0 + w + 10 + String(nf(s.value)).length * 9 + 8}" y="${y + 20}" font-size="12" fill="${MUTED}">${esc(sub)}</text>`;
  });
  return { title: 'Entonnoir des commandes', svg: head(h, 'Entonnoir des commandes', 'Chaque barre est comparée à l’étape précédente') + g + '</svg>', width: W, height: h };
}

/** Taux de réussite par employé. Les petits échantillons sont signalés. */
export function employeesChart(title: string, sub: string, list: BilanEmployee[]): ChartSvg {
  const items = [...list].sort((a, b) => b.total - a.total || b.done - a.done);
  const rowH = 46;
  const h = 70 + items.length * rowH;
  const x0 = 150;
  const maxW = 360;
  let g = `<line x1="${x0}" y1="56" x2="${x0}" y2="${h - 8}" stroke="${GRID}"/><line x1="${x0 + maxW}" y1="56" x2="${x0 + maxW}" y2="${h - 8}" stroke="${GRID}" stroke-dasharray="3 3"/>`;
  g += `<text x="${x0 + maxW}" y="52" font-size="10" fill="${MUTED}" text-anchor="middle">100 %</text><text x="${x0}" y="52" font-size="10" fill="${MUTED}" text-anchor="middle">0</text>`;
  items.forEach((e, i) => {
    const y = 64 + i * rowH;
    const rate = e.total > 0 ? e.done / e.total : 0;
    const weak = e.total < 5;
    const w = Math.max(2, rate * maxW);
    g += `<text x="0" y="${y + 19}" font-size="13" fill="${INK}">${esc(e.name)}</text>`;
    g += `<rect x="${x0}" y="${y}" width="${w}" height="26" rx="4" fill="${e.role === 'livreur' ? GREEN : BLUE}" fill-opacity="${weak ? 0.35 : 1}"/>`;
    g += `<text x="${x0 + maxW + 14}" y="${y + 19}" font-size="13" font-weight="700" fill="${INK}">${Math.round(rate * 100)} %</text>`;
    g += `<text x="${x0 + maxW + 56}" y="${y + 19}" font-size="12" fill="${MUTED}">${e.done}/${e.total}${weak ? ' · échantillon faible' : ''}</text>`;
  });
  return { title, svg: head(h, title, sub) + g + '</svg>', width: W, height: h };
}

/** CA par jour (barres) avec moyenne mobile 7 jours (ligne) quand il y a assez de jours. */
export function dailyChart(days: BilanDay[], currency: string): ChartSvg {
  const h = 320;
  const L = 58;
  const R = 12;
  const T = 60;
  const B = 44;
  const pw = W - L - R;
  const ph = h - T - B;
  const vals = days.map((d) => d.ca);
  const rawMax = Math.max(1, ...vals);
  const mag = Math.pow(10, Math.floor(Math.log10(rawMax / 4)));
  const stepV = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v * 4 >= rawMax) ?? mag * 10;
  const max = stepV * 4;
  const bw = Math.min(28, (pw / Math.max(1, days.length)) * 0.7);
  const xAt = (i: number) => L + (pw / days.length) * (i + 0.5);
  const yAt = (v: number) => T + ph - (v / max) * ph;
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    const y = yAt(v);
    g += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="${GRID}"/><text x="${L - 8}" y="${y + 4}" font-size="10" fill="${MUTED}" text-anchor="end">${short(v)}</text>`;
  }
  days.forEach((d, i) => {
    const y = yAt(d.ca);
    g += `<rect x="${xAt(i) - bw / 2}" y="${y}" width="${bw}" height="${T + ph - y}" rx="2" fill="${BLUE}" fill-opacity="0.85"/>`;
  });
  const step = Math.max(1, Math.ceil(days.length / 10));
  days.forEach((d, i) => {
    if (i % step === 0) {
      const dt = new Date(`${d.date}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      g += `<text x="${xAt(i)}" y="${h - B + 18}" font-size="10" fill="${MUTED}" text-anchor="middle">${esc(dt)}</text>`;
    }
  });
  if (days.length >= 7) {
    const pts: string[] = [];
    for (let i = 6; i < days.length; i++) {
      let s = 0;
      for (let j = i - 6; j <= i; j++) s += vals[j];
      pts.push(`${xAt(i)},${yAt(s / 7)}`);
    }
    g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${ORANGE}" stroke-width="2.5" stroke-linejoin="round"/>`;
    g += `<rect x="${L}" y="${h - 14}" width="10" height="10" fill="${BLUE}" fill-opacity="0.85"/><text x="${L + 16}" y="${h - 5}" font-size="11" fill="${MUTED}">CA par jour</text>`;
    g += `<line x1="${L + 100}" y1="${h - 9}" x2="${L + 116}" y2="${h - 9}" stroke="${ORANGE}" stroke-width="2.5"/><text x="${L + 122}" y="${h - 5}" font-size="11" fill="${MUTED}">Moyenne mobile 7 jours</text>`;
  }
  return { title: 'Chiffre d’affaires par jour', svg: head(h, 'Chiffre d’affaires par jour', `En ${currency}`) + g + '</svg>', width: W, height: h };
}
