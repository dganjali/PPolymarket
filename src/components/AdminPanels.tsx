'use client';

import { useActionState, useState } from 'react';
import {
  addMemberAction,
  announceAction,
  createInviteAction,
  kickMemberAction,
  membershipRequestAction,
  memberRoleAction,
  regenerateInviteAction,
  revokeInviteAction,
  startNextSeasonAction,
  transferOwnershipAction,
  updateSettingsAction,
  updateStakesAction,
  type FormState,
} from '@/app/actions';
import { money0, relative } from '@/lib/format';
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
  name,
  description,
  visibility,
  seasonEnds,
  marketLiquidity,
  disputeWindowHours,
  positionsPublic,
  requireApproval,
  requireMemberApproval,
}: {
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  seasonEnds: string | null;
  marketLiquidity: number;
  disputeWindowHours: number;
  positionsPublic: boolean;
  requireApproval: boolean;
  requireMemberApproval: boolean;
}) {
  const [state, formAction] = useActionState(updateSettingsAction, {} as FormState);
  const [isPublic, setPublic] = useState(visibility === 'public');

  return (
    <form action={formAction} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="visibility" value={isPublic ? 'public' : 'private'} />
      <div className="eyebrow">Group settings</div>

      <div className="field">
        <label htmlFor="groupName">Group name</label>
        <input id="groupName" name="name" defaultValue={name} maxLength={60} required />
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)' }}>
          The web address stays /g/{slug}.
        </div>
      </div>

      <div className="field">
        <label>Who can find this group</label>
        <div style={{ display: 'flex', gap: 7 }}>
          {([
            ['Invite only', false, 'Nobody sees it without a code or a link.'],
            ['Public', true, 'Listed in the directory — anyone can ask to join.'],
          ] as const).map(([label, value, hint]) => (
            <button
              key={label}
              type="button"
              onClick={() => setPublic(value)}
              title={hint}
              style={{
                flex: 1,
                padding: 9,
                borderRadius: 9,
                fontSize: 12.5,
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
            ? 'Anyone signed in can find this group and join. Keep member approval on if you still want to screen people.'
            : 'Only people holding an invite code or link can get in.'}
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">Directory blurb</label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={280}
          defaultValue={description}
          placeholder="Seniors betting on senior things. Ridgeview only."
          style={{ fontSize: 13.5 }}
        />
      </div>

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

function CopyLinkButton({ link, label = 'Copy invite link' }: { link: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
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
      {copied ? 'Copied' : label}
    </button>
  );
}

export interface InviteView {
  id: number;
  code: string;
  label: string;
  state: 'active' | 'revoked' | 'expired' | 'used up';
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  createdBy: string | null;
}

/**
 * The group's permanent code plus any number of named links that can be capped
 * by time or by headcount — one per class, per tryout, per whatever.
 */
export function InviteManager({
  slug,
  code,
  invites,
  origin,
}: {
  slug: string;
  code: string;
  invites: InviteView[];
  origin?: string;
}) {
  const [rotateState, rotateAction] = useActionState(regenerateInviteAction, {} as FormState);
  const [createState, createAction] = useActionState(createInviteAction, {} as FormState);
  const [revokeState, revokeAction] = useActionState(revokeInviteAction, {} as FormState);
  const [open, setOpen] = useState(false);
  const linkFor = (value: string) => `${origin ?? ''}/join?code=${value}`;

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="eyebrow">Invites</div>

      <div>
        <div
          className="mono"
          style={{ fontSize: 22, letterSpacing: '0.2em', color: 'var(--gold)', fontWeight: 600 }}
        >
          {code}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', marginTop: 4 }}>
          the group&rsquo;s standing code — never expires
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <CopyLinkButton link={linkFor(code)} />
        <form action={rotateAction}>
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Rotating…">
            Rotate
          </SubmitButton>
        </form>
      </div>
      {rotateState.error && <div className="error">{rotateState.error}</div>}

      <div className="divider" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="eyebrow" style={{ padding: 0 }}>
          Custom links · {invites.filter((i) => i.state === 'active').length} active
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : 'New link'}
        </button>
      </div>

      {open && (
        <form action={createAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="slug" value={slug} />
          <div className="field">
            <label htmlFor="label">What&rsquo;s it for</label>
            <input id="label" name="label" placeholder="Homeroom 4B" maxLength={60} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="expiresInHours">Expires</label>
              <select id="expiresInHours" name="expiresInHours" className="mono" defaultValue={168}>
                <option value={0}>never</option>
                <option value={1}>in 1 hour</option>
                <option value={24}>in 24 hours</option>
                <option value={72}>in 3 days</option>
                <option value={168}>in 7 days</option>
                <option value={720}>in 30 days</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="maxUses">Max uses</label>
              <input
                id="maxUses"
                name="maxUses"
                type="number"
                min={0}
                step={1}
                className="mono"
                placeholder="unlimited"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="code">Custom code</label>
            <input
              id="code"
              name="code"
              className="mono"
              placeholder="auto-generated"
              maxLength={24}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)' }}>
              4–24 letters, numbers, or dashes. Leave it blank for a random one.
            </div>
          </div>
          {createState.error && <div className="error">{createState.error}</div>}
          <SubmitButton className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} pendingLabel="Creating…">
            Create link
          </SubmitButton>
        </form>
      )}

      {invites.map((invite) => {
        const dead = invite.state !== 'active';
        return (
          <div
            key={invite.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingTop: 9,
              borderTop: '1px solid #262320',
              opacity: dead ? 0.55 : 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="mono"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: dead ? 'var(--dim)' : 'var(--gold)',
                  textDecoration: dead ? 'line-through' : 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {invite.code}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                {[
                  invite.label || null,
                  dead ? invite.state : invite.expiresAt ? `expires ${relative(invite.expiresAt)}` : 'no expiry',
                  invite.maxUses ? `${invite.uses}/${invite.maxUses} used` : `${invite.uses} used`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            {!dead && <CopyLinkButton link={linkFor(invite.code)} label="Copy" />}
            {!dead && (
              <form action={revokeAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="inviteId" value={invite.id} />
                <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                  Revoke
                </SubmitButton>
              </form>
            )}
          </div>
        );
      })}

      {invites.length === 0 && !open && (
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim-2)' }}>
          No custom links yet. Make one that expires when tryouts close.
        </div>
      )}

      {revokeState.error && <div className="error">{revokeState.error}</div>}
      <Toast message={rotateState.ok} />
      <Toast message={createState.ok} />
      <Toast message={revokeState.ok} />
    </div>
  );
}

/** A note straight to every member's inbox — season stakes, house rules, results. */
export function AnnouncementForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState(announceAction, {} as FormState);
  return (
    <form action={formAction} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="slug" value={slug} />
      <div className="eyebrow">Announce</div>
      <textarea
        name="body"
        rows={2}
        maxLength={600}
        placeholder="Prizes get handed out at lunch on Friday."
        style={{ fontSize: 13.5 }}
      />
      {state.error && <div className="error">{state.error}</div>}
      <SubmitButton className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} pendingLabel="Sending…">
        Send to every member
      </SubmitButton>
      <Toast message={state.ok} />
    </form>
  );
}

export interface MemberView {
  userId: number;
  name: string;
  handle: string;
  role: string;
  total: number;
  openPositions: number;
}

export function MemberList({
  slug,
  members,
  ownerId,
  canManageRoles,
}: {
  slug: string;
  members: MemberView[];
  ownerId: number;
  canManageRoles: boolean;
}) {
  const [state, formAction] = useActionState(kickMemberAction, {} as FormState);
  const [roleState, roleAction] = useActionState(memberRoleAction, {} as FormState);
  const [addState, addAction] = useActionState(addMemberAction, {} as FormState);
  const [ownerState, ownerAction] = useActionState(transferOwnershipAction, {} as FormState);
  const [confirming, setConfirming] = useState<number | null>(null);

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="eyebrow">Members · {members.length}</div>

      <form action={addAction} style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
        <input type="hidden" name="slug" value={slug} />
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="identifier">Add by handle or email</label>
          <input
            id="identifier"
            name="identifier"
            placeholder="@priya or priya@school.edu"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Adding…">
          Add
        </SubmitButton>
      </form>
      {addState.error && <div className="error">{addState.error}</div>}
      <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
        They join straight away with this season&rsquo;s bankroll. People without an account yet need
        an invite link instead.
      </div>

      {members.map((m) => {
        const isOwner = m.userId === ownerId;
        return (
          <div
            key={m.userId}
            style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 9, borderTop: '1px solid #262320' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
                  @{m.handle}
                  {isOwner ? ' · owner' : m.role === 'admin' ? ' · admin' : ''} · {money0(m.total)}
                  {m.openPositions > 0 ? ` · ${m.openPositions} open` : ''}
                </div>
              </div>
              {!isOwner && (
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
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirming(confirming === m.userId ? null : m.userId)}
                  >
                    {confirming === m.userId ? 'Keep' : 'Remove'}
                  </button>
                </div>
              )}
            </div>

            {confirming === m.userId && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  background: '#251A18',
                  border: '1px solid #3E2B27',
                }}
              >
                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-4)' }}>
                  Remove {m.name} from the group?
                  {m.openPositions > 0
                    ? ` They hold ${m.openPositions} open position${m.openPositions === 1 ? '' : 's'} — forfeiting drops those shares and leaves the stake in the market.`
                    : ' Their trade history stays in the group log.'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.openPositions === 0 && (
                    <form action={formAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <SubmitButton className="btn btn-no btn-sm" pendingLabel="Removing…">
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                  {m.openPositions > 0 && (
                    <form action={formAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <input type="hidden" name="force" value="1" />
                      <SubmitButton className="btn btn-no btn-sm" pendingLabel="Removing…">
                        Remove and forfeit
                      </SubmitButton>
                    </form>
                  )}
                  {canManageRoles && (
                    <form action={ownerAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                        Hand the group over instead
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {state.error && <div className="error">{state.error}</div>}
      {roleState.error && <div className="error">{roleState.error}</div>}
      {ownerState.error && <div className="error">{ownerState.error}</div>}
      <Toast message={state.ok} />
      <Toast message={roleState.ok} />
      <Toast message={addState.ok} />
      <Toast message={ownerState.ok} />
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

/**
 * Closing a season is the one irreversible admin action, so it shows exactly
 * who is about to be crowned and who is about to owe the punishment first.
 */
export function SeasonControls({
  slug,
  currentSeason,
  unfinishedMarkets,
  prize,
  punishment,
  champion,
  lastPlace,
}: {
  slug: string;
  currentSeason: number;
  unfinishedMarkets: number;
  prize: string;
  punishment: string;
  champion?: { name: string; total: number };
  lastPlace?: { name: string; total: number };
}) {
  const [state, formAction] = useActionState(startNextSeasonAction, {} as FormState);
  const [open, setOpen] = useState(false);
  const blocked = unfinishedMarkets > 0;

  return (
    <form action={formAction} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <input type="hidden" name="slug" value={slug} />
      <div className="eyebrow">Season {currentSeason}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            padding: '9px 11px',
            borderRadius: 10,
            background: 'var(--gold-bg)',
            border: '1px solid var(--gold-line)',
          }}
        >
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--gold)' }}>
            WINNING
          </div>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{champion?.name ?? 'nobody yet'}</div>
          {champion && <div className="mono" style={{ fontSize: 12 }}>{money0(champion.total)}</div>}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-4)', paddingLeft: 2 }}>
          {prize || 'No prize set — add one above before you close the season.'}
        </div>
        {lastPlace && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '9px 11px',
                borderRadius: 10,
                background: '#251A18',
                border: '1px solid #3E2B27',
              }}
            >
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--no-hi)' }}>
                LAST
              </div>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{lastPlace.name}</div>
              <div className="mono" style={{ fontSize: 12 }}>{money0(lastPlace.total)}</div>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-4)', paddingLeft: 2 }}>
              {punishment || 'No punishment set.'}
            </div>
          </>
        )}
      </div>

      <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
        Closing the season archives these standings, announces the result to everyone, and resets each
        member to the starting bankroll. It cannot be undone.
      </div>

      <div className="field">
        <label htmlFor="nextSeasonEnds">Next season ends</label>
        <input id="nextSeasonEnds" name="seasonEnds" type="date" className="mono" />
      </div>

      <div className="field">
        <label htmlFor="note">Note for the announcement</label>
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={600}
          placeholder="Trophy gets handed over at Friday's assembly."
          style={{ fontSize: 13.5 }}
        />
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Keep the same stakes' : 'Set new stakes for next season'}
      </button>

      {open && (
        <>
          <div className="field">
            <label htmlFor="nextPrize">Next season&rsquo;s prize</label>
            <textarea id="nextPrize" name="nextPrize" rows={2} defaultValue={prize} style={{ fontSize: 13.5 }} />
          </div>
          <div className="field">
            <label htmlFor="nextPunishment">Next season&rsquo;s punishment</label>
            <textarea
              id="nextPunishment"
              name="nextPunishment"
              rows={2}
              defaultValue={punishment}
              style={{ fontSize: 13.5 }}
            />
          </div>
        </>
      )}

      {blocked && (
        <div className="notice">
          {unfinishedMarkets} market{unfinishedMarkets === 1 ? '' : 's'} must be resolved or rejected first.
        </div>
      )}
      {state.error && <div className="error">{state.error}</div>}
      <SubmitButton
        className="btn btn-primary btn-sm"
        style={{ alignSelf: 'flex-start' }}
        disabled={blocked}
        pendingLabel="Closing…"
      >
        Close season {currentSeason} and crown {champion?.name ?? 'nobody'}
      </SubmitButton>
      <Toast message={state.ok} />
    </form>
  );
}
