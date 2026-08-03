# Monetization

How Minimarket makes money, what is built, and what is not yet.

The short version: **groups pay, people don't.** One admin buys a plan, everyone
else uses it free and never sees a price. Trading is never gated on any tier,
and a downgrade never deletes anything.

---

## 1. Who pays

Two populations use this product: one admin per group, and everybody else. Only
the first has ever paid for anything in this category, so pricing is per group
and never per seat. Per-seat pricing would tax the only viral loop the product
has — inviting the whole grade — and turn every school sale into a headcount
negotiation.

| | Budget they control | What makes them upgrade |
| --- | --- | --- |
| **University club treasurer** — the first and fastest sale | $200–$2,000/yr of dues or student-government money, spent by a student officer on a club card | Chapter-wide seats (80–300 people), branding for a rush or recruiting event, a season that maps to a semester and gets re-run |
| **Workplace culture owner** — office manager, EA, an EM with a fun budget | $500–$5,000/yr morale budget; a corporate card clears anything under ~$100/mo | Headcount over 25, wanting the company's jokes out of `/discover`, wanting only `@company.com` in the group |
| **School-side adult** — teacher, club advisor, activities director | $50–$500/yr of department money, on a purchasing card or a small PO | A class is 25–35 people and a grade is 200+; they hit the member cap on day one. Then: the crest and colours, and last year's season still being there |
| **The commissioner** — fantasy-league guy, friend-group ringleader | His own $20–$60/yr, same wallet as the league fee | Multi-season history, more live markets, and pure customization dopamine |

**Who will never pay, stated plainly:**

- **Every member who is not the admin.** They did not choose the tool and get
  nothing incremental from paying. They are never shown a price.
- **Students, individually.** Not because they lack $9 — taking a minor's money
  for a play-money markets product is the worst legal and press position
  available. That is what the Campus tier exists to avoid.
- **The friend group of six.** They will run four markets and one season and
  never touch a limit. That is intentional: they are the distribution channel,
  not the revenue.

Realistic shape: clubs and workplaces in year one, schools in year two,
commissioners as noise that pays the Postgres bill.

## 2. Tiers

Prices live in [`src/lib/plans.ts`](src/lib/plans.ts) and nowhere else. Three
self-serve rungs, one invoiced.

| | Free | Plus | Pro | Campus |
| --- | --- | --- | --- | --- |
| Monthly | $0 | $9 | $29 | — |
| Annual | $0 | **$79** | **$249** | **$999**, invoiced |
| Members | 25 | 120 | 500 | ∞ |
| Live markets at once | 4 | 15 | 60 | ∞ |
| Admins | 2 | 6 | 20 | ∞ |
| Active invite links | 3 | 10 | 50 | ∞ |
| Outcomes per market | 8 | 12 | 20 | 20 |
| History kept | 90 days | forever | forever | forever |
| Past seasons visible | 1 | all | all | all |
| Numeric / range markets | — | — | ✓ | ✓ |
| Logo and accent colour | — | ✓ | ✓ | ✓ |
| Badge removed | — | — | ✓ | ✓ |
| Email-domain lock | — | — | ✓ | ✓ |
| Analytics + calibration | — | — | ✓ | ✓ |
| CSV export | — | ✓ | ✓ | ✓ |
| **Buy, sell, resolve, dispute, comment** | **✓** | **✓** | **✓** | **✓** |

**Where the prices come from.** Plus sits deliberately just under **Discord
Nitro ($9.99/mo, ~$99.99/yr)** — the same behaviour we are copying, where one
enthusiast pays a personal subscription that mostly benefits a group. "Cheaper
than Nitro, and it covers everyone" is a sentence a commissioner says out loud.
Pro is anchored on classroom tools in the **Kahoot 360 range (roughly $19–$59/mo
per host)**, a band school buyers have already had approved, and against per-seat
team tools — a 40-person group is ~$290/mo on **Slack Pro (~$7.25/user/mo
annual)** or ~$400/mo on **Notion Plus ($10/user/mo annual)**. Pro at $29 flat is
a tenth of that, and that ratio is the whole pitch. Campus at $999/yr is not
anchored on a SaaS list price at all: it is anchored on the $1,000 signature
threshold most US districts use for a purchase order.

Confidence: Nitro and Notion figures are solid; Slack and Kahoot have been
repriced repeatedly and vary by region and segment — verify both before putting
them in marketing copy. Sleeper was considered as a comparable and dropped: it
monetizes through real-money contests, which is the direction this product must
never be pulled in.

Annual discounts are steep (27–28%) on purpose. Clubs and schools buy once a
year with budget that expires, and annual prepay is the only thing that lets a
$9 product survive a school calendar.

**What each limit is anchored on.** Members, live markets and retention cost
real money to serve: every trade writes a `trades` row *and* a `price_points`
row, and a categorical trade writes one `option_price_points` row **per
outcome** — an 8-outcome market has 8× the write amplification of a binary one,
which is exactly why outcome count is a paid axis. Branding, domain lock,
market types and analytics cost nothing to serve and are priced on want. That
seam is real and worth being honest about: retention is about 70% a want-lever.
It stays because Slack's free tier trained the whole market to accept a 90-day
window, and because "last year's season" is what a returning advisor asks for
first.

## 3. What is built

Shipped and working end to end:

- **`src/lib/plans.ts`** — the plan ladder, limits, and pure helpers
  (`planOf`, `limitsFor`, `can`, `allows`, `overage`, `planThatAllows`). No
  imports at all, so the pricing page, the engine and client components read the
  same numbers.
- **`src/lib/entitlements.ts`** — `requireQuota`, `requireFeature`,
  `requireMarketType`, `groupUsage`. These throw `AppError`, which the server
  actions already funnel through `guard()` into the form's error slot, so a
  paywall message reaches the person who hit it with no new plumbing.
- **Enforcement in `src/lib/engine.ts`** at the chokepoints:
  `issueMembership` (seats — the single path every join goes through),
  `createMarket` (live markets, market type, outcome count),
  `createInvite` (active links), `setMemberRole` (admin seats, promotion only).
- **Schema** — plan, status, period end, overrides, billing ids and branding
  columns on `groups`, plus a `plan_changes` ledger, in `src/lib/db.ts`.
- **Grandfathering** — a one-time, idempotent migration writes a group's current
  size into `seat_limit_override` / `market_limit_override` if it was already
  over the free ceiling when limits shipped. Those groups never see a wall for
  something they already had.
- **`src/lib/billing.ts`** — a provider interface with a working stub and a
  Stripe adapter written against the REST API (no `stripe` package, same
  approach as `mail.ts` and Resend). The stub applies plans immediately and
  says on screen that nothing was charged.
- **`/pricing`** — the public page, with the comparison table and the FAQ.
- **`/g/<slug>/billing`** — the admin's plan screen: usage meters against
  limits, upgrade, and a downgrade confirmation that names exactly what will go
  into overage before anything happens.

## 4. Downgrade rules

Three rules, enforced in code, not just documented:

1. **Nothing is ever deleted.** Retention is a read filter. Branding values stay
   in their columns. Extra invite links stay in `group_invites`. Extra admins
   keep `role = 'admin'`. Re-upgrading restores everything instantly. The UI
   says "hidden", never "removed".
2. **Overage is read-only.** A group dropping from Pro to Free with 90 members
   keeps all 90 members trading. It simply cannot add a 91st. Same for markets:
   existing ones run to resolution. A downgrade must never forfeit a position,
   remove a member or close a market.
3. **A failed card does not end a season.** `plan_status = 'past_due'` keeps
   every entitlement until `plan_period_end`. Only after that does `planOf()`
   fall back to free. A teacher's purchasing card expiring in March must not
   degrade the season.

## 5. Billing mechanics

The stub is live today. To take real money:

1. Create four prices in Stripe (Plus and Pro × monthly and annual).
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PLUS_MONTHLY`,
   `STRIPE_PRICE_PLUS_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`,
   `STRIPE_PRICE_PRO_ANNUAL` and `APP_URL`. `provider` switches on its own.
3. **Still to build:** the webhook route. `checkout.session.completed`,
   `customer.subscription.updated` and `customer.subscription.deleted` should
   verify the HMAC-SHA256 signature with `node:crypto`, dedupe on the Stripe
   event id, and call the existing `applyPlan()`. Nothing else changes — a plan
   must only ever move from a webhook, never from the browser's return trip, or
   anyone who can guess a success URL can upgrade a group for free.

## 6. Where the paywall appears

In context, at the moment of the block, never as a nag:

- Hitting a limit throws a message that names the ceiling *and* the plan that
  clears it, in the form the person was already using.
- The plan screen leads with usage meters, so upgrading is a decision made from
  numbers.
- The sidebar carries a quiet "Plan · Pro" chip for admins only.
- Members never see any of it.

## 7. Risks, and what this product must not do

- **Never take a student's money.** Campus exists so an institution pays. Any
  self-serve purchase should be gated on the buyer being a group owner, and the
  marketing must never target minors with a price.
- **Never sell credits.** The moment play money can be bought, this stops being
  a social product and starts being a regulated one. Bankrolls are issued by
  the season and by the group; they are never for sale, at any tier. This is
  the single line that must not move.
- **Never let a payment affect a market.** No paid boosts, no paid liquidity, no
  paid advantage in a market. A group's plan changes what the software can do,
  never what a price does.
- **App store rules.** If a mobile wrapper ever ships, in-app purchase rules
  apply to a subscription sold inside it; keep purchase on the web.
- **Refunds.** Clubs and schools buy annually with expiring budget. A clear
  pro-rata refund policy for the first 30 days costs little and removes the main
  objection from a treasurer.
- **Data.** A school buyer will ask for a DPA and a privacy answer before they
  can pay. That is a documentation project, and it gates the Campus tier.

## 8. Ninety days

- **Days 1–30 — instrument before charging.** Ship limits in *warn-only* mode:
  measure how many live groups would hit each ceiling and where. Do not turn
  enforcement on until the distribution is known; a member cap that catches 40%
  of active groups is a different product decision from one that catches 4%.
- **Days 31–60 — charge the willing.** Turn on Plus and Pro with Stripe. Sell to
  university clubs first: fastest close, real budget, one decision. Instrument
  the upgrade funnel from limit-hit to checkout.
- **Days 61–90 — build what the money asked for.** Ship the highest-value Pro
  feature that is still missing (numeric and range markets are already designed
  as a thin wrapper over the existing LMSR), then open Campus with an invoice
  flow and the DPA that unblocks schools.
