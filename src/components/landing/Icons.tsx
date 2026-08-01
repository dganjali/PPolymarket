/** Inline icons for the landing chrome — no icon dependency, no network. */

type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function Search({ size = 18 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

export function Chevron({ size = 16, dir = 'right' }: P & { dir?: 'left' | 'right' }) {
  return (
    <svg {...base(size)} aria-hidden style={{ transform: dir === 'left' ? 'rotate(180deg)' : undefined }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function Trending({ size = 17 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function Combos({ size = 17 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3" y="5" width="7" height="14" rx="2" />
      <rect x="13" y="5" width="8" height="9" rx="2" />
    </svg>
  );
}

export function Perps({ size = 17 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M5 4v16M5 8h3M5 15h3" />
      <path d="M12 7v10M12 10h3M12 14h3" />
      <path d="M19 5v14" />
    </svg>
  );
}

export function Bookmark({ size = 17 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M6 4h12v16l-6-4-6 4z" />
    </svg>
  );
}

export function LinkIcon({ size = 17 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M10 13a4 4 0 006 .5l2-2a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 11a4 4 0 00-6-.5l-2 2A4 4 0 0011.7 18l1-1" />
    </svg>
  );
}

export function Info({ size = 15 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function Menu({ size = 19 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function Sliders({ size = 17 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

export function Swap({ size = 15 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

export function Mark({ size = 22 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5 12 2l8 4.5v11L12 22 4 17.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 15V9l4 6 4-6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function Flame({ size = 13 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2c1 3.5-1.5 4.8-2.6 6.4C8.1 10.3 8 12 8 12S6.5 11 6 9c-1.4 1.7-2 3.6-2 5.4C4 18.6 7.6 22 12 22s8-3.4 8-7.6c0-5.2-4.4-7.3-8-12.4z"
        fill="#f0851f"
      />
      <path
        d="M12 22c2.4 0 4-1.7 4-3.8 0-2.6-2.3-3.6-4-6.2-1.7 2.6-4 3.6-4 6.2C8 20.3 9.6 22 12 22z"
        fill="#f7c948"
      />
    </svg>
  );
}
