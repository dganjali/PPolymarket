'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Card } from '@/lib/landing';
import { Bookmark } from './Icons';
import { useReducedMotion } from './motion';

/** The ring is a 270° gauge with the gap at the bottom, on a 100-unit circumference. */
const SWEEP = 75;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

type Flash = 'up' | 'down' | null;

/**
 * A number that moves a point now and then, the way a live price does.
 *
 * Each card owns one, on its own random clock (twelve to forty seconds), so
 * across the grid something twitches every few seconds without any one card
 * looking nervous. It stops entirely when the tab is hidden or when the
 * visitor has asked for reduced motion.
 */
function useDrift(initial: number, lo = 3, hi = 97): [number, Flash] {
  const [value, setValue] = useState(initial);
  const [flash, setFlash] = useState<Flash>(null);
  const current = useRef(initial);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (!document.hidden) {
          const step = Math.random() < 0.5 ? -1 : 1;
          const next = Math.max(lo, Math.min(hi, current.current + step));
          if (next !== current.current) {
            current.current = next;
            setValue(next);
            setFlash(step > 0 ? 'up' : 'down');
            settle = setTimeout(() => alive && setFlash(null), 900);
          }
        }
        schedule();
      }, 12_000 + Math.random() * 28_000);
    };
    schedule();

    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(settle);
    };
  }, [reduced, lo, hi]);

  return [value, flash];
}

/** The cursor lights the card from wherever it is. Two CSS variables, no state. */
function spotlight(event: PointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--mx', `${(event.clientX - box.left).toFixed(0)}px`);
  event.currentTarget.style.setProperty('--my', `${(event.clientY - box.top).toFixed(0)}px`);
}

function Gauge({ pct, label, flash, tone = 'yes' }: { pct: number; label: string; flash: Flash; tone?: 'yes' | 'no' }) {
  return (
    <div className="pm-gauge">
      <svg viewBox="0 0 40 40" aria-hidden>
        <g transform="rotate(135 20 20)">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="3.4"
            pathLength={100}
            strokeDasharray={`${SWEEP} 100`}
            strokeLinecap="round"
          />
          <circle
            className="pm-gauge-fill"
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={tone === 'yes' ? 'var(--yes)' : 'var(--no)'}
            strokeWidth="3.4"
            pathLength={100}
            strokeDasharray={`${(SWEEP * pct) / 100} 100`}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="pm-gauge-text">
        <b key={pct} className={flash ? `pm-flash-${flash}` : undefined}>
          {pct}%
        </b>
        <span>{label}</span>
      </div>
    </div>
  );
}

