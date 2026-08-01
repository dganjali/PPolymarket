import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { CATEGORIES, events, marketsByGroup, priceSeriesFor } from '@/lib/data';
import { relative } from '@/lib/format';
import { MarketCard } from '@/components/MarketCard';
import { Avatar } from '@/components/ui';

export default async function MarketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cat?: string; show?: string }>;
}) {
  const { slug } = await params;
  const { cat = 'All', show = 'live' } = await searchParams;
  const { group, isAdmin, base } = await groupContext(slug);

  const statuses = show === 'resolved' ? ['resolved'] : ['open', 'closed'];
  const all = marketsByGroup(group.id, statuses);
  const markets = cat === 'All' ? all : all.filter((m) => m.category === cat);
  const series = priceSeriesFor(markets.map((m) => m.id));

  const feed = events(group.id, 6);
  const catList = ['All', ...CATEGORIES.filter((c) => all.some((m) => m.category === c))];

  return (
    <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section style={{ display: 'flex', gap: 9 }}>
        <div
          style={{
            flex: 1,
            background: 'linear-gradient(160deg,#241F16,#1A1815)',
            border: '1px solid var(--gold-line)',
            borderRadius: 13,
            padding: 12,
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 6 }}>
            Season prize
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: '#EDE8DE' }}>
            {group.prize || 'The admin has not put anything up yet.'}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: 'linear-gradient(160deg,#251A18,#1A1815)',
            border: '1px solid #3E2B27',
            borderRadius: 13,
            padding: 12,
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--no)', marginBottom: 6 }}>
            Last place
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: '#EDE8DE' }}>
            {group.punishment || 'Nothing set — last place walks free.'}
          </div>
        </div>
      </section>

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

      <section style={{ marginTop: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '10px 0',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
            Group activity
          </h2>
          <Link href={`${base}/activity`} className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
            SEE ALL
          </Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {feed.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: '1px solid #201E1B',
              }}
            >
              <Avatar name={e.user_name ?? 'Minimarket'} size={28} radius={8} />
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{e.user_name ?? 'Minimarket'}</span> {e.body}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', flex: 'none' }}>
                {relative(e.created_at)}
              </div>
            </div>
          ))}
          {feed.length === 0 && <div className="empty">Quiet so far.</div>}
        </div>
      </section>

      <div className="desktop-only" style={{ paddingTop: 4 }}>
        <Link href={`${base}/new`} className="btn btn-primary btn-sm">
          + New market
        </Link>
      </div>

      {isAdmin ? <PendingHint base={base} groupId={group.id} /> : null}
    </div>
  );
}

function PendingHint({ base, groupId }: { base: string; groupId: number }) {
  const pending = marketsByGroup(groupId, ['pending']);
  if (!pending.length) return null;
  return (
    <Link href={`${base}/admin`} className="notice" style={{ display: 'block' }}>
      <span style={{ color: 'var(--gold)' }}>{pending.length} market</span>
      {pending.length === 1 ? ' is' : 's are'} waiting for your approval.
    </Link>
  );
}
