import type { Fill } from '@/lib/landing';

/**
 * The ticker under the header: recent fills sliding past, the way a trading
 * floor's tape would.
 *
 * Pure CSS. The list is rendered twice, back to back, and the track slides by
 * exactly one copy before looping, so the seam never shows. It is a transform
 * animation, so it never causes layout, and it pauses under the cursor so a
 * line can actually be read. No JavaScript is shipped for it at all.
 */
export function Tape({ items }: { items: Fill[] }) {
  const run = (copy: number) => (
    <div className="pm-tape-run" aria-hidden={copy > 0}>
      {items.map((fill) => (
        <span className="pm-fill" key={`${copy}-${fill.who}-${fill.market}`}>
          <b>{fill.who}</b>
          {fill.side === 'yes' ? 'bought' : 'sold'}
          <span className="pm-fill-side" data-side={fill.side}>
            {fill.label} {fill.price}¢
          </span>
          <span className="pm-fill-market">{fill.market}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="pm-tape" role="marquee" aria-label="Recent trades">
      <div className="pm-tape-track">
        {run(0)}
        {run(1)}
      </div>
    </div>
  );
}
