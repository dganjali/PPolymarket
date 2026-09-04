import Link from 'next/link';
import { CARDS, FILTERS, HOW, SLIDES, TAPE, TOPICS } from '@/lib/landing';
import { BrowseProvider, Markets } from '@/components/landing/Browse';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Rail } from '@/components/landing/Rail';
import { Tape } from '@/components/landing/Tape';
import { TryIt } from '@/components/landing/TryIt';
import { StepIcon } from '@/components/landing/Icons';
import './landing.css';

/**
 * The public landing page.
 *
 * Deliberately reads nothing per request — no cookie, no database — so Next
 * prerenders it once at build time and every visit is served as static HTML
 * from the edge. The one thing that depends on who is looking (the sign-in
 * corner of the header) is resolved in the browser after first paint, by
 * `SessionActions`. Adding `cookies()` or `headers()` anywhere in this tree
 * would silently turn the whole route dynamic again; the build's route table
 * marks it ○ when it is static.
 *
 * `BrowseProvider` is the one piece of shared state: the search box in the
 * header and the grid halfway down both read from it.
 */
export default function LandingPage() {
  return (
    <BrowseProvider>
      <div className="pm">
        <div className="pm-aurora" aria-hidden>
          <span className="pm-aurora-a" />
          <span className="pm-aurora-b" />
          <span className="pm-aurora-c" />
        </div>

        <Header />
        <Tape items={TAPE} />

        <main className="pm-shell pm-main">
          <section className="pm-hero">
            <Hero slides={SLIDES} />
            <Rail topics={TOPICS} />
          </section>

          <Markets cards={CARDS} topics={FILTERS} />

          <TryIt />

          <section className="pm-how" id="how">
            <div className="pm-how-head">
              <span className="pm-eyebrow">How it works</span>
              <h2>Thirty seconds from group chat to market.</h2>
            </div>
            <ol className="pm-steps">
              {HOW.map((step, n) => (
                <li key={step.title} className="pm-step" style={{ '--i': n } as React.CSSProperties}>
                  <span className="pm-step-n">0{n + 1}</span>
                  <span className="pm-step-icon">
                    <StepIcon kind={step.icon} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="pm-cta">
            <div className="pm-cta-glow" aria-hidden />
            <div className="pm-cta-body">
              <h2>Run the same thing with your friends.</h2>
              <p>
                Minimarket gives a group its own bankroll, its own markets and its own bragging rights.
                Play money, real prices — an automated market maker sets the odds off what people
                actually buy.
              </p>
              <div className="pm-cta-btns">
                <Link href="/signup" className="pm-btn pm-btn-blue pm-btn-lg pm-btn-shine">
                  Create an account
                </Link>
                <Link href="/join" className="pm-btn pm-btn-ghost pm-btn-lg">
                  Join with an invite code
                </Link>
              </div>
            </div>
            <div className="pm-cta-stats" aria-hidden>
              <div>
                <b>$0</b>
                <span>ever at stake</span>
              </div>
              <div>
                <b>1.5%</b>
                <span>fee stays in the pool</span>
              </div>
              <div>
                <b>30s</b>
                <span>to open a market</span>
              </div>
            </div>
          </section>

          <footer className="pm-foot">
            <span>Minimarket — play-money prediction markets for invite-only groups.</span>
            <span className="pm-foot-links">
              <Link href="/login">Log in</Link>
              <Link href="/signup">Sign up</Link>
              <Link href="/join">Join a group</Link>
              <Link href="/pricing">Pricing</Link>
            </span>
          </footer>
        </main>
      </div>
    </BrowseProvider>
  );
}
