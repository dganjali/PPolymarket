'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { areaPoints, autoDomain, parseStamp, sparkPoints } from '@/lib/format';

/** Tiny inline trend line used on market cards. */
export function Spark({
  series,
  color,
  width = 66,
  height = 26,
}: {
  series: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (series.length < 2) return <div style={{ width, height }} />;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={sparkPoints(series, width, height, 3, autoDomain(series))}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Full price history with a gradient fill, as on the market detail screen. */
export function PriceChart({
  series,
  timestamps = [],
  height = 180,
  id = 'mmg',
}: {
  series: number[];
  timestamps?: string[];
  height?: number;
  id?: string;
}) {
  const w = 620;
  const pad = 12;
  const data = series.length >= 2 ? series : [series[0] ?? 0.5, series[0] ?? 0.5];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gridlines = [0.25, 0.5, 0.75];
  // Full 0–100% scale: on a probability chart, how high the line sits is the
  // information. The labels are there so the empty space reads as scale.
  const y = (g: number) => height - pad - g * (height - pad * 2);
  const x = (index: number) => (index / (data.length - 1)) * w;
  const active = activeIndex == null ? null : Math.min(activeIndex, data.length - 1);
  const activePrice = active == null ? null : data[active];
  const activeTimestamp = active == null ? undefined : timestamps[Math.min(active, timestamps.length - 1)];

  const selectFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const position = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    setActiveIndex(Math.round((position / bounds.width) * (data.length - 1)));
  };

  const moveWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setActiveIndex((current) => {
      if (event.key === 'Home') return 0;
      if (event.key === 'End') return data.length - 1;
      const start = current ?? data.length - 1;
      return Math.max(0, Math.min(data.length - 1, start + (event.key === 'ArrowLeft' ? -1 : 1)));
    });
  };

  const pointLabel = (index: number, price: number) => {
    const rawStamp = timestamps[Math.min(index, timestamps.length - 1)];
    const instant = rawStamp ? parseStamp(rawStamp) : Number.NaN;
    const when = Number.isNaN(instant)
      ? `Point ${Math.min(index + 1, series.length || 1)} of ${series.length || 1}`
      : new Date(instant).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
    return `${(price * 100).toFixed(1)}% Yes · ${when}`;
  };

  return (
    <div
      style={{ position: 'relative', touchAction: 'pan-y' }}
      tabIndex={0}
      role="group"
      aria-label={`Yes probability history. ${active == null ? 'Hover, tap, or use the arrow keys to inspect a point.' : pointLabel(active, activePrice!)}`}
      onPointerMove={selectFromPointer}
      onPointerDown={selectFromPointer}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setActiveIndex(null);
      }}
      onFocus={() => setActiveIndex((current) => current ?? data.length - 1)}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={moveWithKeyboard}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#27AE60" stopOpacity="0.28" />
            <stop offset="1" stopColor="#27AE60" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridlines.map((g) => (
          <line key={g} x1={0} x2={w} y1={y(g)} y2={y(g)} stroke="#222222" strokeWidth={1} />
        ))}
        <polygon points={areaPoints(data, w, height, pad)} fill={`url(#${id})`} />
        <polyline
          points={sparkPoints(data, w, height, pad)}
          fill="none"
          stroke="#27AE60"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        {data.map((price, index) => (
          <circle
            key={`${index}-${price}`}
            cx={x(index)}
            cy={y(price)}
            r={active === index ? 4.5 : 2.4}
            fill={active === index ? '#ffffff' : '#27AE60'}
            stroke="#27AE60"
            strokeWidth={active === index ? 2.5 : 1.2}
            opacity={active === index || data.length <= 24 ? 1 : 0.58}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {active != null && activePrice != null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={pad}
            y2={height - pad}
            stroke="#27AE60"
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.8}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {active != null && activePrice != null && (
        <div
          className="mono"
          role="status"
          style={{
            position: 'absolute',
            zIndex: 2,
            left: `${(active / (data.length - 1)) * 100}%`,
            top: Math.max(4, y(activePrice) - 46),
            transform:
              active === 0 ? 'translateX(0)' : active === data.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            minWidth: 112,
            padding: '7px 9px',
            borderRadius: 8,
            border: '1px solid var(--line-2)',
            background: 'var(--card)',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.28)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--yes-hi)' }}>
            {(activePrice * 100).toFixed(1)}% Yes
          </div>
          <div style={{ marginTop: 3, fontSize: 9.5, color: 'var(--dim)' }}>
            {activeTimestamp && !Number.isNaN(parseStamp(activeTimestamp))
              ? new Date(parseStamp(activeTimestamp)).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : `Point ${Math.min(active + 1, series.length || 1)} of ${series.length || 1}`}
          </div>
        </div>
      )}

      {gridlines.map((g) => (
        <span
          key={g}
          className="mono"
          style={{
            position: 'absolute',
            right: 2,
            top: y(g),
            transform: 'translateY(-50%)',
            fontSize: 9,
            color: 'var(--dim-2)',
            background: 'var(--panel)',
            padding: '0 3px',
            pointerEvents: 'none',
          }}
        >
          {g * 100}%
        </span>
      ))}
      <div
        className="mono"
        style={{ marginTop: 5, paddingLeft: 2, fontSize: 9, color: 'var(--dim-2)' }}
      >
        Hover, tap, or use arrow keys to inspect
      </div>
    </div>
  );
}
