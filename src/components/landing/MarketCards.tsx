import type { Card } from '@/lib/landing';
import { Bookmark } from './Icons';

const R = 16;
const C = 2 * Math.PI * R;
/** The ring is a 270° gauge with the gap at the bottom. */
const SWEEP = 0.75;

function Gauge({ pct, label, tone = 'yes' }: { pct: number; label: string; tone?: 'yes' | 'no' }) {
  return (
    <div className="pm-gauge">
      <svg viewBox="0 0 40 40" aria-hidden>
        <g transform="rotate(135 20 20)">
          <circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="3.4"
            strokeDasharray={`${SWEEP * C} ${C}`}
            strokeLinecap="round"
          />
          <circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke={tone === 'yes' ? 'var(--yes)' : 'var(--no)'}
            strokeWidth="3.4"
            strokeDasharray={`${SWEEP * C * (pct / 100)} ${C}`}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="pm-gauge-text">
        <b>{pct}%</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Foot({ volume, ends }: { volume: string; ends: string }) {
  return (
    <footer className="pm-card-foot">
      <span>{volume}</span>
      <span className="pm-card-ends">{ends}</span>
      <span className="pm-card-save">
        <Bookmark size={14} />
      </span>
    </footer>
  );
}

export function MarketCard({ card }: { card: Card }) {
  return (
    <article className="pm-card">
      <div className="pm-card-top">
        <div className="pm-card-icon" style={{ background: card.tint }}>
          <span>{card.emoji}</span>
        </div>
        <h3 className="pm-card-title">{card.title}</h3>
        {card.kind === 'gauge' || card.kind === 'updown' ? (
          <Gauge pct={card.pct} label={card.gaugeLabel} />
        ) : null}
      </div>

      {card.kind === 'gauge' && (
        <div className="pm-card-duo">
          <button className="pm-buy pm-buy-yes">{card.yes}</button>
          <button className="pm-buy pm-buy-no">{card.no}</button>
        </div>
      )}

      {card.kind === 'updown' && (
        <>
          <div className="pm-rungs">
            {card.rungs.map((r, n) => (
              <div key={n}>
                <span className="pm-rung-up">{r.up}</span>
                <span className="pm-rung-down">{r.down}</span>
              </div>
            ))}
          </div>
          <div className="pm-card-duo">
            <button className="pm-buy pm-buy-yes">{card.upLabel}</button>
            <button className="pm-buy pm-buy-no">{card.downLabel}</button>
          </div>
        </>
      )}

      {card.kind === 'rows' && (
        <div className="pm-card-rows">
          {card.rows.map((r) => (
            <div className="pm-row" key={r.label}>
              <span className="pm-row-label">{r.label}</span>
              <span className="pm-row-pct">{r.pct}%</span>
              <button className="pm-mini pm-mini-yes">Yes</button>
              <button className="pm-mini pm-mini-no">No</button>
            </div>
          ))}
        </div>
      )}

      {card.kind === 'versus' && (
        <>
          <div className="pm-card-rows">
            {card.sides.map((s) => (
              <div className="pm-row pm-row-vs" key={s.name}>
                <span className="pm-team" style={{ background: s.tint }}>
                  {s.emoji}
                </span>
                <span className="pm-score">{s.score}</span>
                <span className="pm-row-label">{s.name}</span>
                <span className="pm-row-pct">{s.pct}%</span>
              </div>
            ))}
          </div>
          <div className="pm-card-duo">
            {card.sides.map((s) => (
              <button key={s.name} className="pm-buy pm-buy-neutral">
                {s.name}
              </button>
            ))}
          </div>
        </>
      )}

      <Foot volume={card.volume} ends={card.ends} />
    </article>
  );
}
