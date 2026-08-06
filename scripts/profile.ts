/**
 * Counts queries and, more importantly, sequential depth per screen.
 *
 * Run: DEBUG_SQL=1 npm run profile
 *      DEBUG_SQL=1 DB_LATENCY_MS=30 npm run profile
 *
 * The query count finds N+1s. The *depth* — how many queries a screen has to make
 * one after another — is what predicts production, because each one is a network
 * round trip to Postgres. Local SQLite answers in microseconds, so a screen with a
 * 12-deep chain and one with 12 parallel queries look identical without
 * DB_LATENCY_MS. With it, wall time divided by the injected latency is the depth.
 */
import { get, queryStats } from '../src/lib/db';
import {
  events,
  groupBySlug,
  groupPrizes,
  marketById,
  marketsByGroup,
  memberWorth,
  membership,
  membershipRequestCount,
  membershipRequests,
  myGroups,
  openLegs,
  standings,
  unreadNotificationCount,
} from '../src/lib/data';
import { marketMoments, marketSeries, relatedMarkets, sparkSeriesFor } from '../src/lib/history';
import { groupUsage } from '../src/lib/entitlements';
import { userById } from '../src/lib/users';

const group = (await groupBySlug('ridgeview-class-of-26'))!;
const userId = 1;
const latency = Number(process.env.DB_LATENCY_MS ?? 0);

const time = async (label: string, fn: () => Promise<unknown>) => {
  queryStats.reset();
  const t0 = performance.now();
  await fn();
  const ms = performance.now() - t0;
  const depth = latency > 0 ? (ms / latency).toFixed(1) : '—';
  console.log(
    `${label.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms  ${String(queryStats.count()).padStart(4)} queries  ${depth.padStart(6)} deep`,
  );
};

console.log(
  latency > 0
    ? `\n  injecting ${latency} ms per query — "deep" is sequential round trips\n`
    : '\n  no DB_LATENCY_MS set — run with it to read sequential depth\n',
);
console.log('  component                            time     queries    depth');
console.log('  ' + '─'.repeat(66));

await time('standings()', () => standings(group.id, group.starting_balance));
await time('memberWorth() [shell tile]', () => memberWorth(userId, group, 2500));
await time('openLegs()', () => openLegs(userId, group.id));
await time('marketsByGroup()', () => marketsByGroup(group.id, ['open', 'closed', 'resolving']));
await time('sparkSeriesFor() [grid]', async () => {
  const ms = await marketsByGroup(group.id, ['open', 'closed', 'resolving']);
  return sparkSeriesFor(ms);
});
await time('groupUsage()', () => groupUsage(group.id, group.current_season));
await time('marketSeries() [categorical]', async () => marketSeries((await marketById(7))!));
await time('marketMoments()', () => marketMoments(7));
await time('relatedMarkets()', () => relatedMarkets(group.id, 7, 'School'));

console.log('\n  ── whole screens ──');

// Mirrors the real await order in src/app/g/[slug]/layout.tsx. The sweeps are not
// included: they run in after(), off the response path.
await time('GROUP LAYOUT (every page!)', async () => {
  const user = (await userById(userId))!;
  // The same single joined row groupAccess() reads in src/lib/context.ts, memoized
  // there per request so the page body reuses it instead of re-querying.
  const row = (await get<{ id: number; current_season: number; ms_balance: number }>(
    `SELECT g.*, ms.role AS ms_role, ms.balance AS ms_balance
       FROM groups g
       LEFT JOIN memberships ms ON ms.group_id = g.id AND ms.user_id = ?
      WHERE g.slug = ?`,
    user.id,
    'ridgeview-class-of-26',
  ))!;
  const [worth, groups, unread, waiting] = await Promise.all([
    memberWorth(user.id, row, row.ms_balance),
    myGroups(user.id),
    unreadNotificationCount(user.id),
    membershipRequestCount(row.id),
  ]);
  return [worth, groups, unread, waiting];
});

await time('MARKET PAGE body', async () => {
  const m = (await marketById(7))!;
  await Promise.all([marketSeries(m), marketMoments(m.id), relatedMarkets(group.id, m.id, m.category)]);
});

// Mirrors src/app/g/[slug]/page.tsx: the sparklines chain off the market list, and
// everything else runs alongside rather than behind it.
await time('HOME body', async () => {
  const marketsPromise = marketsByGroup(group.id, ['open', 'closed', 'resolving']);
  await Promise.all([
    marketsPromise,
    marketsPromise.then(sparkSeriesFor),
    standings(group.id, group.starting_balance),
    groupPrizes(group.id),
    events(group.id, 5),
    membershipRequests(group.id),
  ]);
});
console.log('');
