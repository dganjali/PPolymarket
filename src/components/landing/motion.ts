'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the visitor asked for less motion. CSS handles most of it through
 * the tokens in globals.css; this is for the things JavaScript drives — the
 * carousel's clock, the odds that drift — which have no token to switch off.
 * Starts false so the server and the first client render agree.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return reduced;
}
