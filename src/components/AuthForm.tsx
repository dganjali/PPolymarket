'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, signupAction, type FormState } from '@/app/actions';
import { SubmitButton } from './ui';

const empty: FormState = {};

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next?: string }) {
  const action = mode === 'signup' ? signupAction : loginAction;
  const [state, formAction] = useActionState(action, empty);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input type="hidden" name="next" value={next ?? '/'} />

      {mode === 'signup' && (
        <div className="field">
          <label htmlFor="name">Display name</label>
          <input id="name" name="name" autoComplete="name" placeholder="Priya Raman" required />
        </div>
      )}

      <div className="field">
        <label htmlFor="handle">Handle</label>
        <input
          id="handle"
          name="handle"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="priya"
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

      {state.error && <div className="error">{state.error}</div>}

      <SubmitButton pendingLabel="…">
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </SubmitButton>

      <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-5)' }}>
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--gold)' }}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" style={{ color: 'var(--gold)' }}>
              Create an account
            </Link>
          </>
        )}
      </div>
    </form>
  );
}
