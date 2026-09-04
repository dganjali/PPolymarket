'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Card } from '@/lib/landing';
import { Bookmark, Chevron, Close, Search, Sliders } from './Icons';
import { MarketCard } from './MarketCards';

/**
 * Everything the visitor can do to the market list — type, pick a chip, pick a
 * category, sort, watch — lives here, so the search box in the header and the
 * grid halfway down the page agree without either knowing about the other.
 */

export type Sort = 'trending' | 'closing' | 'newest' | 'biggest';

export const SORTS: { id: Sort; label: string; short: string }[] = [
  { id: 'trending', label: 'Trending', short: 'All markets' },
  { id: 'closing', label: 'Closing soon', short: 'Closing soon' },
  { id: 'newest', label: 'Newest first', short: 'Newest' },
  { id: 'biggest', label: 'Most traded', short: 'Most traded' },
];

interface Browse {
  query: string;
  setQuery: (q: string) => void;
  topic: string;
  setTopic: (t: string) => void;
  category: string | null;
  setCategory: (c: string | null) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
  liveOnly: boolean;
  setLiveOnly: (on: boolean) => void;
  watching: boolean;
  setWatching: (on: boolean) => void;
  saved: ReadonlySet<string>;
  toggleSaved: (id: string) => void;
  /** Back to the page as it loaded. */
  reset: () => void;
  /** The header's search box, so a button elsewhere can put the cursor in it. */
  searchRef: RefObject<HTMLInputElement | null>;
}

const Context = createContext<Browse | null>(null);

export function useBrowse(): Browse {
  const value = useContext(Context);
  if (!value) throw new Error('useBrowse needs a BrowseProvider above it');
  return value;
}

/** Bookmarks survive a reload; they are the visitor's, so they stay in the browser. */
const STORE = 'mm-watchlist';

