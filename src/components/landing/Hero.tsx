'use client';

import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { points, walk, type Slide } from '@/lib/landing';
import { Bookmark, Chevron, LinkIcon, Mark, Swap } from './Icons';
import { useReducedMotion } from './motion';

const GRID = [0.8, 0.6, 0.4, 0.2, 0];
const MONTHS = ['May', 'Jun', 'Jul', 'Aug'];
/** Where each line starts, relative to where it ends. */
const DRIFT = [-0.19, 0.23, -0.06, 0.04];
const W = 600;
const H = 200;
/** How long a slide holds before the next one arrives. */
const DWELL = 7000;
/** The chart pretends to run from May 1 for about four months. */
const START = Date.UTC(2026, 4, 1);
const SPAN_DAYS = 122;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/**
 * The featured market.
 *
 * Three slides rotate on a clock that stops the moment the cursor is over the
 * card, so nobody loses the headline they were reading. The chart draws itself
 * in on every slide change, and it can be read like the real one: point at it
 * and the legend, the end pucks and a small reading follow the cursor back
 * through the history.
 */
export function Hero({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  // The pointer or keyboard focus is inside: the clock waits.
  const [held, setHeld] = useState(false);
  // Bumped to restart the clock and its progress bar together.
  const [cycle, setCycle] = useState(0);
  // Where along the chart the cursor is, 0..1, or nothing.
  const [cursor, setCursor] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const slide = slides[i];

  const series = useMemo(
    () =>
      slide.outcomes.map((o, n) => {
        const end = o.pct / 100;
        const start = Math.min(0.92, Math.max(0.03, end + DRIFT[n % DRIFT.length]));
        return { label: o.label, color: o.color, data: walk(slide.id + o.label, start, end) };
      }),
    [slide],
  );

  const go = (n: number) => {
    setI(((n % slides.length) + slides.length) % slides.length);
    setCursor(null);
    setCycle((c) => c + 1);
  };

  const release = () => {
    setHeld(false);
    setCycle((c) => c + 1);
  };

  useEffect(() => {
    if (held || reduced) return;
    const timer = setTimeout(() => {
      setI((n) => (n + 1) % slides.length);
      setCursor(null);
    }, DWELL);
    return () => clearTimeout(timer);
  }, [i, cycle, held, reduced, slides.length]);

  const count = series[0]?.data.length ?? 0;
  const at = cursor == null ? count - 1 : Math.round(cursor * (count - 1));
  const readings = series.map((s) => s.data[at] ?? 0);
  const leader = series[0];
  const area = leader ? `0,${H} ${points(leader.data, W, H, 0)} ${W},${H}` : '';
  const when =
    cursor == null
      ? null
      : new Date(START + (at / Math.max(1, count - 1)) * SPAN_DAYS * 86_400_000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });

  const track = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setCursor(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)));
  };

  const prev = slides[(i - 1 + slides.length) % slides.length];
  const next = slides[(i + 1) % slides.length];
  const dotX = `${(cursor ?? 1) * 100}%`;

  return (
    <div
      className="pm-hero-col"
      data-held={held}
      style={vars({ '--dwell': `${DWELL}ms` })}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={release}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) release();
      }}
    >
      <article className="pm-hero-card">
        <div key={slide.id} className="pm-hero-swap">
          <div className="pm-hero-head">
            <div className="pm-thumb" style={{ background: slide.tint }}>
              <span>{slide.emoji}</span>
            </div>
            <div className="pm-hero-heading">
              <div className="pm-crumb">
                {slide.crumb.map((c, n) => (
                  <span key={c}>
                    {n > 0 && <span className="pm-crumb-dot">·</span>}
                    {c}
                  </span>
                ))}
              </div>
              <h2 className="pm-hero-title">{slide.title}</h2>
            </div>
            <div className="pm-hero-tools">
              <button aria-label="Copy link">
                <LinkIcon size={16} />
              </button>
              <button aria-label="Watchlist">
                <Bookmark size={16} />
              </button>
            </div>
          </div>

          <div className="pm-hero-body">
            <div className="pm-hero-left">
              <ul className="pm-outcomes">
                {slide.outcomes.map((o, n) => (
                  <li key={o.label} style={vars({ '--i': n })}>
                    <span className="pm-outcome-name">
                      <i className="pm-outcome-swatch" style={{ background: o.color }} />
                      {o.label}
                    </span>
                    <b>{o.pct}%</b>
                    <span className="pm-outcome-bar" style={vars({ '--w': o.pct / 100, background: o.color })} />
                  </li>
                ))}
              </ul>

              <div className="pm-news">
                {slide.news.map((n) => (
                  <div className="pm-news-item" key={n.headline}>
                    <div className="pm-news-meta">
                      <span className="pm-news-fav">{n.source.slice(0, 1)}</span>
                      <span className="pm-news-src">{n.source}</span>
                      <span className="pm-news-ago">· {n.ago}</span>
                    </div>
                    <p>{n.headline}</p>
                  </div>
                ))}
              </div>

              <div className="pm-hero-vol">{slide.volume}</div>
            </div>

            <div className="pm-hero-right">
              <div className="pm-legend">
                {series.map((s, n) => (
                  <span key={s.label}>
                    <i style={{ background: s.color }} />
                    {s.label} <b>{Math.round(readings[n] * 100)}%</b>
                  </span>
                ))}
              </div>

              <div className="pm-chart">
                <div
                  className="pm-plot"
                  onPointerMove={track}
                  onPointerDown={track}
                  onPointerLeave={(event) => {
                    if (event.pointerType === 'mouse') setCursor(null);
                  }}
                >
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
                    <defs>
                      <linearGradient id="pm-hero-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor={leader?.color} stopOpacity="0.3" />
                        <stop offset="1" stopColor={leader?.color} stopOpacity="0" />
                      </linearGradient>
                      {/* The reveal: a clip that widens from the left edge. */}
                      <clipPath id="pm-hero-wipe">
                        <rect className="pm-wipe" x="0" y="-20" width={W} height={H + 40} />
                      </clipPath>
                    </defs>

                    {GRID.map((g) => (
                      <line
                        key={g}
                        x1="0"
                        x2={W}
                        y1={(1 - g) * H}
                        y2={(1 - g) * H}
                        stroke="#252525"
                        strokeWidth="1"
                        strokeDasharray="2 4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}

                    <g clipPath="url(#pm-hero-wipe)">
                      <polygon points={area} fill="url(#pm-hero-fill)" />
                      {series.map((s) => (
                        <polyline
                          key={s.label}
                          points={points(s.data, W, H, 0)}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    </g>
                  </svg>

                  {cursor != null && <span className="pm-xhair" style={{ left: dotX }} />}

                  {series.map((s, n) => (
                    <i
                      key={s.label}
                      className={n === 0 ? 'pm-dot pm-dot-live' : 'pm-dot'}
                      style={{ background: s.color, left: dotX, top: `${(1 - readings[n]) * 100}%` }}
                    />
                  ))}

                  {cursor != null && (
                    <div className="pm-reading" data-flip={cursor > 0.62} style={{ left: dotX }}>
                      <span className="pm-reading-when">{when}</span>
                      {series.map((s, n) => (
                        <span key={s.label} className="pm-reading-row">
                          <i style={{ background: s.color }} />
                          {s.label}
                          <b>{Math.round(readings[n] * 100)}%</b>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pm-axis">
                  {GRID.map((g) => (
                    <span key={g} style={{ top: `${(1 - g) * 100}%` }}>
                      {Math.round(g * 100)}%
                    </span>
                  ))}
                </div>

                <div className="pm-xaxis">
                  {MONTHS.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>

              <div className="pm-chart-foot">
                <button>
                  <Swap size={14} /> Monthly
                </button>
                <span className="pm-chart-mark">
                  <Mark size={13} /> Minimarket
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>

      <div className="pm-carousel-foot">
        <div className="pm-dots" role="tablist" aria-label="Featured markets">
          {slides.map((s, n) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={n === i}
              className="pm-dot-btn"
              data-on={n === i}
              aria-label={`Slide ${n + 1}: ${s.title}`}
              onClick={() => go(n)}
            >
              {n === i && <span key={`${s.id}-${cycle}`} className="pm-dot-fill" />}
            </button>
          ))}
        </div>
        <div className="pm-carousel-nav">
          <button onClick={() => go(i - 1)}>
            <Chevron size={15} dir="left" />
            {prev.crumb[1]}
          </button>
          <button onClick={() => go(i + 1)}>
            {next.crumb[1]}
            <Chevron size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
