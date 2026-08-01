'use client';

import { useActionState, useState } from 'react';
import {
  kickMemberAction,
  membershipRequestAction,
  memberRoleAction,
  regenerateInviteAction,
  startNextSeasonAction,
  updateSettingsAction,
  updateStakesAction,
  type FormState,
} from '@/app/actions';
import { SubmitButton, Toast } from './ui';

/** Prize / punishment editor — one textarea, two modes, like the design. */
export function StakesEditor({
  slug,
  prize,
  punishment,
}: {
  slug: string;
  prize: string;
  punishment: string;
}) {
  const [state, formAction] = useActionState(updateStakesAction, {} as FormState);
  const [mode, setMode] = useState<'prize' | 'punishment'>('prize');
  const [text, setText] = useState(prize);

  const swap = (next: 'prize' | 'punishment') => {
    setMode(next);
    setText(next === 'prize' ? prize : punishment);
  };

  return (
    <form action={formAction} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="mode" value={mode} />

      <div className="eyebrow">Season stakes</div>

      <div style={{ display: 'flex', gap: 7 }}>
        <button
          type="button"
          onClick={() => swap('prize')}
          style={{
            flex: 1,
            padding: 9,
            borderRadius: 9,
            fontSize: 12.5,
            fontWeight: 600,
            background: mode === 'prize' ? 'var(--gold-bg)' : '#211F1D',
            border: `1px solid ${mode === 'prize' ? 'var(--gold-line)' : 'var(--line-3)'}`,
            color: mode === 'prize' ? 'var(--gold)' : 'var(--ink-4)',
          }}
        >
          Prize
        </button>
        <button
          type="button"
          onClick={() => swap('punishment')}
          style={{
            flex: 1,
            padding: 9,
            borderRadius: 9,
            fontSize: 12.5,
            fontWeight: 600,
            background: mode === 'punishment' ? '#251A18' : '#211F1D',
            border: `1px solid ${mode === 'punishment' ? '#3E2B27' : 'var(--line-3)'}`,
            color: mode === 'punishment' ? 'var(--no-hi)' : 'var(--ink-4)',
          }}
        >
          Punishment
        </button>
      </div>

      <textarea
        name="text"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          mode === 'prize'
            ? 'Winner gets the good parking spot for all of senior spring.'
            : 'Last place does the announcements in a full mascot suit.'
        }
        style={{ fontSize: 13.5 }}
      />

      {state.error && <div className="error">{state.error}</div>}

      <SubmitButton className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} pendingLabel="Saving…">
        Save for the group
      </SubmitButton>

      <Toast message={state.ok} />
    </form>
  );
}

export function SettingsForm({
  slug,
  seasonEnds,
  marketLiquidity,
  disputeWindowHours,
  positionsPublic,
  requireApproval,
  requireMemberApproval,
}: {
  slug: string;
  seasonEnds: string | null;
  marketLiquidity: number;
  disputeWindowHours: number;
  positionsPublic: boolean;
  requireApproval: boolean;
  requireMemberApproval: boolean;
}) {
  const [state, formAction] = useActionState(updateSettingsAction, {} as FormState);

  return (
    <form action={formAction} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="slug" value={slug} />
      <div className="eyebrow">Group settings</div>

      <div className="field">
        <label htmlFor="seasonEnds">Season ends</label>
        <input
          id="seasonEnds"
          name="seasonEnds"
          type="date"
          className="mono"
          defaultValue={seasonEnds ? seasonEnds.slice(0, 10) : ''}
        />
      </div>

      <div className="field">
        <label htmlFor="marketLiquidity">House liquidity per market</label>
        <input
          id="marketLiquidity"
          name="marketLiquidity"
          type="number"
          min={100}
          step={100}
          className="mono"
          defaultValue={marketLiquidity}
        />
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
          The group underwrites this much of every new market so one order can&rsquo;t swing it end
          to end. Deeper pools move less per trade. Existing markets keep the depth they opened with.
        </div>
      </div>

      <div className="field">
        <label htmlFor="disputeWindowHours">Result review window</label>
        <select
          id="disputeWindowHours"
          name="disputeWindowHours"
          defaultValue={disputeWindowHours}
          className="mono"
        >
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
          <option value={72}>3 days</option>
          <option value={168}>7 days</option>
        </select>
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
          Members can dispute an admin&rsquo;s proposed result during this window.
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
        <input
          type="checkbox"
          name="positionsPublic"
          defaultChecked={positionsPublic}
          style={{ width: 18, height: 18, accentColor: 'var(--gold)', flex: 'none' }}
        />
        Show who&rsquo;s on each side of a market
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
        <input
          type="checkbox"
          name="requireApproval"
          defaultChecked={requireApproval}
          style={{ width: 18, height: 18, accentColor: 'var(--gold)', flex: 'none' }}
        />
        Member markets need your approval
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
        <input
          type="checkbox"
          name="requireMemberApproval"
          defaultChecked={requireMemberApproval}
          style={{ width: 18, height: 18, accentColor: 'var(--gold)', flex: 'none' }}
        />
        Approve new members before issuing a bankroll
      </label>

      {state.error && <div className="error">{state.error}</div>}

      <SubmitButton className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} pendingLabel="Saving…">
        Save settings
      </SubmitButton>

      <Toast message={state.ok} />
    </form>
  );
}

