'use client';

import { useMemo, useState } from 'react';
import { points, walk, type Slide } from '@/lib/landing';
import { Bookmark, Chevron, LinkIcon, Mark, Swap } from './Icons';

const GRID = [0.8, 0.6, 0.4, 0.2, 0];
const MONTHS = ['May', 'Jun', 'Jul', 'Aug'];
/** Where each line starts, relative to where it ends. */
const DRIFT = [-0.19, 0.23, -0.06, 0.04];

export function Hero({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const slide = slides[i];

  const series = useMemo(
    () =>
      slide.outcomes.map((o, n) => {
        const end = o.pct / 100;
        const start = Math.min(0.92, Math.max(0.03, end + DRIFT[n % DRIFT.length]));
        return { color: o.color, data: walk(slide.id + o.label, start, end) };
      }),
    [slide],
  );

  const prev = slides[(i - 1 + slides.length) % slides.length];
  const next = slides[(i + 1) % slides.length];

  return (
    <div className="pm-hero-col">
      <article className="pm-hero-card">
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
              {slide.outcomes.map((o) => (
                <li key={o.label}>
                  <span>{o.label}</span>
                  <b>{o.pct}%</b>
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
              {slide.outcomes.map((o) => (
                <span key={o.label}>
                  <i style={{ background: o.color }} />
                  {o.label} <b>{o.pct}%</b>
                </span>
              ))}
            </div>

            <div className="pm-chart">
              <div className="pm-plot">
                <svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden>
                  {GRID.map((g) => (
                    <line
                      key={g}
                      x1="0"
                      x2="600"
                      y1={(1 - g) * 200}
                      y2={(1 - g) * 200}
                      stroke="#252525"
                      strokeWidth="1"
                      strokeDasharray="2 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {series.map((s) => (
                    <polyline
                      key={s.color}
                      points={points(s.data, 600, 200, 0)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>

                {series.map((s) => {
                  const v = s.data[s.data.length - 1];
                  return (
                    <i
                      key={s.color}
                      className="pm-dot"
                      style={{ background: s.color, top: `${(1 - v) * 100}%` }}
                    />
                  );
                })}
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
      </article>

      <div className="pm-carousel-foot">
        <div className="pm-dots">
          {slides.map((s, n) => (
            <button
              key={s.id}
              className="pm-dot-btn"
              data-on={n === i}
              aria-label={`Slide ${n + 1}`}
              onClick={() => setI(n)}
            />
          ))}
        </div>
        <div className="pm-carousel-nav">
          <button onClick={() => setI((i - 1 + slides.length) % slides.length)}>
            <Chevron size={15} dir="left" />
            {prev.crumb[1]}
          </button>
          <button onClick={() => setI((i + 1) % slides.length)}>
            {next.crumb[1]}
            <Chevron size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
