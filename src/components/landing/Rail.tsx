import Link from 'next/link';
import type { Topic } from '@/lib/landing';
import { Chevron, Combos, Flame } from './Icons';

export function Rail({ topics }: { topics: Topic[] }) {
  return (
    <aside className="pm-rail">
      <div className="pm-promo pm-promo-perps">
        <div className="pm-promo-copy">
          <h3>Your group, your odds</h3>
          <p>One invite code and everyone starts with the same bankroll</p>
        </div>
        <div className="pm-promo-art" aria-hidden>
          <span className="pm-coin pm-coin-a">P</span>
          <span className="pm-coin pm-coin-b">M</span>
          <span className="pm-coin pm-coin-c">D</span>
        </div>
        <Link href="/new-group" className="pm-promo-btn">
          Start a group
        </Link>
      </div>

      <div className="pm-promo pm-promo-combo">
        <div className="pm-promo-copy">
          <h3>
            <span className="pm-promo-glyph">
              <Combos size={15} />
            </span>
            Settle it with a market
          </h3>
          <p>Stop arguing in the group chat — post it and let the odds answer</p>
        </div>
        <Link href="/signup" className="pm-promo-btn pm-promo-btn-violet">
          Get started
        </Link>
      </div>

      <div className="pm-topics">
        <a className="pm-topics-head" href="#markets">
          Hot topics <Chevron size={15} />
        </a>
        <ol>
          {topics.map((t, n) => (
            <li key={t.name}>
              <a href="#markets">
                <span className="pm-topic-rank">{n + 1}</span>
                <span className="pm-topic-name">{t.name}</span>
                <span className="pm-topic-vol">{t.today}</span>
                <Flame />
                <Chevron size={14} />
              </a>
            </li>
          ))}
        </ol>
      </div>

      <a className="pm-explore" href="#markets">
        Explore all
      </a>
    </aside>
  );
}
