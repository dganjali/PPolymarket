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
    <div className="wrap narrow stack stagger">
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

      <section className="surface rows">
        <div className="table-head">
          <span>#</span>
          <span>Member</span>
          <span>Worth</span>
          <span>Season</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.userId} className="stand-row" data-me={r.userId === user.id} data-place={i + 1}>
            <span className="stand-rank">{i + 1}</span>
            <span className="stand-who">
              <Avatar name={r.name} src={r.avatar} size={28} radius={9} />
              <span className="stand-name">{r.name}</span>
            </span>
            <span className="stand-total">{money0(r.total)}</span>
            <span className={`stand-pnl ${r.pnl >= 0 ? 'up' : 'down'}`}>{signedMoney(r.pnl)}</span>
          </div>
        ))}
      </section>

      <p className="t-micro stand-note">
        Worth = the cash you are holding plus whatever your open bets are worth right now. Everyone
        started on {money0(group.starting_balance)}.
      </p>

      {seasons.length > 0 && (
        <section className="stack-tight past-seasons">
          <h2 className="h-head">Past seasons</h2>
          {seasons.map((season) => {
            const finishers = history.filter((row) => row.season_number === season.season_number);
            return (
              <details key={season.id} className="surface season">
                <summary className="season-summary">
                  <span className="mono season-tag">S{season.season_number}</span>
                  {season.champion_name && (
                    <Avatar name={season.champion_name} src={season.champion_avatar} size={26} radius={8} />
                  )}
                  <span className="row-main">
                    <span className="row-name">{season.champion_name ?? 'No winner'}</span>
                    <span className="row-sub season-when">
                      {longDateLabel(season.ended_at)} · {season.entrants} played
                    </span>
                  </span>
                  <span className="t-micro">open</span>
                </summary>
                <div className="season-body">
                  {season.prize && <p className="t-small season-prize">Won: {season.prize}</p>}
                  {finishers.map((row) => (
                    <div key={row.user_id} className="row season-row">
                      <span className="mono season-rank">{row.rank}</span>
                      <Avatar name={row.name} src={row.avatar} size={22} radius={7} />
                      <span className="row-main t-small season-name">{row.name}</span>
                      <span className="mono season-total">{money0(row.final_total)}</span>
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
