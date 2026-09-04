'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Chevron, Combos, Info, Mark, Menu, Perps, Search, Trending } from './Icons';
import { SessionActions } from './Session';

const PINNED = [
  { label: 'Trending', icon: Trending },
  { label: 'Parlays', icon: Combos },
  { label: 'Live', icon: Perps },
  { label: 'Closing soon' },
  { label: 'New' },
];

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

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function Header() {
  const rail = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState('Trending');

  // The `/` hint in the search box is a promise; this keeps it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      event.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="pm-head">
      <div className="pm-shell pm-head-row">
        <Link href="/" className="pm-logo">
          <span className="pm-logo-mark">
            <Mark size={26} />
          </span>
          <span>Minimarket</span>
        </Link>

        <div className="pm-search">
          <Search size={17} />
          <input ref={search} placeholder="Search markets..." aria-label="Search markets" />
          <kbd>/</kbd>
        </div>

        <div className="pm-head-actions">
          <a className="pm-howto" href="#how">
            <Info size={15} />
            How it works
          </a>
          <SessionActions />
          <button className="pm-icon-btn" aria-label="Menu">
            <Menu />
          </button>
        </div>
      </div>

      <nav className="pm-cats">
        <div className="pm-shell pm-cats-inner">
          <div className="pm-cats-rail" ref={rail}>
            {PINNED.map(({ label, icon: Icon }) => (
              <a
                key={label}
                className="pm-cat"
                data-on={label === active}
                href="#markets"
                onClick={() => setActive(label)}
              >
                {Icon && <Icon size={16} />}
                {label}
              </a>
            ))}
            <span className="pm-cat-sep" />
            {CATEGORIES.map((c) => (
              <a key={c} className="pm-cat" data-on={c === active} href="#markets" onClick={() => setActive(c)}>
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
