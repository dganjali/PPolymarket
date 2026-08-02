import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { all } from '@/lib/db';
import { openLegs, standings } from '@/lib/data';
import { centsLabel, money, shares as fmtShares, signedMoney } from '@/lib/format';
import { LeaveGroup } from '@/components/LeaveGroup';

export default async function PortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, group, ms, base } = await groupContext(slug);

  const [legs, rows] = await Promise.all([
    openLegs(user.id, group.id),
    standings(group.id, group.starting_balance),
  ]);
  const rank = rows.findIndex((r) => r.userId === user.id) + 1;
  const mine = rows[rank - 1];
  const invested = mine?.invested ?? 0;
  const total = ms.balance + invested;
  const pnl = total - group.starting_balance;

  const settledBinary = await all<{
    id: number; question: string; outcome: string; realized: number; resolved_at: string;
  }>(
    `SELECT m.id, m.question, m.outcome, p.realized, m.resolved_at
       FROM positions p JOIN markets m ON m.id = p.market_id
      WHERE p.user_id = ? AND m.group_id = ? AND m.season_number = ? AND m.status = 'resolved'
      ORDER BY m.resolved_at DESC LIMIT 25`,
    user.id,
    group.id,
    group.current_season,
  );
  const settledCategorical = await all<{
    id: number; question: string; outcome: string; realized: number; resolved_at: string;
  }>(
    `SELECT m.id, m.question, winner.label AS outcome, SUM(p.realized) AS realized, m.resolved_at
       FROM option_positions p JOIN markets m ON m.id = p.market_id
       LEFT JOIN market_options winner ON winner.id = CAST(m.outcome AS INTEGER)
      WHERE p.user_id = ? AND m.group_id = ? AND m.season_number = ? AND m.status = 'resolved'
      GROUP BY m.id ORDER BY m.resolved_at DESC LIMIT 25`,
    user.id,
    group.id,
    group.current_season,
  );
  const settled = [...settledBinary, ...settledCategorical]
    .sort((a, b) => b.resolved_at.localeCompare(a.resolved_at))
    .slice(0, 25);

  return (
    <div className="wrap narrow" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="card" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Portfolio value
        </div>
        <div className="mono" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {money(total)}
        </div>
        <div
          className="mono"
          style={{ fontSize: 12.5, marginTop: 4, color: pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}
        >
          {signedMoney(pnl)} all time
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 16,
            borderTop: '1px solid var(--line-2)',
            paddingTop: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <div className="stat-label">Cash</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500 }}>
              {money(ms.balance)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-label">In positions</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500 }}>
              {money(invested)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-label">Rank</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500 }}>
              #{rank || '—'}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
          Open positions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {legs.map((leg) => {
            const avg = leg.shares > 0 ? leg.cost / leg.shares : leg.price;
            const up = leg.value >= leg.cost;
            return (
              <Link
                key={`${leg.market.id}-${leg.optionId ?? leg.side}`}
                href={`${base}/m/${leg.market.id}`}
                className="card"
                style={{ padding: 13, display: 'block' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11 }}>
                  <span
                    className="mono"
                    style={{
                      flex: 'none',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      background: leg.market.market_type === 'categorical' ? 'var(--gold-bg)' : leg.side === 'YES' ? 'var(--yes-bg)' : 'var(--no-bg)',
                      color: leg.market.market_type === 'categorical' ? 'var(--gold)' : leg.side === 'YES' ? 'var(--yes-hi)' : 'var(--no-hi)',
                    }}
                  >
                    {leg.side}
                  </span>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
                    {leg.market.question}
                  </div>
                </div>
                <div className="mono" style={{ display: 'flex' }}>
                  <Cell label="Shares" value={fmtShares(leg.shares)} />
                  <Cell label="Avg" value={centsLabel(avg)} />
                  <Cell label="Now" value={centsLabel(leg.price)} />
                  <Cell
                    label="Value"
                    value={money(leg.value)}
                    align="right"
                    color={up ? 'var(--yes-hi)' : 'var(--no-hi)'}
                  />
                </div>
              </Link>
            );
          })}
          {legs.length === 0 && (
            <div className="empty">
              Nothing open. Every share you buy pays {money(1)} if you called it right.
            </div>
          )}
        </div>
      </section>

      {settled.length > 0 && (
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
            Settled
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {settled.map((s) => (
              <Link
                key={s.id}
                href={`${base}/m/${s.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 0',
                  borderBottom: '1px solid #201E1B',
                }}
              >
                <span
                  className="mono"
                  style={{
                    flex: 'none',
                    padding: '2px 6px',
                    borderRadius: 5,
                    fontSize: 9.5,
                    fontWeight: 600,
                    background: s.outcome === 'YES' ? 'var(--yes-bg)' : s.outcome === 'NO' ? 'var(--no-bg)' : 'var(--gold-bg)',
                    color: s.outcome === 'YES' ? 'var(--yes-hi)' : s.outcome === 'NO' ? 'var(--no-hi)' : 'var(--gold)',
                  }}
                >
                  {s.outcome}
                </span>
                <div style={{ flex: 1, fontSize: 13, lineHeight: 1.35, color: 'var(--ink-3)' }}>
                  {s.question}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: s.realized >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}
                >
                  {signedMoney(s.realized)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <LeaveGroup
        slug={slug}
        groupName={group.name}
        isOwner={user.id === group.owner_id}
        openPositions={legs.length}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  align = 'left',
  color,
}: {
  label: string;
  value: string;
  align?: 'left' | 'right';
  color?: string;
}) {
  return (
    <div style={{ flex: 1, textAlign: align }}>
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--dim)',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color }}>{value}</div>
    </div>
  );
}
