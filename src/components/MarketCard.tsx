import Link from 'next/link';
import { priceYes } from '@/lib/amm';
import type { MarketRow } from '@/lib/data';
import { centsLabel, pctLabel, relative, signedCents, volLabel } from '@/lib/format';
import { Spark } from './Chart';

export function MarketCard({
  market,
  series,
  base,
}: {
  market: MarketRow;
  series: number[];
  base: string;
}) {
  const p = priceYes({ yes: market.yes_reserve, no: market.no_reserve });
  const first = series.length > 1 ? series[Math.max(0, series.length - 7)] : market.open_price;
  const delta = p - first;
  const deltaColor = delta >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)';
  const href = `${base}/m/${market.id}`;
  const tradable = market.status === 'open';

  return (
    <article className="card market-card">
      <Link href={href} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div className="market-meta">
          <span className="tag">{market.category}</span>
          <span>{volLabel(market.volume)}</span>
          <span>·</span>
          <span>
            {market.status === 'open'
              ? `closes ${relative(market.closes_at)}`
              : market.status === 'closed'
                ? 'awaiting resolution'
                : market.status === 'resolved'
                  ? `resolved ${market.outcome}`
                  : market.status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div className="market-q" style={{ flex: 1 }}>
            {market.question}
          </div>
          <div
            style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}
          >
            <Spark series={series} color={deltaColor} />
            <div className="mono" style={{ fontSize: 10.5, fontWeight: 500, color: deltaColor }}>
              {signedCents(delta)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="oddsbar">
            <span style={{ width: pctLabel(p) }} />
          </div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
            {pctLabel(p)}
          </div>
        </div>
      </Link>

      {tradable ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`${href}?side=YES`} className="side-btn pill-yes">
            Yes {centsLabel(p)}
          </Link>
          <Link href={`${href}?side=NO`} className="side-btn pill-no">
            No {centsLabel(1 - p)}
          </Link>
        </div>
      ) : (
        <div
          style={{
            padding: 11,
            borderRadius: 10,
            background: 'var(--chip)',
            textAlign: 'center',
            fontSize: 12.5,
            color: 'var(--dim)',
          }}
        >
          {market.status === 'resolved'
            ? `Settled ${market.outcome} — ${market.outcome === 'YES' ? 'Yes' : 'No'} shares paid $1.00`
            : 'Trading closed — waiting on the admin'}
        </div>
      )}
    </article>
  );
}
