/**
 * Checks on the chart maths. Run with `npm test`.
 *
 * The chart is the loudest thing on a market page, so the things that would be
 * embarrassing to get wrong — a line that stops halfway, a crosshair reading a
 * price the market never traded at, overlapping labels — are checked here.
 */
import assert from 'node:assert/strict';
import {
  clip,
  deltaOver,
  indexAt,
  stackLabels,
  stepAreaPath,
  stepPath,
  ticksFor,
  valueAt,
  windowFor,
  type Point,
  type Series,
} from '../src/lib/chart';

let checks = 0;
const ok = (cond: boolean, label: string) => {
  assert.ok(cond, label);
  checks++;
};
const eq = <T>(a: T, b: T, label: string) => {
  assert.deepEqual(a, b, label);
  checks++;
};

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 6, 1, 12, 0, 0);
const pts: Point[] = [
  { t: T0, v: 0.5 },
  { t: T0 + HOUR, v: 0.62 },
  { t: T0 + 4 * HOUR, v: 0.41 },
];

// ── step semantics ───────────────────────────────────────────────────────────
eq(valueAt(pts, T0 - HOUR), 0.5, 'before the first sample reads the opening price');
eq(valueAt(pts, T0 + HOUR / 2), 0.5, 'a price holds flat until the next trade');
eq(valueAt(pts, T0 + HOUR), 0.62, 'a sample takes effect at its own instant');
eq(valueAt(pts, T0 + 99 * HOUR), 0.41, 'after the last trade the price holds');
eq(valueAt([], 0), 0, 'an empty series reads zero rather than throwing');

eq(indexAt(pts, T0 - 1), -1, 'no index before the series starts');
eq(indexAt(pts, T0 + 2 * HOUR), 1, 'the index is the last sample at or before the instant');
eq(indexAt(pts, T0 + 4 * HOUR), 2, 'the last sample is reachable');

// A binary search over a long series must agree with a linear scan.
{
  const long: Point[] = Array.from({ length: 500 }, (_, i) => ({ t: T0 + i * 1000, v: i / 500 }));
  for (const probe of [T0 - 5, T0, T0 + 250_500, T0 + 499_000, T0 + 10_000_000]) {
    const linear = long.reduce((acc, p) => (p.t <= probe ? p.v : acc), long[0].v);
    eq(valueAt(long, probe), linear, `binary search agrees with a scan at ${probe}`);
  }
}

// ── clipping fills the plot ──────────────────────────────────────────────────
{
  const window = clip(pts, T0 + 2 * HOUR, T0 + 3 * HOUR);
  eq(window.length, 2, 'a window with no samples still gets both edges');
  eq(window[0].v, 0.62, 'the leading edge carries the price in force at the time');
  eq(window[1].v, 0.62, 'and holds it to the right edge');
  eq([window[0].t, window[1].t], [T0 + 2 * HOUR, T0 + 3 * HOUR], 'edges sit exactly on the window');
}
{
  const window = clip(pts, T0 - HOUR, T0 + 6 * HOUR);
  eq(window.length, 5, 'a wide window keeps every sample plus both edges');
  eq(window[window.length - 1].v, 0.41, 'the trailing edge extends the last price to now');
}
eq(clip([], 0, 10), [], 'clipping nothing yields nothing');

// ── timeframe windows ────────────────────────────────────────────────────────
{
  const series: Series[] = [{ id: 'yes', label: 'Yes', color: '#000', points: pts }];
  const now = T0 + 5 * HOUR;
  const [from, to] = windowFor(series, '1H', now);
  ok(to === now, 'a window ends at the present, not at the last trade');
  ok(to - from === HOUR, 'the 1H window is an hour wide');

  const [allFrom] = windowFor(series, 'ALL', now);
  eq(allFrom, T0, 'ALL starts at the first sample');

  // A market minutes old must not draw its whole life in the last pixel column.
  const fresh: Series[] = [{ id: 'yes', label: 'Yes', color: '#000', points: [{ t: now - 60_000, v: 0.5 }] }];
  const [freshFrom, freshTo] = windowFor(fresh, '1M', now);
  ok(freshTo > freshFrom, 'a brand-new market still gets a window with width');

  const [emptyFrom, emptyTo] = windowFor([], 'ALL', now);
  ok(emptyTo > emptyFrom, 'a market with no history at all still gets a window');
}

