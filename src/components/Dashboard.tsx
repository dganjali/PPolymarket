import Link from 'next/link';
import { money0, signedMoney } from '@/lib/format';
import { Avatar } from './ui';

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down' | 'gold';
}) {
  const colour = tone === 'up' ? 'var(--yes-hi)' : tone === 'down' ? 'var(--no-hi)' : tone === 'gold' ? 'var(--gold)' : undefined;
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="n" style={{ color: colour }}>{value}</div>
      {hint && (
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--dim-2)', marginTop: 3 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export interface PodiumEntry {
  place: number;
  label: string;
  holder?: { name: string; avatar: string | null; total: number };
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

/**
 * What each place is playing for, and who is standing there right now. Ranked
 * prizes are the point of the season, so they get the top of the dashboard.
 */
export function Podium({ entries, punishment, lastPlace }: {
  entries: PodiumEntry[];
  punishment: string;
  lastPlace?: { name: string; avatar: string | null; total: number };
}) {
  if (entries.length === 0 && !punishment) return null;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div className="podium">
        {entries.map((entry) => (
          <div key={entry.place} className="podium-row" data-place={entry.place}>
            <div className="podium-top">
              <div className="podium-place">{ORDINAL[entry.place] ?? `${entry.place}th`}</div>
              {entry.holder ? (
                <>
                  <Avatar name={entry.holder.name} src={entry.holder.avatar} size={30} radius={9} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.holder.name}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
                      {money0(entry.holder.total)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mono" style={{ fontSize: 11, color: 'var(--dim-2)' }}>nobody yet</div>
              )}
            </div>
            <div className="podium-label">{entry.label}</div>
          </div>
        ))}
      </div>

      {punishment && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            background: '#251A18',
            border: '1px solid #3E2B27',
          }}
        >
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--no-hi)', flex: 'none' }}>
            LAST
          </div>
          {lastPlace && <Avatar name={lastPlace.name} src={lastPlace.avatar} size={24} radius={7} />}
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--ink-4)' }}>
            {lastPlace ? <strong style={{ color: 'var(--ink-2)' }}>{lastPlace.name}</strong> : 'Nobody'} — {punishment}
          </div>
        </div>
      )}
    </section>
  );
}

export interface StandingRow {
  userId: number;
  name: string;
  avatar: string | null;
  total: number;
  pnl: number;
}

export function StandingsPanel({
  rows,
  meId,
  href,
  title = 'Standings',
}: {
  rows: StandingRow[];
  meId: number;
  href: string;
  title?: string;
}) {
  return (
    <section className="card" style={{ padding: 13 }}>
      <div className="panel-head">
        <div className="eyebrow" style={{ padding: 0 }}>{title}</div>
        <Link href={href} className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
          ALL
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row, index) => {
          const me = row.userId === meId;
          return (
            <div
              key={row.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 8px',
                borderRadius: 9,
                background: me ? 'var(--gold-bg)' : 'transparent',
              }}
            >
              <div
                className="mono"
                style={{ width: 16, fontSize: 11, color: index === 0 || me ? 'var(--gold)' : 'var(--dim)' }}
              >
                {index + 1}
              </div>
              <Avatar name={row.name} src={row.avatar} size={26} radius={8} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.name}
              </div>
              <div className="mono" style={{ fontSize: 11.5, textAlign: 'right' }}>
                <div>{money0(row.total)}</div>
                <div style={{ fontSize: 9.5, color: row.pnl >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}>
                  {signedMoney(row.pnl)}
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="mono" style={{ fontSize: 11, color: 'var(--dim-2)' }}>Nobody yet.</div>}
      </div>
    </section>
  );
}
