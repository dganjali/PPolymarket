/**
 * Billing.
 *
 * Two implementations behind one interface. The stub is what runs today: it
 * moves a group between plans immediately and writes the same rows a real
 * provider's webhook would, so every paywall, upgrade path and overage banner
 * in the app is exercisable without a payment processor. The Stripe adapter is
 * sketched against its REST API — no `stripe` package, same as `mail.ts` talks
 * to Resend with `fetch` — and takes over the moment the keys are set.
 *
 * The rule that keeps the swap small: nothing outside this file knows which
 * provider is live. Callers get a checkout URL and, later, a plan change.
 */
import { get, run } from './db';
import { AppError } from './errors';
import { stamp } from './format';
import { CADENCE_DAYS, PLANS, type Cadence, type PlanId } from './plans';

export type { Cadence };

export interface CheckoutRequest {
  groupId: number;
  groupName: string;
  plan: PlanId;
  cadence: Cadence;
  /** Who is buying — the admin who pressed the button. */
  actorId: number;
  email?: string | null;
  /** Where to send them when it is done. */
  returnPath: string;
}

export interface Checkout {
  /** Where to send the buyer next. */
  url: string;
  /** True when no money changed hands because no provider is configured. */
  simulated: boolean;
}

export interface BillingProvider {
  readonly id: string;
  checkout(request: CheckoutRequest): Promise<Checkout>;
  /** Sends an existing customer to manage or cancel their subscription. */
  portal(groupId: number, returnPath: string): Promise<Checkout>;
}

const stripeKey = process.env.STRIPE_SECRET_KEY;

/**
 * Stripe price ids, one per (plan, cadence). Set alongside the secret key.
 * The season prices are one-off, not subscriptions — see `checkout` below.
 */
const STRIPE_PRICES: Partial<Record<`${PlanId}_${Cadence}`, string | undefined>> = {
  plus_monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY,
  plus_annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
  plus_season: process.env.STRIPE_PRICE_PLUS_SEASON,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  pro_season: process.env.STRIPE_PRICE_PRO_SEASON,
};

/**
 * Records a plan change and applies it.
 *
 * Shared by both providers: the stub calls it directly, and the Stripe adapter
 * calls it from the webhook. One place decides what a plan change means, so a
 * subscription that starts in Stripe and one that starts in a test both leave
 * the database in the same shape.
 */
export async function applyPlan(
  groupId: number,
  plan: PlanId,
  options: {
    actorId?: number | null;
    reason?: string;
    status?: string;
    periodEnd?: string | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    email?: string | null;
    provider?: string;
  } = {},
): Promise<void> {
  const current = await get<{ plan: string }>('SELECT plan FROM groups WHERE id = ?', groupId);
  if (!current) throw new AppError('Group not found.');

  await run(
    `UPDATE groups SET
       plan = ?, plan_status = ?, plan_period_end = ?, plan_since = ?,
       billing_provider = ?, billing_customer_id = COALESCE(?, billing_customer_id),
       billing_subscription_id = COALESCE(?, billing_subscription_id),
       billing_email = COALESCE(?, billing_email)
     WHERE id = ?`,
    plan,
    options.status ?? 'active',
    options.periodEnd ?? null,
    stamp(),
    options.provider ?? provider.id,
    options.customerId ?? null,
    options.subscriptionId ?? null,
    options.email ?? null,
    groupId,
  );

  // Downgrades never touch members, markets or positions — see plans.ts. The
  // ledger is here so an admin can see what happened and when.
  await run(
    'INSERT INTO plan_changes (group_id, actor_id, from_plan, to_plan, reason) VALUES (?, ?, ?, ?, ?)',
    groupId,
    options.actorId ?? null,
    current.plan,
    plan,
    options.reason ?? '',
  );
}

/**
 * The stub. Charges nothing, applies the plan immediately, and says so on the
 * screen it returns to — a demo that silently pretends to take money is worse
 * than no demo.
 */
const stub: BillingProvider = {
  id: 'stub',
  async checkout(request) {
    const plan = PLANS[request.plan];
    if (!plan.selfServe) throw new AppError(`${plan.name} is invoiced. Email sales@minimarket.app to set it up.`);

    // A real subscription renews; the stub grants a period so `planOf` has an
    // end date to reason about, and so `past_due` behaviour is testable.
    const period = CADENCE_DAYS[request.cadence];
    await applyPlan(request.groupId, request.plan, {
      actorId: request.actorId,
      reason: `stub checkout · ${request.cadence}`,
      periodEnd: stamp(Date.now() + period * 86_400_000),
      email: request.email,
      customerId: `stub_cus_${request.groupId}`,
      subscriptionId: `stub_sub_${request.groupId}_${request.plan}`,
      provider: 'stub',
    });

    return { url: `${request.returnPath}?upgraded=${request.plan}`, simulated: true };
  },
  async portal(groupId, returnPath) {
    return { url: `${returnPath}?portal=stub`, simulated: true };
  },
};

/**
 * Stripe, over its REST API.
 *
 * Deliberately thin: create a Checkout Session, hand back its URL, and let the
 * webhook be the only thing that changes a plan. Trusting the browser's return
 * trip instead would mean anyone who can guess a success URL can upgrade a
 * group for free.
 */
const stripe: BillingProvider = {
  id: 'stripe',
  async checkout(request) {
    const plan = PLANS[request.plan];
    if (!plan.selfServe) throw new AppError(`${plan.name} is invoiced. Email sales@minimarket.app to set it up.`);
    const price = STRIPE_PRICES[`${request.plan}_${request.cadence}`];
    if (!price) throw new AppError('That plan is not configured for checkout yet.');

    const base = process.env.APP_URL ?? 'http://localhost:3000';
    // A season pass is a one-off payment, not a subscription: it buys a term
    // and then stops, which is the whole point of offering it.
    const body = new URLSearchParams({
      mode: request.cadence === 'season' ? 'payment' : 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${base}${request.returnPath}?upgraded=${request.plan}`,
      cancel_url: `${base}${request.returnPath}?upgraded=cancelled`,
      client_reference_id: String(request.groupId),
      'metadata[group_id]': String(request.groupId),
      'metadata[plan]': request.plan,
    });
    if (request.cadence !== 'season') {
      body.set('subscription_data[metadata][group_id]', String(request.groupId));
      body.set('subscription_data[metadata][plan]', request.plan);
    }
    body.set('metadata[cadence]', request.cadence);
    if (request.email) body.set('customer_email', request.email);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) {
      console.error('[billing] stripe checkout failed', response.status, await response.text());
      throw new AppError('Could not start checkout. Try again in a moment.');
    }
    const session = (await response.json()) as { url?: string };
    if (!session.url) throw new AppError('Stripe did not return a checkout URL.');
    return { url: session.url, simulated: false };
  },

  async portal(groupId, returnPath) {
    const group = await get<{ billing_customer_id: string | null }>(
      'SELECT billing_customer_id FROM groups WHERE id = ?',
      groupId,
    );
    if (!group?.billing_customer_id) throw new AppError('This group has no billing account yet.');
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: group.billing_customer_id,
        return_url: `${base}${returnPath}`,
      }),
    });
    if (!response.ok) throw new AppError('Could not open the billing portal.');
    const session = (await response.json()) as { url?: string };
    if (!session.url) throw new AppError('Stripe did not return a portal URL.');
    return { url: session.url, simulated: false };
  },
};

export const provider: BillingProvider = stripeKey ? stripe : stub;

export const billingIsSimulated = !stripeKey;
