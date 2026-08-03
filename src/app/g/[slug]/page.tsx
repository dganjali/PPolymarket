import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { CATEGORIES, events, groupPrizes, marketsByGroup, membershipRequests, standings } from '@/lib/data';
import { sparkSeriesFor } from '@/lib/history';
import { money0, relative, signedMoney } from '@/lib/format';
import { MarketCard } from '@/components/MarketCard';
import { Avatar } from '@/components/ui';

/**
 * Where you stand, then what there is to bet on. Everything else — the full
 * table, past seasons, your record — lives one tap away rather than here.
 */
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cat?: string; show?: string }>;
}) {
  const { slug } = await params;
  const { cat = 'All', show = 'live' } = await searchParams;
  const { user, group, ms, isAdmin, base } = await groupContext(slug);

  const statuses = show === 'resolved' ? ['resolved'] : ['open', 'closed', 'resolving'];
  const [all, rows, prizes, feed] = await Promise.all([
    marketsByGroup(group.id, statuses),
    standings(group.id, group.starting_balance),
    groupPrizes(group.id),
    events(group.id, 5),
  ]);
  const joinRequests = isAdmin ? await membershipRequests(group.id) : [];

  const markets = cat === 'All' ? all : all.filter((m) => m.category === cat);
  const series = await sparkSeriesFor(markets);
  const catList = ['All', ...CATEGORIES.filter((c) => all.some((m) => m.category === c))];

  const rank = rows.findIndex((r) => r.userId === user.id) + 1;
  const total = rows[rank - 1]?.total ?? ms.balance;
  const pnl = total - group.starting_balance;
  const leader = rows[0];
  const topPrize = prizes[0];

  return (
    <div className="wrap stack" style={{ maxWidth: 1100 }}>
      {joinRequests.length > 0 && (
        <Link href={`${base}/admin`} className="surface" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', background: 'var(--accent-bg)', borderColor: 'var(--accent-line)' }}>
          <div style={{ display: 'flex' }}>
            {joinRequests.slice(0, 3).map((r, i) => (
              <div key={r.user_id} style={{ marginLeft: i ? -8 : 0 }}>
                <Avatar name={r.name} src={r.avatar} size={24} radius={8} />
              </div>
            ))}
          </div>
          <span className="row-main" style={{ fontSize: 'var(--t-small)', fontWeight: 600 }}>
            {joinRequests.length} waiting to join
          </span>
          <span className="t-micro" style={{ color: 'var(--accent)' }}>Let them in →</span>
        </Link>
      )}

      {/* One line about you, one about who is winning. That is the whole summary. */}
      <section className="surface" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-4)', alignItems: 'center' }}>
        <div>
          <div className="t-micro">You&rsquo;re worth</div>
          <div className="mono" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 3 }}>
            {money0(total)}
          </div>
          <div className="mono t-micro" style={{ color: pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)', marginTop: 2 }}>
            {signedMoney(pnl)} · {rank ? `${rank} of ${rows.length}` : 'unranked'}
          </div>
        </div>

        {leader && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', minWidth: 0 }}>
            <Avatar name={leader.name} src={leader.avatar} size={34} radius={11} />
            <div style={{ minWidth: 0 }}>
              <div className="t-micro">Winning</div>
              <div className="row-name">{leader.name}</div>
              {topPrize && (
                <div className="t-micro" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                  takes {topPrize.label.toLowerCase()}
                </div>
              )}
            </div>
          </div>
        )}

        <Link href={`${base}/standings`} className="t-micro" style={{ marginLeft: 'auto', color: 'var(--accent)' }}>
          Full table →
        </Link>
      </section>

      <section style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-1)', overflowX: 'auto', paddingBottom: 2 }}>
        {catList.map((c) => (
          <Link
            key={c}
            href={c === 'All' ? `${base}?show=${show}` : `${base}?cat=${encodeURIComponent(c)}&show=${show}`}
            className="chip"
            data-on={cat === c}
          >
            {c}
          </Link>
        ))}
        <div style={{ flex: 1, minWidth: 8 }} />
        <Link href={base} className="chip" data-on={show !== 'resolved'}>Open</Link>
        <Link href={`${base}?show=resolved`} className="chip" data-on={show === 'resolved'}>Done</Link>
      </section>

      <section className="market-grid" style={{ display: 'grid', gap: 'var(--s-2)' }}>
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} points={series.get(m.id) ?? []} base={base} />
        ))}
      </section>

      {markets.length === 0 && (
        <div className="empty">
          {show === 'resolved' ? 'Nothing has finished yet.' : 'Nothing to bet on yet.'}
          <div style={{ marginTop: 'var(--s-2)' }}>
            <Link href={`${base}/new`} className="btn btn-primary btn-sm">Ask a question</Link>
          </div>
        </div>
      )}

      <section>
        <div className="sec">
          <h2 className="h-head">Lately</h2>
          <Link href={`${base}/activity`}>Everything →</Link>
        </div>
        <div className="surface" style={{ padding: 'var(--s-2)' }}>
          {feed.map((e) => (
            <div key={e.id} className="row" style={{ padding: '7px var(--s-1)' }}>
              <Avatar name={e.user_name ?? 'Minimarket'} src={e.user_avatar} size={22} radius={7} />
              <span className="row-main t-small" style={{ color: 'var(--ink-4)' }}>
                <span style={{ color: 'var(--ink-2)' }}>{e.user_name ?? 'Minimarket'}</span>{' '}
                {e.body.length > 80 ? `${e.body.slice(0, 80)}…` : e.body}
              </span>
              <span className="t-micro">{relative(e.created_at)}</span>
            </div>
          ))}
          {feed.length === 0 && <p className="t-small" style={{ margin: 0, padding: 'var(--s-2)' }}>Nothing yet.</p>}
        </div>
      </section>
    </div>
  );
}
