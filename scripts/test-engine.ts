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
const { isUniqueViolation } = await import('../src/lib/errors');
const { consumeMagicLink, inspectMagicLink, MAGIC_LINKS_PER_WINDOW, requestMagicLink } =
  await import('../src/lib/magic');
const {
  AppError,
  addMember,
  announce,
  approveMarket,
  buy,
  buyCategorical,
  createGroup,
  createInvite,
  createMarket,
  disputeResolution,
  finalizeResolution,
  joinGroup,
  joinPublicGroup,
  leaveGroup,
  proposeResolution,
  removeMember,
  regenerateInviteCode,
  rejectMarket,
  reviewMembershipRequest,
  resolveMarket,
  revokeInvite,
  sell,
  sellCategorical,
  setMemberRole,
  startNextSeason,
  sweepResolutions,
  transferOwnership,
  updateGroup,
} = await import('../src/lib/engine');
const {
  latestSeason,
  marketById,
  marketOptions,
  optionsWithPrices,
  priceHistory,
  publicGroups,
  seasonArchive,
} = await import('../src/lib/data');

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

  // ── sign-in and account creation ───────────────────────────────────────────
  ok((await authenticate('@admin', 'password'))?.id === admin.id, 'the @handle spelling the app displays signs in');
  ok((await authenticate('  @ADMIN  ', 'password'))?.id === admin.id, 'sign-in tolerates padding and case on a handle');
  ok((await authenticate('admin', 'wrong')) === null, 'a wrong password is refused');
  ok((await authenticate('ghost', 'password')) === null, 'an unknown handle is refused');
  ok((await authenticate('', '')) === null, 'an empty identifier is refused');
  ok(
    (await authenticate('google@example.com', '!google-only')) === null,
    'the Google sentinel is not a usable password',
  );

  // A failed sign-in has to cost the same whether or not the account exists,
  // or response time alone enumerates who has one.
  const attempt = async (id: string) => {
    const started = process.hrtime.bigint();
    await authenticate(id, 'not-the-password');
    return Number(process.hrtime.bigint() - started) / 1e6;
  };
  await attempt('admin');
  const knownCost = await attempt('admin');
  const unknownCost = await attempt('nobody-at-all');
  ok(
    unknownCost > knownCost / 4,
    `signing in as an unknown account costs comparable time (${knownCost.toFixed(1)}ms vs ${unknownCost.toFixed(1)}ms)`,
  );

  await throws(() => createUser('admin', 'Impostor', 'password'), 'a taken handle is refused');
  await throws(() => createUser('newbie', 'New', 'password', 'ADMIN@example.com'), 'a taken email is refused');
  await throws(() => createUser('x', 'Too Short', 'password'), 'a one-character handle is refused');
  await throws(() => createUser('shorty', 'Short', 'pass'), 'a short password is refused');
  await throws(() => createUser('bademail', 'Bad', 'password', 'not-an-address'), 'a malformed email is refused');
  await throws(
    () => upsertGoogleUser({ sub: 's', email: 'x@y.com', emailVerified: false, name: 'X' }),
    'Google sign-in requires a verified address',
  );

  // The driver's own constraint message must never reach the sign-up form.
  const collision = await createUser('collide', 'Collide', 'password', 'collide@example.com');
  const raced = await (async () => {
    try {
      await run(
        'INSERT INTO users (handle, name, pass_hash, email) VALUES (?, ?, ?, ?)',
        'collide',
        'Racer',
        'x:y',
        'racer@example.com',
      );
      return null;
    } catch (error) {
      return error;
    }
  })();
  ok(isUniqueViolation(raced), 'a lost uniqueness race is recognised as one');
  ok(!isUniqueViolation(new Error('connection refused')), 'unrelated failures are not mistaken for one');

  // Two accounts, same person, both signing in with Google: the second call
  // must find the first rather than insert a duplicate.
  const first = await upsertGoogleUser({ sub: 'dup-sub', email: 'dup@example.com', emailVerified: true, name: 'Dup' });
  const second = await upsertGoogleUser({ sub: 'dup-sub', email: 'dup@example.com', emailVerified: true, name: 'Dup' });
  ok(first.id === second.id, 'a repeat Google sign-in reuses the same account');
  const linked = await upsertGoogleUser({
    sub: 'link-sub',
    email: 'collide@example.com',
    emailVerified: true,
    name: 'Collide',
  });
  ok(linked.id === collision.id, 'Google links to the existing account with that verified address');
  ok(
    (await authenticate('collide', 'password'))?.id === collision.id,
    'linking Google leaves the existing password working',
  );

  // ── magic links ────────────────────────────────────────────────────────────
  // No RESEND_API_KEY here, so the link comes back instead of being emailed.
  const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;

  const issued = await requestMagicLink('Newcomer@Example.com ', '/g/test-group', 'https://mini.example');
  ok(issued.delivered === false && !!issued.url, 'without a mail provider the link is returned for the console');
  ok(issued.url!.startsWith('https://mini.example/login/magic?token='), 'the link points at the confirm page');

  const stored = (await get<{ token_hash: string; email: string }>(
    'SELECT token_hash, email FROM login_tokens ORDER BY id DESC LIMIT 1',
  ))!;
  ok(stored.email === 'newcomer@example.com', 'the address is normalised before it is stored');
  ok(!stored.token_hash.includes(tokenOf(issued.url!)), 'the raw token is never written to the database');

  const peek = await inspectMagicLink(tokenOf(issued.url!));
  ok(peek?.email === 'newcomer@example.com', 'opening the link reveals who it is for');
  ok(
    (await get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM login_tokens WHERE consumed_at IS NOT NULL'))!.n === 0,
    'merely opening the link does not spend it, so mail scanners cannot burn it',
  );

  const claimed = await consumeMagicLink(tokenOf(issued.url!));
  ok(claimed.user.email === 'newcomer@example.com', 'a link signs in the address it was sent to');
  ok(claimed.nextPath === '/g/test-group', 'the link returns you to wherever you started');

  const derived = await requestMagicLink('priya.raman@example.com', '/', 'https://mini.example');
  const namedUser = (await consumeMagicLink(tokenOf(derived.url!))).user;
  ok(namedUser.name === 'Priya Raman', 'a display name is derived from the address');
  ok(namedUser.handle === 'priyaraman', 'a handle is derived from the address');
  ok(!(await authenticate('newcomer@example.com', '')), 'an email-only account has no usable password');
  await throws(() => consumeMagicLink(tokenOf(issued.url!)), 'a link cannot be spent twice');

  const returning = await requestMagicLink('newcomer@example.com', '/', 'https://mini.example');
  const returned = await consumeMagicLink(tokenOf(returning.url!));
  ok(returned.user.id === claimed.user.id, 'signing in again reuses the account rather than making another');

  // An older email still sitting in the inbox has to stop working.
  const older = await requestMagicLink('super@example.com', '/', 'https://mini.example');
  const newer = await requestMagicLink('super@example.com', '/', 'https://mini.example');
  await consumeMagicLink(tokenOf(newer.url!));
  await throws(() => consumeMagicLink(tokenOf(older.url!)), 'using a link retires the others for that address');

  const stale = await requestMagicLink('stale@example.com', '/', 'https://mini.example');
  await run('UPDATE login_tokens SET expires_at = ? WHERE email = ?', at(-1), 'stale@example.com');
  ok((await inspectMagicLink(tokenOf(stale.url!))) === null, 'an expired link shows as spent');
  await throws(() => consumeMagicLink(tokenOf(stale.url!)), 'an expired link cannot be spent');
  await throws(() => consumeMagicLink('not-a-real-token'), 'an invented token is refused');
  ok((await inspectMagicLink('')) === null, 'an empty token is refused');
  await throws(() => requestMagicLink('not-an-address', '/', 'https://mini.example'), 'a malformed address is refused');

  // The link must not be usable to bounce somebody to another site.
  const offsite = await requestMagicLink('offsite@example.com', 'https://evil.example/steal', 'https://mini.example');
  ok((await consumeMagicLink(tokenOf(offsite.url!))).nextPath === '/groups', 'an off-site redirect is discarded');

  const flood = async () => requestMagicLink('floody@example.com', '/', 'https://mini.example');
  for (let i = 0; i < MAGIC_LINKS_PER_WINDOW; i++) await flood();
  await throws(flood, 'one address cannot be used to pump out mail');

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

  // ── invite links, directory, and roster management ─────────────────────────
  const linkGroup = await createGroup(admin.id, {
    name: 'Link Group',
    startingBalance: 1000,
    seasonEnds: null,
    prize: 'the good parking spot',
    punishment: 'the mascot suit',
    requireMemberApproval: false,
  });
  const invitee = await createUser('invitee', 'Invitee', 'password', 'invitee@example.com');
  const spare = await createUser('spare', 'Spare', 'password', 'spare@example.com');
  const browser = await createUser('browser', 'Browser', 'password', 'browser@example.com');

  const capped = await createInvite(admin.id, linkGroup.id, { label: 'Homeroom', maxUses: 1 });
  ok(capped.code.length >= 4, 'admins can mint a custom invite link');
  await joinGroup(invitee.id, capped.code);
  ok(!!(await get('SELECT id FROM memberships WHERE user_id = ? AND group_id = ?', invitee.id, linkGroup.id)), 'an invite link admits its holder');
  await throws(() => joinGroup(spare.id, capped.code), 'a link stops working once its uses run out');

  const named = await createInvite(admin.id, linkGroup.id, { code: 'ridgeview-26' });
  ok(named.code === 'RIDGEVIEW-26', 'custom codes are normalised to upper case');
  await throws(() => createInvite(admin.id, linkGroup.id, { code: 'ridgeview-26' }), 'custom codes must be unique');
  await throws(() => createInvite(admin.id, linkGroup.id, { code: 'no' }), 'custom codes have a minimum length');

  const expiring = await createInvite(admin.id, linkGroup.id, { expiresInHours: 1 });
  await run('UPDATE group_invites SET expires_at = ? WHERE id = ?', at(-1), expiring.id);
  await throws(() => joinGroup(spare.id, expiring.code), 'an expired link stops working');

  const revoked = await createInvite(admin.id, linkGroup.id, {});
  await revokeInvite(admin.id, linkGroup.id, revoked.id);
  await throws(() => joinGroup(spare.id, revoked.code), 'a revoked link stops working');
  await throws(() => createInvite(spare.id, linkGroup.id, {}), 'only admins can mint invite links');

  await addMember(admin.id, linkGroup.id, '@spare');
  close(await balance(spare.id, linkGroup.id), 1000, 'an admin can add an existing account directly');
  await throws(() => addMember(admin.id, linkGroup.id, 'spare@example.com'), 'adding somebody twice is refused');
  await throws(() => addMember(admin.id, linkGroup.id, 'ghost@example.com'), 'unknown accounts cannot be added');

  await updateGroup(admin.id, linkGroup.id, { visibility: 'public', description: 'Open to the school.' });
  const directory = await publicGroups(browser.id);
  ok(directory.some((row) => row.id === linkGroup.id), 'public groups show up in the directory');
  ok(!directory.some((row) => row.id === guarded.id), 'invite-only groups stay out of the directory');
  await joinPublicGroup(browser.id, linkGroup.id);
  close(await balance(browser.id, linkGroup.id), 1000, 'anyone can join a public group without a code');
  await throws(() => joinPublicGroup(browser.id, guarded.id), 'private groups refuse a codeless join');

  await leaveGroup(spare.id, linkGroup.id);
  ok(!(await get('SELECT id FROM memberships WHERE user_id = ? AND group_id = ?', spare.id, linkGroup.id)), 'members can leave a group');
  await throws(() => leaveGroup(admin.id, linkGroup.id), 'the owner has to hand the group over before leaving');
  await transferOwnership(admin.id, linkGroup.id, invitee.id);
  ok((await get<{ owner_id: number }>('SELECT owner_id FROM groups WHERE id = ?', linkGroup.id))!.owner_id === invitee.id, 'ownership can be handed over');
  ok((await get<{ role: string }>('SELECT role FROM memberships WHERE user_id = ? AND group_id = ?', invitee.id, linkGroup.id))!.role === 'admin', 'the new owner is an admin');
  await announce(invitee.id, linkGroup.id, 'Season stakes are locked in.');
  ok((await get<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE group_id = ? AND kind = 'announcement'", linkGroup.id))!.n === 1, 'admins can post an announcement');
  await throws(() => announce(spare.id, linkGroup.id, 'Let me in'), 'non-members cannot announce');

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
  const chartHistory = await priceHistory(market.id);
  ok(chartHistory.length >= 3, 'price history keeps the opening price and subsequent fills');
  ok(
    chartHistory.every((point) => point.price >= 0 && point.price <= 1 && !Number.isNaN(Date.parse(`${point.created_at.replace(' ', 'T')}Z`))),
    'every chart point has a probability and timestamp',
  );

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

  const closed = await startNextSeason(admin.id, group.id, {
    note: 'See you all next season.',
    nextPrize: 'first pick of senior quotes',
  });
  const freshGroup = (await get<{ current_season: number; prize: string; punishment: string }>(
    'SELECT current_season, prize, punishment FROM groups WHERE id = ?',
    group.id,
  ))!;
  ok(freshGroup.current_season === 2, 'owners can archive a completed season');
  close(await balance(a.id, group.id), 1000, 'a new season resets member balances');
  ok((await get<{ n: number }>('SELECT COUNT(*) AS n FROM season_results WHERE group_id = ?', group.id))!.n === 3, 'season standings are archived');
  ok((await get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', a.id))!.n > 0, 'important community events create notifications');

  const archived = (await latestSeason(group.id))!;
  ok(archived.season_number === 1, 'closing a season writes its archive row');
  ok(archived.champion_id === closed.champion?.userId, 'the archive records the champion');
  ok(archived.last_place_id === closed.lastPlace?.userId, 'the archive records the last-place finisher');
  ok(archived.prize === 'bragging rights' && archived.punishment === 'dishes', 'the archive snapshots the stakes that were on the table');
  ok(archived.entrants === 3, 'the archive records how many played');
  ok(archived.note === 'See you all next season.', 'the closing note is kept with the season');
  ok(freshGroup.prize === 'first pick of senior quotes', 'a new season can open with fresh stakes');
  ok(freshGroup.punishment === 'dishes', 'stakes left blank carry over');
  ok(
    (await get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = 'season'",
      closed.champion!.userId === admin.id ? closed.lastPlace!.userId : closed.champion!.userId,
    ))!.n > 0,
    'the season result is announced to the group',
  );
  ok((await seasonArchive(group.id)).length === 1, 'the season archive lists closed seasons');

  console.log(`✓ ${checks} assertions passed`);
} finally {
  db.close();
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(process.env.DATABASE_PATH + suffix, { force: true });
  }
}
