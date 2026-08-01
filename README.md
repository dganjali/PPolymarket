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
members, six live markets, a settled one, two awaiting approval, and ~180 trades
of real price history.

`npm run seed` wipes and rebuilds the database. If the dev server is already
running when you reseed, restart it — it holds an open handle to the file.

| command | |
| --- | --- |
| `npm run dev` | dev server on :3000 |
| `npm run build` / `npm start` | production build and serve |
| `npm run seed` | reset the database to the demo group |
| `npm test` | market-maker property checks + engine integration tests |
| `npm run typecheck` | `tsc --noEmit` |

Set `DATABASE_PATH` to move the SQLite file (default `data/minimarket.db`), and
`SESSION_SECRET` to something real before putting this anywhere shared.

New accounts sign in with an email/password or handle/password. Google sign-in
appears automatically when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
set; copy `.env.example` and register its localhost callback URL in a Google
OAuth Web application client.

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

- **Groups** — rotating invite codes, per-group bankrolls, owner-managed admin
  roles, season archives, prize and punishment as free text. One account can be
  in many groups; balances and markets are scoped per group.
- **Markets** — binary Yes/No, categories, resolution rules, close dates.
  Members propose, the admin approves (or the group turns approval off).
  Markets close automatically at their deadline. Admins propose a result with
  evidence, members can dispute it during a configurable review window, and
  undisputed results finalize automatically.
- **Trading** — buy and sell either side, live quotes with price impact and
  payout, a depth ladder showing what it costs to move the price, public
  positions, and a comment thread per market.
- **Portfolio** — open legs with cost basis and mark-to-market, settled history
  with realized P&L, standings across the group.
- **Admin** — approval queue, resolution review, rotating invite links, stakes
  editor, liquidity and privacy settings, member roles, and season rollover.
- **Notifications** — approvals, disputes, results, role changes and new
  seasons appear in a personal inbox.

Mobile-first, with the desktop trading view from the design at ≥1024px.

## Layout

```
src/lib/amm.ts        market maker — pure, shared by server and client
src/lib/engine.ts     transactional writes: groups, markets, trades, resolution
src/lib/db.ts         SQLite schema and migrations (node:sqlite, no native deps)
src/lib/data.ts       read queries
src/app/actions.ts    server actions
src/app/g/[slug]/     the group app
scripts/              seed + tests
```

Next.js App Router, TypeScript, and `node:sqlite` from the standard library —
no ORM, no native modules, no build step beyond Next. Auth is scrypt-hashed
passwords with an HMAC-signed session cookie.

## Caveats

Single SQLite file with synchronous queries: fine for the small groups this is
built for, not for thousands of concurrent traders. Prices update on navigation
rather than streaming — there are no websockets. A disputed result still ends
with an admin decision; the review trail makes that decision visible to the group.
