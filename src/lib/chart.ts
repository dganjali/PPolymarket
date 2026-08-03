/**
 * Chart maths, shared by every price chart in the app.
 *
 * Everything here is pure and unit-free: callers hand in scale functions that
 * map a timestamp and a probability onto pixels, so the same helpers serve the
 * 66px sparkline on a card and the 320px chart on a market page.
 *
 * The one idea worth stating out loud: an AMM price is a *step* function. It
 * holds flat between trades and jumps at one. Drawing straight lines between
 * samples invents prices that never existed — a market that traded twice would
 * look like it drifted smoothly for a week. Every path here is stepped.
 */

export type Timeframe = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

export const TIMEFRAMES: Timeframe[] = ['1H', '6H', '1D', '1W', '1M', 'ALL'];

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1H': HOUR,
  '6H': 6 * HOUR,
  '1D': 24 * HOUR,
  '1W': 7 * 24 * HOUR,
  '1M': 30 * 24 * HOUR,
  ALL: Number.POSITIVE_INFINITY,
};

export interface Point {
  /** Epoch milliseconds. */
  t: number;
  /** Probability in 0..1. */
  v: number;
}

export interface Series {
  id: string;
  label: string;
  color: string;
  points: Point[];
}

export type Scale = (input: number) => number;

/**
 * The price at an instant, holding the last sample forward. Points must be
 * sorted; a binary search keeps the crosshair cheap on a long series.
 */
export function valueAt(points: Point[], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0].t) return points[0].v;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[lo].v;
}

