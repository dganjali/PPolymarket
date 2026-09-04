import { ImageResponse } from 'next/og';

/**
 * The card a link to Minimarket unfurls into, rendered once at build time.
 *
 * Satori draws it, so this is flexbox only — no grid, no CSS variables — and
 * the font is the Noto Sans that ships inside Next, which keeps the build free
 * of any download.
 */
export const alt = 'Minimarket — private prediction markets for small groups';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LINE = [42, 44, 41, 47, 45, 52, 50, 56, 53, 58, 61, 57, 63, 66, 64, 70, 68, 73, 71, 76];

export default function Image() {
  const w = 452;
  const h = 170;
  const pts = LINE.map((v, n) => `${(n / (LINE.length - 1)) * w},${h - (v / 100) * h}`).join(' ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0a0a0a',
          color: '#fff',
          fontFamily: 'Noto Sans, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -200,
            top: -260,
            width: 760,
            height: 760,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(42,108,244,0.42) 0%, rgba(42,108,244,0) 68%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -240,
            bottom: -320,
            width: 760,
            height: 760,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(109,75,214,0.34) 0%, rgba(109,75,214,0) 68%)',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, width: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 700 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M4 6.5 12 2l8 4.5v11L12 22 4 17.5z" stroke="#4d87f7" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M8 15V9l4 6 4-6v6" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            Minimarket
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
              Private prediction markets for your group.
            </div>
            <div style={{ fontSize: 24, color: '#a6a6a6', lineHeight: 1.4 }}>
              Play money, real prices. The only thing at stake is whatever your admin puts up.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '64px 64px 64px 0', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              padding: 28,
              borderRadius: 22,
              background: '#131313',
              border: '1px solid #262626',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8a8a8a', fontSize: 16 }}>
              <span>The Apartment · Chores</span>
              <span>$1,880 Vol</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, letterSpacing: -0.5 }}>
              Who actually does the dishes on Friday?
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 18 }}>
              <span style={{ fontSize: 56, fontWeight: 700, color: '#4ec97f', lineHeight: 1 }}>76%</span>
              <span style={{ fontSize: 18, color: '#8a8a8a', paddingBottom: 8 }}>Marcus +12 today</span>
            </div>
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ marginTop: 18 }}>
              <polygon points={`0,${h} ${pts} ${w},${h}`} fill="rgba(78,201,127,0.16)" />
              <polyline points={pts} fill="none" stroke="#4ec97f" strokeWidth="4" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