/** "Ends in 4m 12s", and it means it. Loops so the demo never goes stale. */
function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const timer = setInterval(() => setLeft((s) => (s <= 1 ? seconds : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, '0');
  return (
    <span className="pm-card-ends" data-hot={left < 60}>
      Ends in {m}m {s}s
    </span>
  );
}

function Foot({ card }: { card: Card }) {
  const [saved, setSaved] = useState(false);
  return (
    <footer className="pm-card-foot">
      <span>{card.volume}</span>
      {card.endsIn ? <Countdown seconds={card.endsIn} /> : <span className="pm-card-ends">{card.ends}</span>}
      <button
        type="button"
        className="pm-card-save"
        data-on={saved}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
        onClick={() => setSaved((s) => !s)}
      >
        <Bookmark size={14} />
      </button>
    </footer>
  );
}

function Shell({
  card,
  index,
  gauge,
  children,
}: {
  card: Card;
  index: number;
  gauge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="pm-card" style={vars({ '--i': index })} onPointerMove={spotlight}>
      <div className="pm-card-top">
        <div className="pm-card-icon" style={{ background: card.tint }}>
          <span>{card.emoji}</span>
        </div>
        <h3 className="pm-card-title">{card.title}</h3>
        {gauge}
      </div>
      {children}
      <Foot card={card} />
    </article>
  );
}

function GaugeCard({ card, index }: { card: Extract<Card, { kind: 'gauge' }>; index: number }) {
  const [pct, flash] = useDrift(card.pct);
  return (
    <Shell card={card} index={index} gauge={<Gauge pct={pct} label={card.gaugeLabel} flash={flash} />}>
      <div className="pm-card-duo">
        <Link href="/signup" className="pm-buy pm-buy-yes">
          Yes {pct}¢
        </Link>
        <Link href="/signup" className="pm-buy pm-buy-no">
          No {100 - pct}¢
        </Link>
      </div>
    </Shell>
  );
}

function UpDownCard({ card, index }: { card: Extract<Card, { kind: 'updown' }>; index: number }) {
  const [pct, flash] = useDrift(card.pct);
  return (
    <Shell card={card} index={index} gauge={<Gauge pct={pct} label={card.gaugeLabel} flash={flash} />}>
      <div className="pm-rungs">
        {card.rungs.map((r, n) => (
          <div key={n}>
            <span className="pm-rung-up">{r.up}</span>
            <span className="pm-rung-down">{r.down}</span>
          </div>
        ))}
      </div>
      <div className="pm-card-duo">
        <Link href="/signup" className="pm-buy pm-buy-yes">
          {card.upLabel}
        </Link>
        <Link href="/signup" className="pm-buy pm-buy-no">
          {card.downLabel}
        </Link>
      </div>
    </Shell>
  );
}

function RowsCard({ card, index }: { card: Extract<Card, { kind: 'rows' }>; index: number }) {
  // Only the favourite moves; the rest of the field holds still.
  const [lead, flash] = useDrift(card.rows[0].pct);
  return (
    <Shell card={card} index={index}>
      <div className="pm-card-rows">
        {card.rows.map((r, n) => {
          const pct = n === 0 ? lead : r.pct;
          return (
            <div className="pm-row" key={r.label} style={vars({ '--w': pct / 100, '--i': n })}>
              <span className="pm-row-label">{r.label}</span>
              <span key={pct} className={`pm-row-pct${n === 0 && flash ? ` pm-flash-${flash}` : ''}`}>
                {pct}%
              </span>
              <Link href="/signup" className="pm-mini pm-mini-yes">
                Yes
              </Link>
              <Link href="/signup" className="pm-mini pm-mini-no">
                No
              </Link>
              <span className="pm-row-bar" />
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function VersusCard({ card, index }: { card: Extract<Card, { kind: 'versus' }>; index: number }) {
  const [a, flash] = useDrift(card.sides[0].pct);
  const pcts = [a, 100 - a];
  const flashes: Flash[] = [flash, flash === 'up' ? 'down' : flash === 'down' ? 'up' : null];
  return (
    <Shell card={card} index={index}>
      <div className="pm-card-rows">
        {card.sides.map((s, n) => (
          <div className="pm-row pm-row-vs" key={s.name} style={vars({ '--w': pcts[n] / 100, '--i': n })}>
            <span className="pm-team" style={{ background: s.tint }}>
              {s.emoji}
            </span>
            <span className="pm-score">{s.score}</span>
            <span className="pm-row-label">{s.name}</span>
            <span key={pcts[n]} className={`pm-row-pct${flashes[n] ? ` pm-flash-${flashes[n]}` : ''}`}>
              {pcts[n]}%
            </span>
            <span className="pm-row-bar" />
          </div>
        ))}
      </div>
      <div className="pm-card-duo">
        {card.sides.map((s, n) => (
          <Link key={s.name} href="/signup" className="pm-buy pm-buy-neutral">
            {s.name} {pcts[n]}¢
          </Link>
        ))}
      </div>
    </Shell>
  );
}

export function MarketCard({ card, index }: { card: Card; index: number }) {
  switch (card.kind) {
    case 'gauge':
      return <GaugeCard card={card} index={index} />;
    case 'updown':
      return <UpDownCard card={card} index={index} />;
    case 'rows':
      return <RowsCard card={card} index={index} />;
    case 'versus':
      return <VersusCard card={card} index={index} />;
  }
}
