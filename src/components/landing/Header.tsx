'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { CATEGORIES } from '@/lib/landing';
import { useBrowse, revealMarkets } from './Browse';
import { Chevron, Close, Info, Mark, Menu, Perps, Search, Trending, Volume } from './Icons';
import { SessionActions } from './Session';

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function Header() {
  const b = useBrowse();
  const rail = useRef<HTMLDivElement>(null);

  // The `/` hint in the search box is a promise; this keeps it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      event.preventDefault();
      b.searchRef.current?.focus();
      b.searchRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [b.searchRef]);

  const trendingOn = b.sort === 'trending' && !b.category && !b.liveOnly && !b.watching;

  const pinned = [
    {
      label: 'Trending',
      icon: <Trending size={16} />,
      on: trendingOn,
      pick: () => b.reset(),
    },
    {
      label: 'Live',
      icon: <Perps size={16} />,
      on: b.liveOnly,
      pick: () => b.setLiveOnly(!b.liveOnly),
    },
    { label: 'Closing soon', on: b.sort === 'closing', pick: () => b.setSort(b.sort === 'closing' ? 'trending' : 'closing') },
    { label: 'New', on: b.sort === 'newest', pick: () => b.setSort(b.sort === 'newest' ? 'trending' : 'newest') },
    {
      label: 'Most traded',
      icon: <Volume size={15} />,
      on: b.sort === 'biggest',
      pick: () => b.setSort(b.sort === 'biggest' ? 'trending' : 'biggest'),
    },
  ];

  return (
    <header className="pm-head">
      <div className="pm-shell pm-head-row">
        <Link href="/" className="pm-logo">
          <span className="pm-logo-mark">
            <Mark size={26} />
          </span>
          <span>Minimarket</span>
        </Link>

        <div className="pm-search" data-active={!!b.query}>
          <Search size={17} />
          <input
            ref={b.searchRef}
            value={b.query}
            onChange={(event) => b.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') revealMarkets();
              if (event.key === 'Escape') {
                b.setQuery('');
                event.currentTarget.blur();
              }
            }}
            placeholder="Search markets..."
            aria-label="Search markets"
            autoComplete="off"
            spellCheck={false}
          />
          {b.query ? (
            <button type="button" className="pm-search-clear" aria-label="Clear search" onClick={() => b.setQuery('')}>
              <Close size={14} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
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

      <nav className="pm-cats" aria-label="Browse">
        <div className="pm-shell pm-cats-inner">
          <div className="pm-cats-rail" ref={rail}>
            {pinned.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className="pm-cat"
                data-on={tab.on}
                aria-pressed={tab.on}
                onClick={() => {
                  tab.pick();
                  revealMarkets();
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <span className="pm-cat-sep" />
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="pm-cat"
                data-on={b.category === c}
                aria-pressed={b.category === c}
                onClick={() => {
                  b.setCategory(b.category === c ? null : c);
                  revealMarkets();
                }}
              >
                {c}
              </button>
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
