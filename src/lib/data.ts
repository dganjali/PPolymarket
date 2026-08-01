import { all, get } from './db';
import { priceYes, type Reserves, type Side } from './amm';

export interface GroupRow {
  id: number;
  slug: string;
  name: string;
  invite_code: string;
  owner_id: number;
  starting_balance: number;
  market_liquidity: number;
  season_ends: string | null;
  prize: string;
  punishment: string;
  positions_public: number;
  require_approval: number;
  dispute_window_hours: number;
  current_season: number;
  season_started_at: string;
}

export interface MarketRow {
  id: number;
  group_id: number;
  creator_id: number;
  creator_name: string;
  creator_handle: string;
  question: string;
  category: string;
  rules: string;
  closes_at: string;
  status: 'pending' | 'open' | 'closed' | 'resolving' | 'resolved' | 'rejected';
  outcome: Side | null;
  proposed_outcome: Side | null;
  resolution_evidence: string;
  resolution_proposed_by: number | null;
  resolution_proposed_at: string | null;
  dispute_ends_at: string | null;
  season_number: number;
  yes_reserve: number;
  no_reserve: number;
  collateral: number;
  fees: number;
  subsidy: number;
  house: number;
  volume: number;
  open_price: number;
  created_at: string;
  resolved_at: string | null;
}

export interface MembershipRow {
  id: number;
  user_id: number;
  group_id: number;
  role: 'admin' | 'member';
  balance: number;
  joined_at: string;
}

const MARKET_COLS = `
  m.*, u.name AS creator_name, u.handle AS creator_handle
  FROM markets m JOIN users u ON u.id = m.creator_id`;

export function groupBySlug(slug: string): GroupRow | undefined {
  return get<GroupRow>('SELECT * FROM groups WHERE slug = ?', slug);
}

export function groupByCode(code: string): GroupRow | undefined {
  return get<GroupRow>('SELECT * FROM groups WHERE invite_code = ?', code.trim().toUpperCase());
}

export function membership(userId: number, groupId: number): MembershipRow | undefined {
  return get<MembershipRow>(
    'SELECT * FROM memberships WHERE user_id = ? AND group_id = ?',
    userId,
    groupId,
  );
}

export function memberCount(groupId: number): number {
  return get<{ n: number }>('SELECT COUNT(*) AS n FROM memberships WHERE group_id = ?', groupId)!.n;
}

export function myGroups(userId: number) {
  return all<GroupRow & { role: string; balance: number; members: number }>(
    `SELECT g.*, ms.role, ms.balance,
            (SELECT COUNT(*) FROM memberships x WHERE x.group_id = g.id) AS members
       FROM memberships ms JOIN groups g ON g.id = ms.group_id
      WHERE ms.user_id = ?
      ORDER BY ms.joined_at`,
    userId,
  );
}

export function marketById(id: number): MarketRow | undefined {
  return get<MarketRow>(`SELECT ${MARKET_COLS} WHERE m.id = ?`, id);
}

export function marketsByGroup(groupId: number, statuses: string[]): MarketRow[] {
  const marks = statuses.map(() => '?').join(',');
  return all<MarketRow>(
    `SELECT ${MARKET_COLS} JOIN groups g ON g.id = m.group_id
      WHERE m.group_id = ? AND m.season_number = g.current_season AND m.status IN (${marks})
      ORDER BY (m.status = 'open') DESC, m.volume DESC, m.id DESC`,
    groupId,
    ...statuses,
  );
}

export function reserves(m: Pick<MarketRow, 'yes_reserve' | 'no_reserve'>): Reserves {
  return { yes: m.yes_reserve, no: m.no_reserve };
}

/** Chronological price series for a market, oldest first, normalised 0..1. */
export function priceSeries(marketId: number, limit = 40): number[] {
  const rows = all<{ price: number }>(
    'SELECT price FROM (SELECT price, id FROM price_points WHERE market_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id',
    marketId,
    limit,
  );
  return rows.map((r) => r.price);
}

export function priceSeriesFor(marketIds: number[], limit = 16): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const id of marketIds) out.set(id, priceSeries(id, limit));
  return out;
}

export interface PositionRow {
  id: number;
  market_id: number;
  user_id: number;
  yes_shares: number;
  no_shares: number;
  yes_cost: number;
  no_cost: number;
  realized: number;
}

