import { all, get, run, tx } from './db';
import {
  priceYes,
  quoteBuy,
  quoteSell,
  seedReserves,
  settle,
  type Side,
} from './amm';
import {
  categoricalLiquidity,
  categoricalPrices,
  quoteCategoricalBuy,
  quoteCategoricalSell,
} from './categorical';
import {
  categoricalState,
  groupByAnyCode,
  inviteState,
  marketById,
  marketOptions,
  marketRestrictionFor,
  membership,
  reserves,
  standings,
  userByIdentifier,
  type GroupRow,
  type InviteRow,
  type MarketRow,
} from './data';
import { money, shares as fmtShares, slugify, stamp } from './format';

export class AppError extends Error {}

function fail(msg: string): never {
  throw new AppError(msg);
}

async function logEvent(groupId: number, marketId: number | null, userId: number | null, kind: string, body: string) {
  await run(
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

/** True if `code` is already spoken for, as a group code or an invite link. */
async function codeTaken(code: string): Promise<boolean> {
  return !!(
    (await get('SELECT id FROM groups WHERE invite_code = ?', code)) ||
    (await get('SELECT id FROM group_invites WHERE code = ?', code))
  );
}

async function freshCode(): Promise<string> {
  let code = randomCode();
  while (await codeTaken(code)) code = randomCode();
  return code;
}

/**
 * Credits a member their season bankroll, unless this account already drew one
 * for this community and season — leaving and rejoining must not mint a second.
 */
async function issueMembership(
  userId: number,
  group: Pick<GroupRow, 'id' | 'current_season' | 'starting_balance'>,
  role: 'admin' | 'member',
) {
  const alreadyGranted = !!(await get(
    'SELECT id FROM membership_grants WHERE user_id = ? AND group_id = ? AND season_number = ?',
    userId,
    group.id,
    group.current_season,
  ));
  await run(
    'INSERT INTO memberships (user_id, group_id, role, balance) VALUES (?, ?, ?, ?)',
    userId,
    group.id,
    role,
    alreadyGranted ? 0 : group.starting_balance,
  );
  await run(
    'INSERT OR IGNORE INTO membership_grants (user_id, group_id, season_number) VALUES (?, ?, ?)',
    userId,
    group.id,
    group.current_season,
  );
  return { issued: !alreadyGranted };
}

// ─── groups ──────────────────────────────────────────────────────────────────

export async function createGroup(
  userId: number,
  input: {
    name: string;
    startingBalance: number;
    marketLiquidity?: number;
    seasonEnds: string | null;
    prize: string;
    punishment: string;
    requireMemberApproval?: boolean;
    visibility?: 'public' | 'private';
    description?: string;
  },
): Promise<GroupRow> {
  const name = input.name.trim();
  if (name.length < 2) fail('Give the group a name.');
  const starting = Math.max(100, Math.min(1_000_000, input.startingBalance || 2500));
  // Deep enough that one member's order doesn't swing a market end to end.
  const liquidity = Math.max(100, input.marketLiquidity || Math.round(starting * 0.2));

  return tx(async () => {
    let slug = slugify(name);
    let n = 2;
    while (await get('SELECT id FROM groups WHERE slug = ?', slug)) slug = `${slugify(name)}-${n++}`;

    const code = await freshCode();

    const res = await run(
      // season_started_at is written explicitly: on databases where the column
      // arrived by migration its default is '', not now().
      `INSERT INTO groups (slug, name, invite_code, owner_id, starting_balance, market_liquidity,
                           season_ends, prize, punishment, require_member_approval, visibility, description,
                           season_started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      slug,
      name,
      code,
      userId,
      starting,
      liquidity,
      input.seasonEnds || null,
      input.prize.trim(),
      input.punishment.trim(),
      input.requireMemberApproval === false ? 0 : 1,
      input.visibility === 'public' ? 'public' : 'private',
      (input.description ?? '').trim().slice(0, 280),
    );
    const groupId = Number(res.lastInsertRowid);

    await issueMembership(userId, { id: groupId, current_season: 1, starting_balance: starting }, 'admin');
    await logEvent(groupId, null, userId, 'group', 'opened the group');
    return (await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId))!;
  });
}

export type JoinResult = GroupRow & { join_status: 'joined' | 'pending' };

/**
 * Admits a user to a group, or files a join request when the group screens
 * members. `invite` is the link they arrived on, so its use can be counted.
 */
async function admit(userId: number, group: GroupRow, invite?: InviteRow): Promise<JoinResult> {
  const existing = await membership(userId, group.id);
  if (existing) return { ...group, join_status: 'joined' };

  const spendInvite = async () => {
    if (invite) await run('UPDATE group_invites SET uses = uses + 1 WHERE id = ?', invite.id);
  };

  if (group.require_member_approval) {
    if (await get('SELECT id FROM membership_requests WHERE user_id = ? AND group_id = ?', userId, group.id)) {
      return { ...group, join_status: 'pending' };
    }
    await tx(async () => {
      await run('INSERT INTO membership_requests (user_id, group_id) VALUES (?, ?)', userId, group.id);
      await spendInvite();
      await notifyAdmins(group.id, userId, null, 'member', 'A person requested to join your community.');
    });
    return { ...group, join_status: 'pending' };
  }

  await tx(async () => {
    await issueMembership(userId, group, 'member');
    await spendInvite();
    await logEvent(group.id, null, userId, 'join', 'joined the group');
    await notifyAdmins(group.id, userId, null, 'member', 'A new member joined your community.');
  });
  return { ...group, join_status: 'joined' };
}

export async function joinGroup(userId: number, code: string): Promise<JoinResult> {
  const found = await groupByAnyCode(code);
  if (!found) fail('No group with that invite code.');
  const { group, invite } = found;

  if (invite && !(await membership(userId, group.id))) {
    const state = inviteState(invite);
    if (state !== 'active') fail(`That invite link is ${state}. Ask an admin for a new one.`);
  }
  return admit(userId, group, invite);
}

/** Joining straight from the public directory, with no code in hand. */
export async function joinPublicGroup(userId: number, groupId: number): Promise<JoinResult> {
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  if (group.visibility !== 'public') fail('That community is invite-only.');
  return admit(userId, group);
}

export async function createInvite(
  userId: number,
  groupId: number,
  input: { label?: string; code?: string; expiresInHours?: number | null; maxUses?: number | null },
): Promise<InviteRow> {
  await requireAdmin(userId, groupId);

  let code: string;
  if (input.code?.trim()) {
    code = input.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (code.length < 4 || code.length > 24) fail('A custom code is 4–24 letters, numbers, or dashes.');
    if (await codeTaken(code)) fail('That code is already in use.');
  } else {
    code = await freshCode();
  }

  const hours = input.expiresInHours ?? null;
  const expiresAt = hours && hours > 0 ? stamp(Date.now() + Math.min(hours, 24 * 365) * 3_600_000) : null;
  const maxUses = input.maxUses && input.maxUses > 0 ? Math.min(Math.round(input.maxUses), 10_000) : null;

  const res = await run(
    `INSERT INTO group_invites (group_id, code, label, created_by, expires_at, max_uses)
     VALUES (?, ?, ?, ?, ?, ?)`,
    groupId,
    code,
    (input.label ?? '').trim().slice(0, 60),
    userId,
    expiresAt,
    maxUses,
  );
  await logEvent(groupId, null, userId, 'group', `created the invite link ${code}`);
  return (await get<InviteRow>('SELECT * FROM group_invites WHERE id = ?', Number(res.lastInsertRowid)))!;
}

export async function revokeInvite(userId: number, groupId: number, inviteId: number) {
  await requireAdmin(userId, groupId);
  const invite = await get<InviteRow>(
    'SELECT * FROM group_invites WHERE id = ? AND group_id = ?',
    inviteId,
    groupId,
  ) ?? fail('That invite link no longer exists.');
  if (invite.revoked_at) return;
  await run("UPDATE group_invites SET revoked_at = datetime('now') WHERE id = ?", inviteId);
  await logEvent(groupId, null, userId, 'group', `revoked the invite link ${invite.code}`);
}

export async function reviewMembershipRequest(
  userId: number,
  groupId: number,
  targetId: number,
  decision: 'approve' | 'reject',
) {
  await requireAdmin(userId, groupId);
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  if (!await get('SELECT id FROM membership_requests WHERE user_id = ? AND group_id = ?', targetId, groupId)) {
    fail('That join request is no longer pending.');
  }

  await tx(async () => {
    if (decision === 'approve') {
      await issueMembership(targetId, group, 'member');
      const target = await get<{ name: string }>('SELECT name FROM users WHERE id = ?', targetId);
      await logEvent(groupId, null, userId, 'join', `approved ${target?.name ?? 'a new member'}`);
      await notifyUser(targetId, groupId, null, 'member', `You were approved to join ${group.name}.`);
    } else {
      await notifyUser(targetId, groupId, null, 'member', `Your request to join ${group.name} was declined.`);
    }
    await run('DELETE FROM membership_requests WHERE user_id = ? AND group_id = ?', targetId, groupId);
  });
}

export async function requireMember(userId: number, groupId: number) {
  const ms = await membership(userId, groupId);
  if (!ms) fail('You are not in this group.');
  return ms;
}

export async function requireAdmin(userId: number, groupId: number) {
  const ms = await requireMember(userId, groupId);
  if (ms.role !== 'admin') fail('Only the group admin can do that.');
  return ms;
}

/** How many live legs a member still holds in a group. */
async function openLegCount(userId: number, groupId: number): Promise<number> {
  const binary = (await get<{ n: number }>(
    `SELECT CAST(COUNT(*) AS INTEGER) AS n FROM positions p JOIN markets m ON m.id = p.market_id
      WHERE p.user_id = ? AND m.group_id = ? AND m.status IN ('open','closed','resolving')
        AND (p.yes_shares > 0.0001 OR p.no_shares > 0.0001)`,
    userId,
    groupId,
  ))!.n;
  const categorical = (await get<{ n: number }>(
    `SELECT CAST(COUNT(*) AS INTEGER) AS n FROM option_positions p JOIN markets m ON m.id = p.market_id
      WHERE p.user_id = ? AND m.group_id = ? AND m.status IN ('open','closed','resolving')
        AND p.shares > 0.0001`,
    userId,
    groupId,
  ))!.n;
  return binary + categorical;
}

/**
 * Drops a departing member's live legs. Their shares stop being a claim on the
 * pool, so the market can only end up over-collateralised — what they forfeit
 * falls through to the LP return at resolution.
 */
async function forfeitOpenLegs(userId: number, groupId: number) {
  await run(
    `DELETE FROM positions WHERE user_id = ? AND market_id IN
       (SELECT id FROM markets WHERE group_id = ? AND status IN ('open','closed','resolving'))`,
    userId,
    groupId,
  );
  await run(
    `DELETE FROM option_positions WHERE user_id = ? AND market_id IN
       (SELECT id FROM markets WHERE group_id = ? AND status IN ('open','closed','resolving'))`,
    userId,
    groupId,
  );
}

export async function removeMember(
  userId: number,
  groupId: number,
  targetId: number,
  options: { force?: boolean } = {},
) {
  await requireAdmin(userId, groupId);
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId);
  if (!group) fail('Group not found.');
  if (targetId === group.owner_id) fail('You cannot remove the group owner.');
  const targetMembership = await membership(targetId, groupId) ?? fail('That person is not in this group.');
  if (targetMembership.role === 'admin' && userId !== group.owner_id) {
    fail('Only the owner can remove another admin.');
  }
  const open = await openLegCount(targetId, groupId);
  if (open && !options.force) {
    fail(`They hold ${open} open position${open === 1 ? '' : 's'}. Sell those first, or remove and forfeit them.`);
  }
  const target = await get<{ name: string }>('SELECT name FROM users WHERE id = ?', targetId);
  await tx(async () => {
    if (open) await forfeitOpenLegs(targetId, groupId);
    await run('DELETE FROM memberships WHERE user_id = ? AND group_id = ?', targetId, groupId);
    await run('DELETE FROM membership_requests WHERE user_id = ? AND group_id = ?', targetId, groupId);
    await logEvent(
      groupId,
      null,
      userId,
      'group',
      `removed ${target?.name ?? 'a member'} from the group` +
        (open ? ` — ${open} open position${open === 1 ? '' : 's'} forfeited` : ''),
    );
    await notifyUser(targetId, groupId, null, 'member', `You were removed from ${group.name}.`);
  });
}

/** An admin adding somebody who already has an account, by handle or email. */
export async function addMember(userId: number, groupId: number, identifier: string) {
  await requireAdmin(userId, groupId);
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  const target = await userByIdentifier(identifier);
  if (!target) fail('No account with that handle or email. Send them an invite link instead.');
  if (await membership(target.id, groupId)) fail(`${target.name} is already in this group.`);

  await tx(async () => {
    const { issued } = await issueMembership(target.id, group, 'member');
    await run('DELETE FROM membership_requests WHERE user_id = ? AND group_id = ?', target.id, groupId);
    await logEvent(groupId, null, userId, 'join', `added ${target.name} to the group`);
    await notifyUser(
      target.id,
      groupId,
      null,
      'member',
      issued
        ? `An admin added you to ${group.name} with ${money(group.starting_balance)} to trade.`
        : `An admin added you back to ${group.name}. You already drew this season's bankroll.`,
    );
  });
  return target;
}

/** A member showing themselves out. The owner has to hand the group over first. */
export async function leaveGroup(userId: number, groupId: number) {
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  await requireMember(userId, groupId);
  if (group.owner_id === userId) fail('Hand the group to another admin before you leave it.');
  const open = await openLegCount(userId, groupId);

  await tx(async () => {
    if (open) await forfeitOpenLegs(userId, groupId);
    await run('DELETE FROM memberships WHERE user_id = ? AND group_id = ?', userId, groupId);
    await logEvent(groupId, null, userId, 'group', 'left the group');
  });
  return { forfeited: open };
}

export async function transferOwnership(userId: number, groupId: number, targetId: number) {
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  if (group.owner_id !== userId) fail('Only the community owner can hand the group over.');
  if (targetId === userId) fail('You already own this group.');
  await requireMember(targetId, groupId);
  const target = (await get<{ name: string }>('SELECT name FROM users WHERE id = ?', targetId))!;

  await tx(async () => {
    await run('UPDATE groups SET owner_id = ? WHERE id = ?', targetId, groupId);
    await run("UPDATE memberships SET role = 'admin' WHERE user_id = ? AND group_id = ?", targetId, groupId);
    await logEvent(groupId, null, userId, 'group', `handed the group over to ${target.name}`);
    await notifyUser(targetId, groupId, null, 'role', `You now own ${group.name}.`);
  });
}

/** A note from an admin that lands in the activity log and every member's inbox. */
export async function announce(userId: number, groupId: number, body: string) {
  await requireAdmin(userId, groupId);
  const group = (await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId))!;
  const text = body.trim().slice(0, 600);
  if (text.length < 3) fail('Write the announcement first.');
  await tx(async () => {
    await logEvent(groupId, null, userId, 'announcement', text);
    await notifyMembers(groupId, userId, null, 'announcement', `${group.name}: ${text}`);
  });
}

export async function updateGroup(
  userId: number,
  groupId: number,
  patch: Partial<
    Pick<
      GroupRow,
      | 'name'
      | 'description'
      | 'visibility'
      | 'prize'
      | 'punishment'
      | 'season_ends'
      | 'positions_public'
      | 'require_approval'
      | 'require_member_approval'
      | 'market_liquidity'
      | 'dispute_window_hours'
    >
  >,
) {
  await requireAdmin(userId, groupId);
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'name' && String(v).trim().length < 2) fail('Give the group a name.');
    if (k === 'visibility' && v !== 'public' && v !== 'private') fail('Pick public or invite-only.');
    fields.push(`${k} = ?`);
    values.push(typeof v === 'string' ? v.trim() : v);
  }
  if (!fields.length) return;
  await run(`UPDATE groups SET ${fields.join(', ')} WHERE id = ?`, ...values, groupId);
}

