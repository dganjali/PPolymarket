import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
// Tokens and primitives first; the rest cascade over them in load order.
import './globals.css';
import './shell.css';
import './market.css';
import './screens.css';
import './account.css';
import './admin.css';
import './premium.css';

/**
 * Fonts, self-hosted.
 *
 * These used to be two `<link>` tags to fonts.googleapis.com, which is a DNS
 * lookup, a TLS handshake and a render-blocking stylesheet to a third party
 * before the first pixel — and then a *second* hop to fonts.gstatic.com for the
 * files themselves. `next/font` downloads them at build time and serves them
 * from the same origin, so first paint waits on nothing external.
 *
 * The variables feed --sans and --mono in globals.css.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono',
});

const DESCRIPTION =
  'Play-money prediction markets for invite-only groups. Real market pricing, nothing at stake beyond whatever your admin puts up.';

/**
 * Absolute URLs in social cards need an origin. APP_ORIGIN is the one the app
 * already uses for sign-in links; when it is unset Next falls back to VERCEL_URL
 * in production and localhost in development, which is the right answer in both.
 */
function metadataBase(): URL | undefined {
  try {
    return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN) : undefined;
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: 'Minimarket — private prediction markets',
  description: DESCRIPTION,
  applicationName: 'Minimarket',
  openGraph: {
    type: 'website',
    siteName: 'Minimarket',
    title: 'Minimarket — private prediction markets',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minimarket — private prediction markets',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // Matches --app, the colour the app shell actually paints.
  themeColor: '#0e0e0e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
