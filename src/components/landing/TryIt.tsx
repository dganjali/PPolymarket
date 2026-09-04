'use client';

import { useMemo, useState } from 'react';
import { FEE_RATE, priceYes, quoteBuy, seedReserves, type Reserves, type Side } from '@/lib/amm';
import { TRY, points, walk } from '@/lib/landing';
import { Glyph } from './Glyphs';

const QUICK = [5, 25, 100, 250];
const MAX = 500;
const W = 560;
const H = 120;

interface Fill {
  side: Side;
  spend: number;
  shares: number;
  avg: number;
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cents = (p: number) => `${Math.max(1, Math.min(99, Math.round(p * 100)))}¢`;
const pct = (p: number) => `${Math.round(p * 100)}%`;

/**
 * A market you can trade against, right here.
 *
 * This is the app's own market maker (src/lib/amm.ts), not a sketch of it:
 * the same `quoteBuy` prices every order inside a group. The pool, the
 * history and the visitor's position live in component state and go away
 * with the tab, which is the whole point of a sandbox.
 */
export function TryIt() {
  const [pool, setPool] = useState<Reserves>(() => seedReserves(TRY.probability, TRY.funding));
  const [side, setSide] = useState<Side>('YES');
  const [amount, setAmount] = useState(25);
  const [history, setHistory] = useState<number[]>(() => walk('sandbox', 0.55, TRY.probability, 48));
  const [fills, setFills] = useState<Fill[]>([]);
  const [cash, setCash] = useState(TRY.bankroll);

  const p = priceYes(pool);
  const spend = Math.min(amount, Math.floor(cash));
  const quote = useMemo(() => quoteBuy(pool, side, spend), [pool, side, spend]);

  const held = fills.reduce(
    (acc, fill) => ({ ...acc, [fill.side]: acc[fill.side] + fill.shares }),
    { YES: 0, NO: 0 } as Record<Side, number>,
  );
  const worth = held.YES * p + held.NO * (1 - p);
  const spent = fills.reduce((sum, fill) => sum + fill.spend, 0);
  const opened = history[0];
  const moved = p - TRY.probability;

  const place = () => {
    if (quote.shares <= 0) return;
    setPool(quote.reservesAfter);
    setCash((c) => c - quote.cost);
    setFills((f) => [...f, { side, spend: quote.cost, shares: quote.shares, avg: quote.avgPrice }]);
    setHistory((h) => [...h.slice(-95), priceYes(quote.reservesAfter)]);
  };

  const reset = () => {
    setPool(seedReserves(TRY.probability, TRY.funding));
    setHistory(walk('sandbox', 0.55, TRY.probability, 48));
    setFills([]);
    setCash(TRY.bankroll);
    setAmount(25);
    setSide('YES');
  };

  const area = `0,${H} ${points(history, W, H, 4)} ${W},${H}`;
  const sideColor = side === 'YES' ? 'var(--yes)' : 'var(--no)';
  const ready = quote.shares > 0 && spend > 0;

  return (
    <section className="pm-try" id="try">
      <div className="pm-how-head">
        <span className="pm-eyebrow">Try it</span>
        <h2>Move a market yourself.</h2>
        <p className="pm-try-lede">
          This is the exact market maker the app runs, with a pretend {money(TRY.bankroll).replace('.00', '')}.
          Back a side and watch the odds answer. Nothing here leaves your browser.
        </p>
      </div>

      <div className="pm-try-grid">
        <article className="pm-try-market">
          <div className="pm-hero-head">
            <div className="pm-thumb" style={{ background: TRY.tint }}>
              <Glyph name={TRY.glyph} size={26} />
            </div>
            <div className="pm-hero-heading">
              <div className="pm-crumb">
                {TRY.crumb.map((c, n) => (
                  <span key={c}>
                    {n > 0 && <span className="pm-crumb-dot">·</span>}
                    {c}
                  </span>
                ))}
              </div>
              <h3 className="pm-hero-title">{TRY.question}</h3>
            </div>
          </div>

          <div className="pm-try-headline">
            <b key={Math.round(p * 1000)} className="tick" style={{ color: moved >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}>
              {pct(p)}
            </b>
            <span>
              chance of Yes
              <em className={moved >= 0 ? 'up' : 'down'}>
                {moved >= 0 ? '+' : '−'}
                {Math.abs(Math.round(moved * 100))} since you got here
              </em>
            </span>
          </div>

          <div className="pm-try-chart">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="pm-try-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#4ec97f" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#4ec97f" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((g) => (
                <line
                  key={g}
                  x1="0"
                  x2={W}
                  y1={(1 - g) * H}
                  y2={(1 - g) * H}
                  stroke="#252525"
                  strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <polygon points={area} fill="url(#pm-try-fill)" />
              <polyline
                points={points(history, W, H, 4)}
                fill="none"
                stroke="#4ec97f"
                strokeWidth="1.8"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <i className="pm-dot pm-dot-live" style={{ background: '#4ec97f', left: '100%', top: `${(1 - p) * 100}%` }} />
          </div>

          <div className="pm-try-meta mono">
            <span>opened at {pct(opened)}</span>
            <span className="pm-crumb-dot">·</span>
            <span>pool {money(pool.yes + pool.no)}</span>
            <span className="pm-crumb-dot">·</span>
            <span>
              {fills.length} fill{fills.length === 1 ? '' : 's'} this visit
            </span>
          </div>
        </article>

        <aside className="pm-try-ticket">
          <div className="pm-try-sides" role="tablist" aria-label="Side">
            {(['YES', 'NO'] as Side[]).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={side === s}
                className="pm-try-side"
                data-side={s.toLowerCase()}
                data-on={side === s}
                onClick={() => setSide(s)}
              >
                {s === 'YES' ? 'Yes' : 'No'} <b className="mono">{cents(s === 'YES' ? p : 1 - p)}</b>
              </button>
            ))}
          </div>

          <div className="pm-try-amount">
            <label htmlFor="pm-try-range">
              Amount <b className="mono">${spend}</b>
            </label>
            <input
              id="pm-try-range"
              type="range"
              min={1}
              max={Math.max(1, Math.min(MAX, Math.floor(cash)))}
              step={1}
              value={spend}
              onChange={(event) => setAmount(Number(event.target.value))}
              style={{ accentColor: sideColor }}
              aria-valuetext={`$${spend}`}
            />
            <div className="pm-try-quick">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="pm-try-chip"
                  data-on={amount === q}
                  disabled={q > cash}
                  onClick={() => setAmount(q)}
                >
                  ${q}
                </button>
              ))}
            </div>
          </div>

          <dl className="pm-try-quote mono">
            <div>
              <dt>You get</dt>
              <dd>
                {quote.shares.toFixed(1)} {side === 'YES' ? 'Yes' : 'No'} shares
              </dd>
            </div>
            <div>
              <dt>Average price</dt>
              <dd>{cents(quote.avgPrice)}</dd>
            </div>
            <div>
              <dt>Odds move</dt>
              <dd>
                {pct(quote.priceBefore)} <span className="pm-try-arrow">to</span>{' '}
                <b style={{ color: sideColor }}>{pct(quote.priceAfter)}</b>
              </dd>
            </div>
            <div>
              <dt>If you are right</dt>
              <dd>
                {money(quote.payout)} <span className="pm-try-dim">for {money(quote.cost)}</span>
              </dd>
            </div>
            <div>
              <dt>Fee, stays in the pool</dt>
              <dd>
                {money(quote.fee)} <span className="pm-try-dim">({(FEE_RATE * 100).toFixed(1)}%)</span>
              </dd>
            </div>
          </dl>

          <button
            type="button"
            className="pm-try-go"
            data-side={side.toLowerCase()}
            disabled={!ready}
            onClick={place}
          >
            {cash < 1 ? 'Out of play money' : `Buy ${side === 'YES' ? 'Yes' : 'No'} for $${spend}`}
          </button>

          <div className="pm-try-pos mono">
            <div>
              <span>Cash</span>
              <b>{money(cash)}</b>
            </div>
            <div>
              <span>You hold</span>
              <b>
                {held.YES > 0.05 ? `${held.YES.toFixed(0)} Yes` : ''}
                {held.YES > 0.05 && held.NO > 0.05 ? ' · ' : ''}
                {held.NO > 0.05 ? `${held.NO.toFixed(0)} No` : ''}
                {held.YES <= 0.05 && held.NO <= 0.05 ? 'nothing yet' : ''}
              </b>
            </div>
            <div>
              <span>Worth at these odds</span>
              <b className={worth - spent >= 0 ? 'up' : 'down'}>
                {money(worth)}
                {fills.length > 0 && ` (${worth - spent >= 0 ? '+' : '−'}${money(Math.abs(worth - spent)).slice(1)})`}
              </b>
            </div>
            {fills.length > 0 && (
              <button type="button" className="pm-try-reset" onClick={reset}>
                Start over
              </button>
            )}
          </div>
        </aside>
      </div>

      <p className="pm-try-note">
        Bigger orders pay a worse average price on purpose. The pool keeps yes × no constant, so every share you
        take out makes the next one dearer — which is what stops anyone from buying certainty with a big enough
        bankroll.
      </p>
    </section>
  );
}