// ─── market lifecycle ────────────────────────────────────────────────────────

export interface NewMarket {
  question: string;
  category: string;
  rules: string;
  closesAt: string;
  openPrice: number;
  funding: number;
  marketType?: 'binary' | 'categorical';
  options?: string[];
  excludedUserIds?: number[];
}

export async function createMarket(userId: number, group: GroupRow, input: NewMarket): Promise<MarketRow> {
  const ms = await requireMember(userId, group.id);
  const question = input.question.trim();
  if (question.length < 8) fail('Write a question the group can actually settle.');

  const stake = Math.max(10, Math.min(500, input.funding || 25));
  if (ms.balance < stake) fail(`You need ${money(stake)} to seed this market.`);

  // The group underwrites a base pool so a new market is deep enough to trade
  // without one person having to fund it. The creator's stake sits on top and
  // is the part with real skin in it.
  const house = Math.max(100, group.market_liquidity || 500);
  const funding = house + stake;

  const marketType = input.marketType === 'categorical' ? 'categorical' : 'binary';
  const labels = (input.options ?? [])
    .map((label) => label.trim().slice(0, 80))
    .filter((label, index, rows) => label.length >= 1 && rows.findIndex((candidate) => candidate.toLowerCase() === label.toLowerCase()) === index)
    .slice(0, 8);
  if (marketType === 'categorical' && labels.length < 2) fail('Add at least two distinct outcomes.');
  const price = marketType === 'binary' ? Math.max(0.03, Math.min(0.97, input.openPrice)) : 1 / labels.length;
  const r = marketType === 'binary' ? seedReserves(price, funding) : { yes: 0, no: 0 };
  const lmsrB = marketType === 'categorical' ? categoricalLiquidity(funding, labels.length) : 0;
  // The admin's own markets skip the queue; members' obey the group setting.
  const status = ms.role === 'admin' || !group.require_approval ? 'open' : 'pending';
  const excludedUserIds = [...new Set(input.excludedUserIds ?? [])].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (excludedUserIds.length > 0 && ms.role !== 'admin') {
    fail('Only an admin can add conflict restrictions.');
  }
  if (excludedUserIds.length > 0) {
    const marks = excludedUserIds.map(() => '?').join(',');
    const validMembers = await all<{ user_id: number }>(
      `SELECT user_id FROM memberships WHERE group_id = ? AND user_id IN (${marks})`,
      group.id,
      ...excludedUserIds,
    );
    if (validMembers.length !== excludedUserIds.length) {
      fail('Every restricted participant must be a group member.');
    }
  }

  return tx(async () => {
    const res = await run(
      `INSERT INTO markets
         (group_id, creator_id, question, category, rules, closes_at, status,
          market_type, yes_reserve, no_reserve, collateral, subsidy, house, open_price, lmsr_b, season_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      group.id,
      userId,
      question,
      input.category,
      input.rules.trim(),
      input.closesAt,
      status,
      marketType,
      r.yes,
      r.no,
      funding,
      stake,
      house,
      price,
      lmsrB,
      group.current_season,
    );
    const id = Number(res.lastInsertRowid);

    if (marketType === 'categorical') {
      for (const [index, label] of labels.entries()) {
        const option = await run(
          'INSERT INTO market_options (market_id, label, sort_order) VALUES (?, ?, ?)',
          id,
          label,
          index,
        );
        await run(
          'INSERT INTO option_price_points (option_id, price) VALUES (?, ?)',
          Number(option.lastInsertRowid),
          price,
        );
      }
    }

    for (const excludedUserId of excludedUserIds) {
      await run('INSERT INTO market_restrictions (market_id, user_id) VALUES (?, ?)', id, excludedUserId);
    }

    await run('UPDATE memberships SET balance = balance - ? WHERE id = ?', stake, ms.id);
    if (marketType === 'binary') await run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', id, price);
    await logEvent(
      group.id,
      id,
      userId,
      status === 'open' ? 'market' : 'proposal',
      status === 'open' ? `opened “${question}”` : `proposed “${question}”`,
    );
    if (status === 'pending') {
      const proposer = (await get<{ handle: string }>('SELECT handle FROM users WHERE id = ?', userId))!;
      await notifyAdmins(group.id, userId, id, 'market', `@${proposer.handle} proposed a new market.`);
    }
    return (await marketById(id))!;
  });
}

export async function approveMarket(userId: number, marketId: number) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireAdmin(userId, m.group_id);
  if (m.status !== 'pending') fail('That market is not waiting for approval.');
  await tx(async () => {
    await run("UPDATE markets SET status = 'open' WHERE id = ?", marketId);
    await logEvent(m.group_id, marketId, userId, 'market', `approved “${m.question}”`);
    if (m.creator_id !== userId) {
      await notifyUser(m.creator_id, m.group_id, marketId, 'market', `Your market “${m.question}” was approved.`);
    }
  });
}

export async function rejectMarket(userId: number, marketId: number) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireAdmin(userId, m.group_id);
  if (m.status !== 'pending') fail('That market is not waiting for approval.');
  await tx(async () => {
    await run("UPDATE markets SET status = 'rejected' WHERE id = ?", marketId);
    // The proposer gets their seed back — nobody ever traded against it.
    await run(
      'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
      m.subsidy,
      m.creator_id,
      m.group_id,
    );
    await logEvent(m.group_id, marketId, userId, 'market', `rejected “${m.question}”`);
    if (m.creator_id !== userId) {
      await notifyUser(m.creator_id, m.group_id, marketId, 'market', `Your market “${m.question}” was rejected.`);
    }
  });
}

/** Flip any open market whose close time has passed. Cheap; called on reads. */
export async function sweepClosures(groupId: number) {
  const due = await all<{ id: number; question: string }>(
    "SELECT id, question FROM markets WHERE group_id = ? AND status = 'open' AND closes_at <= datetime('now')",
    groupId,
  );
  if (!due.length) return;
  await tx(async () => {
    for (const m of due) {
      await run("UPDATE markets SET status = 'closed' WHERE id = ?", m.id);
      await logEvent(groupId, m.id, null, 'close', `“${m.question}” closed for trading`);
    }
  });
}

export async function reopenMarket(userId: number, marketId: number, closesAt: string) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireAdmin(userId, m.group_id);
  if (m.status !== 'closed' && m.status !== 'resolving') fail('Only a closed market can reopen.');
  await tx(async () => {
    await run(
      `UPDATE markets SET status = 'open', closes_at = ?, proposed_outcome = NULL,
              resolution_evidence = '', resolution_proposed_by = NULL,
              resolution_proposed_at = NULL, dispute_ends_at = NULL WHERE id = ?`,
      closesAt,
      marketId,
    );
    await run('DELETE FROM market_disputes WHERE market_id = ?', marketId);
    await logEvent(m.group_id, marketId, userId, 'market', `reopened “${m.question}”`);
  });
}

export async function setMemberRole(
  userId: number,
  groupId: number,
  targetId: number,
  role: 'admin' | 'member',
) {
  await requireAdmin(userId, groupId);
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  if (group.owner_id !== userId) fail('Only the community owner can change admin roles.');
  if (targetId === group.owner_id) fail('The owner must remain an admin.');
  await requireMember(targetId, groupId);
  const target = (await get<{ name: string }>('SELECT name FROM users WHERE id = ?', targetId))!;
  await tx(async () => {
    await run('UPDATE memberships SET role = ? WHERE user_id = ? AND group_id = ?', role, targetId, groupId);
    await logEvent(groupId, null, userId, 'group', `${role === 'admin' ? 'promoted' : 'returned'} ${target.name} ${role === 'admin' ? 'to admin' : 'to member'}`);
    await notifyUser(targetId, groupId, null, 'role', `You are now ${role === 'admin' ? 'an admin' : 'a member'} of ${group.name}.`);
  });
}

export async function regenerateInviteCode(userId: number, groupId: number): Promise<string> {
  await requireAdmin(userId, groupId);
  const code = await freshCode();
  await run('UPDATE groups SET invite_code = ? WHERE id = ?', code, groupId);
  await logEvent(groupId, null, userId, 'group', 'rotated the invite code');
  return code;
}

export async function markNotificationsRead(userId: number) {
  await run("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", userId);
}

export interface SeasonClose {
  season: number;
  champion?: { userId: number; name: string; total: number };
  lastPlace?: { userId: number; name: string; total: number };
  prize: string;
  punishment: string;
  entrants: number;
}

/** The line that goes in the activity log and everybody's inbox. */
function seasonHeadline(group: GroupRow, close: SeasonClose): string {
  if (!close.champion) return `Season ${close.season} closed with nobody on the board.`;
  const parts = [
    `Season ${close.season} of ${group.name} goes to ${close.champion.name} at ${money(close.champion.total)}.`,
  ];
  if (close.prize) parts.push(`They win: ${close.prize}`);
  if (close.lastPlace && close.lastPlace.userId !== close.champion.userId) {
    parts.push(`Last place: ${close.lastPlace.name} at ${money(close.lastPlace.total)}.`);
    if (close.punishment) parts.push(`They owe: ${close.punishment}`);
  }
  return parts.join(' ');
}

/**
 * Closes the current season: archives the standings, announces the champion and
 * the last-place finisher against the stakes that were on the table, then issues
 * everyone a fresh bankroll for the next one.
 */
export async function startNextSeason(
  userId: number,
  groupId: number,
  input: {
    seasonEnds?: string | null;
    note?: string;
    nextPrize?: string | null;
    nextPunishment?: string | null;
  } = {},
): Promise<SeasonClose> {
  await requireAdmin(userId, groupId);
  const group = await get<GroupRow>('SELECT * FROM groups WHERE id = ?', groupId) ?? fail('Group not found.');
  if (group.owner_id !== userId) fail('Only the community owner can start a new season.');
  const unfinished = (await get<{ n: number }>(
    `SELECT CAST(COUNT(*) AS INTEGER) AS n FROM markets
      WHERE group_id = ? AND season_number = ? AND status NOT IN ('resolved','rejected')`,
    groupId,
    group.current_season,
  ))!.n;
  if (unfinished) fail('Resolve or reject every current-season market first.');

  const rows = await standings(groupId, group.starting_balance);
  const top = rows[0];
  const bottom = rows.length > 1 ? rows[rows.length - 1] : undefined;
  const note = (input.note ?? '').trim().slice(0, 600);
  const close: SeasonClose = {
    season: group.current_season,
    champion: top && { userId: top.userId, name: top.name, total: top.total },
    lastPlace: bottom && { userId: bottom.userId, name: bottom.name, total: bottom.total },
    prize: group.prize,
    punishment: group.punishment,
    entrants: rows.length,
  };
  const headline = seasonHeadline(group, close);
  const nextPrize = input.nextPrize?.trim();
  const nextPunishment = input.nextPunishment?.trim();

  await tx(async () => {
    for (const [index, row] of rows.entries()) {
      await run(
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
    await run(
      `INSERT INTO seasons
        (group_id, season_number, started_at, prize, punishment,
         champion_id, runner_up_id, last_place_id, note, entrants)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      groupId,
      group.current_season,
      group.season_started_at,
      group.prize,
      group.punishment,
      close.champion?.userId ?? null,
      rows[1]?.userId ?? null,
      close.lastPlace?.userId ?? null,
      note,
      rows.length,
    );
    await run(
      `UPDATE groups SET current_season = current_season + 1, season_started_at = datetime('now'),
              season_ends = ?, prize = ?, punishment = ? WHERE id = ?`,
      input.seasonEnds || null,
      nextPrize === undefined || nextPrize === '' ? group.prize : nextPrize,
      nextPunishment === undefined || nextPunishment === '' ? group.punishment : nextPunishment,
      groupId,
    );
    await run('UPDATE memberships SET balance = ? WHERE group_id = ?', group.starting_balance, groupId);
    await run(
      `INSERT OR IGNORE INTO membership_grants (user_id, group_id, season_number)
       SELECT user_id, group_id, ? FROM memberships WHERE group_id = ?`,
      group.current_season + 1,
      groupId,
    );

    await logEvent(groupId, null, userId, 'season', headline);
    if (note) await logEvent(groupId, null, userId, 'announcement', note);
    await notifyMembers(groupId, userId, null, 'season', headline);
    if (close.champion && close.champion.userId !== userId) {
      await notifyUser(
        close.champion.userId,
        groupId,
        null,
        'season',
        `You won season ${close.season} of ${group.name}.${group.prize ? ` Prize: ${group.prize}` : ''}`,
      );
    }
    if (close.lastPlace && close.lastPlace.userId !== userId && close.lastPlace.userId !== close.champion?.userId) {
      await notifyUser(
        close.lastPlace.userId,
        groupId,
        null,
        'season',
        `You finished last in season ${close.season} of ${group.name}.${group.punishment ? ` Forfeit: ${group.punishment}` : ''}`,
      );
    }
    await logEvent(groupId, null, userId, 'season', `opened season ${group.current_season + 1}`);
  });

  return close;
}

