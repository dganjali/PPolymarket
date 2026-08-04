import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { myGroups } from '@/lib/data';
import { ORDER, PLANS, annualSaving, priceLabel, type PlanId } from '@/lib/plans';
import { Check, Sparkle } from '@/components/Icon';

export const metadata = {
  title: 'Pricing — Minimarket',
  description: 'Free for a friend group or a whole class. Paid plans start at $29 a year, per group.',
};

/** The lines under each tier, in the order they sell. */
const COMPARISON: { label: string; value: (plan: PlanId) => string }[] = [
  { label: 'Members', value: (id) => count(PLANS[id].limits.members) },
  { label: 'Live markets at once', value: (id) => count(PLANS[id].limits.activeMarkets) },
  { label: 'Admins', value: (id) => count(PLANS[id].limits.admins) },
  { label: 'Invite links', value: (id) => count(PLANS[id].limits.invites) },
  { label: 'Outcomes per market', value: (id) => count(PLANS[id].limits.outcomes) },
  {
    label: 'History kept',
    value: (id) => (PLANS[id].limits.retentionDays === Infinity ? 'Forever' : `${PLANS[id].limits.retentionDays} days`),
  },
  { label: 'Past seasons', value: (id) => count(PLANS[id].limits.seasonsVisible) },
  { label: 'Numeric and range markets', value: (id) => yes(PLANS[id].limits.marketTypes.includes('scalar')) },
  { label: 'Your logo and colour', value: (id) => yes(PLANS[id].limits.branding) },
  { label: 'Minimarket badge removed', value: (id) => yes(PLANS[id].limits.hideBadge) },
  { label: 'Lock joining to a domain', value: (id) => yes(PLANS[id].limits.domainLock) },
  { label: 'Calibration and analytics', value: (id) => yes(PLANS[id].limits.analytics) },
  { label: 'CSV export', value: (id) => yes(PLANS[id].limits.csvExport) },
];

const count = (value: number) => (value === Infinity ? 'Unlimited' : String(value));
const yes = (value: boolean) => (value ? '✓' : '—');

const FAQ: [string, string][] = [
  [
    'Is any of this real money?',
    'No. Every market in Minimarket is play money, on every plan. You are paying for the software that runs your group, the same way you would pay for a scoreboard — not for anything you can win back. Nothing you buy here can be cashed out.',
  ],
  [
    'What happens to my group if I stop paying?',
    'Nothing is deleted and nobody is removed. Everyone keeps trading, every market runs to resolution, and every season stays archived. You simply cannot add another member or open another market until you are back under the free limits.',
  ],
  [
    'Do members have to pay?',
    'Never. One person pays for the group and everybody else uses it for free. Members are never shown a paywall — if you are not the admin, you will never see one of these prices.',
  ],
  [
    'We are a school. Can we pay by invoice?',
    'Yes — that is what Campus is. One purchase order a year covers every group you run, and it is billed to the institution rather than to a person. It is deliberately priced under the signature threshold most departments use, so it does not need a committee. Email sales@minimarket.app and we will send the paperwork.',
  ],
  [
    'Can I switch plans later?',
    'Any time, in both directions. Upgrades take effect immediately. Downgrades take effect at the end of the period you already paid for, and the confirmation tells you exactly what will go over its limit first.',
  ],
  [
    'What is a season pass?',
    'A one-off payment that covers about four months, instead of a subscription. A class group runs one semester and then goes quiet all summer, and paying through the quiet half is annoying. The season pass just stops when the season does — there is nothing to remember to cancel.',
  ],
];

export default async function PricingPage() {
  const user = await currentUser();
  const groups = user ? await myGroups(user.id) : [];
  const target = groups[0];

  return (
    <main className="pricing">
      <header className="pricing-head">
        <Link href={user ? '/groups' : '/'} className="pricing-back">
          ← Minimarket
        </Link>
        <h1 className="h-display pricing-title">
          Free for your group.
          <br />
          Cheap if it gets big.
        </h1>
        <p className="pricing-lede">
          Free covers 40 people and 8 live markets, which is most classes and every friend group.
          Above that it is <b>$29 a year for the whole group</b> — less than one person&rsquo;s share of a
          pizza. We charge per group, never per person, and trading is never limited on any plan.
        </p>
      </header>

      <section className="pricing-grid">
        {ORDER.map((id) => {
          const plan = PLANS[id];
          // Plus is the one to point at now: it is the impulse buy, and the tier
          // most groups that outgrow Free actually need.
          const featured = id === 'plus';
          return (
            <article key={id} className="pricing-card liftable" data-featured={featured}>
              {featured && (
                <div className="pricing-flag">
                  <Sparkle size={12} /> Most groups pick this
                </div>
              )}
              <h2 className="pricing-name">{plan.name}</h2>
              <p className="pricing-tagline">{plan.tagline}</p>

              <div className="pricing-price mono">
                {priceLabel(plan.annualCents, 'yr')}
              </div>
              <div className="pricing-alt mono">
                {plan.id === 'free'
                  ? 'No card, no trial, no expiry'
                  : plan.selfServe
                    ? `${priceLabel(plan.seasonCents, 'season')} · ${priceLabel(plan.monthlyCents, 'mo')} · save ${annualSaving(plan)}% yearly`
                    : 'Invoice or purchase order'}
              </div>

              <ul className="pricing-list">
                {plan.highlights.map((line) => (
                  <li key={line}>
                    <Check size={14} weight={2} />
                    {line}
                  </li>
                ))}
              </ul>

              {plan.id === 'free' ? (
                <Link href={user ? '/new-group' : '/signup'} className="btn btn-ghost pressable">
                  Start a group
                </Link>
              ) : plan.selfServe ? (
                <Link
                  href={target ? `/g/${target.slug}/billing?plan=${plan.id}` : '/signup'}
                  className={`btn pressable ${featured ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {target ? `Upgrade ${target.name}` : `Get ${plan.name}`}
                </Link>
              ) : (
                <a href="mailto:sales@minimarket.app?subject=Minimarket%20Campus" className="btn btn-ghost pressable">
                  Talk to us
                </a>
              )}
            </article>
          );
        })}
      </section>

      <section className="pricing-table-wrap">
        <table className="pricing-table">
          <caption className="t-small">Everything each plan includes</caption>
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              {ORDER.map((id) => (
                <th key={id} scope="col">
                  {PLANS[id].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {ORDER.map((id) => (
                  <td key={id} className="mono">
                    {row.value(id)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="pricing-never">
              <th scope="row">Buying, selling, resolving and disputing</th>
              {ORDER.map((id) => (
                <td key={id} className="mono">
                  Always
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      <section className="pricing-faq">
        <h2 className="h-title">Questions people actually ask</h2>
        <div className="pricing-faq-list">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="pricing-faq-item">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="pricing-foot t-small">
        Play money only. Minimarket is not a gambling product, does not accept wagers, and nothing
        bought here can be redeemed for cash or prizes.
      </footer>
    </main>
  );
}