export function positionFor(userId: number, marketId: number): PositionRow | undefined {
  return get<PositionRow>('SELECT * FROM positions WHERE user_id = ? AND market_id = ?', userId, marketId);
}

export interface OpenPosition {
  market: MarketRow;
  side: Side;
  shares: number;
  cost: number;
  price: number;
  value: number;
}

/** Every open leg the user holds in a group, split by side, richest first. */
export function openLegs(userId: number, groupId: number): OpenPosition[] {
  const rows = all<MarketRow & Pick<PositionRow, 'yes_shares' | 'no_shares' | 'yes_cost' | 'no_cost'>>(
    `SELECT m.*, u.name AS creator_name, u.handle AS creator_handle,
            p.yes_shares, p.no_shares, p.yes_cost, p.no_cost
       FROM positions p
       JOIN markets m ON m.id = p.market_id
       JOIN users u ON u.id = m.creator_id
       JOIN groups g ON g.id = m.group_id
      WHERE p.user_id = ? AND m.group_id = ? AND m.season_number = g.current_season
        AND m.status IN ('open','closed','resolving')
        AND (p.yes_shares > 0.0001 OR p.no_shares > 0.0001)`,
    userId,
    groupId,
  );

  const legs: OpenPosition[] = [];
  for (const m of rows) {
    const py = priceYes(reserves(m));
    if (m.yes_shares > 0.0001) {
      legs.push({ market: m, side: 'YES', shares: m.yes_shares, cost: m.yes_cost, price: py, value: m.yes_shares * py });
    }
    if (m.no_shares > 0.0001) {
      legs.push({ market: m, side: 'NO', shares: m.no_shares, cost: m.no_cost, price: 1 - py, value: m.no_shares * (1 - py) });
    }
  }
  return legs.sort((a, b) => b.value - a.value);
}

export interface Standing {
  userId: number;
  name: string;
  handle: string;
  role: string;
  cash: number;
  invested: number;
  total: number;
  pnl: number;
  openPositions: number;
  trades: number;
}