async function notifyUser(
  userId: number,
  groupId: number | null,
  marketId: number | null,
  kind: string,
  body: string,
) {
  await run(
    'INSERT INTO notifications (user_id, group_id, market_id, kind, body) VALUES (?, ?, ?, ?, ?)',
    userId,
    groupId,
    marketId,
    kind,
    body,
  );
}

async function notifyAdmins(groupId: number, actorId: number, marketId: number | null, kind: string, body: string) {
  const admins = await all<{ user_id: number }>(
    "SELECT user_id FROM memberships WHERE group_id = ? AND role = 'admin' AND user_id <> ?",
    groupId,
    actorId,
  );
  await Promise.all(admins.map((admin) => notifyUser(admin.user_id, groupId, marketId, kind, body)));
}

async function notifyMembers(groupId: number, actorId: number, marketId: number | null, kind: string, body: string) {
  const members = await all<{ user_id: number }>(
    'SELECT user_id FROM memberships WHERE group_id = ? AND user_id <> ?',
    groupId,
    actorId,
  );
  await Promise.all(members.map((member) => notifyUser(member.user_id, groupId, marketId, kind, body)));
}

async function settleCategoricalMarket(m: MarketRow, outcome: string, actorId: number | null) {
  const optionId = Number(outcome);
  const option = await get<{ id: number; label: string }>(
    'SELECT id, label FROM market_options WHERE id = ? AND market_id = ?',
    optionId,
    m.id,
  ) ?? fail('Choose a valid outcome.');

  await tx(async () => {
    const holders = await all<{ user_id: number; shares: number; cost: number }>(
      'SELECT user_id, shares, cost FROM option_positions WHERE option_id = ? AND shares > 0.0001',
      optionId,
    );
    const outstanding = holders.reduce((sum, holder) => sum + holder.shares, 0);
    const paid = Math.min(m.collateral, outstanding);
    const remainder = Math.max(0, m.collateral - paid);
    const scale = outstanding > 0 ? paid / outstanding : 0;

    for (const holder of holders) {
      const payout = holder.shares * scale;
      await run(
        'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
        payout,
        holder.user_id,
        m.group_id,
      );
      await run(
        'UPDATE option_positions SET realized = realized + ? WHERE option_id = ? AND user_id = ?',
        payout - holder.cost,
        optionId,
        holder.user_id,
      );
    }
    await run(
      `UPDATE option_positions SET realized = realized - cost
        WHERE market_id = ? AND option_id <> ? AND shares > 0.0001`,
      m.id,
      optionId,
    );

    const lpTotal = m.subsidy + m.house;
    const creatorCut = lpTotal > 0 ? (remainder * m.subsidy) / lpTotal : remainder;
    if (creatorCut > 0.0001) {
      await run(
        'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
        creatorCut,
        m.creator_id,
        m.group_id,
      );
    }

    await run(
      "UPDATE markets SET status = 'resolved', outcome = ?, resolved_at = datetime('now'), collateral = 0 WHERE id = ?",
      String(optionId),
      m.id,
    );
    for (const marketOption of await marketOptions(m.id)) {
      await run(
        'INSERT INTO option_price_points (option_id, price) VALUES (?, ?)',
        marketOption.id,
        marketOption.id === optionId ? 1 : 0,
      );
    }
    await logEvent(m.group_id, m.id, actorId, 'resolve', `resolved “${m.question}” → ${option.label}`);
    const recipients = new Set(
      (await all<{ user_id: number }>('SELECT DISTINCT user_id FROM option_positions WHERE market_id = ?', m.id)).map(
        (position) => position.user_id,
      ),
    );
    recipients.add(m.creator_id);
    for (const recipient of recipients) {
      if (recipient !== actorId) {
        await notifyUser(recipient, m.group_id, m.id, 'resolution', `“${m.question}” finalized ${option.label}.`);
      }
    }
  });
}

