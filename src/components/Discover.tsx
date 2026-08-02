'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { joinPublicGroupAction, type FormState } from '@/app/actions';
import { money0 } from '@/lib/format';
import { Avatar, SubmitButton } from './ui';

export interface DirectoryGroup {
  id: number;
  slug: string;
  name: string;
  description: string;
  members: number;
  liveMarkets: number;
  startingBalance: number;
  prize: string;
  season: number;
  screened: boolean;
  joined: boolean;
  requested: boolean;
}

/** The public directory. Private groups never appear here — only invites reach those. */
export function Directory({ groups }: { groups: DirectoryGroup[] }) {
  const [state, formAction] = useActionState(joinPublicGroupAction, {} as FormState);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {state.error && <div className="error">{state.error}</div>}
      {state.ok && <div className="notice">{state.ok}</div>}

      {groups.map((g) => (
        <div key={g.id} className="card" style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={g.name} size={38} radius={11} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{g.name}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                {g.members} member{g.members === 1 ? '' : 's'} · {g.liveMarkets} live · season {g.season}
              </div>
            </div>
            {g.joined ? (
              <Link href={`/g/${g.slug}`} className="btn btn-ghost btn-sm">
                Open
              </Link>
            ) : g.requested ? (
              <span className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
                REQUESTED
              </span>
            ) : (
              <form action={formAction}>
                <input type="hidden" name="groupId" value={g.id} />
                <SubmitButton className="btn btn-primary btn-sm" pendingLabel="…">
                  {g.screened ? 'Ask to join' : 'Join'}
                </SubmitButton>
              </form>
            )}
          </div>

          {g.description && (
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-4)' }}>{g.description}</div>
          )}

          <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)' }}>
            {money0(g.startingBalance)} to start
            {g.prize ? ` · playing for ${g.prize.toLowerCase()}` : ''}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div className="empty">
          No public communities yet. Start one and switch it to public in the admin panel, or join a
          private group with an invite code.
        </div>
      )}
    </div>
  );
}
