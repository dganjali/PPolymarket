import { CategoryIcon } from './Icon';

/**
 * A market's artwork.
 *
 * Polymarket puts a photograph beside every question. A group betting on
 * whether prom moves to the gym has no photograph, and asking the person who
 * opened the market to find one would kill the thirty-second flow that makes
 * people open markets at all. So each market gets a generated mark instead:
 * a two-tone field keyed off its own id, with its category's glyph on top.
 *
 * The point is recognition, not decoration — the same market is the same
 * colour on the card, in the header, in the trade ticket and in the related
 * list, so you can follow one question across four screens without reading.
 */

/** A stable hue per market. Golden-angle stepping keeps neighbours distinct. */
function hueFor(seed: number): number {
  return Math.round(((seed * 137.508) % 360 + 360) % 360);
}

export function MarketGlyph({
  seed,
  category,
  size = 44,
  radius,
}: {
  /** The market id — anything stable and integral works. */
  seed: number;
  category: string;
  size?: number;
  radius?: number;
}) {
  const hue = hueFor(seed);
  const corner = radius ?? Math.round(size * 0.26);

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: corner,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: `hsl(${hue} 70% 78%)`,
        background: `linear-gradient(145deg, hsl(${hue} 42% 22%), hsl(${(hue + 40) % 360} 38% 13%))`,
        border: '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      }}
    >
      <CategoryIcon category={category} size={Math.round(size * 0.46)} weight={1.6} />
    </div>
  );
}
