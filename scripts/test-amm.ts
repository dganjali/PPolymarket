/**
 * Property checks on the market maker. Run with `npm test`.
 *
 * The one that matters is solvency: a market must always bank enough
 * collateral to pay every outstanding winning share, whatever sequence of
 * buys and sells it sees.
 */
import assert from 'node:assert/strict';
import {
  FEE_RATE,
  ladder,
  priceYes,
  quoteBuy,
  quoteSell,
  seedReserves,
  type Reserves,
  type Side,
} from '../src/lib/amm';

let checks = 0;
const ok = (cond: boolean, label: string) => {
  assert.ok(cond, label);
  checks++;
};
const close = (a: number, b: number, label: string, eps = 1e-6) =>
  ok(Math.abs(a - b) < eps, `${label} (${a} vs ${b})`);

// ── seeding ──────────────────────────────────────────────────────────────────
for (const p of [0.03, 0.2, 0.5, 0.71, 0.97]) {
  const r = seedReserves(p, 100);
  close(priceYes(r), p, `seed at ${p} prices at ${p}`);
  ok(Math.max(r.yes, r.no) <= 100 + 1e-9, `seed at ${p} never over-issues shares`);
}

// ── buying moves the price the right way ─────────────────────────────────────
{
  const r = seedReserves(0.5, 500);
  const buyYes = quoteBuy(r, 'YES', 100);
  ok(buyYes.priceAfter > buyYes.priceBefore, 'buying YES raises the YES price');
  ok(buyYes.shares > 100, 'a sub-100% price buys more than one share per dollar');
  close(buyYes.avgPrice, 100 / buyYes.shares, 'avg price is cost over shares');

  const buyNo = quoteBuy(r, 'NO', 100);
  close(buyYes.shares, buyNo.shares, 'symmetric book fills both sides alike');

  // Bigger orders get worse fills.
  const small = quoteBuy(r, 'YES', 10);
  const big = quoteBuy(r, 'YES', 1000);
  ok(big.avgPrice > small.avgPrice, 'larger orders pay a worse average price');
}

// ── the constant product is preserved ────────────────────────────────────────
{
  const r = seedReserves(0.4, 300);
  const k = r.yes * r.no;
  const q = quoteBuy(r, 'YES', 250);
  close(q.reservesAfter.yes * q.reservesAfter.no, k, 'buy preserves k', k * 1e-9);

  const s = quoteSell(q.reservesAfter, 'YES', q.shares / 2);
  close(s.reservesAfter.yes * s.reservesAfter.no, k, 'sell preserves k', k * 1e-9);
}

// ── round trip loses exactly the fee (and nothing else) ──────────────────────
{
  const r = seedReserves(0.5, 1000);
  const buy = quoteBuy(r, 'YES', 100);
  const sell = quoteSell(buy.reservesAfter, 'YES', buy.shares);
  ok(sell.proceeds < 100, 'an instant round trip never profits');
  const loss = (100 - sell.proceeds) / 100;
  ok(loss > FEE_RATE && loss < FEE_RATE * 2.2, `round-trip loss is roughly two fees (${loss})`);
}

// ── selling everything cannot drain the pool ─────────────────────────────────
{
  const r = seedReserves(0.5, 100);
  const buy = quoteBuy(r, 'YES', 5000);
  const sell = quoteSell(buy.reservesAfter, 'YES', buy.shares);
  ok(sell.reservesAfter.yes > 0 && sell.reservesAfter.no > 0, 'reserves stay positive');
  ok(sell.proceeds <= 5000, 'you cannot sell back more than you put in');
}

// ── solvency under a random walk ─────────────────────────────────────────────
{
  // Mirrors what engine.ts persists: reserves, banked collateral, and the
  // shares users walk away holding.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  for (let trial = 0; trial < 200; trial++) {
    const funding = 20 + rand() * 500;
    let r: Reserves = seedReserves(0.05 + rand() * 0.9, funding);
    let collateral = funding;
    let fees = 0;
    const held = { YES: 0, NO: 0 };

    for (let step = 0; step < 40; step++) {
      const side: Side = rand() < 0.5 ? 'YES' : 'NO';
      const selling = rand() < 0.4 && held[side] > 1;

      if (selling) {
        const qty = held[side] * (0.1 + rand() * 0.9);
        const q = quoteSell(r, side, qty);
        r = q.reservesAfter;
        collateral -= q.proceeds;
        fees += q.fee;
        held[side] -= qty;
      } else {
        const amount = 1 + rand() * 400;
        const q = quoteBuy(r, side, amount);
        r = q.reservesAfter;
        collateral += amount;
        fees += q.fee;
        held[side] += q.shares;
      }

      ok(r.yes > 0 && r.no > 0, 'reserves stay positive through the walk');
      const p = priceYes(r);
      ok(p > 0 && p < 1, 'price stays a probability');
    }

    // Whichever way the admin calls it, the bank covers the winners.
    for (const outcome of ['YES', 'NO'] as Side[]) {
      ok(
        collateral >= held[outcome] - 1e-6,
        `trial ${trial}: collateral ${collateral.toFixed(2)} covers ${outcome} payout ${held[outcome].toFixed(2)}`,
      );
    }
    ok(fees > 0, 'fees accumulate');
  }
}

// ── ladder ───────────────────────────────────────────────────────────────────
{
  const rows = ladder(seedReserves(0.34, 400), 'YES');
  ok(rows.length === 4, 'ladder has four rungs');
  ok(rows.every((x, i) => i === 0 || x.impact >= rows[i - 1].impact), 'impact grows with size');
  ok(Math.max(...rows.map((x) => x.depth)) === 1, 'deepest rung is the bar reference');
}

console.log(`✓ ${checks} assertions passed`);