async function settleMarket(m: MarketRow, outcome: string, actorId: number | null) {
  const marketId = m.id;
  if (m.status === 'resolved') fail('That market is already resolved.');
  if (m.status === 'pending' || m.status === 'rejected') fail('That market never opened.');
  if (m.market_type === 'categorical') return await settleCategoricalMarket(m, outcome, actorId);
  if (outcome !== 'YES' && outcome !== 'NO') fail('Choose YES or NO.');

  await tx(async () => {
    const col = outcome === 'YES' ? 'yes_shares' : 'no_shares';
    const holders = await all<{ user_id: number; shares: number; cost: number }>(
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
      await run(
        'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
        payout,
        h.user_id,
        m.group_id,
      );
      await run(
        'UPDATE positions SET realized = realized + ? WHERE market_id = ? AND user_id = ?',
        payout - h.cost,
        marketId,
        h.user_id,
      );
    }

    // Losing legs are written off against their cost basis.
    const loseCol = outcome === 'YES' ? 'no_shares' : 'yes_shares';
    const loseCost = outcome === 'YES' ? 'no_cost' : 'yes_cost';
    await run(
      `UPDATE positions SET realized = realized - ${loseCost} WHERE market_id = ? AND ${loseCol} > 0.0001`,
      marketId,
    );

    // Unsold pool shares plus accumulated fees are the LP return. The creator
    // gets the slice matching their stake; the group's underwriting evaporates
    // back to the house it came from.
    const lpTotal = m.subsidy + m.house;
    const creatorCut = lpTotal > 0 ? (remainder * m.subsidy) / lpTotal : remainder;
    if (creatorCut > 0.0001) {
      await run(
        'UPDATE memberships SET balance = balance + ? WHERE user_id = ? AND group_id = ?',
        creatorCut,
        m.creator_id,
        m.group_id,
      );
    }

    await run(
      "UPDATE markets SET status = 'resolved', outcome = ?, resolved_at = datetime('now'), collateral = 0 WHERE id = ?",
      outcome,
      marketId,
    );
    await run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', marketId, outcome === 'YES' ? 1 : 0);
    await logEvent(m.group_id, marketId, actorId, 'resolve', `resolved “${m.question}” → ${outcome}`);
    const recipients = new Set(
      (await all<{ user_id: number }>('SELECT user_id FROM positions WHERE market_id = ?', marketId)).map((p) => p.user_id),
    );
    recipients.add(m.creator_id);
    for (const recipient of recipients) {
      if (recipient !== actorId) {
        await notifyUser(recipient, m.group_id, marketId, 'resolution', `“${m.question}” finalized ${outcome}.`);
      }
    }
  });
}

