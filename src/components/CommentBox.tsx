'use client';

import { useActionState, useEffect, useRef } from 'react';
import { commentAction, type FormState } from '@/app/actions';
import { relative } from '@/lib/format';
import { Avatar, SubmitButton } from './ui';

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  name: string;
  handle: string;
}

export function CommentBox({
  slug,
  marketId,
  thread,
}: {
  slug: string;
  marketId: number;
  thread: Comment[];
}) {
  const [state, formAction] = useActionState(commentAction, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok !== undefined && !state.error) ref.current?.reset();
  }, [state]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="eyebrow">Comments · {thread.length}</div>

      <form ref={ref} action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="marketId" value={marketId} />
        <textarea
          name="body"
          rows={2}
          placeholder="Make your case…"
          maxLength={600}
          style={{ background: 'var(--card)', fontSize: 14 }}
          required
        />
        {state.error && <div className="error">{state.error}</div>}
        <SubmitButton className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} pendingLabel="Posting…">
          Post
        </SubmitButton>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {thread.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 10 }}>
            <Avatar name={c.name} size={28} radius={8} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--dim-2)' }}>
                  {relative(c.created_at)}
                </span>
              </div>
              <div
                style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-3)', marginTop: 3, whiteSpace: 'pre-wrap' }}
              >
                {c.body}
              </div>
            </div>
          </div>
        ))}
        {thread.length === 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim-2)' }}>
            No takes yet.
          </div>
        )}
      </div>
    </section>
  );
}
