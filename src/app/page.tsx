import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { CARDS, FILTERS, SLIDES, TOPICS } from '@/lib/landing';
import { Filters } from '@/components/landing/Filters';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { MarketCard } from '@/components/landing/MarketCards';
import { Rail } from '@/components/landing/Rail';
import { Bookmark, Search, Sliders } from '@/components/landing/Icons';
import './landing.css';

export default async function LandingPage() {
  const user = await currentUser();

  return (
    <div className="pm">
      <Header />

      <main className="pm-shell pm-main">
        {user && (
          <Link href="/groups" className="pm-resume">
            Signed in as {user.name} — back to your groups →
          </Link>
        )}

        <section className="pm-hero">
          <Hero slides={SLIDES} />
          <Rail topics={TOPICS} />
        </section>

        <section className="pm-markets" id="markets">
          <div className="pm-markets-head">
            <h2>All markets</h2>
            <div className="pm-markets-tools">
              <button aria-label="Search markets">
                <Search size={17} />
              </button>
              <button aria-label="Filters">
                <Sliders size={17} />
              </button>
              <button aria-label="Watchlist">
                <Bookmark size={17} />
              </button>
            </div>
          </div>

          <Filters items={FILTERS} />

          <div className="pm-grid">
            {CARDS.map((card) => (
              <MarketCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        <section className="pm-cta" id="how">
          <h2>Run the same thing with your friends.</h2>
          <p>
            Minimarket gives a group its own bankroll, its own markets and its own bragging rights.
            Play money, real prices — an automated market maker sets the odds off what people
            actually buy.
          </p>
          <div className="pm-cta-btns">
            <Link href="/signup" className="pm-btn pm-btn-blue pm-btn-lg">
              Create an account
            </Link>
            <Link href="/join" className="pm-btn pm-btn-ghost pm-btn-lg">
              Join with an invite code
            </Link>
          </div>
        </section>

        <footer className="pm-foot">
          <span>Minimarket — play-money prediction markets for invite-only groups.</span>
          <span className="pm-foot-links">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
            <Link href="/join">Join a group</Link>
          </span>
        </footer>
      </main>
    </div>
  );
}