// ── paths ────────────────────────────────────────────────────────────────────
{
  const x = (t: number) => (t - T0) / HOUR;
  const y = (v: number) => 100 - v * 100;
  const path = stepPath(pts, x, y);
  eq(
    path,
    'M 0.00 50.00 H 1.00 V 38.00 H 4.00 V 59.00',
    'a step path holds each price flat, then jumps',
  );
  ok(!/L /.test(path), 'a step path never draws a diagonal');
  eq(stepPath([], x, y), '', 'an empty series draws no path');
  eq(stepPath([pts[0]], x, y), 'M 0.00 50.00', 'a single sample is a single move');

  const area = stepAreaPath(pts, x, y, 100);
  ok(area.startsWith(path), 'the area reuses the line');
  ok(area.endsWith('Z'), 'the area closes');
  ok(area.includes('L 4.00 100.00'), 'the area drops to the baseline under the last sample');

  // Repeated identical prices must not emit redundant vertical moves.
  const flat: Point[] = [
    { t: T0, v: 0.5 },
    { t: T0 + HOUR, v: 0.5 },
    { t: T0 + 2 * HOUR, v: 0.5 },
  ];
  eq(stepPath(flat, x, y), 'M 0.00 50.00 H 1.00 H 2.00', 'a flat market draws one horizontal run');
}

// ── deltas ───────────────────────────────────────────────────────────────────
{
  const delta = deltaOver(pts, T0, T0 + 4 * HOUR);
  ok(Math.abs(delta - -0.09) < 1e-9, 'the delta is measured between the two endpoints');
  eq(deltaOver([], 0, 1), 0, 'an empty series has no delta');
}

// ── axis ticks ───────────────────────────────────────────────────────────────
{
  const hourly = ticksFor(T0, T0 + 6 * HOUR);
  ok(hourly.length >= 2 && hourly.length <= 12, 'an hours-wide window gets a sane number of ticks');
  ok(hourly.every((t) => t.t >= T0 && t.t <= T0 + 6 * HOUR), 'every tick lands inside the window');
  ok(hourly.every((t, i, all) => i === 0 || t.t > all[i - 1].t), 'ticks are strictly increasing');

  const monthly = ticksFor(T0 - 300 * 24 * HOUR, T0);
  ok(monthly.length >= 2, 'a year-wide window still gets labelled');
  ok(monthly.every((t) => /^[A-Z][a-z]{2}$/.test(t.label)), 'a year-wide window labels months');

  ok(ticksFor(T0, T0 + 1).length <= 12, 'a degenerate window cannot spin out ticks');
}

// ── tooltip stacking ─────────────────────────────────────────────────────────
{
  const stacked = stackLabels([50, 52, 54], 20, 0, 300);
  ok(
    stacked.every((y, i) => i === 0 || y - stacked[i - 1] >= 20 - 1e-9),
    'colliding labels are pushed a full gap apart',
  );
  eq(stacked[0], 50, 'the topmost label keeps its own price when there is room');

  const clamped = stackLabels([290, 292, 295], 20, 0, 300);
  ok(clamped.every((y) => y <= 300 + 1e-9), 'a stack that overflows is slid back inside the plot');
  ok(
    clamped.every((y, i) => i === 0 || y - clamped[i - 1] >= 20 - 1e-9),
    'sliding back up keeps the labels apart',
  );

  const spread = stackLabels([10, 200], 20, 0, 300);
  eq(spread, [10, 200], 'labels that do not collide are left exactly where they want to be');

  const unsorted = stackLabels([200, 10], 20, 0, 300);
  eq(unsorted, [200, 10], 'results come back in the order the caller asked for');
}

console.log(`chart: ${checks} checks passed`);
