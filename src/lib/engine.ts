import { all, get, run, tx } from './db';
import {
  priceYes,
  quoteBuy,
  quoteSell,
  seedReserves,
  settle,
  type Side,
} from './amm';
import { groupByCode, marketById, membership, reserves, standings, type GroupRow, type MarketRow } from './data';
import { money, shares as fmtShares, slugify } from './format';

export class AppError extends Error {}

function fail(msg: string): never {
  throw new AppError(msg);
}

function logEvent(groupId: number, marketId: number | null, userId: number | null, kind: string, body: string) {
  run(
    'INSERT INTO events (group_id, market_id, user_id, kind, body) VALUES (?, ?, ?, ?, ?)',
    groupId,
    marketId,
    userId,
    kind,
    body,
  );
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += '-';
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// ─── groups ──────────────────────────────────────────────────────────────────

export function createGroup(
  userId: number,
  input: {
    name: string;
    startingBalance: number;
    marketLiquidity?: number;
    seasonEnds: string | null;
    prize: string;
    punishment: string;
  },
): GroupRow {
  const name = input.name.trim();
  if (name.length < 2) fail('Give the group a name.');
  const starting = Math.max(100, Math.min(1_000_000, input.startingBalance || 2500));
  // Deep enough that one member's order doesn't swing a market end to end.
  const liquidity = Math.max(100, input.marketLiquidity || Math.round(starting * 0.2));

  return tx(() => {
    let slug = slugify(name);
    let n = 2;
    while (get('SELECT id FROM groups WHERE slug = ?', slug)) slug = `${slugify(name)}-${n++}`;

    let code = randomCode();
    while (get('SELECT id FROM groups WHERE invite_code = ?', code)) code = randomCode();

    const res = run(
      `INSERT INTO groups (slug, name, invite_code, owner_id, starting_balance, market_liquidity,
                           season_ends, prize, punishment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      slug,
      name,
      code,
      userId,
      starting,
      liquidity,
      input.seasonEnds || null,
      input.prize.trim(),
      input.punishment.trim(),
    );
    const groupId = Number(res.lastInsertRowid);

    run(
      'INSERT INTO memberships (user_id, group_id, role, balance) VALUES (?, ?, ?, ?)',
      userId,
      groupId,
      'admin',
      starting,
    );
    logEvent(groupId, null, userId, 'group', 'opened the group');
    return get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId)!;
  });
}

export function joinGroup(userId: number, code: string): GroupRow {
  const group = groupByCode(code);
  if (!group) fail('No group with that invite code.');
  if (membership(userId, group.id)) return group;

  tx(() => {
    run(
      'INSERT INTO memberships (user_id, group_id, role, balance) VALUES (?, ?, ?, ?)',
      userId,
      group.id,
      'member',
      group.starting_balance,
    );
    logEvent(group.id, null, userId, 'join', 'joined the group');
    notifyAdmins(group.id, userId, null, 'member', 'A new member joined your community.');
  });
  return group;
}

export function requireMember(userId: number, groupId: number) {
  const ms = membership(userId, groupId);
  if (!ms) fail('You are not in this group.');
  return ms;
}

export function requireAdmin(userId: number, groupId: number) {
  const ms = requireMember(userId, groupId);
  if (ms.role !== 'admin') fail('Only the group admin can do that.');
  return ms;
}

export function removeMember(userId: number, groupId: number, targetId: number) {
  requireAdmin(userId, groupId);
  const group = get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId);
  if (!group) fail('Group not found.');
  if (targetId === group.owner_id) fail('You cannot remove the group owner.');
  const targetMembership = membership(targetId, groupId) ?? fail('That person is not in this group.');
  if (targetMembership.role === 'admin' && userId !== group.owner_id) {
    fail('Only the owner can remove another admin.');
  }
  const openPositions = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM positions p JOIN markets m ON m.id = p.market_id
      WHERE p.user_id = ? AND m.group_id = ? AND m.status IN ('open','closed','resolving')
        AND (p.yes_shares > 0.0001 OR p.no_shares > 0.0001)`,
    targetId,
    groupId,
  )!.n;
  if (openPositions) fail('Resolve or sell this member’s open positions before removing them.');
  const target = get<{ name: string }>('SELECT name FROM users WHERE id = ?', targetId);
  tx(() => {
    run('DELETE FROM memberships WHERE user_id = ? AND group_id = ?', targetId, groupId);
    logEvent(groupId, null, userId, 'group', `removed ${target?.name ?? 'a member'} from the group`);
  });
}

export function updateGroup(
  userId: number,
  groupId: number,
  patch: Partial<
    Pick<
      GroupRow,
      'prize' | 'punishment' | 'season_ends' | 'positions_public' | 'require_approval' | 'market_liquidity' | 'dispute_window_hours'
    >
  >,
) {
  requireAdmin(userId, groupId);
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`);
    values.push(v);
  }
  if (!fields.length) return;
  run(`UPDATE groups SET ${fields.join(', ')} WHERE id = ?`, ...values, groupId);
}

// ─── market lifecycle ────────────────────────────────────────────────────────

export interface NewMarket {
  question: string;
  category: string;
  rules: string;
  closesAt: string;
  openPrice: number;
  funding: number;
}

export function createMarket(userId: number, group: GroupRow, input: NewMarket): MarketRow {
  const ms = requireMember(userId, group.id);
  const question = input.question.trim();
  if (question.length < 8) fail('Write a question the group can actually settle.');

  const stake = Math.max(10, Math.min(500, input.funding || 25));
  if (ms.balance < stake) fail(`You need ${money(stake)} to seed this market.`);

  // The group underwrites a base pool so a new market is deep enough to trade
  // without one person having to fund it. The creator's stake sits on top and
  // is the part with real skin in it.
  const house = Math.max(100, group.market_liquidity || 500);
  const funding = house + stake;

  const price = Math.max(0.03, Math.min(0.97, input.openPrice));
  const r = seedReserves(price, funding);
  // The admin's own markets skip the queue; members' obey the group setting.
  const status = ms.role === 'admin' || !group.require_approval ? 'open' : 'pending';

  return tx(() => {
    const res = run(
      `INSERT INTO markets
         (group_id, creator_id, question, category, rules, closes_at, status,
          yes_reserve, no_reserve, collateral, subsidy, house, open_price, season_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      group.id,
      userId,
      question,
      input.category,
      input.rules.trim(),
      input.closesAt,
      status,
      r.yes,
      r.no,
      funding,
      stake,
      house,
      price,
      group.current_season,
    );
    const id = Number(res.lastInsertRowid);

    run('UPDATE memberships SET balance = balance - ? WHERE id = ?', stake, ms.id);
    run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', id, price);
    logEvent(
      group.id,
      id,
      userId,
      status === 'open' ? 'market' : 'proposal',
      status === 'open' ? `opened “${question}”` : `proposed “${question}”`,
    );
    if (status === 'pending') {
      const proposer = get<{ handle: string }>('SELECT handle FROM users WHERE id = ?', userId)!;
      notifyAdmins(group.id, userId, id, 'market', `@${proposer.handle} proposed a new market.`);
    }
    return marketById(id)!;
  });
}

export function approveMarket(userId: number, marketId: number) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireAdmin(userId, m.group_id);
  if (m.status !== 'pending') fail('That market is not waiting for approval.');
  tx(() => {
    run("UPDATE markets SET status = 'open' WHERE id = ?", marketId);
    logEvent(m.group_id, marketId, userId, 'market', `approved “${m.question}”`);
    if (m.creator_id !== userId) {
      notifyUser(m.creator_id, m.group_id, marketId, 'market', `Your market “${m.question}” was approved.`);
    }
  });
}

