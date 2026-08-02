import Link from 'next/link';
import { groupContext } from '@/lib/context';
import {
  CATEGORIES,
  events,
  groupPrizes,
  groupStats,
  marketsByGroup,
  membershipRequests,
  priceSeriesFor,
  standings,
} from '@/lib/data';
import { money0, relative, signedMoney, volLabel } from '@/lib/format';
import { MarketCard } from '@/components/MarketCard';
import { Podium, StandingsPanel, StatTile } from '@/components/Dashboard';
import { Avatar } from '@/components/ui';

export default async function DashboardPage({
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
  const [all, rows, stats, prizes, feed] = await Promise.all([
    marketsByGroup(group.id, statuses),
    standings(group.id, group.starting_balance),
    groupStats(group.id, group.current_season),
    groupPrizes(group.id),
    events(group.id, 8),
  ]);
  const joinRequests = isAdmin ? await membershipRequests(group.id) : [];

  const markets = cat === 'All' ? all : all.filter((m) => m.category === cat);
  const series = await priceSeriesFor(markets.map((m) => m.id));
  const catList = ['All', ...CATEGORIES.filter((c) => all.some((m) => m.category === c))];

  const rank = rows.findIndex((r) => r.userId === user.id) + 1;
  const mine = rows[rank - 1];
  const total = mine?.total ?? ms.balance;
  const pnl = total - group.starting_balance;
  const daysLeft = group.season_ends
    ? Math.max(0, Math.ceil((Date.parse(group.season_ends) - Date.now()) / 86_400_000))
    : null;
  const lastPlace = rows.length > 1 ? rows[rows.length - 1] : undefined;

  return (
    <div className="wrap dash">
      {/* Admins land here, so anything waiting on them belongs at the top. */}
      {joinRequests.length > 0 && (
        <Link
          href={`${base}/admin`}
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '12px 14px',
            background: 'var(--gold-bg)',
            borderColor: 'var(--gold-line)',
          }}
        >
          <div style={{ display: 'flex', marginRight: 2 }}>
            {joinRequests.slice(0, 3).map((request, index) => (
              <div key={request.user_id} style={{ marginLeft: index ? -8 : 0 }}>
                <Avatar name={request.name} src={request.avatar} size={26} radius={8} />
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>
            {joinRequests.length} {joinRequests.length === 1 ? 'person is' : 'people are'} waiting to
            join
          </div>
          <span className="btn btn-primary btn-sm">Review</span>
        </Link>
      )}

      <section className="dash-stats">
        <StatTile
          label="Your total"
          value={money0(total)}
          hint={`${signedMoney(pnl)} this season`}
          tone={pnl >= 0 ? 'up' : 'down'}
        />
        <StatTile label="Your rank" value={rank ? `#${rank}` : '—'} hint={`of ${rows.length}`} tone="gold" />
        <StatTile label="Cash free" value={money0(ms.balance)} hint={`${money0(mine?.invested ?? 0)} in play`} />
        <StatTile
          label="Season"
          value={daysLeft === null ? `S${group.current_season}` : `${daysLeft}d`}
          hint={daysLeft === null ? 'no end date' : 'left to play'}
        />
      </section>

      <Podium
        entries={prizes.map((prize) => {
          const holder = rows[prize.place - 1];
          return {
            place: prize.place,
            label: prize.label,
            holder: holder && { name: holder.name, avatar: holder.avatar, total: holder.total },
          };
        })}
        punishment={group.punishment}
        lastPlace={lastPlace && { name: lastPlace.name, avatar: lastPlace.avatar, total: lastPlace.total }}
      />

      <div className="dash-split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <section style={{ display: 'flex', alignItems: 'center', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
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
            <Link href={base} className="chip" data-on={show !== 'resolved'}>
              Live
            </Link>
            <Link href={`${base}?show=resolved`} className="chip" data-on={show === 'resolved'}>
              Settled
            </Link>
          </section>

          <section className="market-grid" style={{ display: 'grid', gap: 10 }}>
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} series={series.get(m.id) ?? []} base={base} />
            ))}
          </section>

          {markets.length === 0 && (
            <div className="empty">
              {show === 'resolved'
                ? 'Nothing has settled yet.'
                : cat === 'All'
                  ? 'No markets yet. Be the first to put a question up.'
                  : `Nothing open in ${cat}.`}
              <div style={{ marginTop: 14 }}>
                <Link href={`${base}/new`} className="btn btn-primary btn-sm">
                  New market
                </Link>
              </div>
            </div>
          )}
        </div>

        <aside className="dash-side">
          <StandingsPanel
            rows={rows.slice(0, 6).map((r) => ({
              userId: r.userId,
              name: r.name,
              avatar: r.avatar,
              total: r.total,
              pnl: r.pnl,
            }))}
            meId={user.id}
            href={`${base}/leaderboard`}
          />

          <section className="card" style={{ padding: 13 }}>
            <div className="panel-head">
              <div className="eyebrow" style={{ padding: 0 }}>This season</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <Cell label="Volume" value={volLabel(stats.volume).replace(' Vol', '')} />
              <Cell label="At stake" value={money0(stats.atStake)} />
              <Cell label="Live" value={String(stats.live)} />
              <Cell label="Settled" value={String(stats.resolved)} />
              <Cell label="Trades" value={String(stats.trades)} />
              <Cell label="Members" value={String(rows.length)} />
            </div>
          </section>

          <section className="card" style={{ padding: 13 }}>
            <div className="panel-head">
              <div className="eyebrow" style={{ padding: 0 }}>Activity</div>
              <Link href={`${base}/activity`} className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
                ALL
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {feed.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <Avatar name={e.user_name ?? 'Minimarket'} src={e.user_avatar} size={22} radius={7} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--ink-4)' }}>
                    <span style={{ color: 'var(--ink-2)' }}>{e.user_name ?? 'Minimarket'}</span>{' '}
                    {e.body.length > 90 ? `${e.body.slice(0, 90)}…` : e.body}
                  </div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--dim-2)', flex: 'none' }}>
                    {relative(e.created_at)}
                  </div>
                </div>
              ))}
              {feed.length === 0 && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--dim-2)' }}>Nothing yet.</div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
