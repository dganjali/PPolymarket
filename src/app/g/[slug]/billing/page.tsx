import Link from 'next/link';
import { notFound } from 'next/navigation';
import { groupContext } from '@/lib/context';
import { billingIsSimulated } from '@/lib/billing';
import { groupUsage, planHistory } from '@/lib/entitlements';
import { ORDER, PLANS, limitsFor, overage, planOf, priceLabel, QUOTA_NOUNS, type PlanId } from '@/lib/plans';
import { longDateLabel, relative } from '@/lib/format';
import { DowngradeForm, UpgradeForm } from '@/components/PlanControls';
import { Check, Lock, Sparkle } from '@/components/Icon';

/** A stored plan id may predate a rename, so fall back to whatever was written. */
const planName = (id: string) => (id in PLANS ? PLANS[id as PlanId].name : id);

/**
 * The plan screen. Admin-only, and deliberately honest: it leads with what the
 * group is actually using against what it is allowed, so an upgrade is a
 * decision made from numbers rather than from a nag.
 */
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ plan?: string; upgraded?: string }>;
}) {
  const { slug } = await params;
  const { plan: wanted, upgraded } = await searchParams;
  const { group, isAdmin, base } = await groupContext(slug);
  if (!isAdmin) notFound();

  const [usage, history] = await Promise.all([
    groupUsage(group.id, group.current_season),
    planHistory(group.id),
  ]);

  const current = planOf(group);
  const limits = limitsFor(group);
  const over = overage(group, usage);
  const target = ORDER.includes(wanted as never) && wanted !== 'free' ? (wanted as (typeof ORDER)[number]) : null;

  const meters: { key: keyof typeof usage; used: number; limit: number }[] = [
    { key: 'members', used: usage.members, limit: limits.members },
    { key: 'activeMarkets', used: usage.activeMarkets, limit: limits.activeMarkets },
    { key: 'admins', used: usage.admins, limit: limits.admins },
    { key: 'invites', used: usage.invites, limit: limits.invites },
  ];

  return (
    <div className="wrap narrow stack stagger">
      <header className="billing-head">
        <div>
          <div className="eyebrow">Plan</div>
          <h1 className="h-display billing-title">{PLANS[current].name}</h1>
          <p className="t-small billing-sub">
            {PLANS[current].tagline}
            {group.plan_period_end && current !== 'free' && (
              <> · renews {longDateLabel(group.plan_period_end)}</>
            )}
          </p>
        </div>
        <Link href="/pricing" className="btn btn-ghost btn-sm pressable">
          Compare plans
        </Link>
      </header>

      {upgraded && upgraded !== 'cancelled' && (
        <div className="billing-banner" data-tone="good">
          <Check size={15} weight={2} />
          <span>
            {PLANS[current].name} is live for {group.name}.
            {billingIsSimulated && ' No card was charged — this instance has no payment provider configured.'}
          </span>
        </div>
      )}

      {over.length > 0 && (
        <div className="billing-banner" data-tone="warn">
          <Lock size={15} />
          <span>
            This group is over its plan on {over.map((item) => QUOTA_NOUNS[item.key][1]).join(' and ')}. Nothing has
            been removed and everyone can still trade — you just cannot add more until you upgrade or
            drop back under.
          </span>
        </div>
      )}

      <section className="surface">
        <div className="sec">
          <h2 className="h-head">What this group is using</h2>
          <span className="t-micro">this season</span>
        </div>
        <div className="billing-meters">
          {meters.map((meter) => {
            const unlimited = meter.limit === Infinity;
            const share = unlimited ? 0 : Math.min(1, meter.used / Math.max(1, meter.limit));
            const full = !unlimited && meter.used >= meter.limit;
            return (
              <div key={meter.key} className="billing-meter">
                <div className="billing-meter-top">
                  <span className="billing-meter-label">{QUOTA_NOUNS[meter.key][1]}</span>
                  <span className="mono billing-meter-count" data-full={full}>
                    {meter.used}
                    <span className="billing-meter-limit">/{unlimited ? '∞' : meter.limit}</span>
                  </span>
                </div>
                <div className="meter">
                  <span
                    style={{
                      width: `${(unlimited ? 0.06 : share) * 100}%`,
                      background: full ? 'var(--no)' : share > 0.8 ? 'var(--c-3)' : 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {target && target !== current && (
        <section className="surface billing-buy">
          <div className="sec">
            <h2 className="h-head">
              <Sparkle size={14} /> {PLANS[target].name}
            </h2>
            <span className="t-micro">{priceLabel(PLANS[target].annualCents, 'yr')}</span>
          </div>
          <ul className="billing-highlights">
            {PLANS[target].highlights.map((line) => (
              <li key={line}>
                <Check size={13} weight={2} />
                {line}
              </li>
            ))}
          </ul>
          <UpgradeForm slug={slug} plan={target} current={current} simulated={billingIsSimulated} />
        </section>
      )}

      {!target && (
        <section className="surface">
          <div className="sec">
            <h2 className="h-head">Change plan</h2>
          </div>
          <div className="billing-options">
            {ORDER.filter((id) => id !== 'free').map((id) => (
              <Link
                key={id}
                href={`${base}/billing?plan=${id}`}
                className="billing-option liftable"
                data-on={id === current}
              >
                <span className="billing-option-name">{PLANS[id].name}</span>
                <span className="mono billing-option-price">
                  {PLANS[id].selfServe ? priceLabel(PLANS[id].annualCents, 'yr') : '$999/yr'}
                </span>
                <span className="t-micro billing-option-line">{PLANS[id].tagline}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {current !== 'free' && (
        <section className="surface">
          <div className="sec">
            <h2 className="h-head">Leaving</h2>
          </div>
          <DowngradeForm slug={slug} members={usage.members} activeMarkets={usage.activeMarkets} />
        </section>
      )}

      {history.length > 0 && (
        <section className="surface">
          <div className="sec">
            <h2 className="h-head">Plan history</h2>
          </div>
          {history.map((entry) => (
            <div key={entry.id} className="row">
              <span className="row-main t-small">
                {planName(entry.from_plan)} → <b>{planName(entry.to_plan)}</b>
                {entry.reason && <span className="t-micro"> · {entry.reason}</span>}
              </span>
              <span className="t-micro">{relative(entry.created_at)}</span>
            </div>
          ))}
        </section>
      )}

      <p className="t-micro billing-legal">
        Minimarket is play money on every plan. Paying here buys software for your group; it does not
        buy credits, and nothing in a market can be redeemed for cash.
      </p>
    </div>
  );
}
