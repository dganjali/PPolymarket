'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, signupAction, type FormState } from '@/app/actions';
import { MagicLinkForm } from './MagicLink';
import { SubmitButton } from './ui';

const empty: FormState = {};

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--dim-2)' }}>
      <span className="divider" style={{ flex: 1 }} />
      <span className="mono" style={{ fontSize: 10 }}>OR</span>
      <span className="divider" style={{ flex: 1 }} />
    </div>
  );
}

export function AuthForm({
  mode,
  next,
  googleEnabled,
  externalError,
  configError,
}: {
  mode: 'login' | 'signup';
  next?: string;
  googleEnabled: boolean;
  externalError?: string;
  /** Set when the deployment itself cannot sign anybody in. */
  configError?: string;
}) {
  const action = mode === 'signup' ? signupAction : loginAction;
  const [state, formAction] = useActionState(action, empty);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {configError && (
        <div className="error" style={{ lineHeight: 1.55 }}>
          {configError}
        </div>
      )}
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="next" value={next ?? '/groups'} />

      {mode === 'signup' && (
        <>
          <div className="field">
            <label htmlFor="name">Display name</label>
            <input id="name" name="name" autoComplete="name" placeholder="Priya Raman" required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              required
            />
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor={mode === 'signup' ? 'handle' : 'identifier'}>
          {mode === 'signup' ? 'Handle' : 'Email or handle'}
        </label>
        <input
          id={mode === 'signup' ? 'handle' : 'identifier'}
          name={mode === 'signup' ? 'handle' : 'identifier'}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={mode === 'signup' ? 'priya' : 'you@example.com'}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder="••••••••"
          required
        />
      </div>

      {/* When the deployment itself is broken the banner above already says so. */}
      {!configError && (state.error || externalError) && (
        <div className="error">{state.error || externalError}</div>
      )}

      <SubmitButton pendingLabel="…">
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </SubmitButton>
    </form>

      <Divider />

      <MagicLinkForm
        next={next}
        label={mode === 'signup' ? 'Sign up with an email link' : 'Email me a sign-in link'}
      />

      {googleEnabled && (
        <a
          className="btn btn-ghost"
          href={`/api/auth/google?next=${encodeURIComponent(next ?? '/groups')}`}
          style={{ textAlign: 'center' }}
        >
          Continue with Google
        </a>
      )}

      <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-5)' }}>
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: 'var(--gold)' }}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: 'var(--gold)' }}>
              Create an account
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
