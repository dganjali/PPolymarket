import { all, get } from './db';
import { priceYes, type Reserves, type Side } from './amm';
import { categoricalPrices, type CategoricalState } from './categorical';
import { parseStamp } from './format';

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
  require_member_approval: number;
  dispute_window_hours: number;
  current_season: number;
  season_started_at: string;
  visibility: 'public' | 'private';
  description: string;
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
  market_type: 'binary' | 'categorical';
  outcome: string | null;
  proposed_outcome: string | null;
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
  lmsr_b: number;
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

export interface MarketRestrictionRow {
  id: number;
  market_id: number;
  user_id: number;
  reason: string;
  created_at: string;
  name: string;
  handle: string;
}

const MARKET_COLS = `
  m.*, u.name AS creator_name, u.handle AS creator_handle
  FROM markets m JOIN users u ON u.id = m.creator_id`;

export async function groupBySlug(slug: string): Promise<GroupRow | undefined> {
  return get<GroupRow>('SELECT * FROM groups WHERE slug = ?', slug);
}

export async function groupByCode(code: string): Promise<GroupRow | undefined> {
  return get<GroupRow>('SELECT * FROM groups WHERE invite_code = ?', code.trim().toUpperCase());
}

export interface InviteRow {
  id: number;
  group_id: number;
  code: string;
  label: string;
  created_by: number | null;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  created_at: string;
}

export type InviteState = 'active' | 'revoked' | 'expired' | 'used up';

/** Why a link no longer works, or 'active' if it still does. */
export function inviteState(
  invite: Pick<InviteRow, 'expires_at' | 'max_uses' | 'uses' | 'revoked_at'>,
  now = Date.now(),
): InviteState {
  if (invite.revoked_at) return 'revoked';
  if (invite.expires_at && parseStamp(invite.expires_at) <= now) return 'expired';
  if (invite.max_uses !== null && invite.uses >= invite.max_uses) return 'used up';
  return 'active';
}

export async function inviteByCode(code: string): Promise<InviteRow | undefined> {
  return get<InviteRow>('SELECT * FROM group_invites WHERE code = ?', code.trim().toUpperCase());
}

export async function groupInvites(groupId: number): Promise<(InviteRow & { created_by_name: string | null })[]> {
  return all<InviteRow & { created_by_name: string | null }>(
    `SELECT i.*, u.name AS created_by_name FROM group_invites i
       LEFT JOIN users u ON u.id = i.created_by
      WHERE i.group_id = ? ORDER BY i.id DESC`,
    groupId,
  );
}

/** The group behind an invite code, whether it is a link or the group's own code. */
export async function groupByAnyCode(
  code: string,
): Promise<{ group: GroupRow; invite?: InviteRow } | undefined> {
  const invite = await inviteByCode(code);
  if (invite) {
    const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', invite.group_id);
    return group && { group, invite };
  }
  const group = await groupByCode(code);
  return group && { group };
}

export interface PublicGroupRow extends GroupRow {
  members: number;
  live_markets: number;
  joined: number;
  requested: number;
}

/** The public directory — every open community, most active first. */
export async function publicGroups(userId: number, limit = 60): Promise<PublicGroupRow[]> {
  return all<PublicGroupRow>(
    `SELECT g.*,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM memberships x WHERE x.group_id = g.id) AS members,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM markets m
              WHERE m.group_id = g.id AND m.status = 'open' AND m.season_number = g.current_season) AS live_markets,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM memberships x WHERE x.group_id = g.id AND x.user_id = ?) AS joined,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM membership_requests r WHERE r.group_id = g.id AND r.user_id = ?) AS requested
       FROM groups g
      WHERE g.visibility = 'public'
      ORDER BY live_markets DESC, members DESC, g.id DESC
      LIMIT ?`,
    userId,
    userId,
    limit,
  );
}

export async function userByIdentifier(identifier: string) {
  const value = identifier.trim();
  if (!value) return undefined;
  return get<{ id: number; name: string; handle: string; email: string | null }>(
    'SELECT id, name, handle, email, avatar FROM users WHERE handle = ? OR email = ?',
    value.replace(/^@/, '').toLowerCase(),
    value.toLowerCase(),
  );
}

export interface GroupStats {
  volume: number;
  live: number;
  resolved: number;
  trades: number;
  atStake: number;
}

