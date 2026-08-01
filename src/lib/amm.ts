/**
 * Constant-product market maker over binary outcome shares.
 *
 * The pool holds `yes` and `no` outcome shares. One share of the winning
 * outcome pays exactly 1.00 at resolution, so the pool's implied probability
 * of YES is the scarcity of YES inside the pool:
 *
 *     priceYes = no / (yes + no)
 *
 * Collateral enters and leaves only as *complete sets* — 1.00 of collateral
 * mints one YES and one NO share, and burning one of each returns 1.00. That
 * is what makes the book self-funding: for either outcome,
 *
 *     userHeldShares + poolShares (+ burned + fees) === collateral
 *
 * so the payout owed at resolution can never exceed the collateral banked.
 * Everything below preserves that identity, which is why `settle()` can always
 * pay winners in full and hand the remainder back to the market's creator.
 */

export const FEE_RATE = 0.015;

export type Side = 'YES' | 'NO';

export interface Reserves {
  yes: number;
  no: number;
}

/** Implied probability of YES, 0..1. */
export function priceYes(r: Reserves): number {
  const t = r.yes + r.no;
  return t <= 0 ? 0.5 : r.no / t;
}

export function priceOf(r: Reserves, side: Side): number {
  const p = priceYes(r);
  return side === 'YES' ? p : 1 - p;
}

/**
 * Opening reserves for a market seeded with `funding` collateral at
 * probability `p`. The larger reserve is pinned to `funding` and the smaller
 * is scaled down, so the pool never holds more shares of an outcome than it
 * has collateral to back.
 */
export function seedReserves(p: number, funding: number): Reserves {
  const prob = Math.max(0.02, Math.min(0.98, p));
  return prob >= 0.5
    ? { yes: (funding * (1 - prob)) / prob, no: funding }
    : { yes: funding, no: (funding * prob) / (1 - prob) };
}

export interface BuyQuote {
  /** Collateral the trader spends, including fee. */
  cost: number;
  fee: number;
  /** Outcome shares received. */
  shares: number;
  /** Effective price per share, 0..1. */
  avgPrice: number;
  priceBefore: number;
  priceAfter: number;
  reservesAfter: Reserves;
  /** Payout if this side wins — one unit per share. */
  payout: number;
}

/** Quote for spending `amount` of collateral on `side`. */
export function quoteBuy(r: Reserves, side: Side, amount: number): BuyQuote {
  const before = priceOf(r, side);
  const empty: BuyQuote = {
    cost: 0,
    fee: 0,
    shares: 0,
    avgPrice: before,
    priceBefore: before,
    priceAfter: before,
    reservesAfter: r,
    payout: 0,
  };
  if (!(amount > 0) || !Number.isFinite(amount)) return empty;

  const fee = amount * FEE_RATE;
  const net = amount - fee;
  const k = r.yes * r.no;

  // Mint `net` complete sets into the pool, then withdraw the bought side
  // back down to the invariant.
  const yesIn = r.yes + net;
  const noIn = r.no + net;
  const out = side === 'YES' ? yesIn - k / noIn : noIn - k / yesIn;
  const shares = Math.max(0, out);

  const after: Reserves =
    side === 'YES' ? { yes: yesIn - shares, no: noIn } : { yes: yesIn, no: noIn - shares };

  return {
    cost: amount,
    fee,
    shares,
    avgPrice: shares > 0 ? amount / shares : before,
    priceBefore: before,
    priceAfter: priceOf(after, side),
    reservesAfter: after,
    payout: shares,
  };
}

export interface SellQuote {
  shares: number;
  /** Collateral returned to the trader, after fee. */
  proceeds: number;
  fee: number;
  avgPrice: number;
  priceBefore: number;
  priceAfter: number;
  reservesAfter: Reserves;
}

/** Quote for selling `shares` of `side` back into the pool. */
export function quoteSell(r: Reserves, side: Side, shares: number): SellQuote {
  const before = priceOf(r, side);
  const empty: SellQuote = {
    shares: 0,
    proceeds: 0,
    fee: 0,
    avgPrice: before,
    priceBefore: before,
    priceAfter: before,
    reservesAfter: r,
  };
  if (!(shares > 0) || !Number.isFinite(shares)) return empty;

  const k = r.yes * r.no;
  const a = (side === 'YES' ? r.yes : r.no) + shares;
  const b = side === 'YES' ? r.no : r.yes;

  // Burn `out` complete sets: (a - out)(b - out) = k. The smaller root is the
  // one that keeps both reserves positive.
  const sum = a + b;
  const disc = Math.max(0, (a - b) * (a - b) + 4 * k);
  const gross = Math.max(0, (sum - Math.sqrt(disc)) / 2);

  const fee = gross * FEE_RATE;
  const proceeds = gross - fee;

  const after: Reserves =
    side === 'YES'
      ? { yes: a - gross, no: b - gross }
      : { yes: b - gross, no: a - gross };

  return {
    shares,
    proceeds,
    fee,
    avgPrice: shares > 0 ? proceeds / shares : before,
    priceBefore: before,
    priceAfter: priceOf(after, side),
    reservesAfter: after,
  };
}

export interface LadderRow {
  size: number;
  avgPrice: number;
  shares: number;
  impact: number;
  depth: number;
}

/** "Cost to move the price" table shown on the market page. */
export function ladder(r: Reserves, side: Side, sizes = [10, 50, 250, 1000]): LadderRow[] {
  const rows = sizes.map((size) => {
    const q = quoteBuy(r, side, size);
    return {
      size,
      avgPrice: q.avgPrice,
      shares: q.shares,
      impact: q.priceAfter - q.priceBefore,
      depth: 0,
    };
  });
  const max = Math.max(...rows.map((x) => Math.abs(x.impact)), 1e-9);
  for (const row of rows) row.depth = Math.abs(row.impact) / max;
  return rows;
}

/**
 * How much collateral a market owes its holders vs. what is banked.
 * `remainder` is the LP's return: unsold pool shares plus accumulated fees.
 */
export function settle(
  collateral: number,
  outstandingWinningShares: number,
): { paid: number; remainder: number } {
  const paid = Math.min(collateral, outstandingWinningShares);
  return { paid, remainder: Math.max(0, collateral - paid) };
}
