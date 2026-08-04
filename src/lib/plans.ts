/**
 * Plans and entitlements.
 *
 * Deliberately pure: no database, no `next`, no imports at all. That means the
 * pricing page, the admin screens, the create-market form and the engine all
 * read the same numbers from the same place, and a client component can import
 * it without dragging the server runtime along.
 *
 * The shape of the business, in one paragraph: groups pay, not people. Per-seat
 * pricing would tax the only viral loop this product has — inviting the whole
 * grade — and turn every school sale into a headcount negotiation. So a plan
 * buys a group a ceiling, and the ceiling is set on the things that genuinely
 * cost money to serve (members, live markets, history) plus the things people
 * actually want (branding, market types, analytics).
 *
 * On the prices: this is a group hobby, not a work tool. The person reaching
 * for a card is the one who also pays the league fee or the game-server bill,
 * out of their own pocket, for something the group uses in bursts — so the
 * numbers are anchored on Splitwise Pro and a Minecraft realm, not on Slack
 * seats. Anything that needs a moment's thought is too expensive here.
 *
 * Hence the season pass. A class group runs one semester and goes quiet all
 * summer; billing it monthly through the quiet half is how you earn a
 * cancellation. A one-off that covers a season is both cheaper for them and
 * worth more to us than the two months they would have paid before quitting.
 *
 * Two rules that are not negotiable and are enforced below:
 *   1. Trading is never gated. Not by plan, not in overage, not when a card
 *      fails. A market that exists can always be traded, resolved and disputed.
 *   2. A downgrade never destroys anything. Limits stop you adding; they never
 *      remove a member, close a market or forfeit a position.
 */

export type PlanId = 'free' | 'plus' | 'pro' | 'campus';

export type MarketType = 'binary' | 'categorical' | 'scalar';

export type QuotaKey = 'members' | 'activeMarkets' | 'admins' | 'invites' | 'outcomes';

export type FeatureKey = 'branding' | 'hideBadge' | 'domainLock' | 'analytics' | 'csvExport';