/** Immediate settlement retained for seeds and trusted maintenance scripts. */
export async function resolveMarket(userId: number, marketId: number, outcome: string) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireAdmin(userId, m.group_id);
  await settleMarket(m, outcome, userId);
}

export async function proposeResolution(userId: number, marketId: number, outcome: string, evidence: string) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireAdmin(userId, m.group_id);
  if (!['open', 'closed', 'resolving'].includes(m.status)) fail('That market cannot be resolved.');
  const outcomeLabel =
    m.market_type === 'categorical'
      ? (await get<{ label: string }>('SELECT label FROM market_options WHERE id = ? AND market_id = ?', Number(outcome), marketId))?.label
      : outcome === 'YES' || outcome === 'NO'
        ? outcome
        : undefined;
  if (!outcomeLabel) fail('Choose a valid outcome.');
  const note = evidence.trim().slice(0, 1000);
  if (note.length < 4) fail('Add a short source or explanation for the result.');
  const group = (await get<GroupRow>('SELECT * FROM groups WHERE id = ?', m.group_id))!;
  const hours = Math.max(1, Math.min(168, group.dispute_window_hours || 24));
  const disputeEndsAt = new Date(Date.now() + hours * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');

  await tx(async () => {
    await run('DELETE FROM market_disputes WHERE market_id = ?', marketId);
    await run(
      `UPDATE markets SET status = 'resolving', proposed_outcome = ?, resolution_evidence = ?,
              resolution_proposed_by = ?, resolution_proposed_at = datetime('now'),
              dispute_ends_at = ? WHERE id = ?`,
      outcome,
      note,
      userId,
      disputeEndsAt,
      marketId,
    );
    await logEvent(
      m.group_id,
      marketId,
      userId,
      'resolution',
      `proposed ${outcomeLabel} for “${m.question}” — ${hours}h review`,
    );
    await notifyMembers(m.group_id, userId, marketId, 'resolution', `Result proposed: “${m.question}” → ${outcomeLabel}.`);
  });
}

