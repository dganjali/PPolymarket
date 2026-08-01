'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, signupAction, type FormState } from '@/app/actions';
import { SubmitButton } from './ui';

const empty: FormState = {};

export function AuthForm({
  mode,
  next,
  googleEnabled,
  externalError,
}: {
  mode: 'login' | 'signup';
  next?: string;
  googleEnabled: boolean;
  externalError?: string;
}) {
  const action = mode === 'signup' ? signupAction : loginAction;
  const [state, formAction] = useActionState(action, empty);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="next" value={next ?? '/'} />

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

      {(state.error || externalError) && <div className="error">{state.error || externalError}</div>}

      <SubmitButton pendingLabel="…">
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </SubmitButton>

      {googleEnabled && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--dim-2)' }}>
            <span className="divider" style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 10 }}>OR</span>
            <span className="divider" style={{ flex: 1 }} />
          </div>
          <a
            className="btn btn-ghost"
            href={`/api/auth/google?next=${encodeURIComponent(next ?? '/')}`}
            style={{ textAlign: 'center' }}
          >
            Continue with Google
          </a>
        </>
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
    </form>
  );
}