export interface Limits {
  /** People in one group. Infinity means no ceiling. */
  members: number;
  /** Markets open, closed or in review at once. Settled ones never count. */
  activeMarkets: number;
  admins: number;
  /** Named invite links that are currently usable. */
  invites: number;
  /** Outcomes on one multiple-choice market. */
  outcomes: number;
  /** How far back the activity feed and season archive stay visible. */
  retentionDays: number;
  /** Past seasons kept on the archive screen. */
  seasonsVisible: number;
  marketTypes: readonly MarketType[];
  branding: boolean;
  hideBadge: boolean;
  domainLock: boolean;
  analytics: boolean;
  csvExport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Price in cents. Zero for free, and the campus tier is invoiced. */
  monthlyCents: number;
  annualCents: number;
  /** One-off, covers a single season. Zero where the tier does not offer one. */
  seasonCents: number;
  selfServe: boolean;
  /** The three or four lines that sell it on the pricing page. */
  highlights: string[];
  limits: Limits;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'A friend group or a whole class, free forever.',
    monthlyCents: 0,
    annualCents: 0,
    seasonCents: 0,
    selfServe: true,
    highlights: [
      'Up to 40 members and 8 live markets',
      'Yes/No and multiple-choice markets',
      'Seasons, prizes, standings and disputes',
      '90 days of activity history',
    ],
    limits: {
      members: 40,
      activeMarkets: 8,
      admins: 3,
      invites: 5,
      outcomes: 8,
      retentionDays: 90,
      seasonsVisible: 1,
      marketTypes: ['binary', 'categorical'],
      branding: false,
      hideBadge: false,
      domainLock: false,
      analytics: false,
      csvExport: false,
    },
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    tagline: 'For the club that outgrew a class-sized group.',
    monthlyCents: 400,
    annualCents: 2900,
    seasonCents: 1200,
    selfServe: true,
    highlights: [
      '150 members and 25 live markets',
      'Your logo and your colour on every screen',
      'Every season kept, forever',
      'Export standings and trades as CSV',
    ],
    limits: {
      members: 150,
      activeMarkets: 25,
      admins: 8,
      invites: 15,
      outcomes: 12,
      retentionDays: UNLIMITED,
      seasonsVisible: UNLIMITED,
      marketTypes: ['binary', 'categorical'],
      branding: true,
      hideBadge: false,
      domainLock: false,
      analytics: false,
      csvExport: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'A whole grade, a whole office, a whole chapter.',
    monthlyCents: 1200,
    annualCents: 9900,
    seasonCents: 3900,
    selfServe: true,
    highlights: [
      '600 members and 100 live markets',
      'Numeric and range markets — not just Yes/No',
      'Lock joining to one email domain',
      'Calibration scoring: who is actually right',
    ],
    limits: {
      members: 600,
      activeMarkets: 100,
      admins: 25,
      invites: 60,
      outcomes: 20,
      retentionDays: UNLIMITED,
      seasonsVisible: UNLIMITED,
      marketTypes: ['binary', 'categorical', 'scalar'],
      branding: true,
      hideBadge: true,
      domainLock: true,
      analytics: true,
      csvExport: true,
    },
  },
  campus: {
    id: 'campus',
    name: 'Campus',
    tagline: 'One invoice, every group on it.',
    monthlyCents: 0,
    annualCents: 49900,
    seasonCents: 0,
    selfServe: false,
    highlights: [
      'Unlimited members, markets and groups',
      'Billed once a year by invoice or PO',
      'The institution pays — never a student',
      'Everything in Pro, for every group you run',
    ],
    limits: {
      members: UNLIMITED,
      activeMarkets: UNLIMITED,
      admins: UNLIMITED,
      invites: UNLIMITED,
      outcomes: 20,
      retentionDays: UNLIMITED,
      seasonsVisible: UNLIMITED,
      marketTypes: ['binary', 'categorical', 'scalar'],
      branding: true,
      hideBadge: true,
      domainLock: true,
      analytics: true,
      csvExport: true,
    },
  },
};

/** Cheapest first. Anything that compares tiers uses this order. */
export const ORDER: readonly PlanId[] = ['free', 'plus', 'pro', 'campus'];

/** The columns `planOf` and `limitsFor` need. A GroupRow satisfies this. */
export interface PlanFields {
  plan?: string | null;
  plan_status?: string | null;
  plan_period_end?: string | null;
  seat_limit_override?: number | null;
  market_limit_override?: number | null;
}

export interface Usage {
  members: number;
  activeMarkets: number;
  admins: number;
  invites: number;
}

const isPlanId = (value: unknown): value is PlanId => ORDER.includes(value as PlanId);

/**
 * The plan a group is actually entitled to right now.
 *
 * A failed card does not downgrade anybody mid-season: `past_due` keeps every
 * entitlement until `plan_period_end` passes. A season that dies because a
 * teacher's purchasing card expired in March is a support ticket and a refund
 * request, not a growth lever.
 */
export function planOf(group: PlanFields, now: number = Date.now()): PlanId {
  const claimed = isPlanId(group.plan) ? group.plan : 'free';
  if (claimed === 'free') return 'free';

  const status = group.plan_status ?? 'active';
  if (status === 'active' || status === 'trialing') return claimed;
  if (status === 'past_due' || status === 'canceling') {
    const until = group.plan_period_end ? Date.parse(`${group.plan_period_end.replace(' ', 'T')}Z`) : NaN;
    return Number.isNaN(until) || until > now ? claimed : 'free';
  }
  return 'free';
}

/**
 * Plan limits, raised by any per-group override.
 *
 * Overrides are how grandfathering works: on the day limits ship, a group that
 * is already over one gets its current count written into an override, so it
 * never sees a wall for something it already had.
 */