/** Headline numbers for the group dashboard, this season only. */
export async function groupStats(groupId: number, season: number): Promise<GroupStats> {
  const row = await get<GroupStats>(
    `SELECT COALESCE(SUM(m.volume), 0) AS volume,
            COALESCE(SUM(m.collateral), 0) AS "atStake",
            CAST(COUNT(*) FILTER (WHERE m.status = 'open') AS INTEGER) AS live,
            CAST(COUNT(*) FILTER (WHERE m.status = 'resolved') AS INTEGER) AS resolved,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM trades t JOIN markets x ON x.id = t.market_id
              WHERE x.group_id = ? AND x.season_number = ?) AS trades
       FROM markets m WHERE m.group_id = ? AND m.season_number = ?`,
    groupId,
    season,
    groupId,
    season,
  );
  return row ?? { volume: 0, live: 0, resolved: 0, trades: 0, atStake: 0 };
}

export interface PrizeRow {
  id: number;
  group_id: number;
  place: number;
  label: string;
}

/** What each finishing place is playing for, first place first. */
export async function groupPrizes(groupId: number): Promise<PrizeRow[]> {
  return all<PrizeRow>('SELECT * FROM group_prizes WHERE group_id = ? ORDER BY place', groupId);
}

export interface AwardRow {
  place: number;
  label: string;
  user_id: number | null;
  final_total: number;
  season_number: number;
  name: string | null;
  handle: string | null;
  avatar: string | null;
}

/** Who actually won what, once a season is closed. */
export async function seasonAwards(groupId: number, seasonNumber?: number): Promise<AwardRow[]> {
  const scoped = seasonNumber !== undefined;
  return all<AwardRow>(
    `SELECT a.place, a.label, a.user_id, a.final_total, a.season_number,
            u.name, u.handle, u.avatar
       FROM season_awards a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.group_id = ?${scoped ? ' AND a.season_number = ?' : ''}
      ORDER BY a.season_number DESC, a.place`,
    ...(scoped ? [groupId, seasonNumber] : [groupId]),
  );
}

export async function membershipRequestFor(userId: number, groupId: number) {
  return get<{ id: number; requested_at: string }>(
    'SELECT id, requested_at FROM membership_requests WHERE user_id = ? AND group_id = ?',
    userId,
    groupId,
  );
}

export async function membership(userId: number, groupId: number): Promise<MembershipRow | undefined> {
  return get<MembershipRow>(
    'SELECT * FROM memberships WHERE user_id = ? AND group_id = ?',
    userId,
    groupId,
  );
}

