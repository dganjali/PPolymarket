'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { tradeAction, type FormState } from '@/app/actions';
import { quoteBuy, quoteSell, type Reserves, type Side } from '@/lib/amm';
import { categoricalPrices, quoteCategoricalBuy, quoteCategoricalSell } from '@/lib/categorical';
import { centsLabel, money, pctLabel, shares as fmtShares, signedCents } from '@/lib/format';
import { Confetti } from './Confetti';
import { MarketGlyph } from './MarketGlyph';
import { Chevron, Info } from './Icon';
import { SubmitButton, Toast } from './ui';

/**
 * The order ticket.
 *
 * One component for both market types. A binary market shows two price buttons;
 * a multiple-choice market shows the outcome you picked and lets you change it.
 * Underneath, both post to the same server action — the only difference is
 * whether an `optionId` rides along.
 *
 * Everything is quoted on the client from the same pure functions the engine
 * uses on the server, so the number under your thumb is the number you get,
 * up to whoever trades between your quote and your submit.
 */

export interface TicketLeg {
  key: string;
  label: string;
  color: string;
  /** Shares of this leg the trader already holds. */
  held: number;
  /** Set for a multiple-choice outcome. */
  optionId?: number;
  /** Set for a binary side. */
  side?: Side;
}

export type TicketBook =
  | { kind: 'binary'; reserves: Reserves }
  | { kind: 'categorical'; liquidity: number; quantities: number[] };

type Mode = 'BUY' | 'SELL';

const QUICK = [1, 5, 10, 100];

