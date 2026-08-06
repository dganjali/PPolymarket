'use client';

import Link from 'next/link';

/**
 * What a failed render looks like.
 *
 * Without this file a throw anywhere in a server component reached the browser as
 * Next's own "Application error: a server-side exception has occurred" plus a
 * digest — no indication of what broke, nothing to do about it, and the whole
 * screen gone. React redacts the real message in production, so the honest thing
 * to show is that something on our side failed, the digest to quote, and a way
 * back. The cause is in the server logs, keyed by the same digest.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="wrap stack" style={{ maxWidth: 460, paddingTop: 'var(--s-6)' }}>
      <div className="surface stack">
        <h1 className="h-head" style={{ margin: 0 }}>That didn&rsquo;t load</h1>
        <p className="t-small" style={{ margin: 0, color: 'var(--ink-4)' }}>
          Something went wrong on our side. Nothing you did caused it, and nothing was
          changed. Trying again usually works.
        </p>
        <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm pressable" onClick={reset}>
            Try again
          </button>
          <Link href="/groups" className="btn btn-sm pressable">Your groups</Link>
        </div>
        {error.digest && (
          <p className="mono t-micro" style={{ margin: 0 }}>
            If it keeps happening, quote this: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
