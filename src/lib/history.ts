/**
 * Reads that feed the market page's chart.
 *
 * These live apart from data.ts because they answer one question — "what has
 * this market done over time, and why" — and because they all return chart-ready
 * shapes (epoch milliseconds, probabilities in 0..1) rather than database rows.
 *
 * Timeframe filtering is deliberately *not* done here. A group market has a few
 * hundred price points at most, so the whole history ships once and the client
 * clips it per timeframe. Switching from 1D to ALL is then instant and costs no
 * round trip — the opposite trade from a public exchange with millions of
 * points, and the right one at this size.
 */
import { all } from './db';
import { colorFor, thinSteps, type Point, type Series } from './chart';
import { marketOptions, type MarketRow } from './data';
import { parseStamp } from './format';

/** Above this, a series is thinned. Roughly two samples per horizontal pixel. */
const MAX_POINTS = 720;

interface PricePointRow {
  price: number;
  created_at: string;
}

interface OptionPricePointRow extends PricePointRow {
  option_id: number;
}

const toPoint = (row: PricePointRow): Point => ({ t: parseStamp(row.created_at), v: row.price });

/**
 * Every line the chart should draw for a market.
 *
 * Binary markets get one line — the Yes probability. The No line is exactly its
 * mirror, so drawing both says nothing and doubles the ink; the trade ticket
 * carries the No price instead. Categorical markets get one line per outcome.
 *
 * Both start at the market's opening price rather than its first trade, so a
 * market that has traded twice still draws a line across the whole plot instead
 * of a dot in the corner.
 */
export async function marketSeries(market: MarketRow): Promise<Series[]> {
  const opened = parseStamp(market.created_at);

  if (market.market_type === 'categorical') {
    const [options, rows] = await Promise.all([
      marketOptions(market.id),
      all<OptionPricePointRow>(
        `SELECT p.option_id, p.price, p.created_at
           FROM option_price_points p
           JOIN market_options o ON o.id = p.option_id
          WHERE o.market_id = ?
          ORDER BY p.id`,
        market.id,
      ),
    ]);
    const byOption = new Map<number, Point[]>(options.map((option) => [option.id, []]));
    for (const row of rows) byOption.get(row.option_id)?.push(toPoint(row));

    const opening = 1 / Math.max(1, options.length);
    return options.map((option, index) => {
      const points = byOption.get(option.id) ?? [];
      return {
        id: String(option.id),
        label: option.label,
        color: colorFor(index),
        points: thinSteps(withOpening(points, opened, opening), MAX_POINTS),
      };
    });
  }

  const rows = await all<PricePointRow>(
    'SELECT price, created_at FROM price_points WHERE market_id = ? ORDER BY id',
    market.id,
  );
  return [
    {
      id: 'YES',
      label: 'Yes',
      color: 'var(--yes)',
      points: thinSteps(withOpening(rows.map(toPoint), opened, market.open_price), MAX_POINTS),
    },
  ];
}

/** Pin the opening price at the moment the market opened. */
function withOpening(points: Point[], opened: number, opening: number): Point[] {
  if (points.length && points[0].t <= opened) return points;
  return [{ t: opened, v: opening }, ...points];
}

/**
 * Sparkline points for a list of markets, in one query per kind rather than one
 * per market. A binary market gets its Yes line; a categorical one gets its
 * current leader, which is the only line that fits in 72 pixels.
 */
