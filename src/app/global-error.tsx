'use client';

import './globals.css';

/**
 * The last resort: a throw in the root layout itself, where no other boundary is
 * mounted yet. It has to render its own <html> and <body> because the layout that
 * normally supplies them is the thing that failed, and it deliberately depends on
 * nothing but globals.css — no fonts, no shell, no data.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="wrap stack" style={{ maxWidth: 460, paddingTop: 48 }}>
          <div className="surface stack">
            <h1 className="h-head" style={{ margin: 0 }}>Minimarket is down</h1>
            <p className="t-small" style={{ margin: 0, color: 'var(--ink-4)' }}>
              The app failed to start rendering. This one is on us — whoever runs this
              deployment needs to check the logs.
            </p>
            <div>
              <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
                Reload
              </button>
            </div>
            {error.digest && (
              <p className="mono t-micro" style={{ margin: 0 }}>Digest: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
