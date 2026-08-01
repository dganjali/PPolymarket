'use client';

import { useActionState } from 'react';
import { createGroupAction, type FormState } from '@/app/actions';
import { SubmitButton } from './ui';

export function NewGroupForm() {
  const [state, formAction] = useActionState(createGroupAction, {} as FormState);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field">
        <label htmlFor="name">Group name</label>
        <input id="name" name="name" placeholder="Ridgeview Class of '26" required />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="startingBalance">Starting bankroll</label>
          <input
            id="startingBalance"
            name="startingBalance"
            type="number"
            min={100}
            step={100}
            defaultValue={2500}
            className="mono"
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="seasonEnds">Season ends</label>
          <input id="seasonEnds" name="seasonEnds" type="date" className="mono" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="prize">Season prize</label>
        <textarea
          id="prize"
          name="prize"
          rows={2}
          placeholder="Winner gets the good parking spot for all of senior spring."
        />
      </div>

      <div className="field">
        <label htmlFor="punishment">Last place</label>
        <textarea
          id="punishment"
          name="punishment"
          rows={2}
          placeholder="Last place does the announcements in a full mascot suit."
        />
      </div>

      <div className="notice">
        No real money moves through Minimarket. Balances are points; the prize and the punishment are
        whatever your group agrees to and settles in person.
      </div>

      {state.error && <div className="error">{state.error}</div>}

      <SubmitButton pendingLabel="Creating…">Create group</SubmitButton>
    </form>
  );
}
