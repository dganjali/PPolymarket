'use client';

import { useActionState, useMemo, useState } from 'react';
import { tradeAction, type FormState } from '@/app/actions';
import { quoteCategoricalBuy, quoteCategoricalSell } from '@/lib/categorical';
import { centsLabel, money, shares as fmtShares } from '@/lib/format';
import { SubmitButton, Toast } from './ui';

interface OptionInput {
  id: number;
  label: string;
  quantity: number;
  price: number;
}

export function CategoricalTradePanel({
  slug,
  marketId,
  options,
  liquidity,
  balance,
  held,
  tradable,
}: {
  slug: string;
  marketId: number;
  options: OptionInput[];
  liquidity: number;
  balance: number;
  held: Record<number, number>;
  tradable: boolean;
}) {
  const [state, formAction] = useActionState(tradeAction, {} as FormState);
  const [optionId, setOptionId] = useState(options[0]?.id ?? 0);
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [raw, setRaw] = useState('');
  const optionIndex = Math.max(0, options.findIndex((option) => option.id === optionId));
  const selected = options[optionIndex];
  const number = Number(raw) || 0;
  const stateNow = useMemo(
    () => ({ quantities: options.map((option) => option.quantity), liquidity }),
    [options, liquidity],
  );
  const buyQuote = action === 'BUY' ? quoteCategoricalBuy(stateNow, optionIndex, number) : null;
  const sellQuote = action === 'SELL' ? quoteCategoricalSell(stateNow, optionIndex, number) : null;
  const ready =
    tradable &&
    number > 0 &&
    (action === 'BUY' ? number <= balance && !!buyQuote?.shares : number <= (held[optionId] ?? 0) && !!sellQuote?.proceeds);

  return (
    <>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="eyebrow">Trade an outcome</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOptionId(option.id);
                setRaw('');
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderColor: option.id === optionId ? 'var(--gold)' : 'var(--line-3)',
                color: option.id === optionId ? 'var(--gold)' : 'var(--ink-2)',
              }}
            >
              <span>{option.label}</span>
              <span className="mono">{centsLabel(option.price)}</span>
            </button>
          ))}
        </div>

        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="marketId" value={marketId} />
          <input type="hidden" name="optionId" value={optionId} />
          <input type="hidden" name="action" value={action} />

          <div style={{ display: 'flex', gap: 7 }}>
            {(['BUY', 'SELL'] as const).map((next) => (
              <button
                key={next}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setAction(next);
                  setRaw('');
                }}
                style={{ flex: 1, borderColor: action === next ? 'var(--gold)' : 'var(--line-3)' }}
              >
                {next === 'BUY' ? 'Buy' : 'Sell'}
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="categoricalAmount">{action === 'BUY' ? 'Amount to spend' : 'Shares to sell'}</label>
            <input
              id="categoricalAmount"
              name={action === 'BUY' ? 'amount' : 'shares'}
              type="number"
              min="0"
              step="0.01"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="0.00"
            />
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            {(action === 'BUY' ? [10, 50, 100] : []).map((value) => (
              <button key={value} type="button" className="btn btn-ghost btn-sm mono" onClick={() => setRaw(String(value))}>
                ${value}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm mono"
              onClick={() => setRaw(String(action === 'BUY' ? Math.floor(balance * 100) / 100 : held[optionId] ?? 0))}
            >
              Max
            </button>
          </div>

          <div className="kv-list">
            <div className="kv">
              <span>{action === 'BUY' ? 'Shares' : 'Cash returned'}</span>
              <span>
                {action === 'BUY' ? fmtShares(buyQuote?.shares ?? 0) : money(sellQuote?.proceeds ?? 0)}
              </span>
            </div>
            <div className="kv">
              <span>Average price</span>
              <span>{centsLabel(action === 'BUY' ? buyQuote?.avgPrice ?? selected.price : sellQuote?.avgPrice ?? selected.price)}</span>
            </div>
            <div className="kv">
              <span>Probability after</span>
              <span>{Math.round((action === 'BUY' ? buyQuote?.priceAfter ?? selected.price : sellQuote?.priceAfter ?? selected.price) * 100)}%</span>
            </div>
          </div>

          {state.error && <div className="error">{state.error}</div>}
          <SubmitButton disabled={!ready} pendingLabel="Filling…">
            {!tradable
              ? 'Trading closed'
              : !number
                ? `Enter ${action === 'BUY' ? 'an amount' : 'shares'}`
                : `${action === 'BUY' ? 'Buy' : 'Sell'} ${selected?.label ?? 'outcome'}`}
          </SubmitButton>
          <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
            LMSR pricing keeps every outcome liquid and all probabilities add up to 100%.
          </div>
        </form>
      </div>
      <Toast message={state.ok} />
    </>
  );
}
