import Link from 'next/link';
import { priceYes } from '@/lib/amm';
import { wholePercentages } from '@/lib/categorical';
import { colorFor, recentDelta, type Point } from '@/lib/chart';
import { optionsWithPrices, type MarketRow } from '@/lib/data';
import { centsLabel, relative, signedCents, volLabel } from '@/lib/format';
import { MarketGlyph } from './MarketGlyph';
import { Spark } from './Spark';

/**
 * One market in a list.
 *
 * The most repeated object in the app, so it carries exactly four things and no
 * more: what is being asked, where it stands, which way it has moved, and the
 * two buttons that let you disagree.
 */
export async function MarketCard({
  market,
  points,
  base,
}: {
  market: MarketRow;
  points: Point[];
  base: string;
}) {
  const href = `${base}/m/${market.id}`;
  const open = market.status === 'open';
  const delta = recentDelta(points);

  const status =
    market.status === 'open'
      ? `closes ${relative(market.closes_at)}`
      : market.status === 'closed'
        ? 'awaiting resolution'
        : market.status === 'resolving'
          ? 'result in review'
          : market.status === 'resolved'
            ? 'settled'
            : market.status;

  if (market.market_type === 'categorical') {
    const options = (await optionsWithPrices(market)).map((option) => ({
      ...option,
      price: market.status === 'resolved' ? (String(option.id) === market.outcome ? 1 : 0) : option.price,
    }));
    const whole = wholePercentages(options.map((option) => option.price));
    const outcomeLabel = options.find((option) => String(option.id) === market.outcome)?.label;
    const shown = options.slice(0, 4);

    return (
      <article className="mc liftable">
        <Link href={href} className="mc-link">
          <div className="mc-top">
            <MarketGlyph seed={market.id} category={market.category} size={40} />
            <div className="mc-headline">
              <div className="mc-meta">
                <span className="tag">{market.category}</span>
                <span>{volLabel(market.volume)}</span>
                <span className="mk-dot" />
                <span>{status}</span>
              </div>
              <h3 className="mc-q">{market.question}</h3>
            </div>
          </div>

          <div className="mc-outcomes">
            {shown.map((option, index) => (
              <div key={option.id} className="mc-outcome">
                <span className="mc-outcome-label">{option.label}</span>
                <span className="meter mc-outcome-meter">
                  <span style={{ width: `${Math.round(option.price * 100)}%`, background: colorFor(index) }} />
                </span>
                <span className="mono mc-outcome-pct">{whole[index]}%</span>
              </div>
            ))}
            {options.length > shown.length && (
              <div className="mc-more">+{options.length - shown.length} more</div>
            )}
          </div>
        </Link>

        <Link href={href} className="mc-buy mc-buy-wide pressable">
          {open ? 'Trade outcomes' : market.status === 'resolved' ? `Settled · ${outcomeLabel}` : 'View market'}
        </Link>
      </article>
    );
  }

  const p = priceYes({ yes: market.yes_reserve, no: market.no_reserve });

  return (
    <article className="mc liftable">
      <Link href={href} className="mc-link">
        <div className="mc-top">
          <MarketGlyph seed={market.id} category={market.category} size={40} />
          <div className="mc-headline">
            <div className="mc-meta">
              <span className="tag">{market.category}</span>
              <span>{volLabel(market.volume)}</span>
              <span className="mk-dot" />
              <span>{status}</span>
            </div>
            <h3 className="mc-q">{market.question}</h3>
          </div>
        </div>

        <div className="mc-figure">
          <div className="mc-spark">
            <Spark points={points} color={delta.value >= 0 ? 'var(--yes)' : 'var(--no)'} />
          </div>
          <div className="mc-numbers">
            <div className="mono mc-pct">{Math.round(p * 100)}%</div>
            <div className={`mono mc-delta ${delta.value >= 0 ? 'up' : 'down'}`}>{signedCents(delta.value)}</div>
          </div>
        </div>
      </Link>

      {open ? (
        // The side rides along in the URL. Both buttons used to land on the same
        // page with Yes preselected, so pressing No looked like it had done
        // nothing at all.
        <div className="mc-buys">
          <Link href={`${href}?side=YES`} className="mc-buy pill-yes pressable">
            Yes <b className="mono">{centsLabel(p)}</b>
          </Link>
          <Link href={`${href}?side=NO`} className="mc-buy pill-no pressable">
            No <b className="mono">{centsLabel(1 - p)}</b>
          </Link>
        </div>
      ) : (
        <div className="mc-closed">
          {market.status === 'resolved'
            ? `Settled ${market.outcome} — ${market.outcome === 'YES' ? 'Yes' : 'No'} paid $1.00`
            : market.status === 'resolving'
              ? `Proposed ${market.proposed_outcome} — open for review`
              : 'Trading closed — waiting on the admin'}
        </div>
      )}
    </article>
  );
}
