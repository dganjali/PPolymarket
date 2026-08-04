import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import {
  groupBySlug,
  memberCount,
  membership,
  membershipRequests,
  memberWorth,
  myGroups,
  unreadNotificationCount,
} from '@/lib/data';
import { sweepClosures, sweepResolutions } from '@/lib/engine';
import { money, signedMoney } from '@/lib/format';
import { CreateFab, SidebarNav, TabBar, type NavItem } from '@/components/Nav';
import { Bell, Plus } from '@/components/Icon';
import { PLANS, planOf } from '@/lib/plans';
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

  const [worth, groups, unread, members, waiting] = await Promise.all([
    memberWorth(user.id, group.id),
    myGroups(user.id),
    unreadNotificationCount(user.id),
    memberCount(group.id),
    isAdmin ? membershipRequests(group.id).then((r) => r.length) : Promise.resolve(0),
  ]);

  // Four destinations, not seven. Seasons folded into Standings, Profile into
  // You, Activity onto Home. Each carries the line that explains it, which the
  // sidebar unrolls on hover and the screen reader gets through aria-describedby.
  const navItems: NavItem[] = [
    {
      href: base,
      label: 'Markets',
      description: 'Everything the group is betting on right now',
      icon: 'home',
      exact: true,
    },
    {
      href: `${base}/standings`,
      label: 'Standings',
      description: 'Who is up, who is down, and what they are playing for',
      icon: 'trophy',
    },
    {
      href: `${base}/you`,
      label: 'You',
      description: 'Your positions, your record and your settings',
      icon: 'person',
    },
    ...(isAdmin
      ? [
          {
            href: `${base}/admin`,
            label: 'Admin',
            description: 'Approvals, results, invites and the roster',
            icon: 'shield' as const,
            badge: waiting,
          },
        ]
      : []),
    {
      href: '/notifications',
      label: 'Alerts',
      description: 'Approvals, results and announcements meant for you',
      icon: 'bell',
      badge: unread,
    },
  ];

  const pnl = worth.total - group.starting_balance;
  const pnlClass = pnl >= 0 ? 'up' : 'down';
  const plan = planOf(group);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/groups" className="sidebar-brand">
          <div className="logo" style={{ width: 24, height: 24, borderRadius: 7, fontSize: 12 }}>
            M
          </div>
          <div className="sidebar-brand-name">Minimarket</div>
        </Link>

        <div className="sidebar-section">
          <div className="sidebar-title">Your groups</div>
          {groups.map((g) => (
            <Link key={g.id} href={`/g/${g.slug}`} className="sidebar-group" data-on={g.id === group.id}>
              <Avatar name={g.name} size={24} radius={7} />
              <span className="sidebar-group-name">{g.name}</span>
              {g.id === group.id && <span className="sidebar-group-tick" />}
            </Link>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">{group.name}</div>
          <SidebarNav items={navItems} />
          <Link href={`${base}/new`} className="btn btn-primary btn-sm pressable" style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Plus size={15} weight={2.2} />
            Ask a question
          </Link>
        </div>

        <div className="sidebar-foot">
          {isAdmin && (
            <Link href={`${base}/billing`} className="sidebar-plan" data-plan={plan}>
              <span className="sidebar-plan-label">Plan</span>
              <span className="sidebar-plan-name">{PLANS[plan].name}</span>
            </Link>
          )}

          <Link href={`${base}/you`} className="sidebar-me">
            <Avatar name={user.name} src={user.avatar} size={26} radius={8} />
            <div className="sidebar-me-main">
              <div className="sidebar-me-name">{user.name}</div>
              <div className="sidebar-me-handle">@{user.handle}</div>
            </div>
          </Link>

          <div className="sidebar-cash">
            <div className="sidebar-cash-label">Cash</div>
            <div className="sidebar-cash-value">{money(ms.balance)}</div>
            <div className={`sidebar-cash-pnl ${pnlClass}`}>{signedMoney(pnl)} this season</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link href="/groups" className="topbar-group">
            <Avatar name={group.name} size={34} radius={10} />
            <div>
              <div className="topbar-name">{group.name}</div>
              <div className="topbar-sub">{members} members</div>
            </div>
          </Link>
          <Link href="/notifications" className="topbar-alerts" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}>
            <Bell size={17} />
            {!!unread && <span className="nav-badge mono">{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <div className="topbar-cash">
            <div className="topbar-cash-value">{money(ms.balance)}</div>
            <div className={`topbar-cash-pnl ${pnlClass}`}>{signedMoney(pnl)}</div>
          </div>
        </header>

        <div className="content enter">{children}</div>
      </div>

      <CreateFab href={`${base}/new`} listHref={base} />
      <TabBar items={navItems} />
    </div>
  );
}