export function rejectMarket(userId: number, marketId: number) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireAdmin(userId, m.group_id);
  if (m.status !== 'pending') fail('That market is not waiting for approval.');
  tx(() => {
    run("UPDATE markets SET status = 'rejected' WHERE id = ?", marketId);
    // The proposer gets their seed back — nobody ever traded against it.
    run(
      'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
      m.subsidy,
      m.creator_id,
      m.group_id,
    );
    logEvent(m.group_id, marketId, userId, 'market', `rejected “${m.question}”`);
    if (m.creator_id !== userId) {
      notifyUser(m.creator_id, m.group_id, marketId, 'market', `Your market “${m.question}” was rejected.`);
    }
  });
}

/** Flip any open market whose close time has passed. Cheap; called on reads. */
export function sweepClosures(groupId: number) {
  const due = all<{ id: number; question: string }>(
    "SELECT id, question FROM markets WHERE group_id = ? AND status = 'open' AND closes_at <= datetime('now')",
    groupId,
  );
  if (!due.length) return;
  tx(() => {
    for (const m of due) {
      run("UPDATE markets SET status = 'closed' WHERE id = ?", m.id);
      logEvent(groupId, m.id, null, 'close', `“${m.question}” closed for trading`);
    }
  });
}

export function reopenMarket(userId: number, marketId: number, closesAt: string) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireAdmin(userId, m.group_id);
  if (m.status !== 'closed' && m.status !== 'resolving') fail('Only a closed market can reopen.');
  tx(() => {
    run(
      `UPDATE markets SET status = 'open', closes_at = ?, proposed_outcome = NULL,
              resolution_evidence = '', resolution_proposed_by = NULL,
              resolution_proposed_at = NULL, dispute_ends_at = NULL WHERE id = ?`,
      closesAt,
      marketId,
    );
    run('DELETE FROM market_disputes WHERE market_id = ?', marketId);
    logEvent(m.group_id, marketId, userId, 'market', `reopened “${m.question}”`);
  });
}