export function InviteCode({ slug, code, origin }: { slug: string; code: string; origin?: string }) {
  const [copied, setCopied] = useState(false);
  const [state, formAction] = useActionState(regenerateInviteAction, {} as FormState);
  const link = `${origin ?? ''}/join?code=${code}`;

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eyebrow">Invite code</div>
      <div
        className="mono"
        style={{ fontSize: 22, letterSpacing: '0.2em', color: 'var(--gold)', fontWeight: 600 }}
      >
        {code}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          navigator.clipboard?.writeText(link).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            },
            () => setCopied(false),
          );
        }}
      >
        {copied ? 'Copied' : 'Copy invite link'}
      </button>
      <form action={formAction}>
        <input type="hidden" name="slug" value={slug} />
        <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Rotating…">
          Rotate invite code
        </SubmitButton>
      </form>
      {state.error && <div className="error">{state.error}</div>}
      <Toast message={state.ok} />
    </div>
  );
}

export function MemberList({
  slug,
  members,
  ownerId,
  canManageRoles,
}: {
  slug: string;
  members: { userId: number; name: string; handle: string; role: string }[];
  ownerId: number;
  canManageRoles: boolean;
}) {
  const [state, formAction] = useActionState(kickMemberAction, {} as FormState);
  const [roleState, roleAction] = useActionState(memberRoleAction, {} as FormState);

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eyebrow">Members · {members.length}</div>
      {members.map((m) => (
        <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
              @{m.handle}
              {m.userId === ownerId ? ' · owner' : m.role === 'admin' ? ' · admin' : ''}
            </div>
          </div>
          {m.userId !== ownerId && (
            <div style={{ display: 'flex', gap: 6 }}>
              {canManageRoles && (
                <form action={roleAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <input type="hidden" name="role" value={m.role === 'admin' ? 'member' : 'admin'} />
                  <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                    {m.role === 'admin' ? 'Demote' : 'Make admin'}
                  </SubmitButton>
                </form>
              )}
              <form action={formAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="userId" value={m.userId} />
                <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                  Remove
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      ))}
      {state.error && <div className="error">{state.error}</div>}
      {roleState.error && <div className="error">{roleState.error}</div>}
      <Toast message={state.ok} />
      <Toast message={roleState.ok} />
    </div>
  );
}

export function MembershipRequests({
  slug,
  requests,
}: {
  slug: string;
  requests: { user_id: number; name: string; handle: string; email: string | null }[];
}) {
  const [state, formAction] = useActionState(membershipRequestAction, {} as FormState);
  if (!requests.length) return null;

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eyebrow">Join requests · {requests.length}</div>
      {requests.map((request) => (
        <div key={request.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{request.name}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
              @{request.handle}{request.email ? ` · ${request.email}` : ''}
            </div>
          </div>
          <form action={formAction} style={{ display: 'flex', gap: 6 }}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="userId" value={request.user_id} />
            <SubmitButton name="decision" value="approve" className="btn btn-sm btn-primary" pendingLabel="…">
              Approve
            </SubmitButton>
            <SubmitButton name="decision" value="reject" className="btn btn-sm btn-ghost" pendingLabel="…">
              Decline
            </SubmitButton>
          </form>
        </div>
      ))}
      {state.error && <div className="error">{state.error}</div>}
      <Toast message={state.ok} />
    </div>
  );
}

export function SeasonControls({
  slug,
  currentSeason,
  unfinishedMarkets,
}: {
  slug: string;
  currentSeason: number;
  unfinishedMarkets: number;
}) {
  const [state, formAction] = useActionState(startNextSeasonAction, {} as FormState);
  return (
    <form action={formAction} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="slug" value={slug} />
      <div className="eyebrow">Season {currentSeason}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-4)' }}>
        Starting a new season archives the final standings and resets every member to the starting bankroll.
      </div>
      <div className="field">
        <label htmlFor="nextSeasonEnds">Next season ends</label>
        <input id="nextSeasonEnds" name="seasonEnds" type="date" className="mono" />
      </div>
      {unfinishedMarkets > 0 && (
        <div className="notice">
          {unfinishedMarkets} market{unfinishedMarkets === 1 ? '' : 's'} must be resolved or rejected first.
        </div>
      )}
      {state.error && <div className="error">{state.error}</div>}
      <SubmitButton
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: 'flex-start' }}
        disabled={unfinishedMarkets > 0}
        pendingLabel="Starting…"
      >
        Archive season and reset
      </SubmitButton>
      <Toast message={state.ok} />
    </form>
  );
}
