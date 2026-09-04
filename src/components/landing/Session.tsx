'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Me = { name: string; handle: string } | null;

/**
 * The sign-in corner of the landing header.
 *
 * Renders the signed-out buttons immediately — they are in the static HTML —
 * and asks `/api/me` once the page is interactive. A visitor who has a session
 * sees the buttons become "Your groups" a beat later; everyone else sees no
 * change and no request beyond one tiny JSON.
 */
export function SessionActions() {
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/me', { signal: controller.signal, credentials: 'same-origin' })
      .then((res) => (res.ok ? (res.json() as Promise<Me>) : null))
      .then((data) => setMe(data))
      .catch(() => setMe(null));
    return () => controller.abort();
  }, []);

  if (me) {
    return (
      <Link href="/groups" className="pm-btn pm-btn-blue pm-me tick">
        <span className="pm-me-dot" aria-hidden />
        {me.name.split(/\s+/)[0]} · Your groups →
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className="pm-btn pm-btn-ghost">
        Log in
      </Link>
      <Link href="/signup" className="pm-btn pm-btn-blue">
        Sign up
      </Link>
    </>
  );
}
