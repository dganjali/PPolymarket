import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { groupPrizes, groupStats, seasonArchive, standings } from '@/lib/data';
import { dateLabel, money, money0, signedMoney, volLabel } from '@/lib/format';
import { Podium } from '@/components/Dashboard';
import { Avatar } from '@/components/ui';

export default async function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, group, base } = await groupContext(slug);
  const [rows, seasons, prizes, stats] = await Promise.all([
    standings(group.id, group.starting_balance),
    seasonArchive(group.id),
    groupPrizes(group.id),
    groupStats(group.id, group.current_season),
  ]);
  const champions = seasons.filter((season) => season.champion_name);
  const lastPlace = rows.length > 1 ? rows[rows.length - 1] : undefined;

  const daysLeft = group.season_ends
    ? Math.max(0, Math.ceil((Date.parse(group.season_ends) - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
          Season {group.current_season}
        </h1>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-5)' }}>
          {daysLeft === null
            ? 'no end date'
            : daysLeft === 0
              ? 'season over'
              : `${daysLeft} days left${group.season_ends ? ` · ${dateLabel(group.season_ends)}` : ''}`}
        </div>
      </div>

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

      <div className="cols">
        <section>
          <div className="panel-head">
            <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>Standings</h2>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>TOTAL VALUE</div>
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
                  <Avatar name={r.name} src={r.avatar} size={32} radius={9} />
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
                    <div style={{ fontSize: 10.5, color: r.pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)', marginTop: 2 }}>
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

        <aside className="cols-side">
          <section className="card" style={{ padding: 13 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Season {group.current_season}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([
                ['Players', String(rows.length)],
                ['Volume', volLabel(stats.volume).replace(' Vol', '')],
                ['Live', String(stats.live)],
                ['Settled', String(stats.resolved)],
                ['Trades', String(stats.trades)],
                ['At stake', money0(stats.atStake)],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <div className="stat-label">{label}</div>
                  <div className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
          </section>

          {champions.length > 0 && (
            <section className="card" style={{ padding: 13 }}>
              <div className="panel-head">
                <div className="eyebrow" style={{ padding: 0 }}>Past champions</div>
                <Link href={`${base}/seasons`} className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
                  ARCHIVE
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {champions.slice(0, 6).map((season) => (
                  <Link
                    key={season.season_number}
                    href={`${base}/seasons`}
                    style={{ display: 'flex', alignItems: 'center', gap: 9 }}
                  >
                    <div className="mono" style={{ color: 'var(--gold)', fontSize: 10, width: 20 }}>
                      S{season.season_number}
                    </div>
                    <Avatar name={season.champion_name!} src={season.champion_avatar} size={26} radius={8} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{season.champion_name}</div>
                      {season.prize && (
                        <div
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            color: 'var(--dim)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {season.prize.toLowerCase()}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {group.description && (
            <section className="card" style={{ padding: 13 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>About</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-4)' }}>{group.description}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