export function limitsFor(group: PlanFields, now?: number): Limits {
  const base = PLANS[planOf(group, now)].limits;
  const members = Math.max(base.members, group.seat_limit_override ?? 0);
  const activeMarkets = Math.max(base.activeMarkets, group.market_limit_override ?? 0);
  return members === base.members && activeMarkets === base.activeMarkets
    ? base
    : { ...base, members, activeMarkets };
}

export function can(group: PlanFields, feature: FeatureKey, now?: number): boolean {
  return limitsFor(group, now)[feature];
}

export function allows(group: PlanFields, type: MarketType, now?: number): boolean {
  return limitsFor(group, now).marketTypes.includes(type);
}

/** Everything a group is currently over, for the read-only overage banner. */
export function overage(
  group: PlanFields,
  usage: Usage,
  now?: number,
): { key: QuotaKey; used: number; limit: number }[] {
  const limits = limitsFor(group, now);
  const keys: QuotaKey[] = ['members', 'activeMarkets', 'admins', 'invites'];
  return keys
    .filter((key) => usage[key as keyof Usage] > limits[key])
    .map((key) => ({ key, used: usage[key as keyof Usage], limit: limits[key] }));
}

/** The cheapest plan that clears a given need — what "Upgrade to X" should say. */
export function planThatAllows(key: QuotaKey, needed: number): PlanId | null {
  return ORDER.find((id) => PLANS[id].limits[key] >= needed) ?? null;
}

/** The cheapest plan that includes a feature. */
export function planWith(feature: FeatureKey | MarketType): PlanId | null {
  return (
    ORDER.find((id) => {
      const limits = PLANS[id].limits;
      return feature in limits
        ? Boolean(limits[feature as FeatureKey])
        : limits.marketTypes.includes(feature as MarketType);
    }) ?? null
  );
}

export const QUOTA_NOUNS: Record<QuotaKey, [one: string, many: string]> = {
  members: ['member', 'members'],
  activeMarkets: ['live market', 'live markets'],
  admins: ['admin', 'admins'],
  invites: ['active invite link', 'active invite links'],
  outcomes: ['outcome', 'outcomes'],
};

/**
 * The sentence a member sees when a limit stops them. Used verbatim in the
 * thrown error and on the upsell card, so the wording is only written once.
 */
export function limitMessage(key: QuotaKey, limit: number, next: PlanId | null): string {
  const [one, many] = QUOTA_NOUNS[key];
  const ceiling = `${limit} ${limit === 1 ? one : many}`;
  const upgrade = next && next !== 'free' ? ` ${PLANS[next].name} raises it to ${describeLimit(key, next)}.` : '';
  return `This group is on its plan's limit of ${ceiling}.${upgrade}`;
}

function describeLimit(key: QuotaKey, plan: PlanId): string {
  const value = PLANS[plan].limits[key];
  const [one, many] = QUOTA_NOUNS[key];
  return value === UNLIMITED ? `unlimited ${many}` : `${value} ${value === 1 ? one : many}`;
}

export type Cadence = 'monthly' | 'annual' | 'season';

/** How long each cadence buys, in days. A season is one school term. */
export const CADENCE_DAYS: Record<Cadence, number> = {
  monthly: 30,
  annual: 365,
  season: 120,
};

export const centsFor = (plan: Plan, cadence: Cadence): number =>
  cadence === 'annual' ? plan.annualCents : cadence === 'season' ? plan.seasonCents : plan.monthlyCents;

/** "$4/mo" / "$29/yr" / "$12 a season" / "Free". */
export function priceLabel(cents: number, period: 'mo' | 'yr' | 'season'): string {
  if (cents === 0) return 'Free';
  const dollars = cents / 100;
  const amount = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  return period === 'season' ? `${amount} a season` : `${amount}/${period}`;
}

/** What annual saves against twelve months of monthly, as a percentage. */
export function annualSaving(plan: Plan): number {
  if (!plan.monthlyCents || !plan.annualCents) return 0;
  return Math.round((1 - plan.annualCents / (plan.monthlyCents * 12)) * 100);
}
