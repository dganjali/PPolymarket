'use client';

import { useActionState, useState } from 'react';
import { editMarketAction, type FormState } from '@/app/actions';
import { SubmitButton, Toast } from './ui';

/**
 * Correcting a market that is already up.
 *
 * Collapsed by default, because most markets are never edited and the button
 * that matters on this screen is Buy. What it can change is deliberately
 * limited to words and a deadline — see `updateMarket` in engine.ts — and the
 * warning above the fields is shown once anybody has money on the outcome,
 * since at that point a reworded question is a moved goalpost.
 */
export function EditMarketForm({
  slug,
  marketId,
  question,
  category,
  rules,
  closesAt,
  categories,
  traded,
  editedAt,
}: {
  slug: string;
  marketId: number;
  question: string;
  category: string;
  rules: string;
  /** As stored: "YYYY-MM-DD HH:MM:SS". */
  closesAt: string;
  categories: string[];
  /** Whether anybody has traded it yet. */
  traded: boolean;
  editedAt: string | null;
}) {
  const [state, formAction] = useActionState(editMarketAction, {} as FormState);
  const [open, setOpen] = useState(false);
  const options = categories.includes(category) ? categories : [category, ...categories];

  if (!open) {
    return (
      <section className="surface">
        <div className="sec">
          <h2 className="h-head">Edit this market</h2>
          {editedAt && <span className="t-micro">edited once already</span>}
        </div>
        <button type="button" className="btn btn-ghost btn-sm pressable" onClick={() => setOpen(true)}>
          Fix the wording or the date
        </button>
      </section>
    );
  }

  return (
    <section className="surface">
      <div className="sec">
        <h2 className="h-head">Edit this market</h2>
      </div>
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="marketId" value={marketId} />

        {traded && (
          <div className="notice">
            People already hold positions here. Fix a typo or tighten the rules — do not change what
            the market is about. Everyone holding a side is told what you changed, and it goes in the
            group log under your name.
          </div>
        )}

        <div className="field">
          <label htmlFor={`edit-q-${marketId}`}>Question</label>
          <input id={`edit-q-${marketId}`} name="question" defaultValue={question} maxLength={160} required />
        </div>

        <div className="field">
          <label htmlFor={`edit-rules-${marketId}`}>Rules</label>
          <textarea
            id={`edit-rules-${marketId}`}
            name="rules"
            rows={3}
            maxLength={1000}
            defaultValue={rules}
            placeholder="What exactly has to happen for this to settle YES."
            style={{ fontSize: 13.5 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label htmlFor={`edit-cat-${marketId}`}>Category</label>
            <select id={`edit-cat-${marketId}`} name="category" defaultValue={category}>
              {options.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label htmlFor={`edit-closes-${marketId}`}>Closes</label>
            <input
              id={`edit-closes-${marketId}`}
              name="closesOn"
              type="date"
              className="mono"
              defaultValue={closesAt.slice(0, 10)}
              required
            />
          </div>
        </div>

        {state.error && <div className="error">{state.error}</div>}

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <SubmitButton className="btn btn-primary btn-sm pressable" pendingLabel="Saving…">
            Save changes
          </SubmitButton>
          <button type="button" className="btn btn-ghost btn-sm pressable" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>

        <Toast message={state.ok} />
      </form>
    </section>
  );
}
