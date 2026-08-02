import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { seasonArchive, standings } from '@/lib/data';
import { dateLabel, money, money0, signedMoney } from '@/lib/format';
import { Avatar } from '@/components/ui';

export default async function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, group, base } = await groupContext(slug);
  const [rows, seasons] = await Promise.all([
    standings(group.id, group.starting_balance),
    seasonArchive(group.id),
  ]);
  const champions = seasons.filter((season) => season.champion_name);

  const daysLeft = group.season_ends
    ? Math.max(0, Math.ceil((Date.parse(group.season_ends) - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="wrap narrow" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section
        style={{
          background: 'linear-gradient(150deg,#2A2317,#1A1815)',
          border: '1px solid var(--gold-line)',
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow" style={{ color: 'var(--gold)' }}>
            Season {group.current_season} stakes
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-5)' }}>
            {daysLeft === null
              ? 'no end date'
              : daysLeft === 0
                ? 'season over'
                : `${daysLeft} days left${group.season_ends ? ` · ${dateLabel(group.season_ends)}` : ''}`}
          </div>
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.45 }}>
          {group.prize || 'No prize set yet.'}
        </div>
        <div style={{ height: 1, background: 'var(--gold-line)' }} />
        <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink-3)' }}>
          <span style={{ color: 'var(--no-hi)' }}>Last place: </span>
          {group.punishment || 'nothing — for now.'}
        </div>
      </section>

      {champions.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Past champions</h2>
            <Link href={`${base}/seasons`} className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
              FULL ARCHIVE
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {champions.slice(0, 4).map((season) => (
              <Link
                key={season.season_number}
                href={`${base}/seasons`}
                className="card"
                style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <div className="mono" style={{ color: 'var(--gold)', fontSize: 11 }}>S{season.season_number}</div>
                <Avatar name={season.champion_name!} size={28} radius={8} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{season.champion_name}</div>
                  {season.prize && (
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: 'var(--dim)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      won {season.prize.toLowerCase()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
            Standings
          </h2>
          <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
            TOTAL VALUE
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r, i) => {
            const me = r.userId === user.id;
            return (
              <div
                key={r.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '11px 12px',
                  borderRadius: 12,
                  background: me ? 'var(--gold-bg)' : 'var(--card)',
                  border: `1px solid ${me ? 'var(--gold-line)' : 'var(--line-2)'}`,
                }}
              >
                <div
                  className="mono"
                  style={{
                    width: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    color: i === 0 || me ? 'var(--gold)' : 'var(--dim)',
                  }}
                >
                  {i + 1}
                </div>
                <Avatar name={r.name} size={32} radius={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {r.name}
                    {r.role === 'admin' && (
                      <span className="mono" style={{ fontSize: 9, color: 'var(--gold)', marginLeft: 6 }}>
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                    {r.openPositions} open · {r.trades} trade{r.trades === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="mono" style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{money0(r.total)}</div>
                  <div
                    style={{ fontSize: 10.5, color: r.pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)', marginTop: 2 }}
                  >
                    {signedMoney(r.pnl)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', marginTop: 12, lineHeight: 1.6 }}>
          Total value = cash plus open positions marked at the current pool price. Everyone started
          at {money(group.starting_balance)}.
        </div>
      </section>
    </div>
  );
}