export async function disputeResolution(userId: number, marketId: number, reason: string) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireMember(userId, m.group_id);
  if (m.status !== 'resolving' || !m.proposed_outcome || !m.dispute_ends_at) {
    fail('There is no proposed result to dispute.');
  }
  const review = (await get<{ expired: number }>(
    "SELECT dispute_ends_at <= datetime('now') AS expired FROM markets WHERE id = ?",
    marketId,
  ))!;
  if (review.expired) fail('The dispute window has closed.');
  const note = reason.trim().slice(0, 600);
  if (note.length < 5) fail('Explain why the proposed result is wrong.');
  const proposedLabel =
    m.market_type === 'categorical'
      ? (await get<{ label: string }>('SELECT label FROM market_options WHERE id = ?', Number(m.proposed_outcome)))?.label
      : m.proposed_outcome;

  await tx(async () => {
    await run(
      `INSERT INTO market_disputes (market_id, user_id, reason) VALUES (?, ?, ?)
       ON CONFLICT(market_id, user_id) DO UPDATE SET reason = excluded.reason, created_at = datetime('now')`,
      marketId,
      userId,
      note,
    );
    await logEvent(m.group_id, marketId, userId, 'dispute', `disputed the proposed ${proposedLabel} result`);
    await notifyAdmins(m.group_id, userId, marketId, 'dispute', `A member disputed “${m.question}”.`);
  });
}

