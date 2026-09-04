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

export function Volume({ size = 16 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 19V11M9.3 19V5M14.7 19v-6M20 19V8" />
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

export function Close({ size = 16 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function Check({ size = 16 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M5.5 12.5 10 17l8.5-9.5" />
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

/* ── how-it-works steps ────────────────────────────────────────────────── */

export function Invite({ size = 20 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="10" cy="8" r="3.4" />
      <path d="M4 19.5a6 6 0 0 1 12 0" />
      <path d="M18.5 8v6M15.5 11h6" />
    </svg>
  );
}

export function Ask({ size = 20 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5z" />
      <path d="M9.8 9.2a2.2 2.2 0 1 1 3 2c-.5.3-.8.7-.8 1.2v.3M12 14.6h.01" />
    </svg>
  );
}

export function Trade({ size = 20 }: P) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M7 15l3.2-3.4 2.6 2.2L17 9.5" />
      <path d="M14.2 9.5H17v2.8" />
    </svg>
  );
}

export function StepIcon({ kind, size = 20 }: P & { kind: 'invite' | 'ask' | 'trade' }) {
  if (kind === 'invite') return <Invite size={size} />;
  if (kind === 'ask') return <Ask size={size} />;
  return <Trade size={size} />;
}
