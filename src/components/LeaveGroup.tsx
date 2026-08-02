'use client';

import { useActionState, useState } from 'react';
import { leaveGroupAction, type FormState } from '@/app/actions';
import { SubmitButton } from './ui';

/** Two taps to leave, because any bet still running is forfeited on the way out. */
export function LeaveGroup({
  slug,
  groupName,
  isOwner,
  openPositions,
}: {
  slug: string;
  groupName: string;
  isOwner: boolean;
  openPositions: number;
}) {
  const [state, formAction] = useActionState(leaveGroupAction, {} as FormState);
  const [confirming, setConfirming] = useState(false);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 6 }}>
      {state.error && <div className="error">{state.error}</div>}

      {confirming ? (
        <div className="card" style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Leave {groupName}?
            {isOwner
              ? ' You own this group — hand it to another admin from the admin panel first.'
              : openPositions > 0
                ? ` Your ${openPositions} open position${openPositions === 1 ? '' : 's'} would be forfeited, and rejoining this season would not issue a second bankroll.`
                : ' Rejoining this season would not issue a second bankroll.'}
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              Stay
            </button>
            {!isOwner && (
              <form action={formAction}>
                <input type="hidden" name="slug" value={slug} />
                <SubmitButton className="btn btn-no btn-sm" pendingLabel="Leaving…">
                  Leave for good
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setConfirming(true)}
        >
          Leave this group
        </button>
      )}
    </section>
  );
}