export async function finalizeResolution(userId: number, marketId: number) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireAdmin(userId, m.group_id);
  if (m.status !== 'resolving' || !m.proposed_outcome) fail('There is no proposed result to finalize.');
  const review = (await get<{ disputes: number; expired: number }>(
    `SELECT (SELECT CAST(COUNT(*) AS INTEGER) FROM market_disputes WHERE market_id = m.id) AS disputes,
            m.dispute_ends_at <= datetime('now') AS expired FROM markets m WHERE m.id = ?`,
    marketId,
  ))!;
  if (!review.expired && review.disputes === 0) fail('Members still have time to review this result.');
  await settleMarket(m, m.proposed_outcome, userId);
}

/** Finalize undisputed proposals after their review period. Cheap; called on group reads. */
export async function sweepResolutions(groupId: number) {
  const due = await all<MarketRow>(
    `SELECT m.*, u.name AS creator_name, u.handle AS creator_handle
       FROM markets m JOIN users u ON u.id = m.creator_id
      WHERE m.group_id = ? AND m.status = 'resolving' AND m.dispute_ends_at <= datetime('now')
        AND NOT EXISTS (SELECT 1 FROM market_disputes d WHERE d.market_id = m.id)`,
    groupId,
  );
  for (const m of due) {
    if (m.proposed_outcome) await settleMarket(m, m.proposed_outcome, m.resolution_proposed_by);
  }
}

// ─── trading ─────────────────────────────────────────────────────────────────

async function upsertPosition(marketId: number, userId: number) {
  await run(
    'INSERT OR IGNORE INTO positions (market_id, user_id) VALUES (?, ?)',
    marketId,
    userId,
  );
}

export interface FillResult {
  side: string;
  action: 'BUY' | 'SELL';
  shares: number;
  cash: number;
  avgPrice: number;
  priceAfter: number;
  balance: number;
}

async function requireEligibleTrader(userId: number, marketId: number) {
  if (await marketRestrictionFor(userId, marketId)) {
    fail('You are listed as connected to this outcome, so you cannot trade this market.');
  }
}

export async function buyCategorical(
  userId: number,
  marketId: number,
  optionId: number,
  amount: number,
): Promise<FillResult> {
  const m = await marketById(marketId) ?? fail('Market not found.');
  if (m.market_type !== 'categorical') fail('That is not a multiple-choice market.');
  if (m.status !== 'open') fail('This market is not open for trading.');
  const ms = await requireMember(userId, m.group_id);
  await requireEligibleTrader(userId, marketId);
  const spend = Math.round(Math.max(0, amount) * 100) / 100;
  if (spend <= 0) fail('Enter an amount.');
  if (spend > ms.balance + 1e-9) fail('Not enough cash.');

  const options = await marketOptions(marketId);
  const optionIndex = options.findIndex((option) => option.id === optionId);
  if (optionIndex < 0) fail('Choose a valid outcome.');
  const quote = quoteCategoricalBuy(categoricalState(m, options), optionIndex, spend);
  if (!(quote.shares > 0)) fail('That order is too small to fill.');

  return tx(async () => {
    await run(
      `UPDATE markets SET collateral = collateral + ?, fees = fees + ?, volume = volume + ? WHERE id = ?`,
      spend,
      quote.fee,
      spend,
      marketId,
    );
    await run('UPDATE market_options SET quantity = ? WHERE id = ?', quote.quantitiesAfter[optionIndex], optionId);
    await run('UPDATE memberships SET balance = balance - ? WHERE id = ?', spend, ms.id);
    await run(
      `INSERT INTO option_positions (market_id, option_id, user_id, shares, cost)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(option_id, user_id) DO UPDATE SET
         shares = shares + excluded.shares, cost = cost + excluded.cost`,
      marketId,
      optionId,
      userId,
      quote.shares,
      spend,
    );
    await run(
      `INSERT INTO trades (market_id, user_id, side, option_id, action, shares, cash, avg_price, price_after)
       VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?)`,
      marketId,
      userId,
      options[optionIndex].label,
      optionId,
      quote.shares,
      spend,
      quote.avgPrice,
      quote.priceAfter,
    );
    const updatedPrices = categoricalPrices({ ...categoricalState(m, options), quantities: quote.quantitiesAfter });
    for (const [index, option] of options.entries()) {
      await run('INSERT INTO option_price_points (option_id, price) VALUES (?, ?)', option.id, updatedPrices[index]);
    }
    await logEvent(
      m.group_id,
      marketId,
      userId,
      'trade',
      `bought ${fmtShares(quote.shares)} ${options[optionIndex].label} on “${m.question}”`,
    );
    const balance = (await get<{ balance: number }>('SELECT balance FROM memberships WHERE id = ?', ms.id))!.balance;
    return {
      side: options[optionIndex].label,
      action: 'BUY' as const,
      shares: quote.shares,
      cash: spend,
      avgPrice: quote.avgPrice,
      priceAfter: quote.priceAfter,
      balance,
    };
  });
}