/** The index of the last sample at or before `t`, or -1 before the series starts. */
export function indexAt(points: Point[], t: number): number {
  if (points.length === 0 || t < points[0].t) return -1;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The samples inside a window, with synthetic points pinned to both edges so a
 * line always spans the full plot. Without the leading edge point a market whose
 * last trade was on Monday would draw nothing at all in a 1H view.
 */
export function clip(points: Point[], from: number, to: number): Point[] {
  if (points.length === 0) return [];
  const inside = points.filter((p) => p.t >= from && p.t <= to);
  const head: Point[] = inside.length === 0 || inside[0].t > from ? [{ t: from, v: valueAt(points, from) }] : [];
  const last = inside.length ? inside[inside.length - 1] : head[0];
  const tail: Point[] = last && last.t < to ? [{ t: to, v: last.v }] : [];
  return [...head, ...inside, ...tail];
}

/**
 * The time window a timeframe selects. ALL starts at the earliest sample, and
 * every window is clamped so it can never start after it ends — a market that
 * opened ten minutes ago still fills the 1M view rather than drawing a line in
 * the last one percent of the plot.
 */
export function windowFor(
  series: Series[],
  timeframe: Timeframe,
  now: number = Date.now(),
): [from: number, to: number] {
  const stamps = series.flatMap((s) => s.points.map((p) => p.t));
  const earliest = stamps.length ? Math.min(...stamps) : now;
  const latest = Math.max(now, ...(stamps.length ? [Math.max(...stamps)] : [now]));
  const span = TIMEFRAME_MS[timeframe];
  const from = span === Number.POSITIVE_INFINITY ? earliest : Math.max(earliest, latest - span);
  // A degenerate window (one sample, or a market seconds old) still needs width.
  return from >= latest ? [latest - Math.min(span, HOUR), latest] : [from, latest];
}

/** `M`/`H`/`V` path for a step line. */
export function stepPath(points: Point[], x: Scale, y: Scale): string {
  if (points.length === 0) return '';
  const parts = [`M ${x(points[0].t).toFixed(2)} ${y(points[0].v).toFixed(2)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`H ${x(points[i].t).toFixed(2)}`);
    if (points[i].v !== points[i - 1].v) parts.push(`V ${y(points[i].v).toFixed(2)}`);
  }
  return parts.join(' ');
}

/** The same step line closed against a baseline, for a gradient fill. */
export function stepAreaPath(points: Point[], x: Scale, y: Scale, baseline: number): string {
  if (points.length === 0) return '';
  const last = points[points.length - 1];
  return `${stepPath(points, x, y)} L ${x(last.t).toFixed(2)} ${baseline.toFixed(2)} L ${x(points[0].t).toFixed(2)} ${baseline.toFixed(2)} Z`;
}

/** Change over a window, in probability points (0.05 === five points). */
export function deltaOver(points: Point[], from: number, to: number = Date.now()): number {
  if (points.length === 0) return 0;
  return valueAt(points, to) - valueAt(points, from);
}

/**
 * The most recent move worth reporting, and what to call it.
 *
 * "+0.0¢ today" on a market whose last trade was on Tuesday is technically true
 * and completely useless. So the window widens until it finds actual movement:
 * a day, then a week, then the market's whole life.
 */
export function recentDelta(points: Point[], now: number = Date.now()): { value: number; label: string } {
  const windows: [number, string][] = [
    [DAY, 'today'],
    [7 * DAY, 'this week'],
    [30 * DAY, 'this month'],
  ];
  for (const [span, label] of windows) {
    const value = deltaOver(points, now - span, now);
    if (Math.abs(value) >= 0.005) return { value, label };
  }
  const first = points[0]?.v ?? 0;
  return { value: valueAt(points, now) - first, label: 'since it opened' };
}

export interface Tick {
  t: number;
  label: string;
}

/**
 * Four to six time labels for the axis, snapped to round instants — the hour,
 * the day, the month — so labels stay put as the window slides.
 */
export function ticksFor(from: number, to: number, target = 5): Tick[] {
  const span = Math.max(1, to - from);
  const steps = [
    5 * MINUTE, 15 * MINUTE, 30 * MINUTE,
    HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
    DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY, 365 * DAY,
  ];
  const step = steps.find((s) => span / s <= target) ?? steps[steps.length - 1];
  const format: Intl.DateTimeFormatOptions =
    step < DAY
      ? { hour: 'numeric', minute: '2-digit' }
      : step < 30 * DAY
        ? { month: 'short', day: 'numeric' }
        : { month: 'short' };

  const ticks: Tick[] = [];
  // Snap to the step from the epoch, then walk forward. Anything coarser than a
  // day snaps to the month instead, since months are not a fixed length.
  const start = step >= 30 * DAY ? monthStart(from) : Math.ceil(from / step) * step;
  for (let t = start; t <= to; t = step >= 30 * DAY ? nextMonth(t) : t + step) {
    if (t < from) continue;
    ticks.push({ t, label: new Date(t).toLocaleString('en-US', format) });
    if (ticks.length > 12) break;
  }
  return ticks;
}

function monthStart(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function nextMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

/** How a moment is spoken in a tooltip: "Jul 14, 8:00 AM". */
export function momentLabel(t: number, withYear = false): string {
  return new Date(t).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Stack tooltip labels so none overlap: each wants to sit at its own price, and
 * any that collide are pushed apart while staying inside the plot. Returns a
 * top offset per input, in the order given.
 */
export function stackLabels(targets: number[], gap: number, min: number, max: number): number[] {
  const order = targets.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  let cursor = min;
  for (const item of order) {
    item.y = Math.max(item.y, cursor);
    cursor = item.y + gap;
  }
  // If the stack overflowed the bottom, slide the whole run back up.
  const overflow = cursor - gap - max;
  if (overflow > 0) {
    let ceiling = max;
    for (let k = order.length - 1; k >= 0; k--) {
      order[k].y = Math.min(order[k].y, ceiling);
      ceiling = order[k].y - gap;
    }
  }
  const out = new Array<number>(targets.length);
  for (const item of order) out[item.i] = item.y;
  return out;
}

/**
 * Thin a long series down to `max` samples while keeping every sample that
 * actually moved the price.
 *
 * Striding — keep every nth point — is the obvious approach and the wrong one
 * for a step chart: it drops the jumps, which are the only interesting samples,
 * and keeps the flat stretches, which are not. So samples are ranked by how far
 * they moved and the biggest moves survive, along with both endpoints.
 */
export function thinSteps(points: Point[], max: number): Point[] {
  if (points.length <= max || max < 2) return points;
  const ranked = points
    .map((p, i) => ({ i, move: i === 0 ? Infinity : Math.abs(p.v - points[i - 1].v) }))
    .sort((a, b) => b.move - a.move)
    .slice(0, max - 1)
    .map((r) => r.i);
  const keep = new Set(ranked);
  keep.add(0);
  keep.add(points.length - 1);
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}

/** Eight series colours, in the order outcomes are assigned them. */
export const SERIES_COLORS = [
  '#3fb27f',
  '#4d87f7',
  '#e0b341',
  '#c06bd9',
  '#e15241',
  '#3fc0d4',
  '#e08a3c',
  '#7d8ce8',
];

export const colorFor = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length];
