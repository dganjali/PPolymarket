'use client';

import { useActionState } from 'react';
import { disputeResolutionAction, type FormState } from '@/app/actions';
import { SubmitButton, Toast } from './ui';

export function DisputeForm({
  slug,
  marketId,
  existingReason,
}: {
  slug: string;
  marketId: number;
  existingReason?: string;
}) {
  const [state, formAction] = useActionState(disputeResolutionAction, {} as FormState);
  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="marketId" value={marketId} />
      <textarea
        name="reason"
        rows={2}
        maxLength={600}
        defaultValue={existingReason}
        placeholder="Explain what is wrong and include a better source…"
        required
        style={{ fontSize: 12.5 }}
      />
      {state.error && <div className="error">{state.error}</div>}
      <SubmitButton className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} pendingLabel="Submitting…">
        {existingReason ? 'Update dispute' : 'Dispute this result'}
      </SubmitButton>
      <Toast message={state.ok} />
    </form>
  );
}
