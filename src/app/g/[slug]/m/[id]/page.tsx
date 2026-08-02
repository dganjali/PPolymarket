import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ladder, priceYes, type Side } from '@/lib/amm';
import { groupContext } from '@/lib/context';
import {
  comments,
  disputeFor,
  holders,
  marketById,
  marketDisputes,
  marketRestrictionFor,
  marketRestrictions,
  marketTraderCount,
  positionFor,
  priceHistory,
  recentTrades,
  reserves,
} from '@/lib/data';
import {
  centsLabel,
  dateLabel,
  money,
  money0,
  pctLabel,
  relative,
  shares as fmtShares,
  signedCents,
  signedMoney,
  volLabel,
} from '@/lib/format';
import { PriceChart } from '@/components/Chart';
import { TradePanel } from '@/components/TradePanel';
import { CommentBox } from '@/components/CommentBox';
import { DisputeForm } from '@/components/DisputeForm';
import { AdminMarketControls } from '@/components/AdminControls';
import { CategoricalMarket } from '@/components/CategoricalMarket';
import { ConflictNotice } from '@/components/ConflictNotice';
import { Avatar } from '@/components/ui';

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ side?: string }>;
}) {
  const { slug, id } = await params;
  const { side } = await searchParams;
  const { user, group, ms, isAdmin, base } = await groupContext(slug);

  const market = await marketById(Number(id));
  if (!market || market.group_id !== group.id) notFound();

  if (market.market_type === 'categorical') {
    return (
      <CategoricalMarket
        slug={slug}
        base={base}
        market={market}
        group={group}
        user={user}
        membership={ms}
        isAdmin={isAdmin}
      />
    );
  }

  const r = reserves(market);
  const p = priceYes(r);
  const [history, pos, restrictions, myRestriction, yesHolders, noHolders, trades, thread, disputes, myDispute, traderCount] =
    await Promise.all([
      priceHistory(market.id, 60),
      positionFor(user.id, market.id),
      marketRestrictions(market.id),
      marketRestrictionFor(user.id, market.id),
      holders(market.id, 'YES'),
      holders(market.id, 'NO'),
      recentTrades(market.id),
      comments(market.id),
      market.status === 'resolving' ? marketDisputes(market.id) : Promise.resolve([]),
      market.status === 'resolving' ? disputeFor(user.id, market.id) : Promise.resolve(undefined),
      marketTraderCount(market.id),
    ]);
  const series = history.map((point) => point.price);
  const first = series.length > 1 ? series[0] : market.open_price;
  const delta = p - first;

  const held = { yes: pos?.yes_shares ?? 0, no: pos?.no_shares ?? 0 };
  const tradable = market.status === 'open' && !myRestriction;

  const rows = ladder(r, 'YES');
  const reviewOpen = !!market.dispute_ends_at && new Date(`${market.dispute_ends_at.replace(' ', 'T')}Z`).getTime() > Date.now();

  return (
    <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href={base}
          className="avatar"
          style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--card)', fontSize: 15 }}
        >
          ←
        </Link>
        <div className="market-meta" style={{ flex: 1 }}>
          <span className="tag">{market.category}</span>
          <span>{volLabel(market.volume)}</span>
          <span>·</span>
          <span>
            {market.status === 'open'
              ? `closes ${dateLabel(market.closes_at)}`
              : market.status === 'resolved'
                ? `settled ${market.outcome}`
                : market.status === 'resolving'
                  ? `proposed ${market.proposed_outcome}`
                : market.status}
          </span>
        </div>
      </div>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1.24,
          letterSpacing: '-0.025em',
          textWrap: 'pretty',
          margin: 0,
        }}
      >
        {market.question}
      </h1>

      <div className="market-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div
              className="mono"
              style={{ fontSize: 44, fontWeight: 600, lineHeight: 0.9, letterSpacing: '-0.03em' }}
            >
              {market.status === 'resolved' ? (market.outcome === 'YES' ? '100%' : '0%') : pctLabel(p)}
            </div>
            <div style={{ paddingBottom: 4 }}>
              <div
                className="mono"
                style={{ fontSize: 12.5, color: delta >= 0 ? 'var(--yes-hi)' : 'var(--no-hi)' }}
              >
                {signedCents(delta)} since open
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>
                chance of Yes
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: '12px 10px 8px' }}>
            <PriceChart
              series={series}
              timestamps={history.map((point) => point.created_at)}
              id={`chart-${market.id}`}
            />
          </div>

          {market.status === 'resolved' && (
            <div
              className="panel"
              style={{
                borderColor: market.outcome === 'YES' ? 'var(--yes-line)' : 'var(--no-line)',
                background: market.outcome === 'YES' ? 'var(--yes-bg)' : 'var(--no-bg)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: market.outcome === 'YES' ? 'var(--yes-hi)' : 'var(--no-hi)' }}>
                Resolved {market.outcome}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-3)', marginTop: 6 }}>
                {market.outcome} shares paid {money(1)} each
                {market.resolved_at ? ` · ${relative(market.resolved_at)}` : ''}.
                {pos && (pos.realized !== 0 ? ` You booked ${signedMoney(pos.realized)}.` : '')}
              </div>
            </div>
          )}

          {market.status === 'resolving' && market.proposed_outcome && (
            <div
              className="panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                borderColor: market.proposed_outcome === 'YES' ? 'var(--yes-line)' : 'var(--no-line)',
              }}
            >
              <div className="eyebrow">Proposed result · {market.proposed_outcome}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                {market.resolution_evidence}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
                {reviewOpen && market.dispute_ends_at
                  ? `Review closes ${relative(market.dispute_ends_at)}`
                  : disputes.length
                    ? 'Review closed · waiting for an admin decision'
                    : 'Review complete · finalizing'}
                {' · '}{disputes.length} dispute{disputes.length === 1 ? '' : 's'}
              </div>

              {disputes.map((d) => (
                <div key={d.id} style={{ padding: 10, borderRadius: 9, background: 'var(--app)' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{d.reason}</div>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--dim-2)', marginTop: 5 }}>
                    @{d.handle} · {relative(d.created_at)}
                  </div>
                </div>
              ))}

              {reviewOpen && !isAdmin && (
                <DisputeForm slug={slug} marketId={market.id} existingReason={myDispute?.reason} />
              )}
            </div>
          )}

          <ConflictNotice restrictions={restrictions} isRestricted={!!myRestriction} />

          {/* Liquidity pool + depth ladder */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="eyebrow">Liquidity pool</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
                {money0(market.collateral)} pooled · 1.5% fee
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <div
                style={{
                  flex: 1,
                  background: 'var(--app)',
                  border: '1px solid var(--line-4)',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div className="stat-label" style={{ marginBottom: 4 }}>
                  Yes shares in pool
                </div>
                <div className="mono" style={{ fontSize: 14, color: 'var(--yes-hi)' }}>
                  {fmtShares(r.yes)}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: 'var(--app)',
                  border: '1px solid var(--line-4)',
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div className="stat-label" style={{ marginBottom: 4 }}>
                  No shares in pool
                </div>
                <div className="mono" style={{ fontSize: 14, color: 'var(--no-hi)' }}>
                  {fmtShares(r.no)}
                </div>
              </div>
            </div>

            <div className="divider" style={{ background: 'var(--line-4)' }} />
            <div className="eyebrow">Cost to move the price — buying Yes</div>
            <div className="ladder-row" style={{ color: 'var(--dim-2)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', padding: 0 }}>
              <span>Order</span>
              <span>Avg price</span>
              <span>Shares</span>
              <span>Impact</span>
            </div>
            {rows.map((row) => (
              <div className="ladder-row" key={row.size}>
                <span className="depth" style={{ width: `${(row.depth * 100).toFixed(0)}%` }} />
                <span style={{ color: 'var(--ink-2)' }}>{money0(row.size)}</span>
                <span style={{ color: 'var(--yes-hi)' }}>{centsLabel(row.avgPrice)}</span>
                <span style={{ color: 'var(--ink-3)' }}>{fmtShares(row.shares)}</span>
                <span style={{ color: 'var(--dim)' }}>{signedCents(row.impact)}</span>
              </div>
            ))}
          </div>

          {/* Who's on each side */}
          {group.positions_public ? (
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="eyebrow">Who&rsquo;s on each side</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <HolderColumn side="YES" rows={yesHolders} />
                <div style={{ width: 1, background: 'var(--line-4)' }} />
                <HolderColumn side="NO" rows={noHolders} />
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
                Positions are public in this group — admin setting.
              </div>
            </div>
          ) : null}

          {/* Recent fills */}
          {trades.length > 0 && (
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="eyebrow">Recent fills</div>
              {trades.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Avatar name={t.name} size={24} radius={7} />
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--ink)' }}>{t.name}</span>{' '}
                    {t.action === 'BUY' ? 'bought' : 'sold'} {fmtShares(t.shares)}{' '}
                    <span style={{ color: t.side === 'YES' ? 'var(--yes-hi)' : 'var(--no-hi)' }}>
                      {t.side}
                    </span>{' '}
                    @ {centsLabel(t.avg_price)}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--dim-2)' }}>
                    {relative(t.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rules */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="eyebrow" style={{ paddingBottom: 4 }}>
              Rules
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-4)', textWrap: 'pretty' }}>
              {market.rules || 'No extra rules — the admin calls it as they see it.'}
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim-2)', paddingTop: 6 }}>
              Opened by @{market.creator_handle} · {traderCount} traders ·{' '}
              {volLabel(market.volume)}
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
            />
          )}

          <CommentBox slug={slug} marketId={market.id} thread={thread} />

          {/* Clears the fixed buy bar on phones. */}
          {tradable && <div className="mobile-only" style={{ height: 60 }} />}
        </div>

        {/* Trade rail */}
        <div className="trade-rail">
          {(held.yes > 0.0001 || held.no > 0.0001) && (
            <div className="card" style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div className="eyebrow">Your position</div>
              {(['YES', 'NO'] as Side[]).map((s) => {
                const qty = s === 'YES' ? held.yes : held.no;
                if (qty <= 0.0001) return null;
                const cost = s === 'YES' ? pos!.yes_cost : pos!.no_cost;
                const price = s === 'YES' ? p : 1 - p;
                const value = qty * price;
                return (
                  <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        className="mono"
                        style={{
                          padding: '2px 6px',
                          borderRadius: 5,
                          fontSize: 9,
                          fontWeight: 600,
                          background: s === 'YES' ? 'var(--yes-bg)' : 'var(--no-bg)',
                          color: s === 'YES' ? 'var(--yes-hi)' : 'var(--no-hi)',
                        }}
                      >
                        {s}
                      </span>
                      <span className="mono" style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-5)' }}>
                        {fmtShares(qty)} @ {centsLabel(qty > 0 ? cost / qty : price)}
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 12, color: value >= cost ? 'var(--yes-hi)' : 'var(--no-hi)' }}
                      >
                        {money(value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <TradePanel
            slug={slug}
            marketId={market.id}
            reserves={r}
            balance={ms.balance}
            held={held}
            initialSide={side === 'NO' ? 'NO' : 'YES'}
            tradable={tradable}
          />

          {!tradable && (
            <div className="notice">
              {myRestriction
                ? 'You are connected to this outcome and cannot trade this market.'
                : market.status === 'closed'
                ? 'Trading is closed. The admin still has to call it.'
                : market.status === 'resolving'
                  ? 'Trading is closed while the group reviews the proposed result.'
                : market.status === 'pending'
                  ? 'Waiting on admin approval before the group can trade.'
                  : 'This market is settled.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HolderColumn({ side, rows }: { side: Side; rows: { name: string; shares: number }[] }) {
  const color = side === 'YES' ? 'var(--yes-hi)' : 'var(--no-hi)';
  const bg = side === 'YES' ? 'var(--yes-bg)' : 'var(--no-bg)';
  const line = side === 'YES' ? 'var(--yes-line)' : 'var(--no-line)';
  const total = rows.reduce((s, h) => s + h.shares, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 11, color }}>
        {side} · {fmtShares(total)} shares
      </div>
      {rows.map((h) => (
        <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className="avatar"
            style={{ width: 24, height: 24, borderRadius: 7, background: bg, borderColor: line, color, fontSize: 9 }}
          >
            {h.name.slice(0, 2).toUpperCase()}
          </div>
          <div
            style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {h.name}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--dim)' }}>
            {fmtShares(h.shares)}
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--dim-2)' }}>
          Nobody yet.
        </div>
      )}
    </div>
  );
}
