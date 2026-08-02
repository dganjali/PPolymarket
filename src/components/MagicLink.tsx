'use client';

import { useActionState } from 'react';
import { magicSignInAction, requestMagicLinkAction, type FormState } from '@/app/actions';
import { SubmitButton } from './ui';

const empty: FormState = {};

/** The "email me a link" half of the sign-in page. */
export function MagicLinkForm({ next, label }: { next?: string; label: string }) {
  const [state, formAction] = useActionState(requestMagicLinkAction, empty);

  if (state.ok) {
    return (
      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow" style={{ color: 'var(--gold)' }}>Link sent</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{state.ok}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
          Nothing in your inbox after a minute? Check spam, then try again.
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="next" value={next ?? '/groups'} />
      <div className="field">
        <label htmlFor="magicEmail">Email</label>
        <input
          id="magicEmail"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          required
        />
      </div>
      {state.error && <div className="error">{state.error}</div>}
      <SubmitButton className="btn btn-ghost" pendingLabel="Sending…">
        {label}
      </SubmitButton>
    </form>
  );
}

/** The button that actually spends a link. Deliberately not a GET. */
export function MagicConfirm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = useActionState(magicSignInAction, empty);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="token" value={token} />
      {state.error && <div className="error">{state.error}</div>}
      <SubmitButton pendingLabel="Signing you in…">Sign in as {email}</SubmitButton>
      <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.6, textAlign: 'center' }}>
        Not you? Close this page and nothing happens.
      </div>
    </form>
  );
}
