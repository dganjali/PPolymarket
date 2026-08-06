import { initials } from '@/lib/format';

/**
 * Deliberately *not* a client component.
 *
 * This is an <img> or a div of initials — no state, no effects, no handlers. It
 * used to live in ui.tsx alongside the components that do need the browser, which
 * meant the whole module was `'use client'` and every avatar became a hydration
 * root: one per group in the sidebar, one per row of the standings table, one per
 * holder on a market page. Rendered on the server it costs nothing on the client.
 */
export function Avatar({
  name,
  src,
  size = 32,
  radius = 9,
}: {
  name: string;
  /** A stored data URL, or null to fall back to initials. */
  src?: string | null;
  size?: number;
  radius?: number;
}) {
  const box = { width: size, height: size, borderRadius: radius, flex: 'none' as const };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- a data URL has nothing for the image optimiser to fetch.
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ ...box, objectFit: 'cover', display: 'block', background: 'var(--chip)' }}
      />
    );
  }
  return (
    <div className="avatar" style={{ ...box, fontSize: Math.round(size * 0.34) }}>
      {initials(name)}
    </div>
  );
}
