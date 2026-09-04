import { stepPath, type Point } from '@/lib/chart';

/**
 * The 72-pixel line on a market card.
 *
 * Deliberately its own module, and deliberately not `'use client'`. It used to be
 * exported from PriceChart.tsx, which *is* a client component — so every market
 * card on the group's landing screen pulled the full interactive chart (four
 * hundred lines, hooks, pointer handling and the icon set) into the browser to draw
 * a static SVG path. Nothing here needs the client: given points, it is a string.
 *
 * It draws itself in on arrival: `pathLength={1}` normalises the stroke to one
 * unit so a single CSS keyframe (mm-draw, in globals.css) can run the dash offset
 * from 1 to 0 for any path, whatever its real length.
 */
export function Spark({
  points,
  color,
  width = 72,
  height = 26,
}: {
  points: Point[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return <div style={{ width, height }} />;
  const from = points[0].t;
  const to = points[points.length - 1].t;
  // A sparkline is about shape, so it fills its own band rather than sitting on
  // an absolute 0-100 scale where most markets would be a flat line near zero.
  const values = points.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(0.04, hi - lo);
  const mid = (lo + hi) / 2;
  const x = (t: number) => ((t - from) / Math.max(1, to - from)) * width;
  const y = (v: number) => height - 2 - ((v - (mid - span / 2 - span * 0.15)) / (span * 1.3)) * (height - 4);

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <path
        className="spark-line"
        d={stepPath(points, x, y)}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle className="spark-end" cx={x(to)} cy={y(points[points.length - 1].v)} r={2} fill={color} />
    </svg>
  );
}
