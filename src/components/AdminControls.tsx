'use client';

import { useActionState } from 'react';
import { marketAdminAction, type FormState } from '@/app/actions';
import type { Side } from '@/lib/amm';
import { SubmitButton, Toast } from './ui';

/** Market approval and evidence-backed resolution controls, scoped to one market. */
export function AdminMarketControls({
  slug,
  marketId,
  status,
  proposedOutcome,
  disputeCount = 0,
  canFinalize = true,
  compact = false,
}: {
  slug: string;
  marketId: number;
  status: string;
  proposedOutcome?: Side | null;
  disputeCount?: number;
  canFinalize?: boolean;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(marketAdminAction, {} as FormState);
  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="marketId" value={marketId} />
    </>
  );

  return (
    <div
      className={compact ? undefined : 'panel'}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {!compact && (
        <div className="eyebrow">
          {status === 'pending' ? 'Approval' : status === 'resolving' ? 'Resolution review' : 'Propose result'}
        </div>
      )}

      {status === 'pending' ? (
        <form action={formAction} style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {hidden}
          <SubmitButton name="op" value="approve" className="btn btn-sm pill-yes" style={{ flex: 1 }} pendingLabel="…">
            Approve
          </SubmitButton>
          <SubmitButton name="op" value="reject" className="btn btn-sm btn-ghost" style={{ flex: 1 }} pendingLabel="…">
            Reject
          </SubmitButton>
        </form>
      ) : (
        <>
          {status === 'resolving' && proposedOutcome && (
            <>
              <div className="notice">
                Proposed <strong>{proposedOutcome}</strong> · {disputeCount} dispute{disputeCount === 1 ? '' : 's'}
              </div>
              <form action={formAction} style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {hidden}
                <SubmitButton
                  name="op"
                  value="finalize"
                  className="btn btn-sm btn-primary"
                  style={{ flex: 1 }}
                  pendingLabel="…"
                  disabled={!canFinalize}
                  title={!canFinalize ? 'Available after the member review window, or as soon as someone disputes.' : undefined}
                >
                  Finalize {proposedOutcome}
                </SubmitButton>
                <SubmitButton name="op" value="reopen" className="btn btn-sm btn-ghost" pendingLabel="…">
                  Reopen
                </SubmitButton>
              </form>
              {!canFinalize && (
                <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
                  Waiting for the member review window. If nobody disputes, this result finalizes automatically.
                </div>
              )}
              <div className="divider" />
            </>
          )}

          <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hidden}
            <textarea
              name="evidence"
              rows={2}
              maxLength={1000}
              placeholder="Source or short explanation members can verify…"
              required
              style={{ fontSize: 12.5 }}
            />
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <SubmitButton name="op" value="propose-yes" className="btn btn-sm pill-yes" style={{ flex: 1 }} pendingLabel="…">
                {status === 'resolving' ? 'Revise to YES' : 'Propose YES'}
              </SubmitButton>
              <SubmitButton name="op" value="propose-no" className="btn btn-sm pill-no" style={{ flex: 1 }} pendingLabel="…">
                {status === 'resolving' ? 'Revise to NO' : 'Propose NO'}
              </SubmitButton>
            </div>
          </form>

          {status === 'closed' && (
            <form action={formAction}>
              {hidden}
              <SubmitButton name="op" value="reopen" className="btn btn-sm btn-ghost" pendingLabel="…">
                Reopen a week
              </SubmitButton>
            </form>
          )}
        </>
      )}

      {state.error && <div className="error">{state.error}</div>}
      {!compact && status !== 'pending' && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
          A proposed result stops trading and starts the group review window. Undisputed results finalize automatically.
        </div>
      )}
      <Toast message={state.ok} />
    </div>
  );
}
