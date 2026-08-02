/**
 * Builds the demo group from the design: Ridgeview Class of '26.
 *
 * Everything goes through the real engine — the same createMarket/buy/sell
 * paths the app uses — so the seeded state is state the app could have
 * reached on its own. Run with `npm run seed`.
 */
import { db, run } from '../src/lib/db';
import { createUser } from '../src/lib/users';
import {
  announce,
  buy,
  createGroup,
  createInvite,
  createMarket,
  joinGroup,
  postComment,
  resolveMarket,
  sell,
  startNextSeason,
  updateGroup,
} from '../src/lib/engine';
import { marketById, groupBySlug } from '../src/lib/data';
import { priceYes } from '../src/lib/amm';

const PASSWORD = 'minimarket';

// Deterministic noise so repeat seeds look the same.
let s = 20260612;
const rand = () => {
  s = (s * 1103515245 + 12345) % 2147483648;
  return s / 2147483648;
};
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

async function reset() {
  for (const t of ['events', 'comments', 'price_points', 'trades', 'positions', 'markets', 'memberships', 'groups', 'users']) {
    await run(`DELETE FROM ${t}`);
    await run('DELETE FROM sqlite_sequence WHERE name = ?', t);
  }
}

const PEOPLE: [string, string][] = [
  ['dawson', 'Dawson Reid'],
  ['priya', 'Priya Raman'],
  ['marcus', 'Marcus Bell'],
  ['elena', 'Elena Fokina'],
  ['kai', 'Kai Ortega'],
  ['loic', 'Loic Mensah'],
  ['tess', 'Tess Nakamura'],
  ['nadia', 'Nadia Haddad'],
  ['owen', 'Owen Petrov'],
  ['sofia', 'Sofia Marchetti'],
];

interface Spec {
  by: string;
  question: string;
  category: string;
  rules: string;
  days: number;
  open: number;
  /** Where the crowd pushes the price by the end of the simulation. */
  target: number;
  funding: number;
  trades: number;
}

const MARKETS: Spec[] = [
  {
    by: 'dawson',
    question: 'Will Pool Party break the curse?',
    category: 'Traditions',
    rules:
      'Resolves YES if the senior pool party happens on school grounds and is not shut down by staff or police before 10pm. A rain delay does not count as a shutdown.',
    days: 42,
    open: 0.5,
    target: 0.34,
    funding: 100,
    trades: 26,
  },
  {
    by: 'priya',
    question: 'Will John ever get with Dawson?',
    category: 'Drama',
    rules:
      'Resolves YES on public confirmation from either party before graduation. Rumors, screenshots and “my cousin saw them” do not resolve this market.',
    days: 34,
    open: 0.35,
    target: 0.12,
    funding: 100,
    trades: 46,
  },
  {
    by: 'marcus',
    question: 'Will Loic make it out?',
    category: 'Drama',
    rules: 'Resolves YES if Loic walks at graduation with the class. Summer school counts as NO.',
    days: 27,
    open: 0.5,
    target: 0.71,
    funding: 50,
    trades: 18,
  },
  {
    by: 'elena',
    question: 'Does Halvorsen cancel the AP final?',
    category: 'School',
    rules:
      'Resolves YES if the final is cancelled, replaced with a project, or made optional for the whole class.',
    days: 19,
    open: 0.4,
    target: 0.48,
    funding: 50,
    trades: 21,
  },
  {
    by: 'tess',
    question: 'Prom gets moved to the gym',
    category: 'School',
    rules: 'Resolves YES if the official venue changes to any on-campus location.',
    days: 12,
    open: 0.3,
    target: 0.22,
    funding: 25,
    trades: 24,
  },
  {
    by: 'owen',
    question: 'Anyone breaks 4:20 in the mile',
    category: 'Sports',
    rules: 'Resolves YES on any timed school race, indoor or outdoor. Relay splits do not count.',
    days: 23,
    open: 0.55,
    target: 0.61,
    funding: 50,
    trades: 15,
  },
];