export function setMemberRole(
  userId: number,
  groupId: number,
  targetId: number,
  role: 'admin' | 'member',
) {
  requireAdmin(userId, groupId);
  const group = get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  if (group.owner_id !== userId) fail('Only the community owner can change admin roles.');
  if (targetId === group.owner_id) fail('The owner must remain an admin.');
  requireMember(targetId, groupId);
  const target = get<{ name: string }>('SELECT name FROM users WHERE id = ?', targetId)!;
  tx(() => {
    run('UPDATE memberships SET role = ? WHERE user_id = ? AND group_id = ?', role, targetId, groupId);
    logEvent(groupId, null, userId, 'group', `${role === 'admin' ? 'promoted' : 'returned'} ${target.name} ${role === 'admin' ? 'to admin' : 'to member'}`);
    notifyUser(targetId, groupId, null, 'role', `You are now ${role === 'admin' ? 'an admin' : 'a member'} of ${group.name}.`);
  });
}

export function regenerateInviteCode(userId: number, groupId: number): string {
  requireAdmin(userId, groupId);
  let code = randomCode();
  while (get('SELECT id FROM groups WHERE invite_code = ?', code)) code = randomCode();
  run('UPDATE groups SET invite_code = ? WHERE id = ?', code, groupId);
  logEvent(groupId, null, userId, 'group', 'rotated the invite code');
  return code;
}

export function markNotificationsRead(userId: number) {
  run("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", userId);
}

