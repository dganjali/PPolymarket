import { groupContext } from '@/lib/context';
import { groupPrizes, seasonArchive, seasonHistory, standings } from '@/lib/data';
import { dateLabel, longDateLabel, money0, signedMoney } from '@/lib/format';
import { Podium } from '@/components/Dashboard';
import { Avatar } from '@/components/ui';

/** Who is winning, what they win, and everyone who has won before. */
export default async function StandingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, group } = await groupContext(slug);
  const [rows, prizes, seasons, history] = await Promise.all([
    standings(group.id, group.starting_balance),
    groupPrizes(group.id),
    seasonArchive(group.id),
    seasonHistory(group.id),
  ]);
  const lastPlace = rows.length > 1 ? rows[rows.length - 1] : undefined;
  const daysLeft = group.season_ends
    ? Math.max(0, Math.ceil((Date.parse(group.season_ends) - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="wrap stack" style={{ maxWidth: 820 }}>
      <div className="sec">
        <h1 className="h-title">Standings</h1>
        <span className="t-micro">
          {daysLeft === null
            ? `Season ${group.current_season}`
            : daysLeft === 0
              ? 'Season over'
              : `${daysLeft} days left${group.season_ends ? ` · ends ${dateLabel(group.season_ends)}` : ''}`}
        </span>
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

      <section className="surface" style={{ padding: 'var(--s-2)' }}>
        {rows.map((r, i) => (
          <div key={r.userId} className={`row${r.userId === user.id ? ' row-me' : ''}`}>
            <div className="mono" style={{ width: 18, fontSize: 'var(--t-small)', color: i === 0 ? 'var(--accent)' : 'var(--dim)' }}>
              {i + 1}
            </div>
            <Avatar name={r.name} src={r.avatar} size={30} radius={9} />
            <div className="row-main">
              <div className="row-name">{r.name}</div>
              <div className="row-sub">{r.openPositions ? `${r.openPositions} bets running` : 'nothing running'}</div>
            </div>
            <div className="row-figure">
              {money0(r.total)}
              <div className="t-micro" style={{ color: r.pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)', marginTop: 2 }}>
                {signedMoney(r.pnl)}
              </div>
            </div>
          </div>
        ))}
      </section>

      <p className="t-micro" style={{ lineHeight: 1.6, margin: 0 }}>
        Worth = the cash you are holding plus whatever your open bets are worth right now. Everyone
        started on {money0(group.starting_balance)}.
      </p>

      {seasons.length > 0 && (
        <section className="stack-tight" style={{ marginTop: 'var(--s-3)' }}>
          <h2 className="h-head">Past seasons</h2>
          {seasons.map((season) => {
            const finishers = history.filter((row) => row.season_number === season.season_number);
            return (
              <details key={season.id} className="surface" style={{ padding: 'var(--s-2) var(--s-3)' }}>
                <summary style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', cursor: 'pointer', listStyle: 'none' }}>
                  <span className="mono" style={{ fontSize: 'var(--t-micro)', color: 'var(--accent)', width: 24 }}>
                    S{season.season_number}
                  </span>
                  {season.champion_name && (
                    <Avatar name={season.champion_name} src={season.champion_avatar} size={26} radius={8} />
                  )}
                  <span className="row-main">
                    <span className="row-name">{season.champion_name ?? 'No winner'}</span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {longDateLabel(season.ended_at)} · {season.entrants} played
                    </span>
                  </span>
                  <span className="t-micro">open</span>
                </summary>
                <div style={{ marginTop: 'var(--s-2)', paddingTop: 'var(--s-2)', borderTop: '1px solid var(--line)' }}>
                  {season.prize && <p className="t-small" style={{ margin: '0 0 var(--s-2)' }}>Won: {season.prize}</p>}
                  {finishers.map((row) => (
                    <div key={row.user_id} className="row" style={{ padding: '6px var(--s-1)' }}>
                      <span className="mono" style={{ width: 18, fontSize: 'var(--t-micro)', color: 'var(--dim)' }}>{row.rank}</span>
                      <Avatar name={row.name} src={row.avatar} size={22} radius={7} />
                      <span className="row-main t-small" style={{ color: 'var(--ink-2)' }}>{row.name}</span>
                      <span className="mono" style={{ fontSize: 'var(--t-small)' }}>{money0(row.final_total)}</span>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