export async function memberCount(groupId: number): Promise<number> {
  return (await get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM memberships WHERE group_id = ?', groupId))!.n;
}

export async function myGroups(userId: number) {
  return all<GroupRow & { role: string; balance: number; members: number }>(
    `SELECT g.*, ms.role, ms.balance,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM memberships x WHERE x.group_id = g.id) AS members
       FROM memberships ms JOIN groups g ON g.id = ms.group_id
      WHERE ms.user_id = ?
      ORDER BY ms.joined_at`,
    userId,
  );
}

export async function marketById(id: number): Promise<MarketRow | undefined> {
  return get<MarketRow>(`SELECT ${MARKET_COLS} WHERE m.id = ?`, id);
}

export async function marketRestrictions(marketId: number): Promise<MarketRestrictionRow[]> {
  return all<MarketRestrictionRow>(
    `SELECT r.*, u.name, u.handle FROM market_restrictions r
       JOIN users u ON u.id = r.user_id
      WHERE r.market_id = ? ORDER BY u.name, u.handle`,
    marketId,
  );
}

export async function marketRestrictionFor(userId: number, marketId: number): Promise<MarketRestrictionRow | undefined> {
  return get<MarketRestrictionRow>(
    `SELECT r.*, u.name, u.handle FROM market_restrictions r
       JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ? AND r.market_id = ?`,
    userId,
    marketId,
  );
}

export async function marketsByGroup(groupId: number, statuses: string[]): Promise<MarketRow[]> {
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

export interface PriceHistoryPoint {
  price: number;
  created_at: string;
}

/** Chronological price history for a market, oldest first. */
export async function priceHistory(marketId: number, limit = 40): Promise<PriceHistoryPoint[]> {
  return all<PriceHistoryPoint>(
    `SELECT price, created_at FROM
       (SELECT price, created_at, id FROM price_points WHERE market_id = ? ORDER BY id DESC LIMIT ?)
     ORDER BY id`,
    marketId,
    limit,
  );
}

/** Chronological price series for compact charts, normalised 0..1. */
export async function priceSeries(marketId: number, limit = 40): Promise<number[]> {
  return (await priceHistory(marketId, limit)).map((point) => point.price);
}

export async function priceSeriesFor(marketIds: number[], limit = 16): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  await Promise.all(marketIds.map(async (id) => out.set(id, await priceSeries(id, limit))));
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

export async function positionFor(userId: number, marketId: number): Promise<PositionRow | undefined> {
  return get<PositionRow>('SELECT * FROM positions WHERE user_id = ? AND market_id = ?', userId, marketId);
}

export interface OpenPosition {
  market: MarketRow;
  side: string;
  optionId?: number;
  shares: number;
  cost: number;
  price: number;
  value: number;
}

/** Every open leg the user holds in a group, split by side, richest first. */
export async function openLegs(userId: number, groupId: number): Promise<OpenPosition[]> {
  const rows = await all<MarketRow & Pick<PositionRow, 'yes_shares' | 'no_shares' | 'yes_cost' | 'no_cost'>>(
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

  const optionRows = await all<MarketRow & { option_id: number; option_label: string; shares: number; cost: number; quantity: number }>(
    `SELECT m.*, u.name AS creator_name, u.handle AS creator_handle,
            op.option_id, o.label AS option_label, op.shares, op.cost, o.quantity
       FROM option_positions op
       JOIN market_options o ON o.id = op.option_id
       JOIN markets m ON m.id = op.market_id
       JOIN users u ON u.id = m.creator_id
       JOIN groups g ON g.id = m.group_id
      WHERE op.user_id = ? AND m.group_id = ? AND m.season_number = g.current_season
        AND m.status IN ('open','closed','resolving') AND op.shares > 0.0001`,
    userId,
    groupId,
  );
  const optionMarkets = new Map<number, Awaited<ReturnType<typeof optionsWithPrices>>>();
  for (const row of optionRows) {
    const prices = optionMarkets.get(row.id) ?? await optionsWithPrices(row);
    optionMarkets.set(row.id, prices);
    const price = prices.find((option) => option.id === row.option_id)?.price ?? 0;
    legs.push({
      market: row,
      side: row.option_label,
      optionId: row.option_id,
      shares: row.shares,
      cost: row.cost,
      price,
      value: row.shares * price,
    });
  }
  return legs.sort((a, b) => b.value - a.value);
}

export interface Standing {
  userId: number;
  name: string;
  handle: string;
  role: string;
  avatar: string | null;
  cash: number;
  invested: number;
  total: number;
  pnl: number;
  openPositions: number;
  trades: number;
}

/** Portfolio value for every member: cash plus mark-to-market on open legs. */
export async function standings(groupId: number, startingBalance: number): Promise<Standing[]> {
  const members = await all<{ user_id: number; name: string; handle: string; role: string; balance: number; avatar: string | null }>(
    `SELECT ms.user_id, ms.role, ms.balance, u.name, u.handle, u.avatar
       FROM memberships ms JOIN users u ON u.id = ms.user_id
      WHERE ms.group_id = ?`,
    groupId,
  );

  const live = await all<PositionRow & { yes_reserve: number; no_reserve: number }>(
    `SELECT p.*, m.yes_reserve, m.no_reserve FROM positions p JOIN markets m ON m.id = p.market_id
       JOIN groups g ON g.id = m.group_id
      WHERE m.group_id = ? AND m.season_number = g.current_season AND m.status IN ('open','closed','resolving')`,
    groupId,
  );

  const tradeCounts = new Map<number, number>();
  for (const t of await all<{ user_id: number; n: number }>(
    `SELECT t.user_id, CAST(COUNT(*) AS INTEGER) AS n FROM trades t JOIN markets m ON m.id = t.market_id
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

  const categoricalLive = await all<{ user_id: number; market_id: number; option_id: number; shares: number; lmsr_b: number }>(
    `SELECT op.user_id, op.market_id, op.option_id, op.shares, m.lmsr_b
       FROM option_positions op JOIN markets m ON m.id = op.market_id
       JOIN groups g ON g.id = m.group_id
      WHERE m.group_id = ? AND m.season_number = g.current_season
        AND m.status IN ('open','closed','resolving') AND op.shares > 0.0001`,
    groupId,
  );
  const categoricalMarkets = new Map<number, Awaited<ReturnType<typeof optionsWithPrices>>>();
  for (const position of categoricalLive) {
    const prices = categoricalMarkets.get(position.market_id) ?? await optionsWithPrices({ id: position.market_id, lmsr_b: position.lmsr_b });
    categoricalMarkets.set(position.market_id, prices);
    const price = prices.find((option) => option.id === position.option_id)?.price ?? 0;
    const value = position.shares * price;
    invested.set(position.user_id, (invested.get(position.user_id) ?? 0) + value);
    openCount.set(position.user_id, (openCount.get(position.user_id) ?? 0) + 1);
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
        avatar: m.avatar,
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
  user_avatar: string | null;
  market_id: number | null;
}

export async function events(groupId: number, limit = 40): Promise<EventRow[]> {
  return all<EventRow>(
    `SELECT e.id, e.kind, e.body, e.created_at, e.market_id, u.name AS user_name, u.avatar AS user_avatar
       FROM events e LEFT JOIN users u ON u.id = e.user_id
      WHERE e.group_id = ? ORDER BY e.id DESC LIMIT ?`,
    groupId,
    limit,
  );
}

export interface HolderRow {
  name: string;
  handle: string;
  avatar: string | null;
  shares: number;
}

export async function holders(marketId: number, side: Side, limit = 5): Promise<HolderRow[]> {
  const col = side === 'YES' ? 'yes_shares' : 'no_shares';
  return all<HolderRow>(
    `SELECT u.name, u.handle, u.avatar, p.${col} AS shares FROM positions p JOIN users u ON u.id = p.user_id
      WHERE p.market_id = ? AND p.${col} > 0.0001 ORDER BY p.${col} DESC LIMIT ?`,
    marketId,
    limit,
  );
}

export async function marketTraderCount(marketId: number): Promise<number> {
  return (await get<{ n: number }>(
    'SELECT CAST(COUNT(DISTINCT user_id) AS INTEGER) AS n FROM trades WHERE market_id = ?',
    marketId,
  ))!.n;
}

export interface CommentRow {
  id: number;
  body: string;
  created_at: string;
  name: string;
  handle: string;
  avatar: string | null;
}

export async function optionHolders(optionId: number, limit = 5): Promise<HolderRow[]> {
  return all<HolderRow>(
    `SELECT u.name, u.handle, u.avatar, p.shares FROM option_positions p JOIN users u ON u.id = p.user_id
      WHERE p.option_id = ? AND p.shares > 0.0001 ORDER BY p.shares DESC LIMIT ?`,
    optionId,
    limit,
  );
}

export interface MarketOptionRow {
  id: number;
  market_id: number;
  label: string;
  sort_order: number;
  quantity: number;
}

export async function marketOptions(marketId: number): Promise<MarketOptionRow[]> {
  return all<MarketOptionRow>(
    'SELECT * FROM market_options WHERE market_id = ? ORDER BY sort_order',
    marketId,
  );
}

export function categoricalState(
  market: Pick<MarketRow, 'id' | 'lmsr_b'>,
  options: MarketOptionRow[],
): CategoricalState {
  return { quantities: options.map((option) => option.quantity), liquidity: market.lmsr_b };
}

export async function optionsWithPrices(market: Pick<MarketRow, 'id' | 'lmsr_b'>) {
  const options = await marketOptions(market.id);
  const prices = categoricalPrices(categoricalState(market, options));
  return options.map((option, index) => ({ ...option, price: prices[index] }));
}

export interface OptionPositionRow {
  id: number;
  market_id: number;
  option_id: number;
  user_id: number;
  shares: number;
  cost: number;
  realized: number;
}

export async function optionPositionFor(userId: number, marketId: number): Promise<OptionPositionRow[]> {
  return all<OptionPositionRow>(
    'SELECT * FROM option_positions WHERE user_id = ? AND market_id = ? AND shares > 0.0001',
    userId,
    marketId,
  );
}

export interface MembershipRequestRow {
  id: number;
  user_id: number;
  group_id: number;
  requested_at: string;
  name: string;
  handle: string;
  email: string | null;
  avatar: string | null;
}

export async function membershipRequests(groupId: number): Promise<MembershipRequestRow[]> {
  return all<MembershipRequestRow>(
    `SELECT r.*, u.name, u.handle, u.email, u.avatar FROM membership_requests r
       JOIN users u ON u.id = r.user_id WHERE r.group_id = ? ORDER BY r.id`,
    groupId,
  );
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

export async function marketDisputes(marketId: number): Promise<DisputeRow[]> {
  return all<DisputeRow>(
    `SELECT d.*, u.name, u.handle FROM market_disputes d
       JOIN users u ON u.id = d.user_id
      WHERE d.market_id = ? ORDER BY d.id DESC`,
    marketId,
  );
}

export async function disputeFor(userId: number, marketId: number): Promise<DisputeRow | undefined> {
  return get<DisputeRow>(
    `SELECT d.*, u.name, u.handle FROM market_disputes d
       JOIN users u ON u.id = d.user_id
      WHERE d.user_id = ? AND d.market_id = ?`,
    userId,
    marketId,
  );
}

export async function comments(marketId: number, limit = 50): Promise<CommentRow[]> {
  return all<CommentRow>(
    `SELECT c.id, c.body, c.created_at, u.name, u.handle, u.avatar
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.market_id = ? ORDER BY c.id DESC LIMIT ?`,
    marketId,
    limit,
  );
}

export async function recentTrades(marketId: number, limit = 12) {
  return all<{
    id: number; side: string; action: string; shares: number; cash: number;
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

export async function notifications(userId: number, limit = 60): Promise<NotificationRow[]> {
  return all<NotificationRow>(
    `SELECT n.*, g.slug AS group_slug, g.name AS group_name
       FROM notifications n LEFT JOIN groups g ON g.id = n.group_id
      WHERE n.user_id = ? ORDER BY n.id DESC LIMIT ?`,
    userId,
    limit,
  );
}

export async function unreadNotificationCount(userId: number): Promise<number> {
  return (await get<{ n: number }>(
    'SELECT CAST(COUNT(*) AS INTEGER) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL',
    userId,
  ))!.n;
}

export interface SeasonResultRow {
  season_number: number;
  rank: number;
  final_total: number;
  pnl: number;
  user_id: number;
  name: string;
  handle: string;
  avatar: string | null;
  created_at: string;
}

export async function seasonHistory(groupId: number): Promise<SeasonResultRow[]> {
  return all<SeasonResultRow>(
    `SELECT r.*, u.name, u.handle, u.avatar FROM season_results r JOIN users u ON u.id = r.user_id
      WHERE r.group_id = ? ORDER BY r.season_number DESC, r.rank`,
    groupId,
  );
}

export interface SeasonRow {
  id: number;
  group_id: number;
  season_number: number;
  started_at: string;
  ended_at: string;
  prize: string;
  punishment: string;
  champion_id: number | null;
  runner_up_id: number | null;
  last_place_id: number | null;
  note: string;
  entrants: number;
  champion_name: string | null;
  champion_handle: string | null;
  champion_avatar: string | null;
  runner_up_name: string | null;
  last_place_name: string | null;
  last_place_handle: string | null;
}

/** Closed seasons, newest first — the header row behind each archived standings table. */
export async function seasonArchive(groupId: number): Promise<SeasonRow[]> {
  return all<SeasonRow>(
    `SELECT s.*, champ.name AS champion_name, champ.handle AS champion_handle,
            champ.avatar AS champion_avatar,
            runner.name AS runner_up_name,
            last.name AS last_place_name, last.handle AS last_place_handle
       FROM seasons s
       LEFT JOIN users champ ON champ.id = s.champion_id
       LEFT JOIN users runner ON runner.id = s.runner_up_id
       LEFT JOIN users last ON last.id = s.last_place_id
      WHERE s.group_id = ? ORDER BY s.season_number DESC`,
    groupId,
  );
}

export async function latestSeason(groupId: number): Promise<SeasonRow | undefined> {
  return (await seasonArchive(groupId))[0];
}

export const CATEGORIES = ['Drama', 'School', 'Traditions', 'Sports', 'Life', 'Other'];
