'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { tradeAction, type FormState } from '@/app/actions';
import { quoteBuy, quoteSell, type Reserves, type Side } from '@/lib/amm';
import { centsLabel, money, pctLabel, shares as fmtShares, signedCents } from '@/lib/format';
import { SubmitButton, Toast } from './ui';

type Mode = 'BUY' | 'SELL';

export interface TradePanelProps {
  slug: string;
  marketId: number;
  reserves: Reserves;
  balance: number;
  held: { yes: number; no: number };
  initialSide?: Side;
  tradable: boolean;
}

export function TradePanel({
  slug,
  marketId,
  reserves,
  balance,
  held,
  initialSide = 'YES',
  tradable,
}: TradePanelProps) {
  const [state, formAction] = useActionState(tradeAction, {} as FormState);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('BUY');
  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState('');
  const [qty, setQty] = useState('');

  // A successful fill clears the ticket; the fresh reserves arrive as props.
  useEffect(() => {
    if (state.ok) {
      setAmount('');
      setQty('');
      setOpen(false);
    }
  }, [state]);

  const heldSide = side === 'YES' ? held.yes : held.no;
  const spend = Number(amount) || 0;
  const sellQty = Math.min(heldSide, Number(qty) || 0);

  const quote = useMemo(
    () =>
      mode === 'BUY'
        ? quoteBuy(reserves, side, spend)
        : quoteSell(reserves, side, sellQty),
    [mode, reserves, side, spend, sellQty],
  );

  const buyQ = mode === 'BUY' ? (quote as ReturnType<typeof quoteBuy>) : null;
  const sellQ = mode === 'SELL' ? (quote as ReturnType<typeof quoteSell>) : null;

  const canBuy = spend > 0 && spend <= balance + 1e-9;
  const canSell = sellQty > 0.0001;
  const ready = mode === 'BUY' ? canBuy : canSell;

  const cashAfter = mode === 'BUY' ? balance - spend : balance + (sellQ?.proceeds ?? 0);
  const impact = quote.priceAfter - quote.priceBefore;

  const press = (k: string) => {
    setAmount((cur) => {
      if (k === '⌫') return cur.slice(0, -1);
      if (k === '.' && cur.includes('.')) return cur;
      if (/\.\d\d$/.test(cur)) return cur;
      return (cur + k).replace(/^0(?=\d)/, '');
    });
  };

  const label = !tradable
    ? 'Trading closed'
    : mode === 'BUY'
      ? spend <= 0
        ? 'Enter an amount'
        : !canBuy
          ? 'Not enough cash'
          : `Buy ${fmtShares(buyQ!.shares)} ${side} shares`
      : sellQty <= 0
        ? 'Enter share count'
        : `Sell ${fmtShares(sellQty)} ${side} for ${money(sellQ!.proceeds)}`;

  return (
    <>
      {/* Phone trigger — the rail is always visible on desktop. */}
      {tradable && !open && (
        <div className="trade-trigger">
          <button
            className="side-btn pill-yes"
            style={{ padding: 15, borderRadius: 13 }}
            onClick={() => {
              setSide('YES');
              setMode('BUY');
              setOpen(true);
            }}
          >
            <div style={{ fontSize: 13 }}>Buy Yes</div>
            <div className="mono" style={{ fontSize: 19, fontWeight: 600, marginTop: 3 }}>
              {centsLabel(reserves.no / (reserves.yes + reserves.no))}
            </div>
          </button>
          <button
            className="side-btn pill-no"
            style={{ padding: 15, borderRadius: 13 }}
            onClick={() => {
              setSide('NO');
              setMode('BUY');
              setOpen(true);
            }}
          >
            <div style={{ fontSize: 13 }}>Buy No</div>
            <div className="mono" style={{ fontSize: 19, fontWeight: 600, marginTop: 3 }}>
              {centsLabel(reserves.yes / (reserves.yes + reserves.no))}
            </div>
          </button>
        </div>
      )}

      <div className="sheet" data-open={open} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        <form action={formAction} className="sheet-body">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="marketId" value={marketId} />
          <input type="hidden" name="side" value={side} />
          <input type="hidden" name="action" value={mode} />
          <input type="hidden" name="amount" value={mode === 'BUY' ? amount : ''} />
          <input type="hidden" name="shares" value={mode === 'SELL' ? String(sellQty) : ''} />

          <div className="mobile-only" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: 'var(--chip)',
                color: 'var(--ink-5)',
                fontSize: 13,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="segment">
            <button type="button" data-side="YES" data-on={side === 'YES'} onClick={() => setSide('YES')}>
              Yes {centsLabel(reserves.no / (reserves.yes + reserves.no))}
            </button>
            <button type="button" data-side="NO" data-on={side === 'NO'} onClick={() => setSide('NO')}>
              No {centsLabel(reserves.yes / (reserves.yes + reserves.no))}
            </button>
          </div>

          {(held.yes > 0.0001 || held.no > 0.0001) && (
            <div className="segment" style={{ background: 'transparent', padding: 0, gap: 7 }}>
              <button
                type="button"
                data-side="none"
                data-on={mode === 'BUY'}
                onClick={() => setMode('BUY')}
                style={{ border: '1px solid var(--line-3)' }}
              >
                Buy
              </button>
              <button
                type="button"
                data-side="none"
                data-on={mode === 'SELL'}
                onClick={() => setMode('SELL')}
                style={{ border: '1px solid var(--line-3)' }}
              >
                Sell
              </button>
            </div>
          )}

          {mode === 'BUY' ? (
            <>
              <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    color: spend > balance ? 'var(--no-hi)' : 'var(--ink)',
                  }}
                >
                  ${amount === '' ? '0' : amount}
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4 }}>
                  {fmtShares(buyQ!.shares)} shares @ {centsLabel(buyQ!.avgPrice)} avg
                </div>
              </div>

              <div style={{ display: 'flex', gap: 7 }}>
                {[10, 50, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="btn btn-ghost btn-sm mono"
                    style={{ flex: 1 }}
                    onClick={() => setAmount(String(v))}
                  >
                    ${v}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mono"
                  style={{ flex: 1 }}
                  onClick={() => setAmount(String(Math.floor(balance)))}
                >
                  Max
                </button>
              </div>

              <div className="desktop-only">
                <input
                  className="mono"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="0.00"
                  aria-label="Amount to spend"
                />
              </div>

              <div className="keypad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
                  <button key={k} type="button" onClick={() => press(k)}>
                    {k}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
                <div className="mono" style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em' }}>
                  {fmtShares(sellQty)}
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4 }}>
                  of {fmtShares(heldSide)} {side} shares held
                </div>
              </div>

              <div style={{ display: 'flex', gap: 7 }}>
                {[
                  ['25%', 0.25],
                  ['50%', 0.5],
                  ['All', 1],
                ].map(([lbl, f]) => (
                  <button
                    key={lbl as string}
                    type="button"
                    className="btn btn-ghost btn-sm mono"
                    style={{ flex: 1 }}
                    onClick={() => setQty(String(Math.floor(heldSide * (f as number))))}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <input
                className="mono"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
                aria-label="Shares to sell"
              />
            </>
          )}

          <div className="divider" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="kv">
              <span>Price impact</span>
              <span>
                {signedCents(impact)} → {pctLabel(quote.priceAfter)}
              </span>
            </div>
            {mode === 'BUY' ? (
              <div className="kv">
                <span>Payout if correct</span>
                <span className="up">{money(buyQ!.payout)}</span>
              </div>
            ) : (
              <div className="kv">
                <span>You receive</span>
                <span className="up">{money(sellQ!.proceeds)}</span>
              </div>
            )}
            <div className="kv">
              <span>Cash after</span>
              <span>{money(cashAfter)}</span>
            </div>
          </div>

          {state.error && <div className="error">{state.error}</div>}

          <SubmitButton
            className={`btn ${!ready || !tradable ? '' : side === 'YES' ? 'btn-yes' : 'btn-no'}`}
            disabled={!ready || !tradable}
            pendingLabel="Filling…"
          >
            {label}
          </SubmitButton>

          <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
            No order book — you trade against the pool. Every trade nudges the price, and the 1.5%
            fee stays in the pool.
          </div>
        </form>
      </div>

      <Toast message={state.ok} />
    </>
  );
}