/** Portfolio value for every member: cash plus mark-to-market on open legs. */
export function standings(groupId: number, startingBalance: number): Standing[] {
  const members = all<{ user_id: number; name: string; handle: string; role: string; balance: number }>(
    `SELECT ms.user_id, ms.role, ms.balance, u.name, u.handle
       FROM memberships ms JOIN users u ON u.id = ms.user_id
      WHERE ms.group_id = ?`,
    groupId,
  );

  const live = all<PositionRow & { yes_reserve: number; no_reserve: number }>(
    `SELECT p.*, m.yes_reserve, m.no_reserve FROM positions p JOIN markets m ON m.id = p.market_id
       JOIN groups g ON g.id = m.group_id
      WHERE m.group_id = ? AND m.season_number = g.current_season AND m.status IN ('open','closed','resolving')`,
    groupId,
  );

  const tradeCounts = new Map<number, number>();
  for (const t of all<{ user_id: number; n: number }>(
    `SELECT t.user_id, COUNT(*) AS n FROM trades t JOIN markets m ON m.id = t.market_id
       JOIN groups g ON g.id = m.group_id
      WHERE m.group_id = ? AND m.season_number = g.current_season GROUP BY t.user_id`,
    groupId,
  )) {
    tradeCounts.set(t.user_id, t.n);
  }

  const invested = new Map<number, number>();
  const openCount = new Map<number, number>();
  for (const p of live) {
    const py = priceYes({ yes: p.yes_reserve, no: p.no_reserve });
    const v = p.yes_shares * py + p.no_shares * (1 - py);
    if (v <= 0.0001) continue;
    invested.set(p.user_id, (invested.get(p.user_id) ?? 0) + v);
    openCount.set(p.user_id, (openCount.get(p.user_id) ?? 0) + 1);
  }

  return members
    .map((m) => {
      const inv = invested.get(m.user_id) ?? 0;
      const total = m.balance + inv;
      return {
        userId: m.user_id,
        name: m.name,
        handle: m.handle,
        role: m.role,
        cash: m.balance,
        invested: inv,
        total,
        pnl: total - startingBalance,
        openPositions: openCount.get(m.user_id) ?? 0,
        trades: tradeCounts.get(m.user_id) ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface EventRow {
  id: number;
  kind: string;
  body: string;
  created_at: string;
  user_name: string | null;
  market_id: number | null;
}

export function events(groupId: number, limit = 40): EventRow[] {
  return all<EventRow>(
    `SELECT e.id, e.kind, e.body, e.created_at, e.market_id, u.name AS user_name
       FROM events e LEFT JOIN users u ON u.id = e.user_id
      WHERE e.group_id = ? ORDER BY e.id DESC LIMIT ?`,
    groupId,
    limit,
  );
}

export interface HolderRow {
  name: string;
  handle: string;
  shares: number;
}

export function holders(marketId: number, side: Side, limit = 5): HolderRow[] {
  const col = side === 'YES' ? 'yes_shares' : 'no_shares';
  return all<HolderRow>(
    `SELECT u.name, u.handle, p.${col} AS shares FROM positions p JOIN users u ON u.id = p.user_id
      WHERE p.market_id = ? AND p.${col} > 0.0001 ORDER BY p.${col} DESC LIMIT ?`,
    marketId,
    limit,
  );
}

export function marketTraderCount(marketId: number): number {
  return get<{ n: number }>(
    'SELECT COUNT(DISTINCT user_id) AS n FROM trades WHERE market_id = ?',
    marketId,
  )!.n;
}

export interface CommentRow {
  id: number;
  body: string;
  created_at: string;
  name: string;
  handle: string;
}

export interface DisputeRow {
  id: number;
  market_id: number;
  user_id: number;
  reason: string;
  created_at: string;
  name: string;
  handle: string;
}

export function marketDisputes(marketId: number): DisputeRow[] {
  return all<DisputeRow>(
    `SELECT d.*, u.name, u.handle FROM market_disputes d
       JOIN users u ON u.id = d.user_id
      WHERE d.market_id = ? ORDER BY d.id DESC`,
    marketId,
  );
}

export function disputeFor(userId: number, marketId: number): DisputeRow | undefined {
  return get<DisputeRow>(
    `SELECT d.*, u.name, u.handle FROM market_disputes d
       JOIN users u ON u.id = d.user_id
      WHERE d.user_id = ? AND d.market_id = ?`,
    userId,
    marketId,
  );
}

export function comments(marketId: number, limit = 50): CommentRow[] {
  return all<CommentRow>(
    `SELECT c.id, c.body, c.created_at, u.name, u.handle
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.market_id = ? ORDER BY c.id DESC LIMIT ?`,
    marketId,
    limit,
  );
}

export function recentTrades(marketId: number, limit = 12) {
  return all<{
    id: number; side: Side; action: string; shares: number; cash: number;
    avg_price: number; created_at: string; name: string;
  }>(
    `SELECT t.id, t.side, t.action, t.shares, t.cash, t.avg_price, t.created_at, u.name
       FROM trades t JOIN users u ON u.id = t.user_id
      WHERE t.market_id = ? ORDER BY t.id DESC LIMIT ?`,
    marketId,
    limit,
  );
}

export interface NotificationRow {
  id: number;
  group_id: number | null;
  market_id: number | null;
  kind: string;
  body: string;
  read_at: string | null;
  created_at: string;
  group_slug: string | null;
  group_name: string | null;
}

export function notifications(userId: number, limit = 60): NotificationRow[] {
  return all<NotificationRow>(
    `SELECT n.*, g.slug AS group_slug, g.name AS group_name
       FROM notifications n LEFT JOIN groups g ON g.id = n.group_id
      WHERE n.user_id = ? ORDER BY n.id DESC LIMIT ?`,
    userId,
    limit,
  );
}

export function unreadNotificationCount(userId: number): number {
  return get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL',
    userId,
  )!.n;
}

export interface SeasonResultRow {
  season_number: number;
  rank: number;
  final_total: number;
  pnl: number;
  user_id: number;
  name: string;
  handle: string;
  created_at: string;
}

export function seasonHistory(groupId: number): SeasonResultRow[] {
  return all<SeasonResultRow>(
    `SELECT r.*, u.name, u.handle FROM season_results r JOIN users u ON u.id = r.user_id
      WHERE r.group_id = ? ORDER BY r.season_number DESC, r.rank`,
    groupId,
  );
}

export const CATEGORIES = ['Drama', 'School', 'Traditions', 'Sports', 'Life', 'Other'];
