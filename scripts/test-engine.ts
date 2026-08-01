/**
 * End-to-end checks against a throwaway database: the whole market lifecycle,
 * and the accounting identity that keeps play money honest.
 *
 * Because payouts are minted at resolution rather than moved between members,
 * the identity to verify is per-market: what a market pays out on settlement
 * must never exceed the collateral it banked.
 */
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';

// ESM hoists every static import above ordinary statements, and db.ts opens its
// file the moment it is evaluated. The path has to be set before any of the app
// modules load, so they come in through dynamic imports below.
process.env.DATABASE_PATH = `data/test-${process.pid}-${Date.now()}.db`;

const { all, db, get, run } = await import('../src/lib/db');
const { authenticate, createUser, upsertGoogleUser } = await import('../src/lib/users');
const {
  AppError,
  approveMarket,
  buy,
  createGroup,
  createMarket,
  disputeResolution,
  finalizeResolution,
  joinGroup,
  proposeResolution,
  regenerateInviteCode,
  rejectMarket,
  resolveMarket,
  sell,
  setMemberRole,
  startNextSeason,
  sweepResolutions,
} = await import('../src/lib/engine');
const { marketById } = await import('../src/lib/data');

let checks = 0;
const ok = (cond: boolean, label: string) => {
  assert.ok(cond, label);
  checks++;
};
const close = (a: number, b: number, label: string, eps = 1e-6) =>
  ok(Math.abs(a - b) < eps, `${label} (${a} vs ${b})`);
const throws = (fn: () => unknown, label: string) => {
  assert.throws(fn, AppError, label);
  checks++;
};

const balance = (userId: number, groupId: number) =>
  get<{ balance: number }>(
    'SELECT balance FROM memberships WHERE user_id = ? AND group_id = ?',
    userId,
    groupId,
  )!.balance;

const at = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

