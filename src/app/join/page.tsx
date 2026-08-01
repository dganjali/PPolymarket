import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { groupByCode, memberCount } from '@/lib/data';
import { dateLabel, money0 } from '@/lib/format';
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

  const preview = code ? await groupByCode(code) : undefined;
  const members = preview ? await memberCount(preview.id) : 0;

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
          Groups are invite-only. Everyone starts with the same fake bankroll — the only thing at
          stake is whatever your admin puts up.
        </div>
      </div>

      {preview && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={preview.name} size={44} radius={12} />
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{preview.name}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 3 }}>
                {members} members
              </div>
            </div>
          </div>
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
        </div>
      )}

      <JoinForm initialCode={code ?? ''} />

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
