import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { events } from '@/lib/data';
import { relative } from '@/lib/format';
import { Avatar } from '@/components/ui';

const KIND_COLOR: Record<string, string> = {
  trade: 'var(--ink-3)',
  resolve: 'var(--gold)',
  market: 'var(--yes-hi)',
  proposal: 'var(--ink-4)',
  close: 'var(--dim)',
  join: 'var(--ink-4)',
  group: 'var(--ink-4)',
};

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { group, base } = await groupContext(slug);
  const feed = await events(group.id, 100);

  return (
    <div className="wrap narrow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Activity</h1>
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
          {group.name.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {feed.map((e) => {
          const row = (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid #201E1B',
              }}
            >
              <Avatar name={e.user_name ?? 'Minimarket'} size={28} radius={8} />
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45, color: KIND_COLOR[e.kind] ?? 'var(--ink-3)' }}>
                <span style={{ color: 'var(--ink)' }}>{e.user_name ?? 'Minimarket'}</span> {e.body}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', flex: 'none' }}>
                {relative(e.created_at)}
              </div>
            </div>
          );
          return e.market_id ? (
            <Link key={e.id} href={`${base}/m/${e.market_id}`}>
              {row}
            </Link>
          ) : (
            <div key={e.id}>{row}</div>
          );
        })}
        {feed.length === 0 && <div className="empty">Nothing has happened yet.</div>}
      </div>
    </div>
  );
}
