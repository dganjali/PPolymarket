import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ladder, priceYes, type Side } from '@/lib/amm';
import { categoricalPrices, wholePercentages } from '@/lib/categorical';
import { groupContext } from '@/lib/context';
import { colorFor, recentDelta, type Series } from '@/lib/chart';
import { marketMoments, marketSeries, relatedMarkets } from '@/lib/history';
import {
  CATEGORIES,
  categoricalState,
  comments,
  disputeFor,
  holders,
  marketById,
  marketDisputes,
  marketOptions,
  marketRestrictionFor,
  marketRestrictions,
  marketTraderCount,
  optionHolders,
  optionPositionFor,
  positionFor,
  recentTrades,
  reserves,
} from '@/lib/data';
import {
  centsLabel,
  dateLabel,
  money,
  money0,
  relative,
  shares as fmtShares,
  signedCents,
  volLabel,
} from '@/lib/format';
import { MarketTrading, MarketHeadline } from '@/components/MarketTrading';
import type { TicketBook, TicketLeg } from '@/components/TradeTicket';
import { MarketGlyph } from '@/components/MarketGlyph';
import { CopyPageLink } from '@/components/CopyLink';
import { Chevron } from '@/components/Icon';
import { CommentBox } from '@/components/CommentBox';
import { EditMarketForm } from '@/components/EditMarketForm';
import { DisputeForm } from '@/components/DisputeForm';
import { AdminMarketControls } from '@/components/AdminControls';
import { ConflictNotice } from '@/components/ConflictNotice';
import { Avatar } from '@/components/Avatar';

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  /** `?side=` is how the Yes/No buttons on a market card carry their side over. */
  searchParams: Promise<{ side?: string }>;
}) {
  const { slug, id } = await params;
  const { side } = await searchParams;
  const { user, group, ms, isAdmin, base } = await groupContext(slug);

  const market = await marketById(Number(id));
  if (!market || market.group_id !== group.id) notFound();

  const categorical = market.market_type === 'categorical';

  const [series, moments, related, restrictions, myRestriction, trades, thread, traderCount, disputes, myDispute] =
    await Promise.all([
      marketSeries(market),
      marketMoments(market.id),
      relatedMarkets(group.id, market.id, market.category),
      marketRestrictions(market.id),
      marketRestrictionFor(user.id, market.id),
      recentTrades(market.id),
      comments(market.id),
      marketTraderCount(market.id),
      market.status === 'resolving' ? marketDisputes(market.id) : Promise.resolve([]),
      market.status === 'resolving' ? disputeFor(user.id, market.id) : Promise.resolve(undefined),
    ]);

  const tradable = market.status === 'open' && !myRestriction;
  const closedReason = myRestriction
    ? 'You are connected to this outcome, so you cannot trade it.'
    : market.status === 'closed'
      ? 'Trading is closed. The admin still has to call it.'
      : market.status === 'resolving'
        ? 'Trading is closed while the group reviews the proposed result.'
        : market.status === 'pending'
          ? 'Waiting on admin approval before the group can trade.'
          : market.status === 'resolved'
            ? 'This market is settled.'
            : undefined;

  const reviewOpen =
    !!market.dispute_ends_at && new Date(`${market.dispute_ends_at.replace(' ', 'T')}Z`).getTime() > Date.now();

  // One instant for the whole page: the chart's window and the client's copy
  // of it must agree, or hydration tears the chart down and rebuilds it.
  const now = Date.now();

  const closesLabel =
    market.status === 'open' ? `Closes ${dateLabel(market.closes_at)}` : `Closed ${dateLabel(market.closes_at)}`;

  // ── the two market shapes, reduced to one set of props ────────────────────
  let book: TicketBook;
  let legs: TicketLeg[];
  let chart: Series[] = series;
  let headline: React.ReactNode;
  let outcomeLabel: string | undefined;
  let proposedLabel: string | undefined;
  let held: Record<string, number> = {};

  if (categorical) {
    const [options, positions] = await Promise.all([
      marketOptions(market.id),
      optionPositionFor(user.id, market.id),
    ]);
    const state = categoricalState(market, options);
    const live = categoricalPrices(state);
    const settled = market.status === 'resolved';
    const prices = options.map((option, i) => (settled ? (String(option.id) === market.outcome ? 1 : 0) : live[i]));
    const whole = wholePercentages(prices);
    const owned = new Map(positions.map((position) => [position.option_id, position.shares]));

    book = { kind: 'categorical', liquidity: state.liquidity, quantities: state.quantities };
    legs = options.map((option, i) => ({
      key: String(option.id),
      label: option.label,
      color: colorFor(i),
      held: owned.get(option.id) ?? 0,
      optionId: option.id,
    }));
    held = Object.fromEntries(legs.map((leg) => [leg.key, leg.held]));

    const leadIndex = prices.indexOf(Math.max(...prices));
    outcomeLabel = options.find((option) => String(option.id) === market.outcome)?.label;
    proposedLabel = options.find((option) => String(option.id) === market.proposed_outcome)?.label;
    headline = (
      <MarketHeadline
        label={settled ? `${outcomeLabel} won` : `${options[leadIndex]?.label} leads`}
        price={prices[leadIndex] ?? 0}
        delta={recentDelta(series[leadIndex]?.points ?? [])}
        color={colorFor(leadIndex)}
        settled={settled ? `${whole[leadIndex]}%` : undefined}
      />
    );
  } else {
    const pool = reserves(market);
    const p = priceYes(pool);
    const position = await positionFor(user.id, market.id);
    book = { kind: 'binary', reserves: pool };
    legs = [
      { key: 'YES', label: 'Yes', color: 'var(--yes)', held: position?.yes_shares ?? 0, side: 'YES' },
      { key: 'NO', label: 'No', color: 'var(--no)', held: position?.no_shares ?? 0, side: 'NO' },
    ];
    held = { YES: legs[0].held, NO: legs[1].held };
    const settled = market.status === 'resolved';
    headline = (
      <MarketHeadline
        label="chance of Yes"
        price={p}
        delta={recentDelta(series[0]?.points ?? [])}
        color="var(--ink)"
        settled={settled ? (market.outcome === 'YES' ? '100%' : '0%') : undefined}
      />
    );
    // The chart's one line is the Yes probability; the legend says so.
    chart = series.map((line) => ({ ...line, color: 'var(--yes)' }));
  }

  // One move per leg. A Yes/No market has a single line, so the No row mirrors it.
  const deltas = legs.map((_, i) => recentDelta(series[i]?.points ?? series[0]?.points ?? []).value);

  return (
    <div className="wrap mk">
      <header className="mk-top">
        <Link href={base} className="mk-back pressable" aria-label="Back to markets">
          <Chevron dir="left" size={17} />
        </Link>
        <MarketGlyph seed={market.id} category={market.category} size={56} />
        <div className="mk-ident">
          <div className="mk-crumb">
            <Link href={`${base}?cat=${encodeURIComponent(market.category)}`}>{market.category}</Link>
            <span className="mk-dot" />
            <span>{group.name}</span>
            {categorical && (
              <>
                <span className="mk-dot" />
                <span>Multiple choice</span>
              </>
            )}
          </div>
          <h1 className="mk-title">{market.question}</h1>
        </div>
        <div className="mk-tools">
          <CopyPageLink />
        </div>
      </header>

      {related.length > 0 && (
        <nav className="mk-sibs" aria-label="Other markets in this group">
          <span className="mk-sib mk-sib-now">{shortQuestion(market.question)}</span>
          {related.slice(0, 4).map((sibling) => (
            <Link key={sibling.id} href={`${base}/m/${sibling.id}`} className="mk-sib pressable">
              {shortQuestion(sibling.question)}
            </Link>
          ))}
        </nav>
      )}

      {headline}

      <MarketTrading
        slug={slug}
        marketId={market.id}
        question={market.question}
        category={market.category}
        book={book}
        legs={legs}
        series={chart}
        moments={moments}
        balance={ms.balance}
        tradable={tradable}
        closedReason={closedReason}
        volume={market.volume}
        closesLabel={closesLabel}
        watermark={group.name}
        deltas={deltas}
        now={now}
        related={related}
        base={base}
        initialKey={side}
      >
        {/* One element, not a list. These sections cross the server-to-client
            boundary as `children`, and an array that crosses it loses the marker
            that tells React its members are static — so React asks for keys on
            hand-written JSX. The wrapper is `display: contents`, so it changes
            nothing about the layout. */}
        <div className="mk-sections">
        {market.status === 'resolved' && (
          <section
            key="verdict"
            className="surface mk-verdict"
            data-outcome={categorical ? 'multi' : market.outcome === 'YES' ? 'yes' : 'no'}
          >
            <h2 className="mk-verdict-head">
              Resolved {categorical ? outcomeLabel : market.outcome}
            </h2>
            <p className="mk-verdict-body">
              Every winning share paid {money(1)}
              {market.resolved_at ? ` · ${relative(market.resolved_at)}` : ''}.
            </p>
          </section>
        )}

        {market.status === 'resolving' && (market.proposed_outcome || proposedLabel) && (
          <section key="review" className="surface mk-review">
            <div className="eyebrow">Proposed result · {categorical ? proposedLabel : market.proposed_outcome}</div>
            <p className="mk-review-body">{market.resolution_evidence}</p>
            <div className="mono t-micro">
              {reviewOpen && market.dispute_ends_at
                ? `Review closes ${relative(market.dispute_ends_at)}`
                : disputes.length
                  ? 'Review closed · waiting for an admin decision'
                  : 'Review complete · finalizing'}
              {' · '}
              {disputes.length} dispute{disputes.length === 1 ? '' : 's'}
            </div>
            {disputes.map((dispute) => (
              <div key={dispute.id} className="mk-dispute">
                <p>{dispute.reason}</p>
                <div className="mono t-micro">
                  @{dispute.handle} · {relative(dispute.created_at)}
                </div>
              </div>
            ))}
            {reviewOpen && !isAdmin && (
              <DisputeForm slug={slug} marketId={market.id} existingReason={myDispute?.reason} />
            )}
          </section>
        )}

        <ConflictNotice key="conflict" restrictions={restrictions} isRestricted={!!myRestriction} />

        <MyPosition key="position" legs={legs} book={book} categorical={categorical} />

        <section key="rules" className="surface mk-rules">
          <div className="sec">
            <h2 className="h-head">Rules</h2>
          </div>
          <p className="mk-rules-body">
            {market.rules ||
              (categorical
                ? 'The admin resolves this market to exactly one listed outcome.'
                : 'No extra rules — the admin calls it as they see it.')}
          </p>
          <div className="mk-rules-meta mono">
            Opened by @{market.creator_handle} · {traderCount} trader{traderCount === 1 ? '' : 's'} ·{' '}
            {volLabel(market.volume)} traded · {money0(market.collateral)} pooled
            {market.edited_at ? ` · edited ${relative(market.edited_at)}` : ''}
          </div>
          {/* Where the creator's stake went, in the one place they look for it.
              "Am I just down $100?" is the first question every market author
              asks, and until now the app answered it nowhere. */}
          <p className="mk-rules-body t-small">
            @{market.creator_handle} put {money0(market.subsidy)} of their own cash in to open this, and the
            group underwrote {money0(market.house)} alongside it — together that is the{' '}
            {money0(market.subsidy + market.house)} the pool started with. That stake is not a fee: it is
            lent to the market as liquidity. The 1.5% taken off every trade stays in the same pool, and
            when the market settles, whatever is left after winning shares are paid out goes back to the
            two of them in proportion — so the author gets their share back plus the fees, and takes a
            loss only if the group read the outcome better than the odds they opened at.
          </p>
        </section>

        {(isAdmin || (market.creator_id === user.id && market.volume === 0)) &&
          market.status !== 'resolved' &&
          market.status !== 'rejected' &&
          market.status !== 'resolving' && (
            <EditMarketForm
              key="edit"
              slug={slug}
              marketId={market.id}
              question={market.question}
              category={market.category}
              rules={market.rules}
              closesAt={market.closes_at}
              categories={CATEGORIES}
              traded={market.volume > 0}
              editedAt={market.edited_at}
            />
          )}

        {!categorical && <DepthLadder key="ladder" market={market} />}

        {group.positions_public && (
          <HoldersPanel
            key="holders"
            categorical={categorical}
            marketId={market.id}
            legs={legs}
            held={held}
          />
        )}

        {trades.length > 0 && (
          <section key="fills" className="surface">
            <div className="sec">
              <h2 className="h-head">Recent fills</h2>
            </div>
            <div className="mk-fills">
              {trades.map((fill) => (
                <div key={fill.id} className="mk-fill">
                  <Avatar name={fill.name} size={26} radius={8} />
                  <span className="mk-fill-body">
                    <b>{fill.name}</b> {fill.action === 'BUY' ? 'bought' : 'sold'} {fmtShares(fill.shares)}{' '}
                    <span className={fill.side === 'NO' ? 'down' : 'up'}>{fill.side}</span> @{' '}
                    {centsLabel(fill.avg_price)}
                  </span>
                  <span className="mono t-micro">{relative(fill.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {isAdmin && market.status !== 'resolved' && (
          <AdminMarketControls
            key="admin"
            slug={slug}
            marketId={market.id}
            status={market.status}
            proposedOutcome={market.proposed_outcome}
            disputeCount={disputes.length}
            canFinalize={!reviewOpen || disputes.length > 0}
            resolutionOutcomes={
              categorical
                ? legs.map((leg) => ({ value: leg.key, label: leg.label }))
                : undefined
            }
          />
        )}

        <CommentBox key="comments" slug={slug} marketId={market.id} thread={thread} />

        {tradable && <div key="clear" className="mobile-only mk-buybar-clear" />}
        </div>
      </MarketTrading>
    </div>
  );
}

/** Trim a sibling question down to a pill. */
function shortQuestion(question: string): string {
  const trimmed = question.replace(/\?$/, '');
  return trimmed.length > 26 ? `${trimmed.slice(0, 25)}…` : trimmed;
}

function MyPosition({
  legs,
  book,
  categorical,
}: {
  legs: TicketLeg[];
  book: TicketBook;
  categorical: boolean;
}) {
  const mine = legs.filter((leg) => leg.held > 0.0001);
  if (mine.length === 0) return null;

  const prices =
    book.kind === 'binary'
      ? { YES: book.reserves.no / (book.reserves.yes + book.reserves.no), NO: book.reserves.yes / (book.reserves.yes + book.reserves.no) }
      : Object.fromEntries(
          categoricalPrices({ liquidity: book.liquidity, quantities: book.quantities }).map((price, i) => [
            legs[i]?.key,
            price,
          ]),
        );

  return (
    <section className="surface mk-position">
      <div className="sec">
        <h2 className="h-head">Your position</h2>
      </div>
      {mine.map((leg) => {
        const price = (prices as Record<string, number>)[leg.key] ?? 0;
        return (
          <div key={leg.key} className="mk-position-row">
            <span className="chart-dot" style={{ background: leg.color }} />
            <span className="mk-position-label">{categorical ? leg.label : leg.label}</span>
            <span className="mono t-small">{fmtShares(leg.held)} shares</span>
            <span className="mono mk-position-value">{money(leg.held * price)}</span>
          </div>
        );
      })}
      <p className="mk-position-note">Marked at what the pool would pay to take them back today.</p>
    </section>
  );
}

async function HoldersPanel({
  categorical,
  marketId,
  legs,
}: {
  categorical: boolean;
  marketId: number;
  legs: TicketLeg[];
  held: Record<string, number>;
}) {
  const columns = categorical
    ? await Promise.all(
        legs.map(async (leg) => ({ leg, rows: await optionHolders(leg.optionId!) })),
      )
    : await Promise.all(
        (['YES', 'NO'] as Side[]).map(async (side, i) => ({
          leg: legs[i],
          rows: await holders(marketId, side),
        })),
      );

  if (columns.every((column) => column.rows.length === 0)) return null;

  return (
    <section className="surface">
      <div className="sec">
        <h2 className="h-head">Who&rsquo;s on each side</h2>
      </div>
      <div className="mk-holders">
        {columns.map(({ leg, rows }) => (
          <div key={leg.key} className="mk-holder-col">
            <div className="mk-holder-head mono">
              <span className="chart-dot" style={{ background: leg.color }} />
              {leg.label}
              <span className="mk-holder-total">
                {fmtShares(rows.reduce((sum, holder) => sum + holder.shares, 0))}
              </span>
            </div>
            {rows.length ? (
              rows.map((holder) => (
                <div key={holder.handle} className="mk-holder">
                  <Avatar name={holder.name} size={22} radius={7} />
                  <span className="mk-holder-name">{holder.name}</span>
                  <span className="mono t-micro">{fmtShares(holder.shares)}</span>
                </div>
              ))
            ) : (
              <div className="mono t-micro">Nobody yet.</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DepthLadder({ market }: { market: Parameters<typeof reserves>[0] & { collateral: number } }) {
  const rows = ladder(reserves(market), 'YES');
  return (
    <section className="surface">
      <div className="sec">
        <h2 className="h-head">What it costs to move it</h2>
        <span className="mono t-micro">buying Yes · 1.5% fee</span>
      </div>
      <div className="mk-ladder">
        <div className="mk-ladder-row mk-ladder-head mono">
          <span>Order</span>
          <span>Avg price</span>
          <span>Shares</span>
          <span>Impact</span>
        </div>
        {rows.map((row) => (
          <div className="mk-ladder-row mono" key={row.size}>
            <span className="mk-ladder-depth" style={{ width: `${(row.depth * 100).toFixed(0)}%` }} />
            <span>{money0(row.size)}</span>
            <span className="up">{centsLabel(row.avgPrice)}</span>
            <span>{fmtShares(row.shares)}</span>
            <span className="t-micro">{signedCents(row.impact)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
