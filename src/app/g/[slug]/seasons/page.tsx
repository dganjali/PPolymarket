import { groupContext } from '@/lib/context';
import { seasonArchive, seasonHistory } from '@/lib/data';
import { longDateLabel, money0, signedMoney } from '@/lib/format';
import { Avatar } from '@/components/ui';

export default async function SeasonsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, group } = await groupContext(slug);
  const [seasons, results] = await Promise.all([seasonArchive(group.id), seasonHistory(group.id)]);

  const byUser = new Map<number, { seasons: number; wins: number; lasts: number }>();
  for (const season of seasons) {
    for (const id of [season.champion_id, season.last_place_id]) {
      if (!id) continue;
      const tally = byUser.get(id) ?? { seasons: 0, wins: 0, lasts: 0 };
      if (id === season.champion_id) tally.wins++;
      if (id === season.last_place_id && id !== season.champion_id) tally.lasts++;
      byUser.set(id, tally);
    }
  }

  return (
    <div className="wrap narrow" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Seasons</h1>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 5 }}>
          season {group.current_season} in progress · {seasons.length} archived
        </div>
      </div>

      {seasons.length === 0 && (
        <div className="empty">
          Nothing archived yet. When the owner closes season {group.current_season}, the final
          standings — and who owes what — land here for good.
        </div>
      )}

      {seasons.map((season) => {
        const rows = results.filter((row) => row.season_number === season.season_number);
        return (
          <section key={season.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                background: 'linear-gradient(150deg,#2A2317,#1A1815)',
                border: '1px solid var(--gold-line)',
                borderRadius: 16,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 11,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="eyebrow" style={{ color: 'var(--gold)' }}>
                  Season {season.season_number}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-5)' }}>
                  {season.started_at ? `${longDateLabel(season.started_at)} — ` : 'ended '}
                  {longDateLabel(season.ended_at)} · {season.entrants} player
                  {season.entrants === 1 ? '' : 's'}
                </div>
              </div>

              {season.champion_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Avatar name={season.champion_name} src={season.champion_avatar} size={38} radius={11} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {season.champion_name}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>
                      CHAMPION{rows[0] ? ` · ${money0(rows[0].final_total)}` : ''}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13.5 }}>Nobody finished this season.</div>
              )}

              {season.prize && (
                <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
                    WON{' '}
                  </span>
                  {season.prize}
                </div>
              )}

              {season.last_place_name && season.last_place_id !== season.champion_id && (
                <>
                  <div style={{ height: 1, background: 'var(--gold-line)' }} />
                  <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--no-hi)' }}>Last place: </span>
                    {season.last_place_name}
                    {season.punishment ? ` — ${season.punishment}` : ''}
                  </div>
                </>
              )}

              {season.note && (
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                  “{season.note}”
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {rows.map((row) => {
                const me = row.user_id === user.id;
                return (
                  <div
                    key={row.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 11px',
                      borderRadius: 10,
                      background: me ? 'var(--gold-bg)' : 'var(--card)',
                      border: `1px solid ${me ? 'var(--gold-line)' : 'var(--line-2)'}`,
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        width: 18,
                        fontSize: 12,
                        fontWeight: 600,
                        color: row.rank === 1 || me ? 'var(--gold)' : 'var(--dim)',
                      }}
                    >
                      {row.rank}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500 }}>{row.name}</div>
                    <div className="mono" style={{ fontSize: 12 }}>{money0(row.final_total)}</div>
                    <div
                      className="mono"
                      style={{ fontSize: 10.5, width: 74, textAlign: 'right', color: row.pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}
                    >
                      {signedMoney(row.pnl)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {seasons.length > 1 && (
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>All-time</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...byUser.entries()]
              .sort((a, b) => b[1].wins - a[1].wins || a[1].lasts - b[1].lasts)
              .map(([userId, tally]) => {
                const name =
                  seasons.find((s) => s.champion_id === userId)?.champion_name ??
                  seasons.find((s) => s.last_place_id === userId)?.last_place_name ??
                  'Unknown';
                return (
                  <div key={userId} className="card" style={{ padding: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={name} size={28} radius={8} />
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim)' }}>
                      {tally.wins} win{tally.wins === 1 ? '' : 's'}
                      {tally.lasts ? ` · ${tally.lasts} last` : ''}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
