'use client';

import { useEffect, useState, type CSSProperties, type RefObject } from 'react';

const COLORS = ['#4ec97f', '#4d87f7', '#e0b341', '#c06bd9', '#f4776a', '#3fc0d4'];
const PIECES = 28;

interface Bit {
  dx: number;
  dy: number;
  spin: number;
  color: string;
  w: number;
  h: number;
  delay: number;
}

interface Shot {
  id: number;
  x: number;
  y: number;
  bits: Bit[];
}

/**
 * A burst of paper from wherever `anchor` is, once per new `burst` value.
 *
 * Fired by the trade ticket when a fill comes back. Every piece is one element
 * moving on `transform` alone, and the whole thing removes itself after a
 * second, so it costs nothing once it is over. Honors reduced motion by not
 * appearing at all — the toast already says what happened.
 */
export function Confetti({ burst, anchor }: { burst?: string; anchor: RefObject<HTMLElement | null> }) {
  const [shot, setShot] = useState<Shot | null>(null);

  useEffect(() => {
    if (!burst) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const box = anchor.current?.getBoundingClientRect();
    const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
    const y = box ? box.top + box.height / 2 : window.innerHeight * 0.7;
    const bits = Array.from({ length: PIECES }, (_, n) => {
      const angle = (Math.PI * 2 * n) / PIECES + (Math.random() - 0.5) * 0.5;
      const reach = 70 + Math.random() * 100;
      return {
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach - 70,
        spin: Math.random() * 720 - 360,
        color: COLORS[n % COLORS.length],
        w: 5 + Math.random() * 5,
        h: 4 + Math.random() * 7,
        delay: Math.random() * 90,
      };
    });

    setShot({ id: Date.now(), x, y, bits });
    const timer = setTimeout(() => setShot(null), 1400);
    return () => clearTimeout(timer);
  }, [burst, anchor]);

  if (!shot) return null;

  return (
    <div className="confetti" style={{ left: shot.x, top: shot.y }} aria-hidden>
      {shot.bits.map((bit, n) => (
        <i
          key={`${shot.id}-${n}`}
          style={
            {
              '--dx': `${bit.dx.toFixed(0)}px`,
              '--dy': `${bit.dy.toFixed(0)}px`,
              '--spin': `${bit.spin.toFixed(0)}deg`,
              background: bit.color,
              width: bit.w,
              height: bit.h,
              animationDelay: `${bit.delay.toFixed(0)}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
