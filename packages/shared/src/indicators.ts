export type Num = number | null;

/** Moyenne mobile simple. Renvoie null tant que la fenêtre n'est pas pleine. */
export function sma(a: number[], n: number): Num[] {
  return a.map((_, i) => {
    if (i < n - 1) return null;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += a[j];
    return s / n;
  });
}

/** Moyenne mobile exponentielle. Ignore les null en tête. */
export function ema(a: Num[], n: number): Num[] {
  const k = 2 / (n + 1);
  let e: number | null = null;
  return a.map((v) => {
    if (v === null) return null;
    e = e === null ? v : v * k + e * (1 - k);
    return e;
  });
}

/** Bandes de Bollinger : moyenne ± mult écarts-types sur n points. */
export function bollinger(a: number[], n = 20, mult = 2) {
  const mid = sma(a, n);
  const up: Num[] = [];
  const lo: Num[] = [];
  a.forEach((_, i) => {
    const m = mid[i];
    if (m === null) {
      up.push(null);
      lo.push(null);
      return;
    }
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (a[j] - m) ** 2;
    const sd = Math.sqrt(s / n);
    up.push(m + mult * sd);
    lo.push(m - mult * sd);
  });
  return { mid, up, lo };
}

/** RSI de Wilder. Valeurs entre 0 et 100. */
export function rsi(a: number[], n = 14): Num[] {
  const out: Num[] = a.map(() => null);
  if (a.length <= n) return out;
  const toRsi = (g: number, l: number) => (g === 0 && l === 0 ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l));
  let ag = 0;
  let al = 0;
  for (let i = 1; i <= n; i++) {
    const d = a[i] - a[i - 1];
    if (d > 0) ag += d;
    else al -= d;
  }
  ag /= n;
  al /= n;
  out[n] = toRsi(ag, al);
  for (let i = n + 1; i < a.length; i++) {
    const d = a[i] - a[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n;
    al = (al * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = toRsi(ag, al);
  }
  return out;
}

/** MACD : ligne, signal et histogramme. */
export function macd(a: number[], fast = 12, slow = 26, signal = 9) {
  const ef = ema(a, fast);
  const es = ema(a, slow);
  const line: Num[] = a.map((_, i) => (i < slow - 1 ? null : (ef[i] as number) - (es[i] as number)));
  const sig = ema(line, signal).map((v, i) => (i < slow + signal - 2 ? null : v));
  const hist: Num[] = line.map((v, i) => (v === null || sig[i] === null ? null : v - (sig[i] as number)));
  return { line, signal: sig, hist };
}

/**
 * Réduit une fenêtre quand il y a peu de points (ex. vue annuelle),
 * pour que les indicateurs restent calculables.
 */
export function adaptWindow(wanted: number, points: number, min = 2): number {
  return Math.max(min, Math.min(wanted, Math.floor(points / 3)));
}
