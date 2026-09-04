/**
 * The number that actually predicts production: sequential round trips for one
 * request to GET /g/<slug>.
 *
 * Next renders the layout and the page *concurrently*, and both resolve the session
 * and the group through one memoized lookup (React `cache()`, stood in for here), so
 * neither a per-component query count nor a sum of component timings tells you what
 * the browser waits for. This measures the whole request as one graph.
 *
 * Run: DEBUG_SQL=1 DB_LATENCY_MS=30 npm run profile:page
 */
import { get, queryStats } from '../src/lib/db';
import {
  events,
  groupPrizes,
  marketsByGroup,
  memberWorth,
  membershipRequestCount,
  membershipRequests,
  myGroups,
  optionsByMarket,
  standings,
  unreadNotificationCount,
} from '../src/lib/data';
import { sparkSeriesFor } from '../src/lib/history';
import { userById } from '../src/lib/users';

const latency = Number(process.env.DB_LATENCY_MS ?? 0);
const SLUG = process.env.PROFILE_SLUG ?? 'ridgeview-class-of-26';
const USER = Number(process.env.PROFILE_USER ?? 1);

interface AccessRow {
  id: number;
  current_season: number;
  starting_balance: number;
  ms_balance: number;
}

/** Stands in for React cache(): one shared promise per request, per key. */
function perRequest() {
  let user: Promise<{ id: number } | null> | undefined;
  let access: Promise<AccessRow | undefined> | undefined;
  return {
    currentUser: () => (user ??= userById(USER) as Promise<{ id: number } | null>),
    groupAccess: () =>
      (access ??= get<AccessRow>(
        `SELECT g.*, ms.role AS ms_role, ms.balance AS ms_balance
           FROM groups g
           LEFT JOIN memberships ms ON ms.group_id = g.id AND ms.user_id = ?
          WHERE g.slug = ?`,
        USER,
        SLUG,
      )),
  };
}

type Ctx = ReturnType<typeof perRequest>;

/** src/app/g/[slug]/layout.tsx — the sweeps run in after(), off the response path. */
async function layout(ctx: Ctx) {
  const user = (await ctx.currentUser())!;
  const row = (await ctx.groupAccess())!;
  return Promise.all([
    memberWorth(user.id, row, row.ms_balance),
    myGroups(user.id),
    unreadNotificationCount(user.id),
    membershipRequestCount(row.id),
  ]);
}

/** src/app/g/[slug]/page.tsx */
async function homePage(ctx: Ctx) {
  await ctx.currentUser();
  const row = (await ctx.groupAccess())!;
  const marketsPromise = marketsByGroup(row.id, ['open', 'closed', 'resolving']);
  return Promise.all([
    marketsPromise,
    marketsPromise.then(sparkSeriesFor),
    // The cards' outcomes, one query for the grid — see g/[slug]/page.tsx.
    marketsPromise.then((rows) =>
      rows.some((m) => m.market_type === 'categorical') ? optionsByMarket(row.id, row.current_season) : new Map(),
    ),
    standings(row.id, row.starting_balance),
    groupPrizes(row.id),
    events(row.id, 5),
    membershipRequests(row.id),
  ]);
}

queryStats.reset();
const started = performance.now();
const ctx = perRequest();
await Promise.all([layout(ctx), homePage(ctx)]);
const elapsed = performance.now() - started;

console.log(`\n  GET /g/${SLUG}   layout ‖ page, session and group resolved once`);
console.log(`  ${'─'.repeat(60)}`);
console.log(`  queries issued              ${String(queryStats.count()).padStart(5)}`);
if (latency > 0) {
  const depth = elapsed / latency;
  console.log(`  sequential round trips      ${depth.toFixed(1).padStart(5)}`);
  console.log(`\n  projected server wait, by where the database lives:`);
  for (const [label, rtt] of [['same region', 5], ['cross region', 30], ['cross ocean', 120]] as const) {
    console.log(`    ${String(rtt).padStart(3)} ms/round trip  (${label})   ${(rtt * depth).toFixed(0).padStart(5)} ms`);
  }
} else {
  console.log('  set DB_LATENCY_MS to read sequential depth (local SQLite is ~0)');
}
console.log('');
