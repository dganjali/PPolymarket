'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { Chevron, Combos, Info, Mark, Menu, Perps, Search, Trending } from './Icons';

const CATEGORIES = [
  'School',
  'Roommates',
  'Sports',
  'Gaming',
  'Chores',
  'Trips',
  'Fantasy',
  'Group chat',
  'Grades',
  'Weather',
  'Money',
  'Gym',
  'Food',
  'Long shots',
];

export function Header() {
  const rail = useRef<HTMLDivElement>(null);

  return (
    <header className="pm-head">
      <div className="pm-shell pm-head-row">
        <Link href="/" className="pm-logo">
          <Mark size={26} />
          <span>Minimarket</span>
        </Link>

        <div className="pm-search">
          <Search size={17} />
          <input placeholder="Search markets..." aria-label="Search markets" />
          <kbd>/</kbd>
        </div>

        <div className="pm-head-actions">
          <a className="pm-howto" href="#how">
            <Info size={15} />
            How it works
          </a>
          <Link href="/login" className="pm-btn pm-btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="pm-btn pm-btn-blue">
            Sign up
          </Link>
          <button className="pm-icon-btn" aria-label="Menu">
            <Menu />
          </button>
        </div>
      </div>

      <nav className="pm-cats">
        <div className="pm-shell pm-cats-inner">
          <div className="pm-cats-rail" ref={rail}>
            <a className="pm-cat" data-on href="#markets">
              <Trending size={16} />
              Trending
            </a>
            <a className="pm-cat" href="#markets">
              <Combos size={16} />
              Parlays
            </a>
            <a className="pm-cat" href="#markets">
              <Perps size={16} />
              Live
            </a>
            <a className="pm-cat" href="#markets">
              Closing soon
            </a>
            <a className="pm-cat" href="#markets">
              New
            </a>
            <span className="pm-cat-sep" />
            {CATEGORIES.map((c) => (
              <a key={c} className="pm-cat" href="#markets">
                {c}
              </a>
            ))}
          </div>
          <button
            className="pm-cats-more"
            aria-label="More categories"
            onClick={() => rail.current?.scrollBy({ left: 260, behavior: 'smooth' })}
          >
            <Chevron size={16} />
          </button>
        </div>
      </nav>
    </header>
  );
}
