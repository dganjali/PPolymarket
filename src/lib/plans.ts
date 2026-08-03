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
    tagline: 'A friend group, a season, real market prices.',
    monthlyCents: 0,
    annualCents: 0,
    selfServe: true,
    highlights: [
      'Up to 25 members and 4 live markets',
      'Yes/No and multiple-choice markets',
      'Seasons, prizes, standings and disputes',
      '90 days of activity history',
    ],
    limits: {
      members: 25,
      activeMarkets: 4,
      admins: 2,
      invites: 3,
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
    tagline: 'For the group that outgrew the free tier in a week.',
    monthlyCents: 900,
    annualCents: 7900,
    selfServe: true,
    highlights: [
      '120 members and 15 live markets',
      'Your logo and your colour on every screen',
      'Every season kept, forever',
      'Export standings and trades as CSV',
    ],
    limits: {
      members: 120,
      activeMarkets: 15,
      admins: 6,
      invites: 10,
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
    tagline: 'A whole club, a whole office, a whole grade.',
    monthlyCents: 2900,
    annualCents: 24900,
    selfServe: true,
    highlights: [
      '500 members and 60 live markets',
      'Numeric and range markets — not just Yes/No',
      'Lock joining to one email domain',
      'Calibration scoring: who is actually right',
    ],
    limits: {
      members: 500,
      activeMarkets: 60,
      admins: 20,
      invites: 50,
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
    annualCents: 99900,
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

/** "$9/mo" / "$79/yr" / "Free". Prices live in cents and are formatted once. */
export function priceLabel(cents: number, period: 'mo' | 'yr'): string {
  if (cents === 0) return 'Free';
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}/${period}`;
}

/** What annual saves against twelve months of monthly, as a percentage. */
export function annualSaving(plan: Plan): number {
  if (!plan.monthlyCents || !plan.annualCents) return 0;
  return Math.round((1 - plan.annualCents / (plan.monthlyCents * 12)) * 100);
}