const heldBy = (marketId: number, userId: number) =>
  db
    .prepare('SELECT yes_shares, no_shares FROM positions WHERE market_id = ? AND user_id = ?')
    .get(marketId, userId) as { yes_shares: number; no_shares: number } | undefined;

async function simulate(marketId: number, traders: number[], target: number, count: number) {
  for (let i = 0; i < count; i++) {
    const m = (await marketById(marketId))!;
    const p = priceYes({ yes: m.yes_reserve, no: m.no_reserve });

    // Trade toward the target, harder the further the price has drifted from
    // it. Near the target it is close to a coin flip, which is what gives the
    // chart its chop instead of a clean ramp.
    const towardYes = p < target;
    const conviction = 0.55 + 0.4 * Math.min(1, Math.abs(p - target) * 5);
    const side = rand() < conviction ? (towardYes ? 'YES' : 'NO') : towardYes ? 'NO' : 'YES';
    const amount = Math.round(5 + rand() * rand() * 150);

    // Try a few traders — by late markets some of them are out of cash, and a
    // silently skipped buy would let the price drift on the sells alone.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await buy(pick(traders), marketId, side, amount);
        break;
      } catch {
        /* broke — ask someone else */
      }
    }

    // Someone takes profits on the losing side of the move, which is the trade
    // that actually happens in a real book.
    if (rand() < 0.14) {
      const exiting = side === 'YES' ? 'NO' : 'YES';
      for (let attempt = 0; attempt < 4; attempt++) {
        const other = pick(traders);
        const held = heldBy(marketId, other);
        const qty = exiting === 'YES' ? held?.yes_shares ?? 0 : held?.no_shares ?? 0;
        if (qty < 20) continue;
        try {
          await sell(other, marketId, exiting, qty * 0.4);
          break;
        } catch {
          /* nothing sellable */
        }
      }
    }
  }
}

