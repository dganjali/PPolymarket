import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { groupBySlug, memberCount, membership, myGroups, standings, unreadNotificationCount } from '@/lib/data';
import { sweepClosures, sweepResolutions } from '@/lib/engine';
import { money, signedMoney } from '@/lib/format';
import { CreateFab, SidebarNav, TabBar, type NavItem } from '@/components/Nav';
import { Avatar } from '@/components/ui';

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/g/${slug}`)}`);

  const group = await groupBySlug(slug);
  if (!group) notFound();

  const ms = await membership(user.id, group.id);
  if (!ms) redirect('/join');

  await sweepClosures(group.id);
  await sweepResolutions(group.id);

  const base = `/g/${slug}`;
  const isAdmin = ms.role === 'admin';

  const navItems: NavItem[] = [
    { href: base, label: 'Markets', exact: true },
    { href: `${base}/portfolio`, label: 'Portfolio' },
    { href: `${base}/leaderboard`, label: 'Leaderboard' },
    { href: `${base}/activity`, label: 'Activity' },
    ...(isAdmin ? [{ href: `${base}/admin`, label: 'Admin' }] : []),
  ];

  const tabItems: NavItem[] = [
    { href: base, label: 'Markets', exact: true },
    { href: `${base}/portfolio`, label: 'Portfolio' },
    { href: `${base}/leaderboard`, label: 'Board' },
    ...(isAdmin
      ? [{ href: `${base}/admin`, label: 'Admin' }]
      : [{ href: `${base}/activity`, label: 'Activity' }]),
    { href: '/groups', label: 'You' },
  ];

  const rows = await standings(group.id, group.starting_balance);
  const mine = rows.find((r) => r.userId === user.id);
  const total = mine?.total ?? ms.balance;
  const pnl = total - group.starting_balance;
  const [groups, unread, members] = await Promise.all([
    myGroups(user.id),
    unreadNotificationCount(user.id),
    memberCount(group.id),
  ]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/groups" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px' }}>
          <div
            className="logo"
            style={{ width: 24, height: 24, borderRadius: 7, fontSize: 12 }}
          >
            M
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Minimarket</div>
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="eyebrow" style={{ padding: '0 5px 3px' }}>
            Groups
          </div>
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/g/${g.slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 6px',
                borderRadius: 9,
                background: g.id === group.id ? 'var(--gold-bg)' : 'transparent',
              }}
            >
              <Avatar name={g.name} size={24} radius={7} />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: g.id === group.id ? 'var(--ink)' : 'var(--ink-4)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {g.name}
              </div>
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="eyebrow" style={{ padding: '0 5px 5px' }}>
            {group.name}
          </div>
          <SidebarNav items={navItems} />
        </div>

        <div style={{ flex: 1 }} />

        <div className="card" style={{ padding: 11, borderRadius: 11 }}>
          <div className="stat-label">Cash</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
            {money(ms.balance)}
          </div>
          <div
            className="mono"
            style={{ fontSize: 10, marginTop: 2, color: pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}
          >
            {signedMoney(pnl)} season
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link href="/groups" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={group.name} size={34} radius={10} />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {group.name}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 2 }}>
                {members} members
              </div>
            </div>
          </Link>
          <Link href="/notifications" className="btn btn-ghost btn-sm" aria-label="Notifications">
            Alerts{unread ? ` · ${unread}` : ''}
          </Link>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
              {money(ms.balance)}
            </div>
            <div
              className="mono"
              style={{ fontSize: 10, color: pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}
            >
              {signedMoney(pnl)} season
            </div>
          </div>
        </header>

        <div className="content">{children}</div>
      </div>

      <CreateFab href={`${base}/new`} listHref={base} />
      <TabBar items={tabItems} />
    </div>
  );
}
