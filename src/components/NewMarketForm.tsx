'use client';

import { useActionState, useState } from 'react';
import { createMarketAction, type FormState } from '@/app/actions';
import { money0 } from '@/lib/format';
import { SubmitButton } from './ui';

const CLOSE_OPTS: [string, number][] = [
  ['1 week', 7],
  ['2 weeks', 14],
  ['1 month', 30],
  ['3 months', 90],
];

export function NewMarketForm({
  slug,
  categories,
  balance,
  houseLiquidity,
  needsApproval,
  adminHandle,
  members,
}: {
  slug: string;
  categories: string[];
  balance: number;
  houseLiquidity: number;
  needsApproval: boolean;
  adminHandle: string;
  members: { userId: number; name: string; handle: string }[];
}) {
  const [state, formAction] = useActionState(createMarketAction, {} as FormState);
  const [question, setQuestion] = useState('');
  const [marketType, setMarketType] = useState<'binary' | 'categorical'>('binary');
  const [outcomes, setOutcomes] = useState(['Candidate A', 'Candidate B']);
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [openPrice, setOpenPrice] = useState(50);
  const [days, setDays] = useState(14);
  const [funding, setFunding] = useState(25);
  // An explicit date wins over the shortcut buttons when both are set.
  const [closesOn, setClosesOn] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const validOutcomes = outcomes.map((outcome) => outcome.trim()).filter(Boolean);
  const ready =
    question.trim().length > 8 &&
    funding <= balance &&
    (marketType === 'binary' || new Set(validOutcomes.map((outcome) => outcome.toLowerCase())).size >= 2);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="openPrice" value={openPrice} />
      <input type="hidden" name="days" value={days} />
      <input type="hidden" name="marketType" value={marketType} />

      <div className="field">
        <label htmlFor="question">
          {marketType === 'binary' ? 'Question — must resolve yes or no' : 'Question — exactly one outcome wins'}
        </label>
        <textarea
          id="question"
          name="question"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={marketType === 'binary' ? 'Will …?' : 'Who will win student president?'}
          style={{ background: 'var(--card)', fontSize: 16 }}
          required
        />
      </div>

      <div className="field">
        <label>Market type</label>
        <div style={{ display: 'flex', gap: 7 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-on={marketType === 'binary'}
            style={{ flex: 1, borderColor: marketType === 'binary' ? 'var(--gold)' : 'var(--line-3)' }}
            onClick={() => setMarketType('binary')}
          >
            Yes / No
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-on={marketType === 'categorical'}
            style={{ flex: 1, borderColor: marketType === 'categorical' ? 'var(--gold)' : 'var(--line-3)' }}
            onClick={() => setMarketType('categorical')}
          >
            Multiple choice
          </button>
        </div>
      </div>

      {marketType === 'categorical' && (
        <div className="field">
          <label>Outcomes</label>
          <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outcomes.map((outcome, index) => (
              <div key={index} style={{ display: 'flex', gap: 7 }}>
                <input
                  name="option"
                  value={outcome}
                  maxLength={80}
                  aria-label={`Outcome ${index + 1}`}
                  onChange={(event) =>
                    setOutcomes((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                  }
                  placeholder={`Candidate or outcome ${index + 1}`}
                  required
                />
                {outcomes.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`Remove outcome ${index + 1}`}
                    onClick={() => setOutcomes((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {outcomes.length < 8 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setOutcomes((current) => [...current, ''])}
              >
                + Add outcome
              </button>
            )}
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
              Two to eight mutually exclusive outcomes. Prices always add up to 100%.
            </div>
          </div>
        </div>
      )}

      <div className="field">
        <label>Category</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {categories.map((c) => (
            <button key={c} type="button" className="chip" data-on={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="rules">Resolution rules</label>
        <textarea
          id="rules"
          name="rules"
          rows={3}
          placeholder={
            marketType === 'binary'
              ? 'Resolves YES if … Screenshots and “my cousin saw them” do not count.'
              : 'Name the official result source, tie rule, and what happens if the election is cancelled.'
          }
          style={{ background: 'var(--card)', fontSize: 14 }}
        />
      </div>

      {members.length > 0 && (
        <div className="field">
          <label>Conflict controls</label>
          <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-4)' }}>
              Block candidates or anyone directly connected to the outcome from trading this entire market.
            </div>
            {members.map((member) => (
              <label
                key={member.userId}
                style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', color: 'var(--ink-3)' }}
              >
                <input type="checkbox" name="excludedUserId" value={member.userId} />
                <span style={{ fontSize: 13 }}>{member.name}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
                  @{member.handle}
                </span>
              </label>
            ))}
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
              Restrictions are public and cannot be bypassed by choosing a different outcome.
            </div>
          </div>
        </div>
      )}

      {marketType === 'binary' && <div className="field">
        <label htmlFor="openPrice">Your opening odds</label>
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div className="mono" style={{ fontSize: 30, fontWeight: 600 }}>
              {openPrice}%
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-5)' }}>chance of Yes</div>
          </div>
          <input
            id="openPrice"
            type="range"
            min={3}
            max={97}
            value={openPrice}
            onChange={(e) => setOpenPrice(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--gold)', padding: 0, border: 'none', background: 'none' }}
          />
        </div>
      </div>}

      <div className="field">
        <label htmlFor="funding">Your stake in the pool — comes out of your cash</label>
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {[10, 25, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                className="btn btn-ghost btn-sm mono"
                style={{
                  flex: 1,
                  borderColor: funding === v ? 'var(--gold)' : 'var(--line-3)',
                  color: funding === v ? 'var(--gold)' : 'var(--ink-2)',
                }}
                onClick={() => setFunding(v)}
              >
                ${v}
              </button>
            ))}
          </div>
          <input type="hidden" name="funding" value={funding} />
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim)', lineHeight: 1.55 }}>
            The group underwrites {money0(houseLiquidity)} of pool on top of your stake, so the
            market opens deep enough to trade. Your stake comes back at resolution with its share of
            the fees, minus whatever the pool loses to traders who called it right. You have{' '}
            {money0(balance)}.
          </div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="closesOn">Trading closes by</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {CLOSE_OPTS.map(([label, d]) => (
            <button
              key={d}
              type="button"
              className="btn btn-ghost btn-sm mono"
              style={{
                flex: 1,
                borderColor: days === d && !closesOn ? 'var(--gold)' : 'var(--line-3)',
                color: days === d && !closesOn ? 'var(--gold)' : 'var(--ink-2)',
              }}
              onClick={() => {
                setDays(d);
                setClosesOn('');
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          id="closesOn"
          name="closesOn"
          type="date"
          className="mono"
          value={closesOn}
          min={today}
          onChange={(e) => setClosesOn(e.target.value)}
        />
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
          {closesOn
            ? `Closes at the end of ${closesOn}. Nobody can trade after that, and it goes to the admin to resolve.`
            : 'Pick a shortcut, or set the exact date it has to be settled by.'}
        </div>
      </div>

      {needsApproval && (
        <div className="notice">
          Member-created markets go to <span style={{ color: 'var(--gold)' }}>@{adminHandle}</span> for
          approval before the group can trade them.
        </div>
      )}

      {state.error && <div className="error">{state.error}</div>}

      <SubmitButton disabled={!ready} pendingLabel="Submitting…">
        {funding > balance ? 'Not enough cash to seed' : needsApproval ? 'Submit for approval' : 'Open the market'}
      </SubmitButton>
    </form>
  );
}
