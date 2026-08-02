export const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money0 = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export const signedMoney = (n: number) =>
  (n >= 0 ? '+' : '−') + money(Math.abs(n)).slice(1);

export const shares = (n: number) =>
  Math.round(n).toLocaleString('en-US');

export const centsLabel = (p: number) => `${Math.max(1, Math.min(99, Math.round(p * 100)))}¢`;

export const pctLabel = (p: number) => `${Math.max(1, Math.min(99, Math.round(p * 100)))}%`;

export const signedCents = (delta: number) => {
  const c = delta * 100;
  return `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(1)}¢`;
};

/** How much has been bet through a question, in words rather than trading desk shorthand. */
export const volLabel = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}k bet` : `$${Math.round(v)} bet`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

/**
 * Epoch ms for a stored timestamp. The database writes UTC as
 * "YYYY-MM-DD HH:MM:SS", which `Date.parse` would otherwise read as local time.
 */
export function parseStamp(iso: string): number {
  return Date.parse(iso.includes('T') || iso.includes('Z') ? iso : iso.replace(' ', 'T') + 'Z');
}

/** The inverse: an epoch/Date as the "YYYY-MM-DD HH:MM:SS" UTC the schema stores. */
export function stamp(at: number | Date = Date.now()): string {
  return new Date(at).toISOString().slice(0, 19).replace('T', ' ');
}

/** "in 3d", "2h ago", "Jun 12" */
export function relative(iso: string, now = Date.now()): string {
  const t = parseStamp(iso);
  if (Number.isNaN(t)) return iso;
  const diff = t - now;
  const abs = Math.abs(diff);
  const min = 60_000, hour = 3_600_000, day = 86_400_000;
  const unit = abs < min ? 'now' : abs < hour ? `${Math.round(abs / min)}m` : abs < day ? `${Math.round(abs / hour)}h` : `${Math.round(abs / day)}d`;
  if (unit === 'now') return 'now';
  if (abs > day * 14) {
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return diff > 0 ? `in ${unit}` : `${unit} ago`;
}

export function dateLabel(iso: string): string {
  const t = parseStamp(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Jun 12, 2026" — for archives, where the year matters. */
export function longDateLabel(iso: string): string {
  const t = parseStamp(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Slugify a group name into a URL segment. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'group'
  );
}

export type Domain = [lo: number, hi: number];

/**
 * Vertical range to plot a price series over. Sparklines have no axis, so they
 * auto-scale to the series' own range — otherwise a market that moved 16¢ to
 * 32¢ draws as a flat line near the floor. Charts with gridlines keep the full
 * [0, 1] domain, where absolute height is the whole point.
 */
export function autoDomain(series: number[], minSpan = 0.08): Domain {
  if (series.length === 0) return [0, 1];
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const mid = (lo + hi) / 2;
  const pad = Math.max(hi - lo, minSpan) * 0.6;
  return [Math.max(0, mid - pad), Math.min(1, mid + pad)];
}

/** Points string for an SVG polyline over a 0..1 price series. */
export function sparkPoints(
  series: number[],
  w: number,
  h: number,
  pad = 3,
  domain: Domain = [0, 1],
): string {
  if (series.length === 0) return '';
  const pts = series.length === 1 ? [series[0], series[0]] : series;
  const [lo, hi] = domain;
  const range = hi - lo || 1;
  const inner = h - pad * 2;

  return pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const t = Math.max(0, Math.min(1, (v - lo) / range));
      return `${x.toFixed(1)},${(h - pad - t * inner).toFixed(1)}`;
    })
    .join(' ');
}

export function areaPoints(
  series: number[],
  w: number,
  h: number,
  pad = 3,
  domain: Domain = [0, 1],
): string {
  if (series.length === 0) return '';
  return `0,${h} ${sparkPoints(series, w, h, pad, domain)} ${w},${h}`;
}
