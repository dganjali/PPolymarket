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

export const metadata: Metadata = {
  title: 'Minimarket — private prediction markets',
  description:
    'Play-money prediction markets for invite-only groups. Real market pricing, nothing at stake beyond whatever your admin puts up.',
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
