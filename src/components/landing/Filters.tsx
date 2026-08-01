'use client';

import { useRef, useState } from 'react';
import { Chevron } from './Icons';

export function Filters({ items }: { items: string[] }) {
  const [on, setOn] = useState(items[0]);
  const rail = useRef<HTMLDivElement>(null);

  return (
    <div className="pm-filters">
      <div className="pm-filters-rail" ref={rail}>
        {items.map((f) => (
          <button key={f} className="pm-filter" data-on={f === on} onClick={() => setOn(f)}>
            {f}
          </button>
        ))}
      </div>
      <button
        className="pm-cats-more"
        aria-label="More filters"
        onClick={() => rail.current?.scrollBy({ left: 240, behavior: 'smooth' })}
      >
        <Chevron size={16} />
      </button>
    </div>
  );
}
