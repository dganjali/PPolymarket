'use client';

import Link from 'next/link';
import { useState } from 'react';
import { priceYes } from '@/lib/amm';
import { categoricalPrices } from '@/lib/categorical';
import type { Series } from '@/lib/chart';
import type { Moment, RelatedMarket } from '@/lib/history';
import { centsLabel, signedCents, volLabel } from '@/lib/format';
import { MarketGlyph } from './MarketGlyph';
import { PriceChart } from './PriceChart';
import { TradeTicket, type TicketBook, type TicketLeg } from './TradeTicket';

/**
 * The interactive half of a market page: the chart, the outcome list, and the
 * ticket, which all have to agree on which outcome you are looking at.
 *
 * They live in one client component because picking an outcome has to be
 * instant. Doing it through the URL would be simpler and would cost a server
 * round trip per click, which on a page whose whole job is "tap the thing you
 * think will happen" is the wrong trade. Everything static — the rules, the
 * holders, the comments — is still server-rendered and arrives as children.
 */

export function MarketTrading({
  slug,
  marketId,
  question,
  category,
  book,
  legs,
  series,
  moments,
  balance,
  tradable,
  closedReason,
  volume,
  closesLabel,
  watermark,
  deltas,
  now,
  related,
  base,
  children,
}: {
  slug: string;
  marketId: number;
  question: string;
  category: string;
  book: TicketBook;
  legs: TicketLeg[];
  series: Series[];
  moments: Moment[];
  balance: number;
  tradable: boolean;
  closedReason?: string;
  volume: number;
  closesLabel: string;
  watermark?: string;
  /** Change over the last day, per leg, in probability points. */
  deltas: number[];
  /**
   * The instant the page was rendered on the server.
   *
   * The chart's window ends at "now", and the client calling `Date.now()` for
   * itself lands milliseconds later than the server did — which shifts every
   * x-coordinate and makes React tear down the whole chart on hydration. So
   * "now" is decided once, on the server, and travels with the data.
   */
  now: number;
  related: RelatedMarket[];
  base: string;
  children: React.ReactNode;
}) {
  const [activeKey, setActiveKey] = useState(legs[0]?.key ?? 'YES');

  const prices =
    book.kind === 'binary'
      ? [
          book.reserves.no / (book.reserves.yes + book.reserves.no),
          book.reserves.yes / (book.reserves.yes + book.reserves.no),
        ]
      : categoricalPrices({ liquidity: book.liquidity, quantities: book.quantities });

  const binary = book.kind === 'binary';
  // One row per thing you can hold. On a Yes/No market that is two rows, which
  // reads better than one row of two buttons: the No side has its own price,
  // its own move and its own position, and burying it inside the Yes row is
  // what made the old page feel like Yes was the only real answer.
  const rows = legs;

  return (
    <div className="mk-grid">
      <div className="mk-main">
        <section className="surface mk-chartcard">
          <PriceChart series={series} moments={moments} watermark={watermark} now={now} />
          <div className="mk-chartmeta">
            <span className="mono">{volLabel(volume)}</span>
            <span className="mk-dot" />
            <span className="mono">{closesLabel}</span>
          </div>
        </section>

        <section className="mk-outcomes">
          {rows.map((leg, i) => {
            const price = prices[i];
            // On a Yes/No market the two rows are mirror images, so only the Yes
            // row carries a move — showing "+3" beside "−3" is noise.
            const delta = binary ? (i === 0 ? deltas[0] : -deltas[0]) : deltas[i] ?? 0;
            return (
              <article key={leg.key} className="mk-outcome" data-on={leg.key === activeKey}>
                <span
                  className="mk-outcome-mark"
                  style={{ background: binary ? (i === 0 ? 'var(--yes)' : 'var(--no)') : leg.color }}
                />
                <div className="mk-outcome-main">
                  <h3 className="mk-outcome-name">{leg.label}</h3>
                  <div className="mk-outcome-sub mono">
                    {leg.held > 0.0001
                      ? `You hold ${Math.round(leg.held).toLocaleString('en-US')}`
                      : 'No position'}
                  </div>
                </div>

                <div className="mk-outcome-figure">
                  <div className="mk-outcome-pct mono">{Math.round(price * 100)}%</div>
                  {Math.abs(delta) >= 0.005 && (
                    <div className={`mk-outcome-delta mono ${delta >= 0 ? 'up' : 'down'}`}>
                      {delta >= 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(0)}
                    </div>
                  )}
                </div>

                <div className="mk-outcome-buys">
                  <button
                    type="button"
                    className={`mk-buy pressable ${binary && i === 1 ? 'pill-no' : 'pill-yes'}`}
                    onClick={() => setActiveKey(leg.key)}
                    data-on={leg.key === activeKey}
                    disabled={!tradable}
                  >
                    Buy {binary ? leg.label : ''} <b className="mono">{centsLabel(price)}</b>
                  </button>
                </div>
              </article>
            );
          })}
          {!binary && (
            <p className="mk-outcome-note">
              Every outcome is priced against the others, so the column always adds to 100%. Backing one
              pushes the rest down.
            </p>
          )}
        </section>

        {children}
      </div>

      <aside className="mk-rail">
        <TradeTicket
          key={activeKey}
          slug={slug}
          marketId={marketId}
          question={question}
          category={category}
          book={book}
          legs={legs}
          balance={balance}
          tradable={tradable}
          closedReason={closedReason}
          initialKey={activeKey}
        />

        {related.length > 0 && (
          <section className="surface mk-related">
            <div className="sec">
              <h2 className="h-head">Also trading</h2>
            </div>
            {related.map((sibling) => (
              <Link key={sibling.id} href={`${base}/m/${sibling.id}`} className="mk-related-row liftable">
                <MarketGlyph seed={sibling.id} category={sibling.category} size={30} />
                <span className="mk-related-q">{sibling.question}</span>
                <span className="mk-related-pct mono">
                  {sibling.market_type === 'categorical'
                    ? '—'
                    : `${Math.round(priceYes({ yes: sibling.yes_reserve, no: sibling.no_reserve }) * 100)}%`}
                </span>
              </Link>
            ))}
          </section>
        )}
      </aside>
    </div>
  );
}

/** The headline number above the chart. */
export function MarketHeadline({
  label,
  price,
  delta,
  color,
  settled,
}: {
  label: string;
  price: number;
  delta: { value: number; label: string };
  color: string;
  settled?: string;
}) {
  return (
    <div className="mk-headline">
      <div className="mk-headline-pct mono" style={{ color }}>
        {settled ?? `${Math.round(price * 100)}%`}
      </div>
      <div className="mk-headline-side">
        <div className="mk-headline-label">{label}</div>
        {!settled && (
          <div className={`mk-headline-delta mono ${delta.value >= 0 ? 'up' : 'down'}`}>
            {signedCents(delta.value)} {delta.label}
          </div>
        )}
      </div>
    </div>
  );
}
