import type { GlyphName } from '@/lib/landing';

/**
 * A drawn mark per market on the landing page, in place of an emoji.
 *
 * Same 24-unit grid and stroke weight as the app's icon set, so a card on the
 * landing page and a card inside a group read as the same object. Emoji were
 * the alternative and render differently on every platform — a gauge next to
 * a cartoon on one machine and a flat pictogram on another is not a design.
 */

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

const PATHS: Record<GlyphName, React.ReactNode> = {
  grades: (
    <>
      <path d="M12 4.5 21 9l-9 4.5L3 9z" />
      <path d="M7 11.2V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.8" />
    </>
  ),
  dishes: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.6" />
    </>
  ),
  car: (
    <>
      <path d="M4 16v-3.4l2.1-5.2A2 2 0 0 1 8 6.2h8a2 2 0 0 1 1.9 1.2L20 12.6V16z" />
      <path d="M4 16v2.2a1 1 0 0 0 1 1h1.3a1 1 0 0 0 1-1V16M20 16v2.2a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1V16" />
      <path d="M7.5 13h.01M16.5 13h.01M5 12.6h14" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="8" width="5" height="8" rx="1.3" />
      <rect x="9.5" y="8" width="5" height="8" rx="1.3" />
      <rect x="15.5" y="8" width="5" height="8" rx="1.3" />
    </>
  ),
  paddle: (
    <>
      <circle cx="13.5" cy="9.5" r="5.8" />
      <path d="M9.6 13.8 5 18.4a1.5 1.5 0 0 0 2.1 2.1l4.6-4.6" />
      <circle cx="5.2" cy="8.2" r="1.6" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11" />
    </>
  ),
  document: (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5v4h4M9 12h6M9 16h6" />
    </>
  ),
  controller: (
    <>
      <path d="M7.2 7.5h9.6a4.6 4.6 0 0 1 4.5 5.6l-.8 3.6a2 2 0 0 1-3.6.7l-1.5-2.6H8.6l-1.5 2.6a2 2 0 0 1-3.6-.7l-.8-3.6a4.6 4.6 0 0 1 4.5-5.6z" />
      <path d="M8.2 10.5v3M6.7 12h3M15.4 11h.01M17.4 12.8h.01" />
    </>
  ),
  bowl: (
    <>
      <path d="M4 12.5h16a8 8 0 0 1-16 0z" />
      <path d="M9.5 5.5c0 1.6 1.2 1.6 1.2 3.2M13.5 5.5c0 1.6 1.2 1.6 1.2 3.2" />
    </>
  ),
  snow: (
    <>
      <path d="M12 3.5v17M4.6 7.75l14.8 8.5M4.6 16.25l14.8-8.5" />
      <path d="M12 3.5 10 5.5M12 3.5l2 2M12 20.5l-2-2M12 20.5l2-2" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <path d="M12 14v3M9 20h6M10 20a2 2 0 0 1 4 0" />
    </>
  ),
  thermostat: (
    <>
      <path d="M9.5 5a2.5 2.5 0 0 1 5 0v8.6a4 4 0 1 1-5 0z" />
      <path d="M12 9v6M12 17h.01" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="10" cy="7.5" rx="6.5" ry="2.8" />
      <path d="M3.5 7.5v4c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8v-4" />
      <path d="M3.5 11.5v4c0 1.5 2.9 2.8 6.5 2.8 1.2 0 2.3-.1 3.3-.4" />
      <path d="M13 18.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z" />
    </>
  ),
  chat: (
    <>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7.5a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16.5H6.5A2.5 2.5 0 0 1 4 14z" />
      <path d="M8.5 10h7M8.5 13h4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
};

export function Glyph({ name, size = 20 }: { name: GlyphName; size?: number }) {
  return (
    <svg {...base(size)} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
