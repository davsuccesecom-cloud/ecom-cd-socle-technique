import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adaptWindow, bollinger, macd, rsi, sma } from '@ecomcod/shared';
import { DEFAULT_SPEC, type ChartSpec } from '../lib/aiChart';
import { PERIODS, type Metric, type Period, type Point } from '../lib/dailyStatsSeries';

const BLUE = '#2a78d6';
const ORANGE = '#eb6834';
const VIOLET = '#6250d6';
const GREEN = '#1baf7a';
const RED = '#e34948';
const GRAY = '#898781';
const CACHE_MS = 60_000;

const METRIC_LABEL: Record<Metric, string> = {
  ca: "Chiffre d'affaires",
  livraisons: 'Livraisons réussies',
  rejetees: 'Commandes rejetées',
  injoignables: 'Clients injoignables',
  tauxLivraison: 'Taux de livraison',
};

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const unit = (m: Metric) => (m === 'ca' ? ' FCFA' : m === 'tauxLivraison' ? ' %' : '');

interface Row {
  key: string;
  label: string;
  partial: boolean;
  value: number;
  ma1: number | null;
  ma2: number | null;
  band: [number, number] | null;
  vol: number;
  volUp: boolean;
  rsi: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

interface Props {
  spec?: ChartSpec;
  /** Fournit les points pour une période (voir fetchDailyStats). */
  load: (period: Period) => Promise<Point[]>;
}

const margin = { top: 6, right: 0, left: 0, bottom: 0 };
const cursor = { stroke: 'var(--brand)', strokeOpacity: 0.45, strokeDasharray: '3 3' };
const tick = { fontSize: 11, fill: '#94a3b8' };

function ProChartBase({ spec = DEFAULT_SPEC, load }: Props) {
  const syncId = useId();
  const [period, setPeriod] = useState<Period>(spec.period);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const cache = useRef(new Map<Period, { at: number; points: Point[] }>());
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const hit = cache.current.get(period);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setPoints(hit.points);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadRef
      .current(period)
      .then((p) => {
        if (cancelled) return;
        cache.current.set(period, { at: Date.now(), points: p });
        setPoints(p);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les données. Réessayez.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, reloadTick]);

  const model = useMemo(() => {
    if (!points || points.length < 2) return null;
    const n = points.length;
    const values = points.map((p) => p[spec.metric]);
    const w1 = adaptWindow(20, n);
    const w2 = adaptWindow(50, n);
    const bb = bollinger(values, w1);
    const m1 = sma(values, w1);
    const m2 = sma(values, w2);
    const fast = adaptWindow(12, n);
    const slow = Math.max(fast + 1, adaptWindow(26, n));
    const sg = adaptWindow(9, n);
    const r = rsi(values, adaptWindow(14, n));
    const mc = macd(values, fast, slow, sg);
    const rows: Row[] = points.map((p, i) => ({
      key: p.key,
      label: p.label,
      partial: p.partial,
      value: values[i],
      ma1: m1[i],
      ma2: w2 > w1 ? m2[i] : null,
      band: bb.lo[i] !== null && bb.up[i] !== null ? [bb.lo[i] as number, bb.up[i] as number] : null,
      vol: p.livraisons + p.rejetees + p.injoignables,
      volUp: i === 0 || values[i] >= values[i - 1],
      rsi: r[i],
      macd: mc.line[i],
      signal: mc.signal[i],
      hist: mc.hist[i],
    }));
    return { rows, w1, w2, advanced: n >= 8, macdLabel: `MACD (${fast}, ${slow}, ${sg})` };
  }, [points, spec.metric]);

  const metric = spec.metric;
  const fmtAxis = (v: number) => compact.format(v);
  const fmtFull = (v: number) => `${nf.format(Math.round(v * 10) / 10)}${unit(metric)}`;

  const showBand = spec.overlays.includes('bollinger');
  const showMa1 = spec.overlays.includes('ma20');
  const showMa2 = spec.overlays.includes('ma50') && !!model && model.w2 > model.w1;
  const wanted = model?.advanced ? spec.panels : spec.panels.filter((p) => p === 'volume');
  const order = ['volume', 'rsi', 'macd'] as const;
  const panels = order.filter((p) => wanted.includes(p));
  const lastPanel: string = panels.length ? panels[panels.length - 1] : 'main';

  const xAxis = (show: boolean) => (
    <XAxis
      dataKey="label"
      hide={!show}
      tickLine={false}
      axisLine={{ stroke: 'var(--surface-border)' }}
      tick={tick}
      interval="preserveStartEnd"
      minTickGap={36}
    />
  );
  const yAxis = (extra?: Record<string, unknown>) => (
    <YAxis
      orientation="right"
      width={58}
      tickLine={false}
      axisLine={false}
      tick={tick}
      tickFormatter={fmtAxis}
      domain={['auto', 'auto']}
      {...extra}
    />
  );
  const grid = <CartesianGrid vertical={false} stroke="var(--surface-border)" strokeDasharray="3 3" />;
  const silentTip = <Tooltip content={() => null} cursor={cursor} />;

  const last = model?.rows[model.rows.length - 1];
  const prev = model && model.rows.length > 1 ? model.rows[model.rows.length - 2] : undefined;
  const delta = last && prev && prev.value !== 0 ? ((last.value - prev.value) / Math.abs(prev.value)) * 100 : null;

  return (
    <section
      className="my-2 w-full rounded-xl border border-surface-border bg-surface/50 p-3 text-slate-100"
      aria-label={`Graphique : ${METRIC_LABEL[metric]}, vue par ${PERIODS[period].label.toLowerCase()}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Période" className="flex gap-1 rounded-lg border border-surface-border bg-surface p-0.5">
          {(Object.keys(PERIODS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => setPeriod(p)}
              className={`min-h-7 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                p === period
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-400 hover:bg-surface-raised hover:text-slate-100'
              }`}
            >
              {PERIODS[p].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            cache.current.delete(period);
            setReloadTick((t) => t + 1);
          }}
          className="min-h-7 rounded-md border border-surface-border bg-surface px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-brand/40 hover:text-slate-100"
        >
          Actualiser
        </button>
      </div>

      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="font-semibold text-slate-100">{METRIC_LABEL[metric]}</span>
        {last && <span className="font-mono font-bold text-slate-200">{fmtFull(last.value)}</span>}
        {delta !== null && (
          <span style={{ color: delta >= 0 ? GREEN : RED }} className="font-medium">
            {delta >= 0 ? '+' : ''}
            {nf.format(Math.round(delta * 10) / 10)} % vs période précédente
          </span>
        )}
        {last?.partial && <span className="text-xs text-slate-400">période en cours</span>}
      </div>

      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <Legend color={BLUE} text={METRIC_LABEL[metric]} />
        {showMa1 && model && <Legend color={ORANGE} text={`MM ${model.w1}`} />}
        {showMa2 && model && <Legend color={VIOLET} text={`MM ${model.w2}`} dashed />}
        {showBand && model && <Legend color={GRAY} text="Bollinger" />}
      </div>

      {error && (
        <p className="py-8 text-center text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
      {!error && !model && !loading && (
        <p className="py-8 text-center text-sm text-slate-400">
          Pas encore assez de données sur cette période. Il faut au moins 2 points.
        </p>
      )}
      {!error && !model && loading && <p className="py-8 text-center text-sm text-slate-400">Chargement…</p>}

      {model && (
        <div className={`transition-opacity duration-150 ${loading ? 'opacity-50' : 'opacity-100'}`} aria-busy={loading}>
          <ResponsiveContainer width="100%" height={lastPanel === 'main' ? 300 : 260}>
            <ComposedChart data={model.rows} syncId={syncId} margin={margin}>
              {grid}
              {xAxis(lastPanel === 'main')}
              {yAxis()}
              <Tooltip
                cursor={cursor}
                content={(p: any) => <Readout {...p} metric={metric} fmt={fmtFull} />}
              />
              {showBand && (
                <Area dataKey="band" stroke="none" fill={GRAY} fillOpacity={0.14} isAnimationActive={false} connectNulls={false} />
              )}
              <Line dataKey="value" stroke={BLUE} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              {showMa1 && <Line dataKey="ma1" stroke={ORANGE} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />}
              {showMa2 && <Line dataKey="ma2" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="6 3" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />}
            </ComposedChart>
          </ResponsiveContainer>

          {panels.includes('volume') && (
            <Panel title="Volume (commandes traitées)">
              <ResponsiveContainer width="100%" height={lastPanel === 'volume' ? 100 : 76}>
                <ComposedChart data={model.rows} syncId={syncId} margin={margin}>
                  {grid}
                  {xAxis(lastPanel === 'volume')}
                  {yAxis({ domain: [0, 'auto'], tickCount: 3 })}
                  {silentTip}
                  <Bar dataKey="vol" isAnimationActive={false} maxBarSize={14} radius={[2, 2, 0, 0]}>
                    {model.rows.map((r) => (
                      <Cell key={r.key} fill={r.volUp ? GREEN : RED} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
          )}

          {panels.includes('rsi') && (
            <Panel title="RSI">
              <ResponsiveContainer width="100%" height={lastPanel === 'rsi' ? 120 : 96}>
                <ComposedChart data={model.rows} syncId={syncId} margin={margin}>
                  {grid}
                  {xAxis(lastPanel === 'rsi')}
                  {yAxis({ domain: [0, 100], ticks: [30, 50, 70], tickFormatter: (v: number) => String(v) })}
                  {silentTip}
                  <ReferenceLine y={70} stroke={RED} strokeDasharray="4 3" strokeOpacity={0.7} />
                  <ReferenceLine y={30} stroke={GREEN} strokeDasharray="4 3" strokeOpacity={0.7} />
                  <Line dataKey="rsi" stroke={VIOLET} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
          )}

          {panels.includes('macd') && (
            <Panel title={model.macdLabel}>
              <ResponsiveContainer width="100%" height={lastPanel === 'macd' ? 130 : 106}>
                <ComposedChart data={model.rows} syncId={syncId} margin={margin}>
                  {grid}
                  {xAxis(lastPanel === 'macd')}
                  {yAxis({ tickCount: 4 })}
                  {silentTip}
                  <ReferenceLine y={0} stroke="var(--surface-border)" />
                  <Bar dataKey="hist" isAnimationActive={false} maxBarSize={14}>
                    {model.rows.map((r) => (
                      <Cell key={r.key} fill={(r.hist ?? 0) >= 0 ? GREEN : RED} />
                    ))}
                  </Bar>
                  <Line dataKey="macd" stroke={BLUE} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
                  <Line dataKey="signal" stroke={ORANGE} strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
          )}

          {!model.advanced && spec.panels.some((p) => p !== 'volume') && (
            <p className="mt-2 text-xs text-slate-400">
              RSI et MACD apparaissent à partir de 8 points. Essayez une période plus fine.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Legend({ color, text, dashed }: { color: string; text: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-300">
      <span
        aria-hidden="true"
        className="inline-block h-0 w-4"
        style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }}
      />
      {text}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <div className="text-xs font-medium text-slate-300">{title}</div>
      {children}
    </div>
  );
}

function Readout({ active, payload, metric, fmt }: any) {
  if (!active || !payload?.length) return null;
  const r: Row = payload[0].payload;
  const f = (v: number | null, d = 1) => (v === null || v === undefined ? '–' : nf.format(Math.round(v * 10 ** d) / 10 ** d));
  return (
    <div className="surface-popover rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-xs text-slate-100 shadow-lg">
      <div className="mb-1 font-semibold text-slate-100">
        {r.label}
        {r.partial ? ' (en cours)' : ''}
      </div>
      <div className="text-slate-200">
        {METRIC_LABEL[metric as Metric]} : <b className="font-mono font-bold text-slate-100">{fmt(r.value)}</b>
      </div>
      <div className="text-slate-400">Volume : {f(r.vol, 0)} commandes</div>
      <div className="text-slate-400">MM : {f(r.ma1)} · RSI : {f(r.rsi)} · MACD : {f(r.macd, 2)}</div>
    </div>
  );
}

export const ProChart = memo(ProChartBase);
export default ProChart;
