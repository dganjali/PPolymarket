'use client';

import { useActionState } from 'react';
import { marketAdminAction, type FormState } from '@/app/actions';
import { SubmitButton, Toast } from './ui';

/** Approve / reject / resolve / reopen, scoped to one market. */
export function AdminMarketControls({
  slug,
  marketId,
  status,
  compact = false,
}: {
  slug: string;
  marketId: number;
  status: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(marketAdminAction, {} as FormState);

  const buttons =
    status === 'pending'
      ? ([
          ['approve', 'Approve', 'pill-yes'],
          ['reject', 'Reject', 'btn-ghost'],
        ] as const)
      : ([
          ['resolve-yes', 'Resolve YES', 'pill-yes'],
          ['resolve-no', 'Resolve NO', 'pill-no'],
        ] as const);

  return (
    <div
      className={compact ? undefined : 'panel'}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {!compact && (
        <div className="eyebrow">
          {status === 'pending' ? 'Approval' : 'Resolve — admin only'}
        </div>
      )}

      <form action={formAction} style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="marketId" value={marketId} />

        {buttons.map(([op, label, cls]) => (
          <SubmitButton
            key={op}
            name="op"
            value={op}
            className={`btn btn-sm ${cls}`}
            style={{ flex: 1, minWidth: 120 }}
            pendingLabel="…"
          >
            {label}
          </SubmitButton>
        ))}

        {status === 'closed' && (
          <SubmitButton name="op" value="reopen" className="btn btn-sm btn-ghost" pendingLabel="…">
            Reopen a week
          </SubmitButton>
        )}
      </form>

      {state.error && <div className="error">{state.error}</div>}
      {!compact && status !== 'pending' && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
          Resolving pays every winning share {'$'}1.00 and returns the leftover pool plus fees to
          whoever seeded the market. It cannot be undone.
        </div>
      )}

      <Toast message={state.ok} />
    </div>
  );
}
