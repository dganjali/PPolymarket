/**
 * The app's icon set. Inline SVG on purpose: no icon package, no network
 * request, and every glyph inherits `currentColor` so a button's hover state
 * carries the icon with it.
 *
 * All icons share one 24-unit grid and one stroke weight. If a new icon needs a
 * different weight to read at 16px, redraw it rather than changing the shared
 * base — mismatched stroke weights are the fastest way to make a set look
 * borrowed from three places.
 */

export interface IconProps {
  size?: number;
  /** Stroke weight override, for the rare glyph that needs to sit lighter. */
  weight?: number;
  className?: string;
}

const base = (size: number, weight: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: weight,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

type I = (props: IconProps) => React.ReactElement;

const icon =
  (path: React.ReactNode, defaults: { size?: number; weight?: number } = {}): I =>
  ({ size = defaults.size ?? 18, weight = defaults.weight ?? 1.7, className }) => (
    <svg {...base(size, weight)} className={className}>
      {path}
    </svg>
  );

/* ── navigation ───────────────────────────────────────────────────────────── */

export const Home = icon(
  <>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  </>,
);

export const Trophy = icon(
  <>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
    <path d="M12 14v3M9 20h6M10 20a2 2 0 0 1 4 0" />
  </>,
);

export const Person = icon(
  <>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </>,
);

export const Shield = icon(
  <>
    <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
    <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
  </>,
);

export const Bell = icon(
  <>
    <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3.2.7 4.6 1.5 5.6H5c.8-1 1.5-2.4 1.5-5.6z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </>,
);

export const Compass = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.2 8.8 13.6 13.6 8.8 15.2l1.6-4.8z" />
  </>,
);

/* ── market chrome ────────────────────────────────────────────────────────── */

export const Chevron = ({ size = 16, weight = 1.7, dir = 'right', className }: IconProps & { dir?: 'up' | 'down' | 'left' | 'right' }) => (
  <svg
    {...base(size, weight)}
    className={className}
    style={{ transform: `rotate(${{ right: 0, down: 90, left: 180, up: 270 }[dir]}deg)`, transition: 'transform var(--dur-base) var(--ease-out)' }}
  >
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);

export const Clock = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </>,
);

export const Volume = icon(
  <>
    <path d="M4 19V11M9.3 19V5M14.7 19v-6M20 19V8" />
  </>,
  { weight: 2 },
);

export const Bookmark = icon(<path d="M6.5 4h11v16.2l-5.5-3.8-5.5 3.8z" />);

export const Link = icon(
  <>
    <path d="M10.2 13.4a3.8 3.8 0 0 0 5.7.4l2-2a3.8 3.8 0 0 0-5.4-5.4l-1 1" />
    <path d="M13.8 10.6a3.8 3.8 0 0 0-5.7-.4l-2 2a3.8 3.8 0 0 0 5.4 5.4l1-1" />
  </>,
);

export const Code = icon(<path d="M8.6 8.4 5 12l3.6 3.6M15.4 8.4 19 12l-3.6 3.6M13.4 6.4l-2.8 11.2" />);

export const Plus = icon(<path d="M12 5.5v13M5.5 12h13" />, { weight: 2 });

export const Search = icon(
  <>
    <circle cx="11" cy="11" r="6.6" />
    <path d="M19.4 19.4 15.8 15.8" />
  </>,
);

export const Sparkle = icon(
  <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" />,
);

export const Lock = icon(
  <>
    <rect x="4.8" y="10.5" width="14.4" height="9.5" rx="2.2" />
    <path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5" />
  </>,
);

export const Check = icon(<path d="M5.5 12.5 10 17l8.5-9.5" />, { weight: 2 });

export const Close = icon(<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />);

export const Info = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.9h.01" />
  </>,
);

export const Users = icon(
  <>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.5 19.5a6 6 0 0 1 12 0" />
    <path d="M16 6.2a3.2 3.2 0 0 1 0 6M17.5 14.4a6 6 0 0 1 3 5.1" />
  </>,
);

/* ── categories ───────────────────────────────────────────────────────────── */

const Drama = icon(
  <>
    <path d="M5 5.5h14v9a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" />
    <path d="M9.2 10.5h.01M14.8 10.5h.01M9.5 14.8a3.4 3.4 0 0 0 5 0" />
  </>,
);

const School = icon(
  <>
    <path d="M12 4.5 21 9l-9 4.5L3 9z" />
    <path d="M7 11.2V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.8" />
  </>,
);

const Traditions = icon(
  <>
    <path d="M12 3.5 14.2 8l5 .7-3.6 3.5.9 5-4.5-2.4L7.5 17.2l.9-5L4.8 8.7l5-.7z" />
  </>,
);

const Sports = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17M3.5 12h17" />
    <path d="M6 6a8.5 8.5 0 0 0 12 12M18 6A8.5 8.5 0 0 1 6 18" />
  </>,
);

const Life = icon(
  <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z" />,
);

const Other = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.7 9.6a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.9.7-.9 1.3v.4M12 16.6h.01" />
  </>,
);

/** One glyph per market category, falling back to a question mark. */
export const CATEGORY_ICONS: Record<string, I> = {
  Drama,
  School,
  Traditions,
  Sports,
  Life,
  Other,
};

export function CategoryIcon({ category, ...props }: IconProps & { category: string }) {
  const Glyph = CATEGORY_ICONS[category] ?? Other;
  return <Glyph {...props} />;
}
