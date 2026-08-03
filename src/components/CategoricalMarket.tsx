import Link from 'next/link';
import type { GroupRow, MarketRow, MembershipRow } from '@/lib/data';
import { wholePercentages } from '@/lib/categorical';
import {
  comments,
  disputeFor,
  marketDisputes,
  marketRestrictionFor,
  marketRestrictions,
  marketTraderCount,
  optionPriceHistory,
  optionHolders,
  optionPositionFor,
  optionsWithPrices,
  recentTrades,
} from '@/lib/data';
import { centsLabel, money, money0, relative, shares as fmtShares, volLabel } from '@/lib/format';
import { AdminMarketControls } from './AdminControls';
import { CategoricalTradePanel } from './CategoricalTradePanel';
import { CommentBox } from './CommentBox';
import { ConflictNotice } from './ConflictNotice';
import { MultiPriceChart } from './Chart';
import { DisputeForm } from './DisputeForm';
import { Avatar } from './ui';

export async function CategoricalMarket({
  slug,
  base,
  market,
  group,
  user,
  membership,
  isAdmin,
}: {
  slug: string;
  base: string;
  market: MarketRow;
  group: GroupRow;
  user: { id: number };
  membership: MembershipRow;
  isAdmin: boolean;
}) {
  const [rawOptions, history, positions, disputes, myDispute, thread, trades, restrictions, myRestriction, traderCount] =
    await Promise.all([
      optionsWithPrices(market),
      optionPriceHistory(market.id, 60),
      optionPositionFor(user.id, market.id),
      market.status === 'resolving' ? marketDisputes(market.id) : Promise.resolve([]),
      market.status === 'resolving' ? disputeFor(user.id, market.id) : Promise.resolve(undefined),
      comments(market.id),
      recentTrades(market.id),
      marketRestrictions(market.id),
      marketRestrictionFor(user.id, market.id),
      marketTraderCount(market.id),
    ]);
  const options = rawOptions.map((option) => ({
    ...option,
    price:
      market.status === 'resolved'
        ? String(option.id) === market.outcome
          ? 1
          : 0
        : option.price,
  }));
  const displayedPercentages = wholePercentages(options.map((option) => option.price));
  const historyByOption = new Map(history.map((item) => [item.option_id, item]));
  const held = Object.fromEntries(positions.map((position) => [position.option_id, position.shares]));
  const reviewOpen =
    !!market.dispute_ends_at && new Date(`${market.dispute_ends_at.replace(' ', 'T')}Z`).getTime() > Date.now();
  const proposedLabel = options.find((option) => String(option.id) === market.proposed_outcome)?.label;
  const outcomeLabel = options.find((option) => String(option.id) === market.outcome)?.label;
  const resolutionOutcomes = options.map((option) => ({ value: String(option.id), label: option.label }));
  const tradable = market.status === 'open' && !myRestriction;
  const holdersByOption = new Map(
    await Promise.all(options.map(async (option) => [option.id, await optionHolders(option.id)] as const)),
  );

  return (
    <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href={base} className="avatar" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--card)' }}>
          ←
        </Link>
        <div className="market-meta" style={{ flex: 1 }}>
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
                  ? `settled ${outcomeLabel}`
                  : market.status}
          </span>
        </div>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.24, letterSpacing: '-0.025em', margin: 0 }}>
        {market.question}
      </h1>

      <div className="market-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {market.status === 'resolved' && (
            <div className="panel" style={{ borderColor: 'var(--gold-line)', background: 'var(--gold-bg)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>Resolved · {outcomeLabel}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>
                Every {outcomeLabel} share paid {money(1)}.
              </div>
            </div>
          )}

          {market.status === 'resolving' && proposedLabel && (
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'var(--gold-line)' }}>
              <div className="eyebrow">Proposed result · {proposedLabel}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{market.resolution_evidence}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
                {reviewOpen && market.dispute_ends_at
                  ? `Review closes ${relative(market.dispute_ends_at)}`
                  : disputes.length
                    ? 'Review closed · waiting for an admin decision'
                    : 'Review complete · finalizing'}{' '}
                · {disputes.length} dispute{disputes.length === 1 ? '' : 's'}
              </div>
              {disputes.map((dispute) => (
                <div key={dispute.id} style={{ padding: 10, borderRadius: 9, background: 'var(--app)' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{dispute.reason}</div>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--dim-2)', marginTop: 5 }}>
                    @{dispute.handle} · {relative(dispute.created_at)}
                  </div>
                </div>
              ))}
              {reviewOpen && !isAdmin && (
                <DisputeForm slug={slug} marketId={market.id} existingReason={myDispute?.reason} />
              )}
            </div>
          )}

          <ConflictNotice restrictions={restrictions} isRestricted={!!myRestriction} />

          <div className="panel" style={{ padding: '12px 10px 10px' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Probability history</div>
            <MultiPriceChart
              series={options.map((option) => ({
                id: option.id,
                label: option.label,
                prices: historyByOption.get(option.id)?.prices ?? [option.price],
                timestamps: historyByOption.get(option.id)?.timestamps ?? [],
              }))}
            />
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="eyebrow">Outcome probabilities</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{money0(market.collateral)} pooled</div>
            </div>
            {options.map((option, index) => {
              const own = positions.find((position) => position.option_id === option.id);
              return (
                <div key={option.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{option.label}</div>
                    {own && <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>{fmtShares(own.shares)} owned</div>}
                    <div className="mono" style={{ fontSize: 14, color: 'var(--gold)' }}>{displayedPercentages[index]}%</div>
                  </div>
                  <div className="oddsbar"><span style={{ width: `${option.price * 100}%` }} /></div>
                </div>
              );
            })}
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)' }}>
              Probabilities total 100%. Buying one outcome pushes the others down.
            </div>
          </div>

          {group.positions_public && (
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="eyebrow">Who backs each outcome</div>
              {options.map((option) => {
                const holders = holdersByOption.get(option.id) ?? [];
                return (
                  <div key={option.id}>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--gold)', marginBottom: 7 }}>
                      {option.label.toUpperCase()} · {fmtShares(holders.reduce((sum, holder) => sum + holder.shares, 0))} shares
                    </div>
                    {holders.length ? holders.map((holder) => (
                      <div key={holder.handle} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <Avatar name={holder.name} size={24} radius={7} />
                        <div style={{ flex: 1, fontSize: 12 }}>{holder.name}</div>
                        <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim)' }}>{fmtShares(holder.shares)}</div>
                      </div>
                    )) : <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim-2)' }}>Nobody yet.</div>}
                  </div>
                );
              })}
            </div>
          )}

          {trades.length > 0 && (
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="eyebrow">Recent fills</div>
              {trades.map((trade) => (
                <div key={trade.id} style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  <span style={{ color: 'var(--ink)' }}>{trade.name}</span> {trade.action === 'BUY' ? 'bought' : 'sold'}{' '}
                  {fmtShares(trade.shares)} <span style={{ color: 'var(--gold)' }}>{trade.side}</span> @ {centsLabel(trade.avg_price)}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="eyebrow">Rules</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-4)' }}>
              {market.rules || 'The admin resolves this market to exactly one listed outcome.'}
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim-2)', paddingTop: 6 }}>
              Opened by @{market.creator_handle} · {traderCount} traders · {volLabel(market.volume)}
            </div>
          </div>

          {isAdmin && market.status !== 'resolved' && (
            <AdminMarketControls
              slug={slug}
              marketId={market.id}
              status={market.status}
              proposedOutcome={market.proposed_outcome}
              disputeCount={disputes.length}
              canFinalize={!reviewOpen || disputes.length > 0}
              resolutionOutcomes={resolutionOutcomes}
            />
          )}

          <CommentBox slug={slug} marketId={market.id} thread={thread} />
        </div>

        <div className="trade-rail">
          <CategoricalTradePanel
            slug={slug}
            marketId={market.id}
            options={options}
            liquidity={market.lmsr_b}
            balance={membership.balance}
            held={held}
            tradable={tradable}
          />
          {!tradable && (
            <div className="notice">
              {myRestriction
                ? 'You are connected to this outcome and cannot trade this market.'
                : market.status === 'resolving'
                  ? 'Trading is closed during result review.'
                  : 'Trading is closed.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