export async function sparkSeriesFor(
  markets: Pick<MarketRow, 'id' | 'market_type' | 'created_at' | 'open_price'>[],
  perMarket = 60,
): Promise<Map<number, Point[]>> {
  const out = new Map<number, Point[]>();
  if (markets.length === 0) return out;

  const binary = markets.filter((m) => m.market_type !== 'categorical');
  const multi = markets.filter((m) => m.market_type === 'categorical');

  // The two kinds share nothing, so they are fetched together. Run in sequence, as
  // they were, a mixed grid cost two round trips where one would do — and this runs
  // on the group's landing screen.
  const [binaryRows, multiRows] = await Promise.all([
    binary.length
      ? all<PricePointRow & { market_id: number }>(
          `SELECT market_id, price, created_at FROM price_points
            WHERE market_id IN (${binary.map(() => '?').join(',')}) ORDER BY market_id, id`,
          ...binary.map((m) => m.id),
        )
      : Promise.resolve([]),
    multi.length
      // The leading outcome per market, by its most recent price.
      ? all<OptionPricePointRow & { market_id: number }>(
          `SELECT o.market_id, p.option_id, p.price, p.created_at
             FROM option_price_points p
             JOIN market_options o ON o.id = p.option_id
            WHERE o.market_id IN (${multi.map(() => '?').join(',')})
            ORDER BY o.market_id, p.id`,
          ...multi.map((m) => m.id),
        )
      : Promise.resolve([]),
  ]);

  if (binary.length) {
    for (const market of binary) out.set(market.id, [{ t: parseStamp(market.created_at), v: market.open_price }]);
    for (const row of binaryRows) out.get(row.market_id)?.push(toPoint(row));
  }

  if (multi.length) {
    const rows = multiRows;
    const byMarket = new Map<number, Map<number, Point[]>>();
    for (const row of rows) {
      const options = byMarket.get(row.market_id) ?? new Map<number, Point[]>();
      const points = options.get(row.option_id) ?? [];
      points.push(toPoint(row));
      options.set(row.option_id, points);
      byMarket.set(row.market_id, options);
    }
    for (const market of multi) {
      const options = [...(byMarket.get(market.id)?.values() ?? [])];
      const leader = options.sort((a, b) => (b.at(-1)?.v ?? 0) - (a.at(-1)?.v ?? 0))[0] ?? [];
      out.set(market.id, leader);
    }
  }

  for (const [id, points] of out) out.set(id, thinSteps(points, perMarket));
  return out;
}

export interface Moment {
  id: string;
  /** Epoch milliseconds. */
  t: number;
  kind: 'move' | 'comment' | 'event';
  /** One line, shown as the card's headline. */
  headline: string;
  /** The detail under it. May be empty. */
  body: string;
  /** Who caused it, if anybody. */
  who?: string;
  /** Signed probability change, for a move. */
  move?: number;
}

interface MoveRow {
  id: number;
  created_at: string;
  price_after: number;
  previous: number | null;
  shares: number;
  cash: number;
  side: string;
  action: string;
  name: string;
  handle: string;
  option_label: string | null;
}

interface ThreadRow {
  id: number;
  created_at: string;
  body: string;
  name: string;
}

interface FeedRow {
  id: number;
  created_at: string;
  kind: string;
  body: string;
  name: string | null;
}

/** A move smaller than this is noise, not a story. Five probability points. */
const MOVE_THRESHOLD = 0.05;

/**
 * The moments that moved this market — what Polymarket fills with news
 * headlines, and this app fills with its own group.
 *
 * Three sources: trades that moved the price more than five points, comments,
 * and the market's own lifecycle events. Ordered oldest first so the chart can
 * page through them left to right.
 */
