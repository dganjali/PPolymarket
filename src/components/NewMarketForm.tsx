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
}: {
  slug: string;
  categories: string[];
  balance: number;
  houseLiquidity: number;
  needsApproval: boolean;
  adminHandle: string;
}) {
  const [state, formAction] = useActionState(createMarketAction, {} as FormState);
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState(categories[0] ?? 'Other');
  const [openPrice, setOpenPrice] = useState(50);
  const [days, setDays] = useState(14);
  const [funding, setFunding] = useState(25);

  const ready = question.trim().length > 8 && funding <= balance;

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="openPrice" value={openPrice} />
      <input type="hidden" name="days" value={days} />

      <div className="field">
        <label htmlFor="question">Question — must resolve yes or no</label>
        <textarea
          id="question"
          name="question"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will …?"
          style={{ background: 'var(--card)', fontSize: 16 }}
          required
        />
      </div>

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
          placeholder="Resolves YES if … Screenshots and “my cousin saw them” do not count."
          style={{ background: 'var(--card)', fontSize: 14 }}
        />
      </div>

      <div className="field">
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
      </div>

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
        <label>Closes</label>
        <div style={{ display: 'flex', gap: 7 }}>
          {CLOSE_OPTS.map(([label, d]) => (
            <button
              key={d}
              type="button"
              className="btn btn-ghost btn-sm mono"
              style={{
                flex: 1,
                borderColor: days === d ? 'var(--gold)' : 'var(--line-3)',
                color: days === d ? 'var(--gold)' : 'var(--ink-2)',
              }}
              onClick={() => setDays(d)}
            >
              {label}
            </button>
          ))}
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
