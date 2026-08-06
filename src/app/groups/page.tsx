import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { myGroups, unreadNotificationCount } from '@/lib/data';
import { money0 } from '@/lib/format';
import { Bell, Person, Plus } from '@/components/Icon';
import { Avatar } from '@/components/Avatar';
import { logoutAction } from '../actions';

export default async function GroupsPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/groups');

  const [groups, unread] = await Promise.all([myGroups(user.id), unreadNotificationCount(user.id)]);

  return (
    <main className="account stack stagger">
      <header className="groups-head">
        <div className="groups-me">
          <Avatar name={user.name} src={user.avatar} size={40} radius={13} />
          <div>
            <div className="groups-me-name">{user.name}</div>
            <div className="groups-me-handle">@{user.handle}</div>
          </div>
        </div>
        {/* Sign out is deliberately last and unadorned: it and "Profile" used to
            be three identical pills, so the destructive one read as routine. */}
        <div className="groups-actions">
          <Link href="/profile" className="btn btn-ghost btn-sm pressable icon-btn" aria-label="Profile">
            <Person size={15} />
          </Link>
          <Link href="/notifications" className="btn btn-ghost btn-sm pressable icon-btn" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}>
            <Bell size={15} />
            {!!unread && <span className="nav-badge mono">{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn-sm pressable">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div>
        <h1 className="h-display">Your groups</h1>
        <p className="lede auth-lede">
          Each group has its own bankroll, its own markets, and its own stakes.
        </p>
      </div>

      <section className="stack-tight">
        {groups.map((g) => (
          <Link key={g.id} href={`/g/${g.slug}`} className="group-card liftable">
            <Avatar name={g.name} size={40} radius={13} />
            <div className="group-card-main">
              <div className="group-card-name">{g.name}</div>
              <div className="group-card-sub">
                <span>
                  {g.members} member{g.members === 1 ? '' : 's'}
                </span>
                <span className="mk-dot" />
                <span>season {g.current_season}</span>
                {g.visibility === 'public' && (
                  <>
                    <span className="mk-dot" />
                    <span>public</span>
                  </>
                )}
              </div>
            </div>
            <div className="group-card-figure">
              <div className="group-card-cash">{money0(g.balance)}</div>
              {g.role === 'admin' && <div className="group-card-role">admin</div>}
            </div>
          </Link>
        ))}

        {groups.length === 0 && (
          <div className="empty">
            You are not in a group yet. Join one with an invite code, or start your own and send the
            code around.
          </div>
        )}
      </section>

      {/* One primary action, two alternatives — not three identical walls. */}
      <Link href="/join" className="btn btn-primary pressable">
        Join with an invite code
      </Link>
      <div className="groups-cta">
        <Link href="/discover" className="btn btn-ghost btn-sm pressable">
          Browse public communities
        </Link>
        <Link href="/new-group" className="btn btn-ghost btn-sm pressable" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={14} weight={2} />
          Start a new group
        </Link>
      </div>

      <Link href="/pricing" className="t-micro" style={{ color: 'var(--dim)' }}>
        Plans and pricing →
      </Link>
    </main>
  );
}
