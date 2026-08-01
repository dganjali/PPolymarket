import Link from 'next/link';
import { priceYes } from '@/lib/amm';
import { wholePercentages } from '@/lib/categorical';
import { optionsWithPrices, type MarketRow } from '@/lib/data';
import { centsLabel, pctLabel, relative, signedCents, volLabel } from '@/lib/format';
import { Spark } from './Chart';

export async function MarketCard({
  market,
  series,
  base,
}: {
  market: MarketRow;
  series: number[];
  base: string;
}) {
  if (market.market_type === 'categorical') {
    const options = (await optionsWithPrices(market)).map((option) => ({
      ...option,
      price: market.status === 'resolved' ? (String(option.id) === market.outcome ? 1 : 0) : option.price,
    }));
    const outcomeLabel = options.find((option) => String(option.id) === market.outcome)?.label;
    const proposedLabel = options.find((option) => String(option.id) === market.proposed_outcome)?.label;
    const displayedPercentages = wholePercentages(options.map((option) => option.price));
    const href = `${base}/m/${market.id}`;
    return (
      <article className="card market-card">
        <Link href={href} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="market-meta">
            <span className="tag">{market.category}</span>
            <span>Multiple choice</span>
            <span>·</span>
            <span>{volLabel(market.volume)}</span>
            <span>·</span>
            <span>
              {market.status === 'open'
                ? `closes ${relative(market.closes_at)}`
                : market.status === 'resolving'
                  ? `proposed ${proposedLabel}`
                  : market.status === 'resolved'
                    ? `resolved ${outcomeLabel}`
                    : market.status}
            </span>
          </div>
          <div className="market-q">{market.question}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {options.slice(0, 4).map((option, index) => (
              <div key={option.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {option.label}
                </div>
                <div className="oddsbar" style={{ maxWidth: 120 }}><span style={{ width: `${option.price * 100}%` }} /></div>
                <div className="mono" style={{ width: 38, textAlign: 'right', fontSize: 11.5 }}>{displayedPercentages[index]}%</div>
              </div>
            ))}
          </div>
        </Link>
        <Link href={href} className="side-btn" style={{ justifyContent: 'center' }}>
          {market.status === 'open' ? 'Trade outcomes' : market.status === 'resolved' ? `Settled · ${outcomeLabel}` : 'View market'}
        </Link>
      </article>
    );
  }

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
                : market.status === 'resolving'
                  ? `proposed ${market.proposed_outcome} · in review`
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
            : market.status === 'resolving'
              ? `Proposed ${market.proposed_outcome} — open for member review`
            : 'Trading closed — waiting on the admin'}
        </div>
      )}
    </article>
  );
}
