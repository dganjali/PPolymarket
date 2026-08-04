'use client';

import { useActionState, useState } from 'react';
import { downgradeGroupAction, upgradeGroupAction, type FormState } from '@/app/actions';
import { PLANS, annualSaving, centsFor, priceLabel, type Cadence, type PlanId } from '@/lib/plans';
import { SubmitButton, Toast } from './ui';

/** Buy a plan. The cadence toggle is the only state; the rest is a form post. */
export function UpgradeForm({
  slug,
  plan,
  current,
  simulated,
}: {
  slug: string;
  plan: PlanId;
  current: PlanId;
  /** True when no payment provider is configured, so nothing is charged. */
  simulated: boolean;
}) {
  const [state, formAction] = useActionState(upgradeGroupAction, {} as FormState);
  // Yearly first: it is the cheapest per month and the one most groups want.
  const [cadence, setCadence] = useState<Cadence>('annual');
  const details = PLANS[plan];
  const on = current === plan;
  const options: { id: Cadence; label: string; note?: string }[] = [
    { id: 'annual', label: 'Yearly', note: annualSaving(details) > 0 ? `−${annualSaving(details)}%` : undefined },
    { id: 'season', label: 'One season' },
    { id: 'monthly', label: 'Monthly' },
  ];

  return (
    <form action={formAction} className="plan-buy">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cadence" value={cadence} />

      <div className="plan-cadence" role="group" aria-label="Billing period">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="plan-cadence-btn pressable"
            data-on={cadence === option.id}
            onClick={() => setCadence(option.id)}
          >
            {option.label}
            {option.note && <span className="plan-save">{option.note}</span>}
          </button>
        ))}
      </div>

      {/* The figure stays monospaced; the period does not, because "a season"
          set in mono at 28px reads as though it has double spaces in it. */}
      <div className="plan-price">
        <span className="mono">${(centsFor(details, cadence) / 100).toLocaleString('en-US')}</span>
        <span className="plan-period">
          {cadence === 'annual' ? 'per year' : cadence === 'season' ? 'for the season' : 'per month'}
        </span>
      </div>
      {cadence === 'season' && (
        <p className="plan-note">
          A one-off payment covering one season — about four months. It does not renew, so there is
          nothing to remember to cancel over the summer.
        </p>
      )}

      {state.error && <div className="error">{state.error}</div>}

      <SubmitButton className="btn btn-primary pressable" disabled={on} pendingLabel="Starting checkout…">
        {on ? `Already on ${details.name}` : `Upgrade to ${details.name}`}
      </SubmitButton>

      {simulated && (
        <p className="plan-note">
          No payment provider is configured, so this switches the plan immediately and charges
          nothing. Set <code>STRIPE_SECRET_KEY</code> to take real payments.
        </p>
      )}

      <Toast message={state.ok} />
    </form>
  );
}

/** Drop back to Free, with the consequences spelled out before the click. */
export function DowngradeForm({
  slug,
  members,
  activeMarkets,
}: {
  slug: string;
  members: number;
  activeMarkets: number;
}) {
  const [state, formAction] = useActionState(downgradeGroupAction, {} as FormState);
  const [confirming, setConfirming] = useState(false);
  const free = PLANS.free.limits;
  const overMembers = Math.max(0, members - free.members);
  const overMarkets = Math.max(0, activeMarkets - free.activeMarkets);

  if (!confirming) {
    return (
      <button type="button" className="plan-downgrade pressable" onClick={() => setConfirming(true)}>
        Move this group back to Free
      </button>
    );
  }

  return (
    <form action={formAction} className="plan-confirm">
      <input type="hidden" name="slug" value={slug} />
      <h3 className="h-head">Back to Free — here is exactly what happens</h3>
      <ul className="plan-consequences">
        <li>
          <b>Nobody is removed.</b> All {members} members keep their positions and keep trading.
        </li>
        <li>
          <b>No market closes.</b> All {activeMarkets} live markets run to resolution as normal.
        </li>
        {overMembers > 0 && (
          <li>
            You will be {overMembers} over the {free.members}-member limit, so you cannot add anyone
            new until people leave.
          </li>
        )}
        {overMarkets > 0 && (
          <li>
            You will be {overMarkets} over the {free.activeMarkets}-market limit, so you cannot open
            a new market until some settle.
          </li>
        )}
        <li>Your logo and colour stop showing. They are kept, not deleted, and come back if you upgrade again.</li>
      </ul>

      {state.error && <div className="error">{state.error}</div>}

      <div className="plan-confirm-actions">
        <button type="button" className="btn btn-ghost btn-sm pressable" onClick={() => setConfirming(false)}>
          Keep the plan
        </button>
        <SubmitButton className="btn btn-ghost btn-sm pressable plan-danger" pendingLabel="Switching…">
          Move to Free
        </SubmitButton>
      </div>

      <Toast message={state.ok} />
    </form>
  );
}