export async function marketMoments(marketId: number, limit = 12): Promise<Moment[]> {
  const [moves, thread, feed] = await Promise.all([
    all<MoveRow>(
      `SELECT t.id, t.created_at, t.price_after, t.shares, t.cash, t.side, t.action,
              u.name, u.handle, o.label AS option_label,
              LAG(t.price_after) OVER (PARTITION BY COALESCE(t.option_id, 0) ORDER BY t.id) AS previous
         FROM trades t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN market_options o ON o.id = t.option_id
        WHERE t.market_id = ?
        ORDER BY t.id`,
      marketId,
    ),
    all<ThreadRow>(
      `SELECT c.id, c.created_at, c.body, u.name
         FROM comments c JOIN users u ON u.id = c.user_id
        WHERE c.market_id = ? ORDER BY c.id DESC LIMIT ?`,
      marketId,
      limit,
    ),
    all<FeedRow>(
      // 'trade' events are excluded: every one of them is already a candidate
      // move above, with the price change attached. Listing both would put two
      // markers on the same instant saying the same thing.
      `SELECT e.id, e.created_at, e.kind, e.body, u.name
         FROM events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.market_id = ? AND e.kind <> 'trade' ORDER BY e.id DESC LIMIT ?`,
      marketId,
      limit,
    ),
  ]);

  const swings: Moment[] = moves
    .filter((row) => row.previous != null && Math.abs(row.price_after - row.previous) >= MOVE_THRESHOLD)
    .map((row) => {
      const move = row.price_after - (row.previous ?? row.price_after);
      const what = row.option_label ?? row.side;
      return {
        id: `move-${row.id}`,
        t: parseStamp(row.created_at),
        kind: 'move' as const,
        headline: `${what} ${move >= 0 ? 'jumped' : 'fell'} ${Math.abs(move * 100).toFixed(0)} points`,
        body: `${row.name} ${row.action === 'BUY' ? 'bought' : 'sold'} ${Math.round(row.shares).toLocaleString('en-US')} ${what} shares for $${Math.abs(row.cash).toFixed(2)}, taking it to ${Math.round(row.price_after * 100)}%.`,
        who: row.name,
        move,
      };
    });

  const said: Moment[] = thread.map((row) => ({
    id: `comment-${row.id}`,
    t: parseStamp(row.created_at),
    kind: 'comment' as const,
    headline: `${row.name} said`,
    body: row.body,
    who: row.name,
  }));

  const happened: Moment[] = feed.map((row) => ({
    id: `event-${row.id}`,
    t: parseStamp(row.created_at),
    kind: 'event' as const,
    headline: EVENT_HEADLINES[row.kind] ?? 'Update',
    body: row.body,
    who: row.name ?? undefined,
  }));

  // Biggest swings first while trimming, then back into time order for the chart.
  const ranked = [
    ...swings.sort((a, b) => Math.abs(b.move ?? 0) - Math.abs(a.move ?? 0)).slice(0, limit),
    ...said,
    ...happened,
  ];
  return ranked.sort((a, b) => a.t - b.t).slice(0, limit * 2);
}

/** Keyed on the `kind` values engine.ts actually writes into `events`. */
const EVENT_HEADLINES: Record<string, string> = {
  market: 'Market opened',
  proposal: 'Proposed to the group',
  resolve: 'Settled',
  dispute: 'Result disputed',
  announcement: 'Announcement',
  season: 'Season rolled over',
};

export interface RelatedMarket {
  id: number;
  question: string;
  category: string;
  market_type: string;
  status: string;
  volume: number;
  yes_reserve: number;
  no_reserve: number;
  closes_at: string;
}

/**
 * What else this group is betting on — the rail beside the trade ticket.
 *
 * Same category first, because that is the closest thing this schema has to
 * Polymarket's event grouping, then whatever else is busiest. Markets carry no
 * series column and adding one would mean an events table, a picker in the
 * create form and a migration; category ordering gets most of the value for
 * none of that.
 */
export async function relatedMarkets(
  groupId: number,
  excludeId: number,
  category: string,
  limit = 6,
): Promise<RelatedMarket[]> {
  return all<RelatedMarket>(
    `SELECT m.id, m.question, m.category, m.market_type, m.status, m.volume,
            m.yes_reserve, m.no_reserve, m.closes_at
       FROM markets m
       JOIN groups g ON g.id = m.group_id
      WHERE m.group_id = ? AND m.id <> ? AND m.season_number = g.current_season
        AND m.status IN ('open', 'closed', 'resolving')
      ORDER BY (m.category = ?) DESC, m.volume DESC, m.id DESC
      LIMIT ?`,
    groupId,
    excludeId,
    category,
    limit,
  );
}
