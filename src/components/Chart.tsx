import { areaPoints, autoDomain, sparkPoints } from '@/lib/format';

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
  height = 180,
  id = 'mmg',
}: {
  series: number[];
  height?: number;
  id?: string;
}) {
  const w = 620;
  const pad = 12;
  const data = series.length >= 2 ? series : [series[0] ?? 0.5, series[0] ?? 0.5];
  const gridlines = [0.25, 0.5, 0.75];
  // Full 0–100% scale: on a probability chart, how high the line sits is the
  // information. The labels are there so the empty space reads as scale.
  const y = (g: number) => height - pad - g * (height - pad * 2);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3FB27F" stopOpacity="0.28" />
            <stop offset="1" stopColor="#3FB27F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridlines.map((g) => (
          <line key={g} x1={0} x2={w} y1={y(g)} y2={y(g)} stroke="#242220" strokeWidth={1} />
        ))}
        <polygon points={areaPoints(data, w, height, pad)} fill={`url(#${id})`} />
        <polyline
          points={sparkPoints(data, w, height, pad)}
          fill="none"
          stroke="#3FB27F"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </svg>

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
    </div>
  );
}
