/** Counts queries and wall time per screen. Run: DEBUG_SQL=1 npm run profile */
import { queryStats } from '../src/lib/db';
import { groupBySlug, membership, myGroups, standings, memberCount, memberWorth, unreadNotificationCount, marketsByGroup, marketById, events, groupPrizes, membershipRequests, openLegs } from '../src/lib/data';
import { marketSeries, marketMoments, relatedMarkets, sparkSeriesFor } from '../src/lib/history';
import { groupUsage } from '../src/lib/entitlements';

const group = (await groupBySlug('ridgeview-class-of-26'))!;
const userId = 1;

const time = async (label: string, fn: () => Promise<unknown>) => {
  queryStats.reset();
  const t0 = performance.now();
  await fn();
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms  ${String(queryStats.count()).padStart(4)} queries`);
};

console.log('\n  component                            time     queries');
console.log('  ' + '─'.repeat(56));

await time('standings()', () => standings(group.id, group.starting_balance));
await time('memberWorth() [shell tile]', () => memberWorth(userId, group.id));
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
await time('GROUP LAYOUT (every page!)', async () => {
  await Promise.all([
    memberWorth(userId, group.id),
    myGroups(userId),
    unreadNotificationCount(userId),
    memberCount(group.id),
    membershipRequests(group.id),
    membership(userId, group.id),
    groupBySlug('ridgeview-class-of-26'),
  ]);
});
await time('MARKET PAGE body', async () => {
  const m = (await marketById(7))!;
  await Promise.all([marketSeries(m), marketMoments(m.id), relatedMarkets(group.id, m.id, m.category)]);
});
await time('HOME body', async () => {
  const all = await marketsByGroup(group.id, ['open', 'closed', 'resolving']);
  await Promise.all([sparkSeriesFor(all), standings(group.id, group.starting_balance), groupPrizes(group.id), events(group.id, 5)]);
});
console.log('');
