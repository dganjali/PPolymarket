/**
 * Loading placeholders.
 *
 * Every one of these is shaped like the thing it stands in for — same heights,
 * same gaps, same grid — because the point is not "something is happening", it
 * is that nothing moves when the real content lands. A spinner in the middle of
 * an empty page tells you less and costs a layout shift when it goes away.
 *
 * Next renders these from a route's `loading.tsx` the instant you click, so
 * navigation feels immediate even while the server is still querying.
 */

export function SkeletonText({ width = '100%', height = 13 }: { width?: string | number; height?: number }) {
  return <span className="skeleton sk-text" style={{ width, height }} />;
}

/** A market card, mid-load. */
export function SkeletonCard() {
  return (
    <article className="mc sk-card" aria-hidden>
      <div className="mc-top">
        <span className="skeleton sk-glyph" />
        <div className="mc-headline">
          <SkeletonText width="42%" height={9} />
          <div className="sk-gap" />
          <SkeletonText width="88%" height={16} />
        </div>
      </div>
      <div className="mc-figure">
        <span className="skeleton sk-spark" />
        <span className="skeleton sk-pct" />
      </div>
      <div className="mc-buys">
        <span className="skeleton sk-btn" />
        <span className="skeleton sk-btn" />
      </div>
    </article>
  );
}

/** The market grid. */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="market-grid sk-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** A stack of list rows — standings, positions, the inbox. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="surface rows" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="row sk-row">
          <span className="skeleton sk-avatar" />
          <div className="row-main">
            <SkeletonText width={`${45 + ((i * 13) % 35)}%`} height={13} />
          </div>
          <span className="skeleton sk-figure" />
        </div>
      ))}
    </div>
  );
}

/** The market page: header, chart, outcome rows, ticket. */
export function SkeletonMarket() {
  return (
    <div className="wrap mk" aria-hidden>
      <header className="mk-top">
        <span className="skeleton sk-back" />
        <span className="skeleton sk-glyph-lg" />
        <div className="mk-ident">
          <SkeletonText width="180px" height={11} />
          <div className="sk-gap" />
          <SkeletonText width="60%" height={28} />
        </div>
      </header>

      <div className="mk-grid">
        <div className="mk-main">
          <section className="surface mk-chartcard">
            <SkeletonText width="120px" height={11} />
            <span className="skeleton sk-chart" />
          </section>
          <section className="mk-outcomes">
            {[0, 1].map((i) => (
              <div key={i} className="mk-outcome sk-outcome">
                <div className="mk-outcome-main">
                  <SkeletonText width="30%" height={15} />
                </div>
                <span className="skeleton sk-pct" />
                <span className="skeleton sk-btn" />
              </div>
            ))}
          </section>
        </div>
        <aside className="mk-rail">
          <span className="skeleton sk-ticket" />
        </aside>
      </div>
    </div>
  );
}

/** A screen that is mostly one column of sections. */
export function SkeletonStack({ rows = 5 }: { rows?: number }) {
  return (
    <div className="wrap narrow stack" aria-hidden>
      <span className="skeleton sk-heading" />
      <SkeletonRows count={rows} />
    </div>
  );
}