export function startNextSeason(userId: number, groupId: number, seasonEnds: string | null) {
  requireAdmin(userId, groupId);
  const group = get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  if (group.owner_id !== userId) fail('Only the community owner can start a new season.');
  const unfinished = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM markets
      WHERE group_id = ? AND season_number = ? AND status NOT IN ('resolved','rejected')`,
    groupId,
    group.current_season,
  )!.n;
  if (unfinished) fail('Resolve or reject every current-season market first.');
  const rows = standings(groupId, group.starting_balance);

  tx(() => {
    for (const [index, row] of rows.entries()) {
      run(
        `INSERT INTO season_results
          (group_id, season_number, user_id, rank, final_total, pnl)
         VALUES (?, ?, ?, ?, ?, ?)`,
        groupId,
        group.current_season,
        row.userId,
        index + 1,
        row.total,
        row.pnl,
      );
    }
    run(
      `UPDATE groups SET current_season = current_season + 1, season_started_at = datetime('now'),
              season_ends = ? WHERE id = ?`,
      seasonEnds || null,
      groupId,
    );
    run('UPDATE memberships SET balance = ? WHERE group_id = ?', group.starting_balance, groupId);
    logEvent(groupId, null, userId, 'season', `started season ${group.current_season + 1}`);
    notifyMembers(groupId, userId, null, 'season', `${group.name} season ${group.current_season + 1} has started.`);
  });
}

function notifyUser(
  userId: number,
  groupId: number | null,
  marketId: number | null,
  kind: string,
  body: string,
) {
  run(
    'INSERT INTO notifications (user_id, group_id, market_id, kind, body) VALUES (?, ?, ?, ?, ?)',
    userId,
    groupId,
    marketId,
    kind,
    body,
  );
}

function notifyAdmins(groupId: number, actorId: number, marketId: number | null, kind: string, body: string) {
  const admins = all<{ user_id: number }>(
    "SELECT user_id FROM memberships WHERE group_id = ? AND role = 'admin' AND user_id <> ?",
    groupId,
    actorId,
  );
  for (const admin of admins) notifyUser(admin.user_id, groupId, marketId, kind, body);
}

function notifyMembers(groupId: number, actorId: number, marketId: number | null, kind: string, body: string) {
  const members = all<{ user_id: number }>(
    'SELECT user_id FROM memberships WHERE group_id = ? AND user_id <> ?',
    groupId,
    actorId,
  );
  for (const member of members) notifyUser(member.user_id, groupId, marketId, kind, body);
}

function settleMarket(m: MarketRow, outcome: Side, actorId: number | null) {
  const marketId = m.id;
  if (m.status === 'resolved') fail('That market is already resolved.');
  if (m.status === 'pending' || m.status === 'rejected') fail('That market never opened.');

  tx(() => {
    const col = outcome === 'YES' ? 'yes_shares' : 'no_shares';
    const holders = all<{ user_id: number; shares: number; cost: number }>(
      `SELECT user_id, ${col} AS shares, ${outcome === 'YES' ? 'yes_cost' : 'no_cost'} AS cost
         FROM positions WHERE market_id = ? AND ${col} > 0.0001`,
      marketId,
    );

    const outstanding = holders.reduce((s, h) => s + h.shares, 0);
    const { paid, remainder } = settle(m.collateral, outstanding);
    // Pay pro-rata if a market were ever short; by construction it never is.
    const scale = outstanding > 0 ? paid / outstanding : 0;

    for (const h of holders) {
      const payout = h.shares * scale;
      run(
        'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
        payout,
        h.user_id,
        m.group_id,
      );
      run(
        'UPDATE positions SET realized = realized + ? WHERE market_id = ? AND user_id = ?',
        payout - h.cost,
        marketId,
        h.user_id,
      );
    }

    // Losing legs are written off against their cost basis.
    const loseCol = outcome === 'YES' ? 'no_shares' : 'yes_shares';
    const loseCost = outcome === 'YES' ? 'no_cost' : 'yes_cost';
    run(
      `UPDATE positions SET realized = realized - ${loseCost} WHERE market_id = ? AND ${loseCol} > 0.0001`,
      marketId,
    );

    // Unsold pool shares plus accumulated fees are the LP return. The creator
    // gets the slice matching their stake; the group's underwriting evaporates
    // back to the house it came from.
    const lpTotal = m.subsidy + m.house;
    const creatorCut = lpTotal > 0 ? (remainder * m.subsidy) / lpTotal : remainder;
    if (creatorCut > 0.0001) {
      run(
        'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
        creatorCut,
        m.creator_id,
        m.group_id,
      );
    }

    run(
      "UPDATE markets SET status = 'resolved', outcome = ?, resolved_at = datetime('now'), collateral = 0 WHERE id = ?",
      outcome,
      marketId,
    );
    run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', marketId, outcome === 'YES' ? 1 : 0);
    logEvent(m.group_id, marketId, actorId, 'resolve', `resolved “${m.question}” → ${outcome}`);
    const recipients = new Set(
      all<{ user_id: number }>('SELECT user_id FROM positions WHERE market_id = ?', marketId).map((p) => p.user_id),
    );
    recipients.add(m.creator_id);
    for (const recipient of recipients) {
      if (recipient !== actorId) {
        notifyUser(recipient, m.group_id, marketId, 'resolution', `“${m.question}” finalized ${outcome}.`);
      }
    }
  });
}

/** Immediate settlement retained for seeds and trusted maintenance scripts. */
export function resolveMarket(userId: number, marketId: number, outcome: Side) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireAdmin(userId, m.group_id);
  settleMarket(m, outcome, userId);
}

export function proposeResolution(userId: number, marketId: number, outcome: Side, evidence: string) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireAdmin(userId, m.group_id);
  if (!['open', 'closed', 'resolving'].includes(m.status)) fail('That market cannot be resolved.');
  const note = evidence.trim().slice(0, 1000);
  if (note.length < 4) fail('Add a short source or explanation for the result.');
  const group = get<GroupRow>('SELECT * FROM groups WHERE id = ?', m.group_id)!;
  const hours = Math.max(1, Math.min(168, group.dispute_window_hours || 24));

  tx(() => {
    run('DELETE FROM market_disputes WHERE market_id = ?', marketId);
    run(
      `UPDATE markets SET status = 'resolving', proposed_outcome = ?, resolution_evidence = ?,
              resolution_proposed_by = ?, resolution_proposed_at = datetime('now'),
              dispute_ends_at = datetime('now', ?) WHERE id = ?`,
      outcome,
      note,
      userId,
      `+${hours} hours`,
      marketId,
    );
    logEvent(
      m.group_id,
      marketId,
      userId,
      'resolution',
      `proposed ${outcome} for “${m.question}” — ${hours}h review`,
    );
    notifyMembers(m.group_id, userId, marketId, 'resolution', `Result proposed: “${m.question}” → ${outcome}.`);
  });
}

export function disputeResolution(userId: number, marketId: number, reason: string) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireMember(userId, m.group_id);
  if (m.status !== 'resolving' || !m.proposed_outcome || !m.dispute_ends_at) {
    fail('There is no proposed result to dispute.');
  }
  const review = get<{ expired: number }>(
    "SELECT dispute_ends_at <= datetime('now') AS expired FROM markets WHERE id = ?",
    marketId,
  )!;
  if (review.expired) fail('The dispute window has closed.');
  const note = reason.trim().slice(0, 600);
  if (note.length < 5) fail('Explain why the proposed result is wrong.');

  tx(() => {
    run(
      `INSERT INTO market_disputes (market_id, user_id, reason) VALUES (?, ?, ?)
       ON CONFLICT(market_id, user_id) DO UPDATE SET reason = excluded.reason, created_at = datetime('now')`,
      marketId,
      userId,
      note,
    );
    logEvent(m.group_id, marketId, userId, 'dispute', `disputed the proposed ${m.proposed_outcome} result`);
    notifyAdmins(m.group_id, userId, marketId, 'dispute', `A member disputed “${m.question}”.`);
  });
}

export function finalizeResolution(userId: number, marketId: number) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireAdmin(userId, m.group_id);
  if (m.status !== 'resolving' || !m.proposed_outcome) fail('There is no proposed result to finalize.');
  const review = get<{ disputes: number; expired: number }>(
    `SELECT (SELECT COUNT(*) FROM market_disputes WHERE market_id = m.id) AS disputes,
            m.dispute_ends_at <= datetime('now') AS expired FROM markets m WHERE m.id = ?`,
    marketId,
  )!;
  if (!review.expired && review.disputes === 0) fail('Members still have time to review this result.');
  settleMarket(m, m.proposed_outcome, userId);
}

/** Finalize undisputed proposals after their review period. Cheap; called on group reads. */
export function sweepResolutions(groupId: number) {
  const due = all<MarketRow>(
    `SELECT m.*, u.name AS creator_name, u.handle AS creator_handle
       FROM markets m JOIN users u ON u.id = m.creator_id
      WHERE m.group_id = ? AND m.status = 'resolving' AND m.dispute_ends_at <= datetime('now')
        AND NOT EXISTS (SELECT 1 FROM market_disputes d WHERE d.market_id = m.id)`,
    groupId,
  );
  for (const m of due) {
    if (m.proposed_outcome) settleMarket(m, m.proposed_outcome, m.resolution_proposed_by);
  }
}

// ─── trading ─────────────────────────────────────────────────────────────────

function upsertPosition(marketId: number, userId: number) {
  run(
    'INSERT OR IGNORE INTO positions (market_id, user_id) VALUES (?, ?)',
    marketId,
    userId,
  );
}

export interface FillResult {
  side: Side;
  action: 'BUY' | 'SELL';
  shares: number;
  cash: number;
  avgPrice: number;
  priceAfter: number;
  balance: number;
}

export function buy(userId: number, marketId: number, side: Side, amount: number): FillResult {
  const m = marketById(marketId) ?? fail('Market not found.');
  if (m.status !== 'open') fail('This market is not open for trading.');
  const ms = requireMember(userId, m.group_id);

  const spend = Math.round(Math.max(0, amount) * 100) / 100;
  if (spend <= 0) fail('Enter an amount.');
  if (spend > ms.balance + 1e-9) fail('Not enough cash.');

  const q = quoteBuy(reserves(m), side, spend);
  if (!(q.shares > 0)) fail('That order is too small to fill.');

  return tx(() => {
    run(
      `UPDATE markets SET yes_reserve = ?, no_reserve = ?, collateral = collateral + ?,
              fees = fees + ?, volume = volume + ? WHERE id = ?`,
      q.reservesAfter.yes,
      q.reservesAfter.no,
      spend,
      q.fee,
      spend,
      marketId,
    );
    run('UPDATE memberships SET balance = balance - ? WHERE id = ?', spend, ms.id);

    upsertPosition(marketId, userId);
    const col = side === 'YES' ? 'yes_shares' : 'no_shares';
    const costCol = side === 'YES' ? 'yes_cost' : 'no_cost';
    run(
      `UPDATE positions SET ${col} = ${col} + ?, ${costCol} = ${costCol} + ? WHERE market_id = ? AND user_id = ?`,
      q.shares,
      spend,
      marketId,
      userId,
    );

    const after = priceYes(q.reservesAfter);
    run(
      `INSERT INTO trades (market_id, user_id, side, action, shares, cash, avg_price, price_after)
       VALUES (?, ?, ?, 'BUY', ?, ?, ?, ?)`,
      marketId,
      userId,
      side,
      q.shares,
      spend,
      q.avgPrice,
      after,
    );
    run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', marketId, after);
    logEvent(
      m.group_id,
      marketId,
      userId,
      'trade',
      `bought ${fmtShares(q.shares)} ${side} on “${m.question}”`,
    );

    const balance = get<{ balance: number }>('SELECT balance FROM memberships WHERE id = ?', ms.id)!.balance;
    return {
      side,
      action: 'BUY' as const,
      shares: q.shares,
      cash: spend,
      avgPrice: q.avgPrice,
      priceAfter: q.priceAfter,
      balance,
    };
  });
}

export function sell(userId: number, marketId: number, side: Side, sharesIn: number): FillResult {
  const m = marketById(marketId) ?? fail('Market not found.');
  if (m.status !== 'open') fail('This market is not open for trading.');
  const ms = requireMember(userId, m.group_id);

  const pos = get<{ yes_shares: number; no_shares: number; yes_cost: number; no_cost: number }>(
    'SELECT yes_shares, no_shares, yes_cost, no_cost FROM positions WHERE market_id = ? AND user_id = ?',
    marketId,
    userId,
  );
  const held = side === 'YES' ? pos?.yes_shares ?? 0 : pos?.no_shares ?? 0;
  const basis = side === 'YES' ? pos?.yes_cost ?? 0 : pos?.no_cost ?? 0;

  const qty = Math.min(held, Math.max(0, sharesIn));
  if (!(qty > 0.0001)) fail(`You have no ${side} shares to sell.`);

  const q = quoteSell(reserves(m), side, qty);
  if (!(q.proceeds > 0)) fail('That order is too small to fill.');

  return tx(() => {
    run(
      `UPDATE markets SET yes_reserve = ?, no_reserve = ?, collateral = collateral - ?,
              fees = fees + ?, volume = volume + ? WHERE id = ?`,
      q.reservesAfter.yes,
      q.reservesAfter.no,
      q.proceeds,
      q.fee,
      q.proceeds,
      marketId,
    );
    run('UPDATE memberships SET balance = balance + ? WHERE id = ?', q.proceeds, ms.id);

    // Release cost basis proportionally so avg price survives a partial sell.
    const releasedCost = held > 0 ? (basis * qty) / held : 0;
    const col = side === 'YES' ? 'yes_shares' : 'no_shares';
    const costCol = side === 'YES' ? 'yes_cost' : 'no_cost';
    run(
      `UPDATE positions SET ${col} = ${col} - ?, ${costCol} = ${costCol} - ?, realized = realized + ?
        WHERE market_id = ? AND user_id = ?`,
      qty,
      releasedCost,
      q.proceeds - releasedCost,
      marketId,
      userId,
    );

    const after = priceYes(q.reservesAfter);
    run(
      `INSERT INTO trades (market_id, user_id, side, action, shares, cash, avg_price, price_after)
       VALUES (?, ?, ?, 'SELL', ?, ?, ?, ?)`,
      marketId,
      userId,
      side,
      qty,
      q.proceeds,
      q.avgPrice,
      after,
    );
    run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', marketId, after);
    logEvent(
      m.group_id,
      marketId,
      userId,
      'trade',
      `sold ${fmtShares(qty)} ${side} on “${m.question}”`,
    );

    const balance = get<{ balance: number }>('SELECT balance FROM memberships WHERE id = ?', ms.id)!.balance;
    return {
      side,
      action: 'SELL' as const,
      shares: qty,
      cash: q.proceeds,
      avgPrice: q.avgPrice,
      priceAfter: q.priceAfter,
      balance,
    };
  });
}

export function postComment(userId: number, marketId: number, body: string) {
  const m = marketById(marketId) ?? fail('Market not found.');
  requireMember(userId, m.group_id);
  const text = body.trim().slice(0, 600);
  if (!text) fail('Say something first.');
  run('INSERT INTO comments (market_id, user_id, body) VALUES (?, ?, ?)', marketId, userId, text);
}
