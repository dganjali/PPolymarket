import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { notifications, unreadNotificationCount } from '@/lib/data';
import { relative } from '@/lib/format';
import { Bell, Check, Chevron, Shield, Sparkle, Trophy } from '@/components/Icon';
import { MarkRead } from '@/components/MarkRead';

/**
 * One glyph per notification kind, so the inbox is scannable without reading.
 * Keys are the exact `kind` values engine.ts writes.
 */
const KIND_ICONS: Record<string, (props: { size?: number }) => React.ReactElement> = {
  market: Sparkle,
  resolution: Trophy,
  member: Check,
  admin: Shield,
  role: Shield,
  season: Trophy,
  announcement: Bell,
};

/** Day headings, so a busy week does not read as one undifferentiated list. */
function dayOf(iso: string): string {
  const at = new Date(`${iso.replace(' ', 'T')}Z`);
  const today = new Date();
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return at.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/notifications');
  const [items, unread] = await Promise.all([notifications(user.id), unreadNotificationCount(user.id)]);

  // Group by day in one pass, keeping the order the query returned.
  const days: { label: string; items: typeof items }[] = [];
  for (const item of items) {
    const label = dayOf(item.created_at);
    const bucket = days[days.length - 1];
    if (bucket && bucket.label === label) bucket.items.push(item);
    else days.push({ label, items: [item] });
  }

  return (
    <main className="account stack stagger">
      {/* Opening this page is reading them; the badge comes down with it. */}
      <MarkRead unread={unread} />

      <header className="inbox-head">
        <Link href="/groups" className="btn btn-ghost btn-sm pressable icon-btn" aria-label="Back to your groups">
          <Chevron dir="left" size={16} />
        </Link>
        <div>
          <h1 className="h-title">Notifications</h1>
          <div className="mono t-micro inbox-count">{unread ? `${unread} new` : 'all caught up'}</div>
        </div>
      </header>

      {days.map((day) => (
        <section key={day.label} className="stack-tight">
          <div className="inbox-day">{day.label}</div>
          {day.items.map((item) => {
            const href = item.group_slug
              ? item.market_id
                ? `/g/${item.group_slug}/m/${item.market_id}`
                : `/g/${item.group_slug}`
              : '/';
            const Icon = KIND_ICONS[item.kind] ?? Bell;
            return (
              <Link key={item.id} href={href} className="inbox-row liftable" data-unread={!item.read_at}>
                <span className="inbox-icon">
                  <Icon size={15} />
                </span>
                <span className="inbox-main">
                  <span className="inbox-body">{item.body}</span>
                  <span className="mono inbox-meta">
                    {item.group_name ? `${item.group_name} · ` : ''}
                    {relative(item.created_at)}
                  </span>
                </span>
              </Link>
            );
          })}
        </section>
      ))}

      {items.length === 0 && (
        <div className="empty">Nothing yet. Market reviews and admin actions will show up here.</div>
      )}
    </main>
  );
}
