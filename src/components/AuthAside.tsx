import { colorFor } from '@/lib/chart';
import { stepPath, type Point } from '@/lib/chart';
import { CategoryIcon } from './Icon';

/**
 * The half of the sign-in screen that is not a form.
 *
 * The old auth pages were a 460px column of inputs centred in a black void at
 * any window size — nothing on screen said what you were signing in to. This
 * shows the product instead: a market, mid-argument, with its odds moving.
 *
 * Everything here is static and fabricated on purpose. It renders before anyone
 * is signed in, so it cannot show a real group's markets, and pretending
 * otherwise would leak one community's business onto a public page.
 */

const CURVE: Point[] = [
  0.5, 0.52, 0.48, 0.44, 0.46, 0.41, 0.38, 0.42, 0.4, 0.35, 0.37, 0.33, 0.3, 0.34, 0.32,
].map((v, i) => ({ t: i, v }));

const SAMPLES = [
  { question: 'Will Pool Party break the curse?', category: 'Traditions', price: 0.32, move: -0.12 },
  { question: 'Does Halvorsen cancel the AP final?', category: 'School', price: 0.57, move: 0.09 },
  { question: 'Anyone breaks 4:20 in the mile', category: 'Sports', price: 0.55, move: 0.02 },
];

export function AuthAside() {
  const width = 300;
  const height = 76;
  const x = (t: number) => (t / (CURVE.length - 1)) * width;
  const y = (v: number) => height - 6 - ((v - 0.25) / 0.35) * (height - 12);

  return (
    <aside className="auth-aside" aria-hidden>
      <div className="auth-aside-inner">
        <p className="auth-pitch">
          Your group, its own bankroll, and an actual market deciding who is right.
        </p>

        <div className="auth-demo">
          <div className="auth-demo-head">
            <span className="tag">Traditions</span>
            <span className="mono auth-demo-vol">$1.4k bet</span>
          </div>
          <div className="auth-demo-q">Will Pool Party break the curse?</div>
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <path d={stepPath(CURVE, x, y)} fill="none" stroke="var(--no)" strokeWidth={2} strokeLinejoin="round" />
          </svg>
          <div className="auth-demo-foot">
            <span className="mono auth-demo-pct">32%</span>
            <span className="mono down">−12¢ this week</span>
          </div>
        </div>

        <div className="auth-list">
          {SAMPLES.map((sample, index) => (
            <div key={sample.question} className="auth-list-row">
              <span className="auth-list-mark" style={{ color: colorFor(index) }}>
                <CategoryIcon category={sample.category} size={15} />
              </span>
              <span className="auth-list-q">{sample.question}</span>
              <span className="mono auth-list-pct">{Math.round(sample.price * 100)}%</span>
            </div>
          ))}
        </div>

        <p className="auth-foot">
          Play money, always. The only thing at stake is whatever your admin put up.
        </p>
      </div>
    </aside>
  );
}
