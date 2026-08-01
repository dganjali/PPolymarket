import Link from 'next/link';
import { redirect } from 'next/navigation';
import { markNotificationsReadAction } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import { notifications, unreadNotificationCount } from '@/lib/data';
import { relative } from '@/lib/format';

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/notifications');
  const [items, unread] = await Promise.all([notifications(user.id), unreadNotificationCount(user.id)]);

  return (
    <main className="auth" style={{ gap: 20, paddingTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/" className="btn btn-ghost btn-sm">←</Link>
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 25 }}>Notifications</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>
            {unread} unread
          </div>
        </div>
        {unread > 0 && (
          <form action={markNotificationsReadAction}>
            <button className="btn btn-ghost btn-sm" type="submit">Mark all read</button>
          </form>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => {
          const href = item.group_slug
            ? item.market_id
              ? `/g/${item.group_slug}/m/${item.market_id}`
              : `/g/${item.group_slug}`
            : '/';
          return (
            <Link
              key={item.id}
              href={href}
              className="card"
              style={{ padding: 13, display: 'flex', gap: 10, borderColor: item.read_at ? undefined : 'var(--gold-line)' }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  marginTop: 5,
                  flex: 'none',
                  background: item.read_at ? 'var(--line-3)' : 'var(--gold)',
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, lineHeight: 1.45 }}>{item.body}</span>
                <span className="mono" style={{ display: 'block', fontSize: 9.5, color: 'var(--dim-2)', marginTop: 5 }}>
                  {item.group_name ? `${item.group_name} · ` : ''}{relative(item.created_at)}
                </span>
              </span>
            </Link>
          );
        })}
        {items.length === 0 && <div className="empty">Nothing yet. Market reviews and admin actions will show up here.</div>}
      </div>
    </main>
  );
}
