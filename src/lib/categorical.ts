import { FEE_RATE } from './amm';

/** State for an LMSR market. Quantities are the outcome shares held by traders. */
export interface CategoricalState {
  quantities: number[];
  liquidity: number;
}

function logSumExp(values: number[]): number {
  const peak = Math.max(...values);
  return peak + Math.log(values.reduce((sum, value) => sum + Math.exp(value - peak), 0));
}

/** LMSR cost function. Moving from q to q' costs C(q') - C(q). */
export function categoricalCost(state: CategoricalState): number {
  const b = Math.max(0.01, state.liquidity);
  return b * logSumExp(state.quantities.map((quantity) => quantity / b));
}

/** Outcome probabilities. They always sum to one. */
export function categoricalPrices(state: CategoricalState): number[] {
  const b = Math.max(0.01, state.liquidity);
  const scaled = state.quantities.map((quantity) => quantity / b);
  const peak = Math.max(...scaled);
  const weights = scaled.map((value) => Math.exp(value - peak));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

/** Integer percentages using largest remainders, guaranteed to total 100. */
export function wholePercentages(prices: number[]): number[] {
  const exact = prices.map((price) => Math.max(0, price) * 100);
  const rounded = exact.map(Math.floor);
  const remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remaining; i++) rounded[order[i % order.length].index]++;
  return rounded;
}

export function categoricalLiquidity(funding: number, outcomes: number): number {
  return Math.max(0.01, funding / Math.log(Math.max(2, outcomes)));
}

export interface CategoricalBuyQuote {
  cost: number;
  fee: number;
  shares: number;
  avgPrice: number;
  priceBefore: number;
  priceAfter: number;
  quantitiesAfter: number[];
  payout: number;
}

/** Quote a buy by cash amount, matching the binary-market interaction. */
export function quoteCategoricalBuy(
  state: CategoricalState,
  outcomeIndex: number,
  amount: number,
): CategoricalBuyQuote {
  const prices = categoricalPrices(state);
  const before = prices[outcomeIndex] ?? 0;
  const empty = {
    cost: 0,
    fee: 0,
    shares: 0,
    avgPrice: before,
    priceBefore: before,
    priceAfter: before,
    quantitiesAfter: [...state.quantities],
    payout: 0,
  };
  if (!(amount > 0) || !Number.isFinite(amount) || outcomeIndex < 0 || outcomeIndex >= state.quantities.length) {
    return empty;
  }

  const fee = amount * FEE_RATE;
  const net = amount - fee;
  const baseCost = categoricalCost(state);
  const costFor = (shares: number) => {
    const quantities = [...state.quantities];
    quantities[outcomeIndex] += shares;
    return categoricalCost({ ...state, quantities }) - baseCost;
  };

  let low = 0;
  let high = net + state.liquidity * Math.log(state.quantities.length) + 1;
  while (costFor(high) < net) high *= 2;
  for (let i = 0; i < 70; i++) {
    const mid = (low + high) / 2;
    if (costFor(mid) < net) low = mid;
    else high = mid;
  }
  const shares = (low + high) / 2;
  const quantitiesAfter = [...state.quantities];
  quantitiesAfter[outcomeIndex] += shares;
  const priceAfter = categoricalPrices({ ...state, quantities: quantitiesAfter })[outcomeIndex];
  return {
    cost: amount,
    fee,
    shares,
    avgPrice: amount / shares,
    priceBefore: before,
    priceAfter,
    quantitiesAfter,
    payout: shares,
  };
}

export interface CategoricalSellQuote {
  shares: number;
  proceeds: number;
  fee: number;
  avgPrice: number;
  priceBefore: number;
  priceAfter: number;
  quantitiesAfter: number[];
}

export function quoteCategoricalSell(
  state: CategoricalState,
  outcomeIndex: number,
  shares: number,
): CategoricalSellQuote {
  const prices = categoricalPrices(state);
  const before = prices[outcomeIndex] ?? 0;
  const empty = {
    shares: 0,
    proceeds: 0,
    fee: 0,
    avgPrice: before,
    priceBefore: before,
    priceAfter: before,
    quantitiesAfter: [...state.quantities],
  };
  if (
    !(shares > 0) ||
    !Number.isFinite(shares) ||
    outcomeIndex < 0 ||
    outcomeIndex >= state.quantities.length ||
    shares > state.quantities[outcomeIndex] + 1e-9
  ) {
    return empty;
  }

  const beforeCost = categoricalCost(state);
  const quantitiesAfter = [...state.quantities];
  quantitiesAfter[outcomeIndex] = Math.max(0, quantitiesAfter[outcomeIndex] - shares);
  const gross = Math.max(0, beforeCost - categoricalCost({ ...state, quantities: quantitiesAfter }));
  const fee = gross * FEE_RATE;
  const proceeds = gross - fee;
  return {
    shares,
    proceeds,
    fee,
    avgPrice: proceeds / shares,
    priceBefore: before,
    priceAfter: categoricalPrices({ ...state, quantities: quantitiesAfter })[outcomeIndex],
    quantitiesAfter,
  };
}
