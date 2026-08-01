'use client';

import { useActionState, useState } from 'react';
import { joinGroupAction, type FormState } from '@/app/actions';
import { SubmitButton } from './ui';

export function JoinForm({ initialCode = '' }: { initialCode?: string }) {
  const [state, formAction] = useActionState(joinGroupAction, {} as FormState);
  const [code, setCode] = useState(initialCode);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="field">
        <label htmlFor="code">Invite code</label>
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="mono"
          style={{ fontSize: 17, letterSpacing: '0.22em' }}
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      {state.error && <div className="error">{state.error}</div>}
      {state.ok && <div className="notice">{state.ok}</div>}

      <SubmitButton pendingLabel="Joining…">Join group</SubmitButton>
    </form>
  );
}
