import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { all } from '@/lib/db';
import { openLegs, standings } from '@/lib/data';
import { money0, pctLabel, signedMoney } from '@/lib/format';
import { ProfileForm } from '@/components/ProfileForm';
import { LeaveGroup } from '@/components/LeaveGroup';

/** Your bets, your record, and who you are — the three things that are yours. */
export default async function YouPage({ params }: { params: Promise<{ slug: string }> }) {
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

  type Settled = { id: number; question: string; outcome: string; realized: number; resolved_at: string };
  const [settledBinary, settledChoice] = await Promise.all([
    all<Settled>(
      `SELECT m.id, m.question, m.outcome, p.realized, m.resolved_at
         FROM positions p JOIN markets m ON m.id = p.market_id
        WHERE p.user_id = ? AND m.group_id = ? AND m.season_number = ? AND m.status = 'resolved'
        ORDER BY m.resolved_at DESC LIMIT 20`,
      user.id,
      group.id,
      group.current_season,
    ),
    // Joined on the option id as text: casting m.outcome to an integer throws on
    // Postgres the moment a binary market's 'YES' reaches the cast.
    all<Settled>(
      `SELECT m.id, m.question, COALESCE(winner.label, 'settled') AS outcome,
              SUM(p.realized) AS realized, m.resolved_at
         FROM option_positions p JOIN markets m ON m.id = p.market_id
         LEFT JOIN market_options winner
                ON winner.market_id = m.id AND CAST(winner.id AS TEXT) = m.outcome
        WHERE p.user_id = ? AND m.group_id = ? AND m.season_number = ? AND m.status = 'resolved'
        GROUP BY m.id, m.question, winner.label, m.resolved_at
        ORDER BY m.resolved_at DESC LIMIT 20`,
      user.id,
      group.id,
      group.current_season,
    ),
  ]);
  const settled = [...settledBinary, ...settledChoice]
    .sort((a, b) => b.resolved_at.localeCompare(a.resolved_at))
    .slice(0, 20);
  const won = settled.filter((s) => s.realized > 0).length;

  return (
    <div className="wrap stack" style={{ maxWidth: 720 }}>
      <section className="surface">
        <div className="t-micro">You&rsquo;re worth</div>
        <div className="mono h-display" style={{ marginTop: 4 }}>{money0(total)}</div>
        <div
          className="mono t-small"
          style={{ color: pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)', marginTop: 2 }}
        >
          {signedMoney(pnl)} since the season started
        </div>

        <div style={{ display: 'flex', gap: 'var(--s-3)', marginTop: 'var(--s-3)', paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
          {([
            ['Spare cash', money0(ms.balance)],
            ['On the table', money0(invested)],
            ['Position', rank ? `${rank} of ${rows.length}` : '—'],
          ] as const).map(([label, value]) => (
            <div key={label} style={{ flex: 1, minWidth: 0 }}>
              <div className="t-micro">{label}</div>
              <div className="mono" style={{ fontSize: 'var(--t-head)', fontWeight: 600, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="sec">
          <h2 className="h-head">Bets running</h2>
          <span className="t-micro">{legs.length}</span>
        </div>
        <div className="surface" style={{ padding: 'var(--s-2)' }}>
          {legs.map((leg) => {
            const up = leg.value >= leg.cost;
            return (
              <Link key={`${leg.market.id}-${leg.optionId ?? leg.side}`} href={`${base}/m/${leg.market.id}`} className="row">
                <div className="row-main">
                  <div className="row-name" style={{ fontSize: 'var(--t-small)' }}>{leg.market.question}</div>
                  <div className="row-sub">
                    {leg.side} · {pctLabel(leg.price)} chance now
                  </div>
                </div>
                <div className="row-figure">
                  {money0(leg.value)}
                  <div className="t-micro" style={{ color: up ? 'var(--yes-hi)' : 'var(--no-hi)', marginTop: 2 }}>
                    {signedMoney(leg.value - leg.cost)}
                  </div>
                </div>
              </Link>
            );
          })}
          {legs.length === 0 && (
            <p className="t-small" style={{ margin: 0, padding: 'var(--s-2)' }}>
              Nothing running. Back something on <Link href={base} style={{ color: 'var(--accent)' }}>Home</Link>.
            </p>
          )}
        </div>
      </section>

      {settled.length > 0 && (
        <section>
          <div className="sec">
            <h2 className="h-head">Settled</h2>
            <span className="t-micro">{won} of {settled.length} called right</span>
          </div>
          <div className="surface" style={{ padding: 'var(--s-2)' }}>
            {settled.map((s) => (
              <Link key={s.id} href={`${base}/m/${s.id}`} className="row">
                <div className="row-main">
                  <div className="row-name" style={{ fontSize: 'var(--t-small)' }}>{s.question}</div>
                  <div className="row-sub">ended {s.outcome}</div>
                </div>
                <div className="mono" style={{ fontSize: 'var(--t-small)', color: s.realized >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}>
                  {signedMoney(s.realized)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="sec">
          <h2 className="h-head">Your profile</h2>
        </div>
        <ProfileForm name={user.name} handle={user.handle} avatar={user.avatar} />
      </section>

      <LeaveGroup slug={slug} groupName={group.name} isOwner={user.id === group.owner_id} openPositions={legs.length} />
    </div>
  );
}