export async function sellCategorical(
  userId: number,
  marketId: number,
  optionId: number,
  sharesIn: number,
): Promise<FillResult> {
  const m = await marketById(marketId) ?? fail('Market not found.');
  if (m.market_type !== 'categorical') fail('That is not a multiple-choice market.');
  if (m.status !== 'open') fail('This market is not open for trading.');
  const ms = await requireMember(userId, m.group_id);
  await requireEligibleTrader(userId, marketId);
  const options = await marketOptions(marketId);
  const optionIndex = options.findIndex((option) => option.id === optionId);
  if (optionIndex < 0) fail('Choose a valid outcome.');
  const position = await get<{ shares: number; cost: number }>(
    'SELECT shares, cost FROM option_positions WHERE option_id = ? AND user_id = ?',
    optionId,
    userId,
  );
  const held = position?.shares ?? 0;
  const qty = Math.min(held, Math.max(0, sharesIn));
  if (!(qty > 0.0001)) fail(`You have no ${options[optionIndex].label} shares to sell.`);
  const quote = quoteCategoricalSell(categoricalState(m, options), optionIndex, qty);
  if (!(quote.proceeds > 0)) fail('That order is too small to fill.');

  return tx(async () => {
    await run(
      `UPDATE markets SET collateral = collateral - ?, fees = fees + ?, volume = volume + ? WHERE id = ?`,
      quote.proceeds,
      quote.fee,
      quote.proceeds,
      marketId,
    );
    await run('UPDATE market_options SET quantity = ? WHERE id = ?', quote.quantitiesAfter[optionIndex], optionId);
    await run('UPDATE memberships SET balance = balance + ? WHERE id = ?', quote.proceeds, ms.id);
    const releasedCost = held > 0 ? ((position?.cost ?? 0) * qty) / held : 0;
    await run(
      `UPDATE option_positions SET shares = shares - ?, cost = cost - ?, realized = realized + ?
        WHERE option_id = ? AND user_id = ?`,
      qty,
      releasedCost,
      quote.proceeds - releasedCost,
      optionId,
      userId,
    );
    await run(
      `INSERT INTO trades (market_id, user_id, side, option_id, action, shares, cash, avg_price, price_after)
       VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?)`,
      marketId,
      userId,
      options[optionIndex].label,
      optionId,
      qty,
      quote.proceeds,
      quote.avgPrice,
      quote.priceAfter,
    );
    const updatedPrices = categoricalPrices({ ...categoricalState(m, options), quantities: quote.quantitiesAfter });
    for (const [index, option] of options.entries()) {
      await run('INSERT INTO option_price_points (option_id, price) VALUES (?, ?)', option.id, updatedPrices[index]);
    }
    await logEvent(
      m.group_id,
      marketId,
      userId,
      'trade',
      `sold ${fmtShares(qty)} ${options[optionIndex].label} on “${m.question}”`,
    );
    const balance = (await get<{ balance: number }>('SELECT balance FROM memberships WHERE id = ?', ms.id))!.balance;
    return {
      side: options[optionIndex].label,
      action: 'SELL' as const,
      shares: qty,
      cash: quote.proceeds,
      avgPrice: quote.avgPrice,
      priceAfter: quote.priceAfter,
      balance,
    };
  });
}

export async function buy(userId: number, marketId: number, side: Side, amount: number): Promise<FillResult> {
  const m = await marketById(marketId) ?? fail('Market not found.');
  if (m.status !== 'open') fail('This market is not open for trading.');
  const ms = await requireMember(userId, m.group_id);
  await requireEligibleTrader(userId, marketId);

  const spend = Math.round(Math.max(0, amount) * 100) / 100;
  if (spend <= 0) fail('Enter an amount.');
  if (spend > ms.balance + 1e-9) fail('Not enough cash.');

  const q = quoteBuy(reserves(m), side, spend);
  if (!(q.shares > 0)) fail('That order is too small to fill.');

  return tx(async () => {
    await run(
      `UPDATE markets SET yes_reserve = ?, no_reserve = ?, collateral = collateral + ?,
              fees = fees + ?, volume = volume + ? WHERE id = ?`,
      q.reservesAfter.yes,
      q.reservesAfter.no,
      spend,
      q.fee,
      spend,
      marketId,
    );
    await run('UPDATE memberships SET balance = balance - ? WHERE id = ?', spend, ms.id);

    await upsertPosition(marketId, userId);
    const col = side === 'YES' ? 'yes_shares' : 'no_shares';
    const costCol = side === 'YES' ? 'yes_cost' : 'no_cost';
    await run(
      `UPDATE positions SET ${col} = ${col} + ?, ${costCol} = ${costCol} + ? WHERE market_id = ? AND user_id = ?`,
      q.shares,
      spend,
      marketId,
      userId,
    );

    const after = priceYes(q.reservesAfter);
    await run(
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
    await run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', marketId, after);
    await logEvent(
      m.group_id,
      marketId,
      userId,
      'trade',
      `bought ${fmtShares(q.shares)} ${side} on “${m.question}”`,
    );

    const balance = (await get<{ balance: number }>('SELECT balance FROM memberships WHERE id = ?', ms.id))!.balance;
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

export async function sell(userId: number, marketId: number, side: Side, sharesIn: number): Promise<FillResult> {
  const m = await marketById(marketId) ?? fail('Market not found.');
  if (m.status !== 'open') fail('This market is not open for trading.');
  const ms = await requireMember(userId, m.group_id);
  await requireEligibleTrader(userId, marketId);

  const pos = await get<{ yes_shares: number; no_shares: number; yes_cost: number; no_cost: number }>(
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

  return tx(async () => {
    await run(
      `UPDATE markets SET yes_reserve = ?, no_reserve = ?, collateral = collateral - ?,
              fees = fees + ?, volume = volume + ? WHERE id = ?`,
      q.reservesAfter.yes,
      q.reservesAfter.no,
      q.proceeds,
      q.fee,
      q.proceeds,
      marketId,
    );
    await run('UPDATE memberships SET balance = balance + ? WHERE id = ?', q.proceeds, ms.id);

    // Release cost basis proportionally so avg price survives a partial sell.
    const releasedCost = held > 0 ? (basis * qty) / held : 0;
    const col = side === 'YES' ? 'yes_shares' : 'no_shares';
    const costCol = side === 'YES' ? 'yes_cost' : 'no_cost';
    await run(
      `UPDATE positions SET ${col} = ${col} - ?, ${costCol} = ${costCol} - ?, realized = realized + ?
        WHERE market_id = ? AND user_id = ?`,
      qty,
      releasedCost,
      q.proceeds - releasedCost,
      marketId,
      userId,
    );

    const after = priceYes(q.reservesAfter);
    await run(
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
    await run('INSERT INTO price_points (market_id, price) VALUES (?, ?)', marketId, after);
    await logEvent(
      m.group_id,
      marketId,
      userId,
      'trade',
      `sold ${fmtShares(qty)} ${side} on “${m.question}”`,
    );

    const balance = (await get<{ balance: number }>('SELECT balance FROM memberships WHERE id = ?', ms.id))!.balance;
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

export async function postComment(userId: number, marketId: number, body: string) {
  const m = await marketById(marketId) ?? fail('Market not found.');
  await requireMember(userId, m.group_id);
  const text = body.trim().slice(0, 600);
  if (!text) fail('Say something first.');
  await run('INSERT INTO comments (market_id, user_id, body) VALUES (?, ?, ?)', marketId, userId, text);
}