export function TradeTicket({
  slug,
  marketId,
  question,
  category,
  book,
  legs,
  balance,
  tradable,
  closedReason,
  activeKey,
  onPick,
  open,
  onOpenChange,
}: {
  slug: string;
  marketId: number;
  question: string;
  category: string;
  book: TicketBook;
  legs: TicketLeg[];
  balance: number;
  tradable: boolean;
  /** Why trading is off, when it is. */
  closedReason?: string;
  /** Which leg is being traded. Owned by the page, so the outcome list agrees. */
  activeKey: string;
  onPick: (key: string) => void;
  /** Whether the phone sheet is up. Ignored on a desktop, where the rail is always open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState(tradeAction, {} as FormState);
  const [mode, setMode] = useState<Mode>('BUY');
  const [amount, setAmount] = useState('');
  const [qty, setQty] = useState('');
  const [picking, setPicking] = useState(false);
  // Where the paper comes from when a fill lands.
  const go = useRef<HTMLDivElement>(null);

  const index = Math.max(0, legs.findIndex((leg) => leg.key === activeKey));
  const leg = legs[index] ?? legs[0];

  // A fill clears the ticket; fresh prices arrive as props on the next render.
  useEffect(() => {
    if (state.ok) {
      setAmount('');
      setQty('');
      onOpenChange(false);
      setPicking(false);
    }
    // `onOpenChange` is stable enough in practice, and depending on it would
    // re-run this on every parent render and close the sheet mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const prices = useMemo(
    () =>
      book.kind === 'binary'
        ? [
            book.reserves.no / (book.reserves.yes + book.reserves.no),
            book.reserves.yes / (book.reserves.yes + book.reserves.no),
          ]
        : categoricalPrices({ liquidity: book.liquidity, quantities: book.quantities }),
    [book],
  );

  const spend = Number(amount) || 0;
  const sellQty = Math.min(leg?.held ?? 0, Number(qty) || 0);

  const quote = useMemo(() => {
    if (book.kind === 'binary') {
      const side = (leg?.side ?? 'YES') as Side;
      return mode === 'BUY'
        ? quoteBuy(book.reserves, side, spend)
        : quoteSell(book.reserves, side, sellQty);
    }
    const state = { liquidity: book.liquidity, quantities: book.quantities };
    return mode === 'BUY'
      ? quoteCategoricalBuy(state, index, spend)
      : quoteCategoricalSell(state, index, sellQty);
  }, [book, leg, index, mode, spend, sellQty]);

  const buying = mode === 'BUY';
  const shares = buying ? quote.shares : sellQty;
  const proceeds = 'proceeds' in quote ? quote.proceeds : 0;
  const payout = 'payout' in quote ? quote.payout : 0;
  const impact = quote.priceAfter - quote.priceBefore;

  const canBuy = spend > 0 && spend <= balance + 1e-9;
  const canSell = sellQty > 0.0001;
  const ready = tradable && (buying ? canBuy : canSell);
  const cashAfter = buying ? balance - spend : balance + proceeds;
  const holdsAnything = legs.some((l) => l.held > 0.0001);

  const label = !tradable
    ? 'Trading closed'
    : buying
      ? spend <= 0
        ? 'Enter an amount'
        : !canBuy
          ? 'Not enough cash'
          : `Buy ${fmtShares(shares)} ${leg?.label ?? ''}`
      : sellQty <= 0
        ? 'Enter a share count'
        : `Sell ${fmtShares(sellQty)} for ${money(proceeds)}`;

  const bump = (value: number) =>
    setAmount((current) => String(Math.min(Math.floor(balance), (Number(current) || 0) + value)));

  return (
    <>
      {/* Phones get a fixed buy bar; the rail is always open on a desktop. */}
      {tradable && !open && (
        <div className="trade-trigger mobile-only">
          {legs.slice(0, 2).map((option, i) => (
            <button
              key={option.key}
              className={`side-btn pressable ${book.kind === 'binary' ? (i === 0 ? 'pill-yes' : 'pill-no') : 'pill-yes'}`}
              onClick={() => {
                onPick(option.key);
                setMode('BUY');
                onOpenChange(true);
              }}
            >
              <div className="tt-trigger-label">{book.kind === 'binary' ? `Buy ${option.label}` : option.label}</div>
              <div className="mono tt-trigger-price">{centsLabel(prices[i])}</div>
            </button>
          ))}
        </div>
      )}

      <div className="sheet" data-open={open} onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}>
        <form action={formAction} className="sheet-body tt">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="marketId" value={marketId} />
          <input type="hidden" name="action" value={mode} />
          <input type="hidden" name="side" value={leg?.side ?? 'YES'} />
          <input type="hidden" name="optionId" value={leg?.optionId ?? ''} />
          <input type="hidden" name="amount" value={buying ? amount : ''} />
          <input type="hidden" name="shares" value={buying ? '' : String(sellQty)} />

          <header className="tt-head">
            <MarketGlyph seed={marketId} category={category} size={38} />
            <div className="tt-head-main">
              <div className="tt-head-q">{question}</div>
              <div className="tt-head-leg">
                <span className="chart-dot" style={{ background: leg?.color }} />
                {leg?.label}
              </div>
            </div>
            <button
              type="button"
              className="tt-close mobile-only pressable"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div className="tt-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={buying}
              data-on={buying}
              className="tt-tab"
              onClick={() => setMode('BUY')}
            >
              Buy
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!buying}
              data-on={!buying}
              className="tt-tab"
              onClick={() => setMode('SELL')}
              disabled={!holdsAnything}
              title={holdsAnything ? undefined : 'You have nothing to sell in this market yet'}
            >
              Sell
            </button>
            <span className="tt-order mono">
              Market
              <span className="tt-hint" role="note">
                <Info size={13} />
                <span className="tt-hint-body">
                  There is no order book. Every trade fills against the pool at the price your size moves it to.
                </span>
              </span>
            </span>
          </div>

          {/* Which leg you are trading. Two buttons for a Yes/No market; a
              picker for a multiple-choice one, where two would be a lie. */}
          {book.kind === 'binary' ? (
            <div className="tt-sides">
              {legs.map((option, i) => (
                <button
                  key={option.key}
                  type="button"
                  className="tt-side pressable"
                  data-side={i === 0 ? 'yes' : 'no'}
                  data-on={activeKey === option.key}
                  onClick={() => onPick(option.key)}
                >
                  {option.label} <b className="mono">{centsLabel(prices[i])}</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="tt-picker">
              <button
                type="button"
                className="tt-pick pressable"
                onClick={() => setPicking((p) => !p)}
                aria-expanded={picking}
              >
                <span className="chart-dot" style={{ background: leg?.color }} />
                <span className="tt-pick-label">{leg?.label}</span>
                <b className="mono">{centsLabel(prices[index])}</b>
                <Chevron dir={picking ? 'up' : 'down'} size={15} />
              </button>
              {picking && (
                <div className="tt-options">
                  {legs.map((option, i) => (
                    <button
                      key={option.key}
                      type="button"
                      className="tt-option pressable"
                      data-on={option.key === activeKey}
                      onClick={() => {
                        onPick(option.key);
                        setPicking(false);
                      }}
                    >
                      <span className="chart-dot" style={{ background: option.color }} />
                      <span className="tt-option-label">{option.label}</span>
                      <b className="mono">{centsLabel(prices[i])}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {buying ? (
            <>
              <div className="tt-amount">
                <label htmlFor={`tt-amount-${marketId}`}>Amount</label>
                <div className="tt-amount-field">
                  <span className="tt-amount-sign">$</span>
                  <input
                    id={`tt-amount-${marketId}`}
                    className="mono tt-amount-input"
                    inputMode="decimal"
                    value={amount}
                    placeholder="0"
                    // Sized to its own content so the dollar sign stays welded to
                    // the number instead of drifting to the far side of the field.
                    style={{ width: `${Math.min(9, Math.max(1, amount.length || 1))}ch` }}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                    data-over={spend > balance}
                  />
                </div>
              </div>

              <div className="tt-quick">
                {QUICK.map((value) => (
                  <button key={value} type="button" className="tt-chip pressable mono" onClick={() => bump(value)}>
                    +${value}
                  </button>
                ))}
                <button
                  type="button"
                  className="tt-chip pressable mono"
                  onClick={() => setAmount(String(Math.floor(balance)))}
                >
                  Max
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="tt-amount">
                <label htmlFor={`tt-shares-${marketId}`}>Shares</label>
                <div className="tt-amount-field">
                  <input
                    id={`tt-shares-${marketId}`}
                    className="mono tt-amount-input"
                    inputMode="decimal"
                    value={qty}
                    placeholder="0"
                    style={{ width: `${Math.min(9, Math.max(1, qty.length || 1))}ch` }}
                    onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </div>
              </div>
              <div className="tt-quick">
                {([['25%', 0.25], ['50%', 0.5], ['All', 1]] as const).map(([text, fraction]) => (
                  <button
                    key={text}
                    type="button"
                    className="tt-chip pressable mono"
                    onClick={() => setQty(String(Math.floor((leg?.held ?? 0) * fraction)))}
                  >
                    {text}
                  </button>
                ))}
                <span className="tt-held mono">{fmtShares(leg?.held ?? 0)} held</span>
              </div>
            </>
          )}

          <div ref={go} className="tt-go-wrap">
            <SubmitButton
              className={`btn tt-go pressable ${!ready ? '' : book.kind === 'binary' && leg?.side === 'NO' ? 'btn-no' : 'btn-primary'}`}
              disabled={!ready}
              pendingLabel="Filling…"
            >
              {label}
            </SubmitButton>
          </div>

          {state.error && <div className="error">{state.error}</div>}

          <dl className="tt-detail mono">
            <div>
              <dt>{buying ? 'Avg price' : 'You receive'}</dt>
              <dd>{buying ? centsLabel(quote.avgPrice) : money(proceeds)}</dd>
            </div>
            <div>
              <dt>{buying ? 'Payout if right' : 'Shares left'}</dt>
              <dd className={buying ? 'up' : undefined}>
                {buying ? money(payout) : fmtShares(Math.max(0, (leg?.held ?? 0) - sellQty))}
              </dd>
            </div>
            <div>
              <dt>Price impact</dt>
              <dd>
                {signedCents(impact)} → {pctLabel(quote.priceAfter)}
              </dd>
            </div>
            <div>
              <dt>Cash after</dt>
              <dd>{money(cashAfter)}</dd>
            </div>
          </dl>

          {!tradable && closedReason && <p className="tt-closed">{closedReason}</p>}

          <p className="tt-terms">
            Play money. Every trade moves the price and 1.5% stays with the pool.
          </p>
        </form>
      </div>

      <Toast message={state.ok} />
      <Confetti burst={state.ok} anchor={go} />
    </>
  );
}
