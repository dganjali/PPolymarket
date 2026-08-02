# Minimarket

Private prediction markets for small groups. Polymarket's mechanics — automated
market maker pricing, Yes/No shares quoted in cents, $1 payout on resolution —
with **no real money**. Every group is invite-only, everyone starts with the
same fake bankroll, and the only thing actually at stake is whatever the admin
puts up: the good parking spot, dish duty, announcements in a mascot suit.

Built from the [Minimarket design](https://claude.ai/design/p/c669afc2-b773-4717-acdc-7fbd616ab80a).

## Running it

Requires Node.js 22.13 or newer (the app uses the built-in `node:sqlite` module
and Node's TypeScript type stripping for scripts).

```bash
npm install && npm run seed && npm run dev
```

Then open http://localhost:3000 and sign in as `dawson` (the admin) or any of
`priya`, `marcus`, `elena`, `kai`, `loic`, `tess`, `nadia`, `owen`, `sofia` —
password `minimarket` for all of them. The seed builds a demo group with ten
members, six live markets, a settled one, two awaiting approval, ~180 trades of
real price history, and three invite links in different states. It also builds a
second, public group — run by `priya`, with season one already closed and
archived, and a join request waiting in its queue.

`npm run seed` wipes and rebuilds the database. If the dev server is already
running when you reseed, restart it — it holds an open handle to the file.

| command | |
| --- | --- |
| `npm run dev` | dev server on :3000 |
| `npm run build` / `npm start` | production build and serve |
| `npm run seed` | reset the database to the demo group |
| `npm test` | market-maker property checks + engine integration tests |
| `npm run typecheck` | `tsc --noEmit` |

Set `DATABASE_PATH` to move the local SQLite file (default
`data/minimarket.db`). Production uses Postgres whenever `POSTGRES_URL` or
`DATABASE_URL` is set; Supabase's transaction-pooler connection string is the
recommended Vercel configuration.

**`SESSION_SECRET` is required in production.** Without it the app cannot sign
anybody in — it says so on the sign-in page and in the logs rather than failing
mysteriously, but nothing works until it is set. Generate one with
`openssl rand -base64 32` and put it in the hosting environment. Local
development falls back to a fixed development key, so it needs no setup.

## Signing in

Three ways in, all landing on the same account when they share a verified
address:

- **Password**, with an email or a handle (`priya` and `@priya` both work).
- **A link by email**, which needs no account first — a new address gets a
  passwordless one, with a handle and display name derived from it.
- **Google**, which appears automatically when `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set. Copy `.env.example` and register its localhost
  callback URL in a Google OAuth Web application client.

Sign-in links go out through [Resend](https://resend.com). Set `RESEND_API_KEY`
and point `RESEND_FROM` at an address on a domain you have verified there —
Resend's sandbox sender only delivers to whoever owns the key. **Without a key
the link is printed to the server console instead**, so local development needs
no mail provider at all.

Links last 15 minutes, work once, and using one retires every other link
outstanding for that address. Opening the link only shows a confirm button:
spending it takes a POST, because mail scanners at schools and workplaces follow
every link in an inbound message and would otherwise burn the token before the
person clicked it. Only the SHA-256 of each token is stored, so a database dump
cannot be replayed into sessions, and the account behind an address is created
when a link is *used* rather than when one is requested — a typo cannot leave
junk behind, since nobody can open mail sent to a mailbox they do not have.

## How the market maker works

Each market is a constant-product AMM over binary outcome shares — the same
shape as Polymarket's, in [`src/lib/amm.ts`](src/lib/amm.ts). There is no order
book; you always trade against the pool.

The pool holds `yes` and `no` shares, and the implied probability of YES is how
scarce YES is inside it:

```
priceYes = no / (yes + no)
```

Collateral only ever enters or leaves as **complete sets** — $1.00 mints one YES
and one NO share, and burning one of each returns $1.00. Buying $100 of YES
mints 100 sets into the pool and withdraws YES back down to the invariant
`yes × no = k`, which is what makes bigger orders pay a worse average price. A
1.5% fee is taken off the top and stays with the pool.

That complete-set rule is what keeps the book self-funding. For either outcome:

```
userHeldShares + poolShares + fees === collateral
```

so the payout owed at resolution can never exceed the collateral banked. The
test suite checks this holds across 200 randomized buy/sell walks.

**Liquidity.** A market opens with a house subsidy from the group (default $500,
admin-configurable) plus a stake from whoever created it (default $25, out of
their own cash). Without the subsidy a market seeded by one person is so thin
that a single $200 order swings it 90 points. At resolution every winning share
pays $1.00, and the leftover pool plus accumulated fees goes back to the
creator in proportion to their stake — the LP return, which can be negative if
traders read the market better than its opening odds did.

Because it is play money, payouts are minted rather than moved between members,
so a group's total balance is not conserved — deliberately. What *is* enforced
is per-market solvency.

## What's here

- **Groups** — public or invite-only, per-group bankrolls, owner-managed admin
  roles, ownership handover, and prize and punishment as free text. Public
  groups appear in a directory at `/discover`; private ones are reachable only
  through a code. One account can be in many groups; balances and markets are
  scoped per group. Members can leave, which forfeits their open positions.
- **Invites** — a standing group code plus any number of named links, each with
  its own expiry and headcount cap, revocable at any time. Custom codes
  (`RIDGEVIEW-26`) or generated ones; a spent link says why it stopped working.
- **Seasons** — closing a season archives the final standings, announces the
  champion against the prize and the last-place finisher against the punishment,
  and issues everyone a fresh bankroll. `/g/<slug>/seasons` keeps every past
  season, its stakes, its closing note, and an all-time win count.
- **Markets** — binary Yes/No or 2–8 mutually exclusive outcomes for elections,
  awards, and tournaments, plus categories, resolution rules, and close dates.
  Members propose, the admin approves (or the group turns approval off).
  Markets close automatically at their deadline. Admins propose a result with
  evidence, members can dispute it during a configurable review window, and
  undisputed results finalize automatically.
- **Trading** — buy and sell either side, live quotes with price impact and
  payout, a depth ladder showing what it costs to move the price, public
  positions, and a comment thread per market.
- **Portfolio** — open legs with cost basis and mark-to-market, settled history
  with realized P&L, standings across the group.
- **Admin** — approval queue, resolution review, the invite manager, stakes
  editor, group name/visibility/liquidity/privacy settings, join requests, and a
  roster where people can be added by handle or email, promoted, demoted, or
  removed (forfeiting their open positions if they still hold any). Owners get
  the season rollover, which previews who is about to be crowned before it runs.
- **Announcements** — a note from an admin that lands in the activity log and
  every member's inbox.
- **Notifications** — approvals, disputes, results, role changes, season results
  and announcements appear in a personal inbox.

Mobile-first, with the desktop trading view from the design at ≥1024px.

## Keeping credits meaningful

Credits are scarce per community and season. With member approval enabled, an
invite creates a join request and the starting bankroll is issued only after an
admin approves the person. A `(member, community, season)` grant ledger prevents
leaving and rejoining from minting a second bankroll — that holds whether the
person came back through a link, the public directory, or an admin adding them
by hand. New seasons archive the old standings and issue one fresh bankroll to
each current member.

Public groups are the one place strangers can reach a community without a code,
so keep join approval on if that matters. Capped and expiring invite links are
the middle ground: one link per homeroom, good for a week, good for five people.

This cannot prove that two different emails belong to one person. For larger
school communities, keep join approval enabled and use Google sign-in with school
accounts. Domain restrictions and verified-email enforcement are a natural next
deployment feature.

Multiple-choice markets use a logarithmic market scoring rule (LMSR). Every
outcome is immediately tradeable, buying one outcome lowers the others, and the
displayed probabilities always sum to 100%. House liquidity plus the creator's
stake bounds the market maker's maximum loss.

## Layout

```
src/lib/amm.ts        market maker — pure, shared by server and client
src/lib/engine.ts     transactional writes: groups, invites, markets, trades,
                      resolution, seasons
src/lib/db.ts         SQLite locally, Postgres/Supabase in production
src/lib/data.ts       read queries
src/lib/users.ts      accounts, passwords, Google and email identities
src/lib/magic.ts      single-use sign-in links
src/lib/mail.ts       Resend transport
src/app/actions.ts    server actions
src/app/g/[slug]/     the group app
src/app/discover/     the public group directory
scripts/              seed + tests
```

Next.js App Router and TypeScript, with a small SQL adapter over `node:sqlite`
locally and Postgres in production. Auth is scrypt-hashed passwords with an
HMAC-signed session cookie.

## Caveats

Prices update on navigation rather than streaming — there are no websockets. A
disputed result still ends with an admin decision; the review trail makes that
decision visible to the group.
