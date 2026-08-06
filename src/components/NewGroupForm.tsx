'use client';

import { useActionState, useState } from 'react';
import { createGroupAction, type FormState } from '@/app/actions';
import { SubmitButton } from './ui';

export function NewGroupForm() {
  const [state, formAction] = useActionState(createGroupAction, {} as FormState);
  const [isPublic, setPublic] = useState(false);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input type="hidden" name="visibility" value={isPublic ? 'public' : 'private'} />

      <div className="field">
        <label htmlFor="name">Group name</label>
        <input id="name" name="name" placeholder="Ridgeview Class of '26" required />
      </div>

      <div className="field">
        <label>Who can find it</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {([
            ['Invite only', false],
            ['Public', true],
          ] as const).map(([label, value]) => (
            <button
              key={label}
              type="button"
              onClick={() => setPublic(value)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                background: isPublic === value ? 'var(--gold-bg)' : '#211F1D',
                border: `1px solid ${isPublic === value ? 'var(--gold-line)' : 'var(--line-3)'}`,
                color: isPublic === value ? 'var(--gold)' : 'var(--ink-4)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
          {isPublic
            ? 'Listed in the public directory. Anyone signed in can ask to join.'
            : 'Nobody gets in without an invite code or link. You can change this later.'}
        </div>
      </div>

      {isPublic && (
        <div className="field">
          <label htmlFor="description">Directory blurb</label>
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={280}
            placeholder="Seniors betting on senior things. Ridgeview only."
          />
        </div>
      )}

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

      <div className="field">
        <label>Who can open a market</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 400 }}>
          <input
            type="checkbox"
            name="requireApproval"
            style={{ width: 18, height: 18, accentColor: 'var(--gold)', flex: 'none' }}
          />
          Hold members&rsquo; questions for my approval first
        </label>
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
          Off by default: anyone in the group can put a question up and it goes live. Turn it on if you
          would rather see each one first — either way you can change it in the group&rsquo;s settings.
        </div>
      </div>

      <div className="field">
        <label>New members</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 400 }}>
          <input
            type="checkbox"
            name="requireMemberApproval"
            defaultChecked={isPublic}
            key={isPublic ? 'public' : 'private'}
            style={{ width: 18, height: 18, accentColor: 'var(--gold)', flex: 'none' }}
          />
          Approve people before issuing a bankroll
        </label>
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
          Anyone holding an invite link is admitted straight away regardless — this screens the people
          who find the group on their own.
        </div>
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
