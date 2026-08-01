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
  buyCategorical,
  createGroup,
  createMarket,
  disputeResolution,
  finalizeResolution,
  joinGroup,
  proposeResolution,
  removeMember,
  regenerateInviteCode,
  rejectMarket,
  reviewMembershipRequest,
  resolveMarket,
  sell,
  sellCategorical,
  setMemberRole,
  startNextSeason,
  sweepResolutions,
} = await import('../src/lib/engine');
const { marketById, marketOptions, optionsWithPrices } = await import('../src/lib/data');

let checks = 0;
const ok = (cond: boolean, label: string) => {
  assert.ok(cond, label);
  checks++;
};
const close = (a: number, b: number, label: string, eps = 1e-6) =>
  ok(Math.abs(a - b) < eps, `${label} (${a} vs ${b})`);
const throws = async (fn: () => Promise<unknown>, label: string) => {
  await assert.rejects(fn, AppError, label);
  checks++;
};

const balance = async (userId: number, groupId: number) =>
  (await get<{ balance: number }>(
    'SELECT balance FROM memberships WHERE user_id = ? AND group_id = ?',
    userId,
    groupId,
  ))!.balance;

const at = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

try {
  const admin = await createUser('admin', 'The Admin', 'password', 'admin@example.com');
  const a = await createUser('ava', 'Ava', 'password', 'ava@example.com');
  const b = await createUser('ben', 'Ben', 'password', 'ben@example.com');
  ok((await authenticate('ADMIN@example.com', 'password'))?.id === admin.id, 'email login is case-insensitive');
  ok((await authenticate('admin', 'password'))?.id === admin.id, 'handle login remains supported');
  const google = await upsertGoogleUser({
    sub: 'google-test-sub',
    email: 'google@example.com',
    emailVerified: true,
    name: 'Google User',
  });
  ok(google.email === 'google@example.com', 'Google sign-in creates an email-backed account');

  const group = await createGroup(admin.id, {
    name: 'Test Group',
    startingBalance: 1000,
    seasonEnds: null,
    prize: 'bragging rights',
    punishment: 'dishes',
    requireMemberApproval: false,
  });
  await joinGroup(a.id, group.invite_code);
  await joinGroup(b.id, group.invite_code);

  close(await balance(a.id, group.id), 1000, 'joining grants the starting bankroll');
  await setMemberRole(admin.id, group.id, a.id, 'admin');
  ok((await get<{ role: string }>('SELECT role FROM memberships WHERE user_id = ? AND group_id = ?', a.id, group.id))!.role === 'admin', 'owners can add community admins');
  await setMemberRole(admin.id, group.id, a.id, 'member');
  const oldInvite = group.invite_code;
  ok((await regenerateInviteCode(admin.id, group.id)) !== oldInvite, 'admins can rotate invite codes');

  const guarded = await createGroup(admin.id, {
    name: 'Guarded Group',
    startingBalance: 1000,
    seasonEnds: null,
    prize: '',
    punishment: '',
  });
  const guardedMember = await createUser('guarded', 'Guarded Member', 'password', 'guarded@example.com');
  ok((await joinGroup(guardedMember.id, guarded.invite_code)).join_status === 'pending', 'guarded groups queue join requests');
  ok(!(await get('SELECT id FROM memberships WHERE user_id = ? AND group_id = ?', guardedMember.id, guarded.id)), 'pending accounts receive no bankroll');
  await reviewMembershipRequest(admin.id, guarded.id, guardedMember.id, 'approve');
  close(await balance(guardedMember.id, guarded.id), 1000, 'approval issues one seasonal bankroll');
  await removeMember(admin.id, guarded.id, guardedMember.id);
  await joinGroup(guardedMember.id, guarded.invite_code);
  await reviewMembershipRequest(admin.id, guarded.id, guardedMember.id, 'approve');
  close(await balance(guardedMember.id, guarded.id), 0, 'rejoining cannot mint a second seasonal bankroll');

  // ── membership and permissions ─────────────────────────────────────────────
  const outsider = await createUser('nope', 'Outsider', 'password');
  const market = await createMarket(admin.id, group, {
    question: 'Does the test suite pass?',
    category: 'Other',
    rules: 'Resolves YES when it does.',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 100,
  });
  ok(market.status === 'open', "an admin's own market skips the queue");
  close(await balance(admin.id, group.id), 900, 'seeding a market costs the creator its funding');

  await throws(
    () => createMarket(a.id, group, {
      question: 'Can a member silently block another trader?',
      category: 'Other',
      rules: '',
      closesAt: at(7),
      openPrice: 0.5,
      funding: 10,
      excludedUserIds: [b.id],
    }),
    'only admins can create conflict restrictions',
  );
  const restrictedMarket = await createMarket(admin.id, group, {
    question: 'Is Ben connected to this outcome?',
    category: 'Other',
    rules: 'Ben is named as a participant and cannot trade.',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 10,
    excludedUserIds: [b.id],
  });
  await throws(() => buy(b.id, restrictedMarket.id, 'YES', 10), 'restricted participants cannot trade');
  await buy(a.id, restrictedMarket.id, 'YES', 10);
  await resolveMarket(admin.id, restrictedMarket.id, 'YES');

  await throws(() => buy(outsider.id, market.id, 'YES', 10), 'non-members cannot trade');
  await throws(() => buy(a.id, market.id, 'YES', 99_999), 'you cannot spend cash you do not have');
  await throws(() => buy(a.id, market.id, 'YES', 0), 'zero-size orders are rejected');
  await throws(() => resolveMarket(a.id, market.id, 'YES'), 'members cannot resolve markets');

  // ── proposal flow ──────────────────────────────────────────────────────────
  const proposed = await createMarket(a.id, group, {
    question: 'Do member markets need approval?',
    category: 'Other',
    rules: '',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 25,
  });
  ok(proposed.status === 'pending', 'member markets queue for approval');
  await throws(() => buy(b.id, proposed.id, 'YES', 10), 'pending markets are not tradeable');

  const beforeReject = await balance(a.id, group.id);
  await rejectMarket(admin.id, proposed.id);
  close(await balance(a.id, group.id), beforeReject + 25, 'rejection refunds the seed');

  const approved = await createMarket(b.id, group, {
    question: 'Does approval open the market?',
    category: 'Other',
    rules: '',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 25,
  });
  await approveMarket(admin.id, approved.id);
  ok((await marketById(approved.id))!.status === 'open', 'approval opens the market');

  // ── trading ────────────────────────────────────────────────────────────────
  const beforeBuy = await balance(a.id, group.id);
  const fill = await buy(a.id, market.id, 'YES', 200);
  close(await balance(a.id, group.id), beforeBuy - 200, 'a buy debits exactly the amount spent');
  ok(fill.shares > 200, 'a sub-100% price buys more than one share per dollar');
  ok(
    (await marketById(market.id))!.yes_reserve < (await marketById(market.id))!.no_reserve,
    'buying YES makes YES scarce in the pool',
  );

  await buy(b.id, market.id, 'NO', 150);

  // Partial sell keeps the average price intact.
  const pos = (await get<{ yes_shares: number; yes_cost: number }>(
    'SELECT yes_shares, yes_cost FROM positions WHERE market_id = ? AND user_id = ?',
    market.id,
    a.id,
  ))!;
  const avgBefore = pos.yes_cost / pos.yes_shares;
  await sell(a.id, market.id, 'YES', pos.yes_shares / 2);
  const after = (await get<{ yes_shares: number; yes_cost: number }>(
    'SELECT yes_shares, yes_cost FROM positions WHERE market_id = ? AND user_id = ?',
    market.id,
    a.id,
  ))!;
  close(after.yes_cost / after.yes_shares, avgBefore, 'a partial sell preserves the average price');
  close(after.yes_shares, pos.yes_shares / 2, 'a partial sell halves the position');

  await throws(() => sell(b.id, market.id, 'YES', 10), 'you cannot sell a side you do not hold');

  // ── solvency at resolution ─────────────────────────────────────────────────
  const banked = (await marketById(market.id))!.collateral;
  const outstandingYes = (await all<{ yes_shares: number }>(
    'SELECT yes_shares FROM positions WHERE market_id = ?',
    market.id,
  )).reduce((sum, p) => sum + p.yes_shares, 0);
  const outstandingNo = (await all<{ no_shares: number }>(
    'SELECT no_shares FROM positions WHERE market_id = ?',
    market.id,
  )).reduce((sum, p) => sum + p.no_shares, 0);

  ok(banked >= outstandingYes - 1e-6, 'the pool can cover a YES resolution');
  ok(banked >= outstandingNo - 1e-6, 'the pool can cover a NO resolution');

  const winner = after.yes_shares;
  const aBefore = await balance(a.id, group.id);
  const adminBefore = await balance(admin.id, group.id);

  await proposeResolution(admin.id, market.id, 'YES', 'The test suite reached the resolution section.');
  ok((await marketById(market.id))!.status === 'resolving', 'an admin proposal starts resolution review');
  await throws(() => finalizeResolution(admin.id, market.id), 'an undisputed result cannot skip the review window');
  await disputeResolution(b.id, market.id, 'The suite has not finished all assertions yet.');
  ok((await get<{ n: number }>('SELECT COUNT(*) AS n FROM market_disputes WHERE market_id = ?', market.id))!.n === 1, 'members can dispute a proposed result');
  await finalizeResolution(admin.id, market.id);

  close(await balance(a.id, group.id), aBefore + winner, 'every winning share pays exactly 1.00');
  ok((await balance(admin.id, group.id)) > adminBefore, 'the leftover pool returns to the seeder');
  ok((await marketById(market.id))!.status === 'resolved', 'the market is marked resolved');

  const realizedLoss = (await get<{ realized: number }>(
    'SELECT realized FROM positions WHERE market_id = ? AND user_id = ?',
    market.id,
    b.id,
  ))!.realized;
  ok(realizedLoss < 0, 'the losing side books a loss');

  await throws(() => buy(a.id, market.id, 'YES', 10), 'a resolved market stops trading');
  await throws(() => finalizeResolution(admin.id, market.id), 'a market cannot resolve twice');

  // Total paid out never exceeded what the market banked.
  const paidOut = winner + ((await balance(admin.id, group.id)) - adminBefore);
  ok(paidOut <= banked + 1e-6, `settlement paid ${paidOut.toFixed(2)} out of ${banked.toFixed(2)} banked`);

  // ─── categorical LMSR market ──────────────────────────────────────────────
  const election = await createMarket(admin.id, group, {
    question: 'Who wins the student president election?',
    category: 'School',
    rules: 'The official school announcement decides the winner.',
    closesAt: at(7),
    openPrice: 0.5,
    funding: 50,
    marketType: 'categorical',
    options: ['Ava', 'Ben', 'Casey'],
  });
  const electionOptions = await marketOptions(election.id);
  ok(electionOptions.length === 3, 'categorical markets store every outcome');
  close((await optionsWithPrices(election)).reduce((sum, option) => sum + option.price, 0), 1, 'categorical probabilities sum to one');
  const avaOption = electionOptions[0];
  const benOption = electionOptions[1];
  const avaBeforeElection = await balance(a.id, group.id);
  const electionBuy = await buyCategorical(a.id, election.id, avaOption.id, 120);
  await buyCategorical(b.id, election.id, benOption.id, 80);
  const freshElection = (await marketById(election.id))!;
  ok((await optionsWithPrices(freshElection)).find((option) => option.id === avaOption.id)!.price > 1 / 3, 'buying a candidate raises that candidate’s probability');
  const electionPosition = (await get<{ shares: number }>('SELECT shares FROM option_positions WHERE option_id = ? AND user_id = ?', avaOption.id, a.id))!;
  await sellCategorical(a.id, election.id, avaOption.id, electionPosition.shares / 4);
  const winningShares = (await get<{ shares: number }>('SELECT shares FROM option_positions WHERE option_id = ? AND user_id = ?', avaOption.id, a.id))!.shares;
  const electionBanked = (await marketById(election.id))!.collateral;
  const maxOutstanding = Math.max(
    ...(await all<{ total: number }>('SELECT COALESCE(SUM(shares), 0) AS total FROM option_positions WHERE market_id = ? GROUP BY option_id', election.id)).map((row) => row.total),
  );
  ok(electionBanked >= maxOutstanding - 1e-6, 'categorical LMSR remains solvent for every outcome');
  await resolveMarket(admin.id, election.id, String(avaOption.id));
  ok((await balance(a.id, group.id)) > avaBeforeElection - electionBuy.cash, 'winning categorical shares pay out');
  ok((await marketById(election.id))!.outcome === String(avaOption.id), 'categorical resolution records the winning outcome');

  await proposeResolution(admin.id, approved.id, 'YES', 'No objections expected for this test market.');
  await run('UPDATE markets SET dispute_ends_at = ? WHERE id = ?', at(-1 / 1440), approved.id);
  await sweepResolutions(group.id);
  ok((await marketById(approved.id))!.status === 'resolved', 'undisputed results finalize after review');

  await startNextSeason(admin.id, group.id, null);
  const freshGroup = (await get<{ current_season: number }>('SELECT current_season FROM groups WHERE id = ?', group.id))!;
  ok(freshGroup.current_season === 2, 'owners can archive a completed season');
  close(await balance(a.id, group.id), 1000, 'a new season resets member balances');
  ok((await get<{ n: number }>('SELECT COUNT(*) AS n FROM season_results WHERE group_id = ?', group.id))!.n === 3, 'season standings are archived');
  ok((await get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', a.id))!.n > 0, 'important community events create notifications');

  console.log(`✓ ${checks} assertions passed`);
} finally {
  db.close();
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(process.env.DATABASE_PATH + suffix, { force: true });
  }
}