export function BrowseProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('trending');
  const [liveOnly, setLiveOnly] = useState(false);
  const [watching, setWatching] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Read after mount: the server has no localStorage, and hydrating with a
  // different set of bookmarks than it rendered would tear the cards down.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setSaved(new Set(JSON.parse(raw) as string[]));
    } catch {
      // A blocked store just means bookmarks last for the visit.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE, JSON.stringify([...saved]));
    } catch {
      // Same: nothing to do about a full or blocked store.
    }
  }, [saved, loaded]);

  const toggleSaved = useCallback((id: string) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setQuery('');
    setTopic('All');
    setCategory(null);
    setSort('trending');
    setLiveOnly(false);
    setWatching(false);
  }, []);

  const value = useMemo<Browse>(
    () => ({
      query, setQuery,
      topic, setTopic,
      category, setCategory,
      sort, setSort,
      liveOnly, setLiveOnly,
      watching, setWatching,
      saved, toggleSaved,
      reset,
      searchRef,
    }),
    [query, topic, category, sort, liveOnly, watching, saved, toggleSaved, reset],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Everything a card can be found by. */
function haystack(card: Card): string {
  const parts = [card.title, card.topic, card.category];
  if (card.kind === 'rows') parts.push(...card.rows.map((r) => r.label));
  if (card.kind === 'versus') parts.push(...card.sides.map((s) => s.name));
  if (card.kind === 'updown') parts.push(card.upLabel, card.downLabel);
  return parts.join(' ').toLowerCase();
}

/** Jump the page to the grid, for the controls that live in the header. */
export function revealMarkets() {
  document.getElementById('markets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * The market list: its heading, its tools, its chips, and the grid itself,
 * showing whatever the current filters leave.
 */
export function Markets({ cards, topics }: { cards: Card[]; topics: string[] }) {
  const b = useBrowse();
  const [sortOpen, setSortOpen] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const sortBox = useRef<HTMLDivElement>(null);

  // The sort menu closes on a click anywhere else, or on Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const away = (event: PointerEvent) => {
      if (!sortBox.current?.contains(event.target as Node)) setSortOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSortOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [sortOpen]);

  const needle = b.query.trim().toLowerCase();

  const shown = useMemo(() => {
    const list = cards.filter(
      (card) =>
        (b.topic === 'All' || card.topic === b.topic) &&
        (!b.category || card.category === b.category) &&
        (!b.liveOnly || card.live) &&
        (!b.watching || b.saved.has(card.id)) &&
        (!needle || haystack(card).includes(needle)),
    );
    switch (b.sort) {
      case 'closing':
        return [...list].sort((a, z) => a.closesIn - z.closesIn);
      case 'newest':
        return [...list].sort((a, z) => a.age - z.age);
      case 'biggest':
        return [...list].sort((a, z) => z.vol - a.vol);
      default:
        return list;
    }
  }, [cards, b.topic, b.category, b.liveOnly, b.watching, b.saved, b.sort, needle]);

  const heading = b.watching
    ? 'Watchlist'
    : b.liveOnly
      ? 'Live now'
      : b.category ?? SORTS.find((s) => s.id === b.sort)?.short ?? 'All markets';

  const narrowed = !!needle || !!b.category || b.liveOnly || b.watching || b.sort !== 'trending';

  return (
    <section className="pm-markets" id="markets">
      <div className="pm-markets-head">
        <h2>
          {heading}
          <span className="pm-count mono">{shown.length}</span>
          {!b.watching && (
            <span className="pm-live-pill">
              <span className="live" /> live
            </span>
          )}
        </h2>
        <div className="pm-markets-tools">
          <button
            type="button"
            aria-label="Search markets"
            data-on={!!needle}
            onClick={() => {
              b.searchRef.current?.focus();
              b.searchRef.current?.select();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Search size={17} />
          </button>
          <div className="pm-sort" ref={sortBox}>
            <button
              type="button"
              aria-label="Sort"
              aria-haspopup="menu"
              aria-expanded={sortOpen}
              data-on={b.sort !== 'trending'}
              onClick={() => setSortOpen((open) => !open)}
            >
              <Sliders size={17} />
            </button>
            {sortOpen && (
              <div className="pm-sort-menu" role="menu">
                {SORTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={b.sort === option.id}
                    className="pm-sort-item"
                    data-on={b.sort === option.id}
                    onClick={() => {
                      b.setSort(option.id);
                      setSortOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={b.watching ? 'Show all markets' : 'Show your watchlist'}
            aria-pressed={b.watching}
            data-on={b.watching}
            onClick={() => b.setWatching(!b.watching)}
          >
            <Bookmark size={17} />
            {b.saved.size > 0 && <span className="pm-tool-badge mono">{b.saved.size}</span>}
          </button>
        </div>
      </div>

      <div className="pm-filters">
        <div className="pm-filters-rail" ref={rail} role="tablist" aria-label="Topics">
          {topics.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === b.topic}
              className="pm-filter"
              data-on={t === b.topic}
              onClick={() => b.setTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pm-cats-more"
          aria-label="More topics"
          onClick={() => rail.current?.scrollBy({ left: 240, behavior: 'smooth' })}
        >
          <Chevron size={16} />
        </button>
      </div>

      {narrowed && (
        <div className="pm-active mono">
          {needle && (
            <span>
              matching <b>“{b.query.trim()}”</b>
            </span>
          )}
          {b.category && (
            <span>
              in <b>{b.category}</b>
            </span>
          )}
          {b.liveOnly && <span>happening now</span>}
          {b.watching && <span>on your watchlist</span>}
          {b.sort !== 'trending' && (
            <span>
              sorted by <b>{SORTS.find((s) => s.id === b.sort)?.label.toLowerCase()}</b>
            </span>
          )}
          <button type="button" onClick={b.reset}>
            <Close size={12} /> clear
          </button>
        </div>
      )}

      <div className="pm-grid">
        {shown.map((card, index) => (
          <MarketCard key={card.id} card={card} index={index} />
        ))}
      </div>

      {shown.length === 0 && (
        <div className="pm-empty">
          <b>
            {b.watching && b.saved.size === 0
              ? 'Nothing on your watchlist yet.'
              : needle
                ? `Nothing matches “${b.query.trim()}”.`
                : 'Nothing here yet.'}
          </b>
          <p>
            {b.watching && b.saved.size === 0
              ? 'Tap the bookmark on any market to keep it here.'
              : 'Every market on Minimarket started as somebody asking. '}
            {!(b.watching && b.saved.size === 0) && (
              <Link href="/signup">Ask it in your group</Link>
            )}
            {!(b.watching && b.saved.size === 0) && ' or '}
            <button type="button" onClick={b.reset}>
              clear the filters
            </button>
            .
          </p>
        </div>
      )}
    </section>
  );
}