async function main() {
  await reset();

  const users = new Map<string, number>();
  for (const [handle, name] of PEOPLE) {
    users.set(handle, (await createUser(handle, name, PASSWORD)).id);
  }
  const id = (h: string) => users.get(h)!;

  const seasonEnds = new Date(Date.now() + 42 * 86_400_000).toISOString().slice(0, 10);
  const group = await createGroup(id('dawson'), {
    name: "Ridgeview Class of '26",
    startingBalance: 2500,
    marketLiquidity: 600,
    seasonEnds,
    prize:
      'Winner gets the good parking spot for all of senior spring + a $40 Chipotle card from the class fund.',
    punishment: 'Last place has to do the morning announcements in a full mascot suit.',
    // The demo group hands out its bankrolls on the spot; the second group below
    // is the one that shows the approval queue.
    requireMemberApproval: false,
  });

  for (const [handle] of PEOPLE) {
    if (handle !== 'dawson') await joinGroup(id(handle), group.invite_code);
  }
  const everyone = PEOPLE.map(([h]) => id(h));

  const at = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

  for (const spec of MARKETS) {
    const market = await createMarket(id(spec.by), group, {
      question: spec.question,
      category: spec.category,
      rules: spec.rules,
      closesAt: at(spec.days),
      openPrice: spec.open,
      funding: spec.funding,
    });
    // Members' markets land as proposals; the demo wants them live.
    await run("UPDATE markets SET status = 'open' WHERE id = ?", market.id);
    await simulate(market.id, everyone, spec.target, spec.trades);
  }

  // One market that already ran its course, so the settled tab has something.
  const past = await createMarket(id('dawson'), group, {
    question: 'Homecoming float actually finishes',
    category: 'Traditions',
    rules: 'Resolves YES if the float rolls in the parade under its own power.',
    closesAt: at(-1),
    openPrice: 0.45,
    funding: 50,
  });
  await simulate(past.id, everyone, 0.68, 14);
  await resolveMarket(id('dawson'), past.id, 'YES');

  // And two waiting on the admin.
  await createMarket(id('kai'), group, {
    question: 'Will the senior prank get anyone suspended?',
    category: 'Drama',
    rules: 'Resolves YES on any suspension handed out for the prank, in or out of school.',
    closesAt: at(30),
    openPrice: 0.4,
    funding: 25,
  });
  await createMarket(id('nadia'), group, {
    question: 'Does Ms. Reyes announce she is leaving?',
    category: 'School',
    rules: 'Resolves YES if she says so publicly before the last day of classes.',
    closesAt: at(45),
    openPrice: 0.25,
    funding: 25,
  });

  // A little conversation on the busiest market.
  const drama = db
    .prepare('SELECT id FROM markets WHERE group_id = ? AND question LIKE ? LIMIT 1')
    .get(group.id, '%John ever get%') as { id: number } | undefined;
  if (drama) {
    await postComment(id('marcus'), drama.id, 'This price is generous and you all know it.');
    await postComment(id('elena'), drama.id, 'I was at the bonfire. I am not saying anything else.');
    await postComment(id('dawson'), drama.id, 'This market is defamation and I am leaving it open.');
  }

  // Named invite links: one open-ended, one that runs out, one already dead.
  await createInvite(id('dawson'), group.id, { code: 'ridgeview-26', label: 'Class group chat' });
  await createInvite(id('dawson'), group.id, {
    label: 'Homeroom 4B',
    maxUses: 5,
    expiresInHours: 72,
  });
  const lapsed = await createInvite(id('dawson'), group.id, { label: 'Spirit week table' });
  await run('UPDATE group_invites SET expires_at = ?, uses = 3 WHERE id = ?', at(-2), lapsed.id);

  await announce(
    id('dawson'),
    group.id,
    'Prizes get handed out at the last assembly. Settle your positions before finals week.',
  );

  // A second community: public, screened, and one season already in the books —
  // so the directory, the join queue, and the season archive all have something.
  const league = await createGroup(id('priya'), {
    name: 'Ridgeview Debate League',
    startingBalance: 1500,
    marketLiquidity: 400,
    seasonEnds: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
    prize: 'Winner picks the topic for the season opener.',
    punishment: 'Last place judges novice rounds all weekend.',
    visibility: 'public',
    description: 'Open to anyone at Ridgeview. We trade tournaments, bids, and bid drama.',
    requireMemberApproval: false,
  });
  const leagueMembers = ['marcus', 'elena', 'tess', 'nadia'];
  for (const handle of leagueMembers) await joinGroup(id(handle), league.invite_code);

  const bid = await createMarket(id('priya'), league, {
    question: 'Does Ridgeview take a bid at the Berkeley invitational?',
    category: 'Sports',
    rules: 'Resolves YES on any qualifying bid earned at the tournament.',
    closesAt: at(-2),
    openPrice: 0.4,
    funding: 40,
  });
  await simulate(bid.id, [id('priya'), ...leagueMembers.map(id)], 0.72, 22);
  await resolveMarket(id('priya'), bid.id, 'YES');
  await startNextSeason(id('priya'), league.id, {
    note: 'Trophy is in the debate room. Season two topics go up Monday.',
    seasonEnds: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
  });
  // Screening is on from season two, so newcomers land in the approval queue.
  await updateGroup(id('priya'), league.id, { require_member_approval: 1 });
  await joinGroup(id('owen'), league.invite_code);

  const fresh = (await groupBySlug(group.slug))!;
  const freshLeague = (await groupBySlug(league.slug))!;
  const counts = db.prepare('SELECT COUNT(*) AS n FROM trades').get() as { n: number };

  console.log(`\n  Seeded “${fresh.name}”`);
  console.log(`  ${PEOPLE.length} members · ${counts.n} trades`);
  console.log(`\n  URL          http://localhost:3000/g/${fresh.slug}`);
  console.log(`  Invite code  ${fresh.invite_code}`);
  console.log(`  Invite link  http://localhost:3000/join?code=RIDGEVIEW-26`);
  console.log(`\n  Public group http://localhost:3000/g/${freshLeague.slug} (season 1 archived, run by priya)`);
  console.log(`  Directory    http://localhost:3000/discover`);
  console.log(`\n  Sign in as   dawson (admin) / priya / marcus / elena / kai / loic / tess …`);
  console.log(`  Password     ${PASSWORD}\n`);
}

await main();
