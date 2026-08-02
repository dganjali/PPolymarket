import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import {
  groupByAnyCode,
  inviteState,
  memberCount,
  membership,
  membershipRequestFor,
} from '@/lib/data';
import { dateLabel, money0, relative } from '@/lib/format';
import { JoinForm } from '@/components/JoinForm';
import { Avatar } from '@/components/ui';

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await currentUser();
  const { code } = await searchParams;
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join${code ? `?code=${code}` : ''}`)}`);

  const found = code ? await groupByAnyCode(code) : undefined;
  const preview = found?.group;
  const invite = found?.invite;
  const state = invite ? inviteState(invite) : 'active';

  if (preview && (await membership(user.id, preview.id))) redirect(`/g/${preview.slug}`);
  const [members, pendingRequest] = preview
    ? await Promise.all([memberCount(preview.id), membershipRequestFor(user.id, preview.id)])
    : [0, undefined];

  return (
    <main className="auth" style={{ gap: 22 }}>
      <div className="logo">M</div>
      <div>
        <div className="display">
          You&rsquo;ve been invited
          <br />
          to a market.
        </div>
        <div className="lede" style={{ marginTop: 10 }}>
          Everyone starts with the same fake bankroll — the only thing really at stake is whatever your admin
          puts up.
        </div>
      </div>

      {code && !preview && (
        <div className="error">No group with that invite code. Check it with whoever sent it.</div>
      )}

      {preview && state !== 'active' && (
        <div className="error">
          This invite link is {state}. Ask an admin of {preview.name} for a fresh one
          {preview.visibility === 'public' ? ', or find the group in the public directory' : ''}.
        </div>
      )}

      {preview && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={preview.name} size={44} radius={12} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{preview.name}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 3 }}>
                {members} member{members === 1 ? '' : 's'} · season {preview.current_season} ·{' '}
                {preview.visibility === 'public' ? 'public' : 'invite only'}
              </div>
            </div>
          </div>

          {preview.description && (
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-4)' }}>{preview.description}</div>
          )}

          <div className="divider" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="stat-label">Starting balance</div>
              <div className="stat-value">{money0(preview.starting_balance)}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="stat-label">Season ends</div>
              <div className="stat-value">
                {preview.season_ends ? dateLabel(preview.season_ends) : 'Open'}
              </div>
            </div>
          </div>

          {preview.prize && (
            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink-3)' }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
                PLAYING FOR{' '}
              </span>
              {preview.prize}
            </div>
          )}

          {invite && state === 'active' && (invite.expires_at || invite.max_uses) && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)' }}>
              {[
                invite.expires_at ? `link expires ${relative(invite.expires_at)}` : null,
                invite.max_uses ? `${invite.max_uses - invite.uses} spot${invite.max_uses - invite.uses === 1 ? '' : 's'} left` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}

          {!!preview.require_member_approval && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.55 }}>
              An admin approves new members here, so your bankroll is issued once they do.
            </div>
          )}
        </div>
      )}

      {pendingRequest ? (
        <div className="notice">
          Your request is with the admins — you&rsquo;ll get an alert the moment they decide.
        </div>
      ) : (
        <JoinForm initialCode={code ?? ''} />
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href="/discover" className="btn btn-ghost">
          Browse public communities
        </Link>
        <Link href="/new-group" className="btn btn-ghost">
          Start a new group instead
        </Link>
        <Link
          href="/groups"
          style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-5)', padding: '4px 0' }}
        >
          Back to your groups
        </Link>
      </div>
    </main>
  );
}
