import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { myGroups, unreadNotificationCount } from '@/lib/data';
import { money0 } from '@/lib/format';
import { Avatar } from '@/components/ui';
import { logoutAction } from '../actions';

export default async function GroupsPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/groups');

  const [groups, unread] = await Promise.all([myGroups(user.id), unreadNotificationCount(user.id)]);

  return (
    <main className="auth" style={{ gap: 24, paddingTop: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={user.name} src={user.avatar} size={38} radius={12} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{user.name}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-5)' }}>
              @{user.handle}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <Link href="/profile" className="btn btn-ghost btn-sm">Profile</Link>
          <Link href="/notifications" className="btn btn-ghost btn-sm">
            Alerts{unread ? ` · ${unread}` : ''}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
          </form>
        </div>
      </div>

      <div>
        <div className="display" style={{ fontSize: 27 }}>
          Your groups
        </div>
        <div className="lede" style={{ marginTop: 8 }}>
          Each group has its own bankroll, its own markets, and its own stakes.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/g/${g.slug}`}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13 }}
          >
            <Avatar name={g.name} size={38} radius={11} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{g.name}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                {g.members} member{g.members === 1 ? '' : 's'} · season {g.current_season}
                {g.role === 'admin' ? ' · admin' : ''}
                {g.visibility === 'public' ? ' · public' : ''}
              </div>
            </div>
            <div className="mono" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              {money0(g.balance)}
            </div>
          </Link>
        ))}

        {groups.length === 0 && (
          <div className="empty">
            You are not in a group yet. Join one with an invite code, or start your own and send the
            code around.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
        <Link href="/join" className="btn btn-primary">
          Join with an invite code
        </Link>
        <Link href="/discover" className="btn btn-ghost">
          Browse public communities
        </Link>
        <Link href="/new-group" className="btn btn-ghost">
          Start a new group
        </Link>
      </div>
    </main>
  );
}
