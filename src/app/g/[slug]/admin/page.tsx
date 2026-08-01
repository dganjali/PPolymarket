import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { groupContext } from '@/lib/context';
import { marketsByGroup, standings } from '@/lib/data';
import { dateLabel, money0, relative, volLabel } from '@/lib/format';
import { AdminMarketControls } from '@/components/AdminControls';
import { InviteCode, MemberList, SettingsForm, StakesEditor } from '@/components/AdminPanels';

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { group, isAdmin, base } = await groupContext(slug);
  if (!isAdmin) redirect(base);

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const origin = host ? `${proto}://${host}` : undefined;

  const pending = marketsByGroup(group.id, ['pending']);
  const resolvable = marketsByGroup(group.id, ['closed', 'open']);
  const members = standings(group.id, group.starting_balance);

  return (
    <div className="wrap narrow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Admin</h1>
        <span
          className="mono"
          style={{
            padding: '3px 7px',
            borderRadius: 5,
            background: 'var(--gold-bg)',
            border: '1px solid var(--gold-line)',
            fontSize: 9.5,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
          }}
        >
          You run this group
        </span>
      </div>

      <StakesEditor slug={slug} prize={group.prize} punishment={group.punishment} />

      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow">Pending markets</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
            {pending.length} waiting
          </div>
        </div>
        {pending.map((m) => (
          <div
            key={m.id}
            style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingBottom: 11, borderBottom: '1px solid #262320' }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{m.question}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
              proposed by @{m.creator_handle} · opens at {Math.round(m.open_price * 100)}% ·{' '}
              {money0(m.subsidy)} seed · closes {dateLabel(m.closes_at)}
            </div>
            {m.rules && (
              <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-4)' }}>{m.rules}</div>
            )}
            <AdminMarketControls slug={slug} marketId={m.id} status="pending" compact />
          </div>
        ))}
        {pending.length === 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim-2)' }}>
            Nothing in the queue.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="eyebrow">Resolve markets</div>
        {resolvable.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Link href={`${base}/m/${m.id}`} style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>
              {m.question}
            </Link>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
              {volLabel(m.volume)} · {money0(m.collateral)} at stake ·{' '}
              {m.status === 'closed' ? 'closed' : `closes ${relative(m.closes_at)}`}
            </div>
            <AdminMarketControls slug={slug} marketId={m.id} status={m.status} compact />
          </div>
        ))}
        {resolvable.length === 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim-2)' }}>
            No live markets.
          </div>
        )}
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
          Resolving pays every winning share $1.00 and hands the leftover pool plus fees back to
          whoever seeded the market. It cannot be undone.
        </div>
      </div>

      <InviteCode code={group.invite_code} origin={origin} />

      <SettingsForm
        slug={slug}
        seasonEnds={group.season_ends}
        marketLiquidity={group.market_liquidity}
        positionsPublic={!!group.positions_public}
        requireApproval={!!group.require_approval}
      />

      <MemberList
        slug={slug}
        ownerId={group.owner_id}
        members={members.map((m) => ({ userId: m.userId, name: m.name, handle: m.handle, role: m.role }))}
      />
    </div>
  );
}
