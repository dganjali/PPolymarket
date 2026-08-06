'use client';

import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  TIMEFRAMES,
  clip,
  momentLabel,
  stackLabels,
  stepAreaPath,
  stepPath,
  ticksFor,
  valueAt,
  windowFor,
  type Series,
  type Timeframe,
} from '@/lib/chart';
import type { Moment } from '@/lib/history';
import { Chevron } from './Icon';

/**
 * The price history chart.
 *
 * Two decisions drive the whole thing:
 *
 * 1. It draws against *time*, not against sample index. A market that traded
 *    forty times on Tuesday and twice since should look like that — a wall of
 *    movement, then a flat week. Plotting by index makes every market look
 *    equally busy, which is the same lie as a stock chart with no x-axis.
 *
 * 2. Under the cursor, the future goes quiet. Everything right of the crosshair
 *    drops to a ghost, so reading a price at a moment does not have the rest of
 *    the line shouting over it. That is the one flourish here that is purely
 *    aesthetic, and it is worth it.
 */

const PAD = { top: 14, right: 46, bottom: 24, left: 2 };
const GRIDLINES = [0, 0.25, 0.5, 0.75, 1];

export function PriceChart({
  series,
  moments = [],
  height = 300,
  initialTimeframe = 'ALL',
  watermark,
  now,
}: {
  series: Series[];
  moments?: Moment[];
  height?: number;
  initialTimeframe?: Timeframe;
  /** Faint label in the corner of the plot — the group's name. */
  watermark?: string;
  /**
   * The instant to treat as the right edge of the chart. Supplied by the server
   * so the same window is computed on both sides of hydration; without it the
   * client picks a slightly later "now" and every x-coordinate shifts.
   */
  now: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [cursor, setCursor] = useState<number | null>(null);
  const [openMoment, setOpenMoment] = useState<number | null>(null);
  // Dates are formatted in the viewer's timezone, which the server does not
  // know. Everything time-labelled waits a frame rather than hydrating wrong.
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    observer.observe(node);
    setWidth(Math.max(320, node.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  const [from, to] = useMemo(() => windowFor(series, timeframe, now), [series, timeframe, now]);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = Math.max(1, height - PAD.top - PAD.bottom);
  const x = (t: number) => PAD.left + ((t - from) / Math.max(1, to - from)) * plotW;
  const y = (v: number) => PAD.top + (1 - Math.max(0, Math.min(1, v))) * plotH;

  const lines = useMemo(
    () => series.map((s) => ({ ...s, window: clip(s.points, from, to) })),
    [series, from, to],
  );

  const inWindow = useMemo(() => moments.filter((m) => m.t >= from && m.t <= to), [moments, from, to]);

  const cursorT = cursor == null ? null : from + (cursor / plotW) * (to - from);
  const readAt = cursorT ?? to;

  // Legend and endpoint labels read at the cursor when there is one, and at the
  // right edge when there is not — so the numbers on screen always match the
  // vertical line on screen.
  const readings = lines.map((line) => ({
    ...line,
    value: valueAt(line.points, readAt),
    latest: valueAt(line.points, to),
  }));

  const labelTops = stackLabels(
    readings.map((r) => y(r.value)),
    22,
    PAD.top,
    PAD.top + plotH,
  );

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setCursor(Math.max(0, Math.min(plotW, event.clientX - bounds.left - PAD.left)));
  };

  const ticks = mounted ? ticksFor(from, to) : [];
  const openIndex = openMoment == null ? null : Math.max(0, Math.min(inWindow.length - 1, openMoment));
  const shown = openIndex == null ? null : inWindow[openIndex];

  return (
    <div className="chart">
      <div className="chart-legend">
        {readings.map((r) => (
          <button
            key={r.id}
            type="button"
            className="chart-key"
            aria-label={`${r.label} ${(r.value * 100).toFixed(1)} percent`}
          >
            <span className="chart-dot" style={{ background: r.color }} />
            <span className="chart-key-label">{r.label}</span>
            <span className="chart-key-value mono">{(r.value * 100).toFixed(r.value >= 0.1 ? 0 : 1)}%</span>
          </button>
        ))}
      </div>

      <div
        ref={box}
        className="chart-plot"
        style={{ height }}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setCursor(null);
        }}
        role="img"
        aria-label={`Probability history. ${readings.map((r) => `${r.label} ${(r.latest * 100).toFixed(0)} percent`).join(', ')}.`}
      >
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <clipPath id="chart-past">
              <rect x={0} y={0} width={cursor == null ? width : PAD.left + cursor} height={height} />
            </clipPath>
            {lines.length === 1 && (
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={lines[0].color} stopOpacity="0.22" />
                <stop offset="1" stopColor={lines[0].color} stopOpacity="0" />
              </linearGradient>
            )}
          </defs>

          {GRIDLINES.map((g) => (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(g)}
                y2={y(g)}
                className="chart-grid"
                strokeDasharray={g === 0 || g === 1 ? undefined : '2 5'}
              />
              <text x={PAD.left + plotW + 8} y={y(g) + 3.5} className="chart-axis mono">
                {g * 100}%
              </text>
            </g>
          ))}

          {watermark && (
            <text x={PAD.left + plotW - 6} y={PAD.top + 16} className="chart-watermark" textAnchor="end">
              {watermark}
            </text>
          )}

          {/* A single-outcome market gets a filled area; several would muddy. */}
          {lines.length === 1 && (
            <path
              d={stepAreaPath(lines[0].window, x, y, PAD.top + plotH)}
              fill="url(#chart-fill)"
              clipPath="url(#chart-past)"
            />
          )}

          {/* Every line twice: a ghost across the full window, and the real one
              clipped to the left of the cursor. With no cursor the clip is the
              whole plot and the ghost is invisible underneath. */}
          {lines.map((line) => (
            <path key={`ghost-${line.id}`} d={stepPath(line.window, x, y)} stroke={line.color} className="chart-line chart-line-ghost" />
          ))}
          {lines.map((line) => (
            <path
              key={`live-${line.id}`}
              d={stepPath(line.window, x, y)}
              stroke={line.color}
              className="chart-line"
              clipPath="url(#chart-past)"
            />
          ))}

          {/* Endpoint pucks, at the right edge or wherever the cursor is. */}
          {readings.map((r, i) => (
            <g key={`end-${r.id}`}>
              <circle cx={cursor == null ? x(to) : PAD.left + cursor} cy={y(r.value)} r={7} fill={r.color} opacity={0.22} />
              <circle
                cx={cursor == null ? x(to) : PAD.left + cursor}
                cy={y(r.value)}
                r={3.5}
                fill={r.color}
                stroke="var(--app)"
                strokeWidth={2}
                style={{ transition: cursor == null ? 'none' : undefined }}
                data-index={i}
              />
            </g>
          ))}

          {cursor != null && (
            <line
              x1={PAD.left + cursor}
              x2={PAD.left + cursor}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="chart-crosshair"
            />
          )}

          {ticks.map((tick) => (
            <text key={tick.t} x={x(tick.t)} y={height - 6} className="chart-axis mono" textAnchor="middle">
              {tick.label}
            </text>
          ))}
        </svg>

        {/* Reading chips ride at the crosshair, pushed apart when they collide. */}
        {cursor != null &&
          readings.map((r, i) => (
            <div
              key={`chip-${r.id}`}
              className="chart-chip mono"
              style={{
                left: `${(PAD.left + cursor + 10).toFixed(2)}px`,
                top: `${(labelTops[i] - 11).toFixed(2)}px`,
                borderColor: r.color,
              }}
            >
              <span className="chart-chip-bar" style={{ background: r.color }} />
              {r.label} <b>{(r.value * 100).toFixed(1)}%</b>
            </div>
          ))}

        {cursor != null && mounted && (
          <div className="chart-stamp mono" style={{ left: `${(PAD.left + cursor).toFixed(2)}px` }}>
            {momentLabel(readAt)}
          </div>
        )}

        {/* What the group was doing at each point on the line. */}
        {inWindow.map((moment, i) => (
          <button
            key={moment.id}
            type="button"
            className="chart-moment"
            data-kind={moment.kind}
            data-on={openIndex === i}
            // A rounded string, not a number: the browser serialises inline
            // pixel values to two decimals, and React's hydration check compares
            // against that string. An unrounded number mismatches every time.
            style={{ left: `${x(moment.t).toFixed(2)}px` }}
            onClick={() => setOpenMoment(openIndex === i ? null : i)}
            onPointerEnter={() => setOpenMoment(i)}
            aria-label={moment.headline}
          >
            <span />
          </button>
        ))}
      </div>

      {shown && mounted && (
        <MomentCard
          moment={shown}
          index={openIndex!}
          count={inWindow.length}
          left={x(shown.t)}
          width={width}
          onStep={(step) => setOpenMoment(((openIndex! + step) % inWindow.length + inWindow.length) % inWindow.length)}
          onClose={() => setOpenMoment(null)}
        />
      )}

      <div className="chart-foot">
        <div className="chart-frames" role="tablist" aria-label="Timeframe">
          {TIMEFRAMES.map((frame) => (
            <button
              key={frame}
              type="button"
              role="tab"
              aria-selected={timeframe === frame}
              className="chart-frame pressable"
              data-on={timeframe === frame}
              onClick={() => setTimeframe(frame)}
            >
              {frame}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MomentCard({
  moment,
  index,
  count,
  left,
  width,
  onStep,
  onClose,
}: {
  moment: Moment;
  index: number;
  count: number;
  left: number;
  width: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  // Keep the card on screen: it hangs right of its marker until that would run
  // it off the edge, then flips.
  const flip = left + 300 > width;

  return (
    <div
      className="chart-card"
      style={{
        left: flip ? undefined : `${left.toFixed(2)}px`,
        right: flip ? `${Math.max(0, width - left).toFixed(2)}px` : undefined,
      }}
      onPointerLeave={onClose}
    >
      <div className="chart-card-when mono">{momentLabel(moment.t, true)}</div>
      <div className="chart-card-head">{moment.headline}</div>
      {moment.body && <p className="chart-card-body">{moment.body}</p>}
      <div className="chart-card-foot">
        <span className="chart-card-kind mono">{moment.kind === 'move' ? 'Price move' : moment.kind === 'comment' ? 'Comment' : 'Update'}</span>
        {count > 1 && (
          <div className="chart-card-pager mono">
            <button type="button" onClick={() => onStep(-1)} aria-label="Previous moment">
              <Chevron dir="left" size={13} />
            </button>
            {index + 1}/{count}
            <button type="button" onClick={() => onStep(1)} aria-label="Next moment">
              <Chevron dir="right" size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The compact trend line on a market card. Same step semantics, no chrome. */
// Spark moved to ./Spark — it is a static SVG and does not belong in a client module.