try {
  const admin = createUser('admin', 'The Admin', 'password', 'admin@example.com');
  const a = createUser('ava', 'Ava', 'password', 'ava@example.com');
  const b = createUser('ben', 'Ben', 'password', 'ben@example.com');
  ok(authenticate('ADMIN@example.com', 'password')?.id === admin.id, 'email login is case-insensitive');
  ok(authenticate('admin', 'password')?.id === admin.id, 'handle login remains supported');
  const google = upsertGoogleUser({
    sub: 'google-test-sub',
    email: 'google@example.com',
    emailVerified: true,
    name: 'Google User',
  });
  ok(google.email === 'google@example.com', 'Google sign-in creates an email-backed account');

  const group = createGroup(admin.id, {
    name: 'Test Group',
    startingBalance: 1000,
    seasonEnds: null,
    prize: 'bragging rights',
    punishment: 'dishes',
  });
  joinGroup(a.id, group.invite_code);
  joinGroup(b.id, group.invite_code);

  close(balance(a.id, group.id), 1000, 'joining grants the starting bankroll');
  setMemberRole(admin.id, group.id, a.id, 'admin');
  ok(get<{ role: string }>('SELECT role FROM memberships WHERE user_id = ? AND group_id = ?', a.id, group.id)!.role === 'admin', 'owners can add community admins');
  setMemberRole(admin.id, group.id, a.id, 'member');
  const oldInvite = group.invite_code;
  ok(regenerateInviteCode(admin.id, group.id) !== oldInvite, 'admins can rotate invite codes');

  // ── membership and permissions ─────────────────────────────────────────────
  const outsider = createUser('nope', 'Outsider', 'password');
  const market = createMarket(admin.id, group, {
    question: 'Does the test suite pass?',
    category: 'Other',
    rules: 'Resolves YES when it does.',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 100,
  });
  ok(market.status === 'open', "an admin's own market skips the queue");
  close(balance(admin.id, group.id), 900, 'seeding a market costs the creator its funding');

  throws(() => buy(outsider.id, market.id, 'YES', 10), 'non-members cannot trade');
  throws(() => buy(a.id, market.id, 'YES', 99_999), 'you cannot spend cash you do not have');
  throws(() => buy(a.id, market.id, 'YES', 0), 'zero-size orders are rejected');
  throws(() => resolveMarket(a.id, market.id, 'YES'), 'members cannot resolve markets');

  // ── proposal flow ──────────────────────────────────────────────────────────
  const proposed = createMarket(a.id, group, {
    question: 'Do member markets need approval?',
    category: 'Other',
    rules: '',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 25,
  });
  ok(proposed.status === 'pending', 'member markets queue for approval');
  throws(() => buy(b.id, proposed.id, 'YES', 10), 'pending markets are not tradeable');

  const beforeReject = balance(a.id, group.id);
  rejectMarket(admin.id, proposed.id);
  close(balance(a.id, group.id), beforeReject + 25, 'rejection refunds the seed');

  const approved = createMarket(b.id, group, {
    question: 'Does approval open the market?',
    category: 'Other',
    rules: '',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 25,
  });
  approveMarket(admin.id, approved.id);
  ok(marketById(approved.id)!.status === 'open', 'approval opens the market');

  // ── trading ────────────────────────────────────────────────────────────────
  const beforeBuy = balance(a.id, group.id);
  const fill = buy(a.id, market.id, 'YES', 200);
  close(balance(a.id, group.id), beforeBuy - 200, 'a buy debits exactly the amount spent');
  ok(fill.shares > 200, 'a sub-100% price buys more than one share per dollar');
  ok(
    marketById(market.id)!.yes_reserve < marketById(market.id)!.no_reserve,
    'buying YES makes YES scarce in the pool',
  );

  buy(b.id, market.id, 'NO', 150);

  // Partial sell keeps the average price intact.
  const pos = get<{ yes_shares: number; yes_cost: number }>(
    'SELECT yes_shares, yes_cost FROM positions WHERE market_id = ? AND user_id = ?',
    market.id,
    a.id,
  )!;
  const avgBefore = pos.yes_cost / pos.yes_shares;
  sell(a.id, market.id, 'YES', pos.yes_shares / 2);
  const after = get<{ yes_shares: number; yes_cost: number }>(
    'SELECT yes_shares, yes_cost FROM positions WHERE market_id = ? AND user_id = ?',
    market.id,
    a.id,
  )!;
  close(after.yes_cost / after.yes_shares, avgBefore, 'a partial sell preserves the average price');
  close(after.yes_shares, pos.yes_shares / 2, 'a partial sell halves the position');

  throws(() => sell(b.id, market.id, 'YES', 10), 'you cannot sell a side you do not hold');

  // ── solvency at resolution ─────────────────────────────────────────────────
  const banked = marketById(market.id)!.collateral;
  const outstandingYes = all<{ yes_shares: number }>(
    'SELECT yes_shares FROM positions WHERE market_id = ?',
    market.id,
  ).reduce((sum, p) => sum + p.yes_shares, 0);
  const outstandingNo = all<{ no_shares: number }>(
    'SELECT no_shares FROM positions WHERE market_id = ?',
    market.id,
  ).reduce((sum, p) => sum + p.no_shares, 0);

  ok(banked >= outstandingYes - 1e-6, 'the pool can cover a YES resolution');
  ok(banked >= outstandingNo - 1e-6, 'the pool can cover a NO resolution');

  const winner = after.yes_shares;
  const aBefore = balance(a.id, group.id);
  const adminBefore = balance(admin.id, group.id);

  proposeResolution(admin.id, market.id, 'YES', 'The test suite reached the resolution section.');
  ok(marketById(market.id)!.status === 'resolving', 'an admin proposal starts resolution review');
  throws(() => finalizeResolution(admin.id, market.id), 'an undisputed result cannot skip the review window');
  disputeResolution(b.id, market.id, 'The suite has not finished all assertions yet.');
  ok(get<{ n: number }>('SELECT COUNT(*) AS n FROM market_disputes WHERE market_id = ?', market.id)!.n === 1, 'members can dispute a proposed result');
  finalizeResolution(admin.id, market.id);

  close(balance(a.id, group.id), aBefore + winner, 'every winning share pays exactly 1.00');
  ok(balance(admin.id, group.id) > adminBefore, 'the leftover pool returns to the seeder');
  ok(marketById(market.id)!.status === 'resolved', 'the market is marked resolved');

  const realizedLoss = get<{ realized: number }>(
    'SELECT realized FROM positions WHERE market_id = ? AND user_id = ?',
    market.id,
    b.id,
  )!.realized;
  ok(realizedLoss < 0, 'the losing side books a loss');

  throws(() => buy(a.id, market.id, 'YES', 10), 'a resolved market stops trading');
  throws(() => finalizeResolution(admin.id, market.id), 'a market cannot resolve twice');

  // Total paid out never exceeded what the market banked.
  const paidOut = winner + (balance(admin.id, group.id) - adminBefore);
  ok(paidOut <= banked + 1e-6, `settlement paid ${paidOut.toFixed(2)} out of ${banked.toFixed(2)} banked`);

  proposeResolution(admin.id, approved.id, 'YES', 'No objections expected for this test market.');
  run("UPDATE markets SET dispute_ends_at = datetime('now', '-1 minute') WHERE id = ?", approved.id);
  sweepResolutions(group.id);
  ok(marketById(approved.id)!.status === 'resolved', 'undisputed results finalize after review');

  startNextSeason(admin.id, group.id, null);
  const freshGroup = get<{ current_season: number }>('SELECT current_season FROM groups WHERE id = ?', group.id)!;
  ok(freshGroup.current_season === 2, 'owners can archive a completed season');
  close(balance(a.id, group.id), 1000, 'a new season resets member balances');
  ok(get<{ n: number }>('SELECT COUNT(*) AS n FROM season_results WHERE group_id = ?', group.id)!.n === 3, 'season standings are archived');
  ok(get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', a.id)!.n > 0, 'important community events create notifications');

  console.log(`✓ ${checks} assertions passed`);
} finally {
  db.close();
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(process.env.DATABASE_PATH + suffix, { force: true });
  }
}
