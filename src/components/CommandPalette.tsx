'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CategoryIcon, Home, Person, Plus, Search, Shield, Trophy, Users } from './Icon';

export interface PaletteMarket {
  id: number;
  question: string;
  category: string;
  status: string;
}

export interface PaletteLink {
  href: string;
  label: string;
  hint?: string;
  icon: 'home' | 'trophy' | 'person' | 'shield' | 'bell' | 'plus' | 'groups';
}

type Item =
  | { key: string; href: string; label: string; hint?: string; kind: 'market'; category: string }
  | { key: string; href: string; label: string; hint?: string; kind: 'link'; icon: PaletteLink['icon'] };

const ICONS = { home: Home, trophy: Trophy, person: Person, shield: Shield, bell: Bell, plus: Plus, groups: Users };

/** The event the buttons fire; the palette listens for it. */
const OPEN = 'minimarket:palette';

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Jump anywhere in the group from the keyboard.
 *
 * Ctrl+K (or Cmd+K on a Mac) opens it; type a few letters of a question or a
 * category and Enter goes there. The market list arrives from the layout as
 * plain data — id, question, category, status — so opening the palette costs
 * no request, and the whole thing is one small client component that renders
 * nothing at all until it is asked for.
 */
export function CommandPalette({
  base,
  markets,
  links,
}: {
  base: string;
  markets: PaletteMarket[];
  links: PaletteLink[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === 'Escape') {
        setOpen(false);
      } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !typing(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const needle = query.trim().toLowerCase();
    const found = markets
      .filter((m) => !needle || `${m.question} ${m.category} ${m.status}`.toLowerCase().includes(needle))
      .slice(0, needle ? 12 : 6)
      .map<Item>((m) => ({
        key: `m${m.id}`,
        href: `${base}/m/${m.id}`,
        label: m.question,
        hint: m.status === 'open' ? m.category : `${m.category} · ${m.status}`,
        kind: 'market',
        category: m.category,
      }));
    const pages = links
      .filter((l) => !needle || `${l.label} ${l.hint ?? ''}`.toLowerCase().includes(needle))
      .map<Item>((l) => ({ key: l.href, href: l.href, label: l.label, hint: l.hint, kind: 'link', icon: l.icon }));
    // With nothing typed the pages lead, since they are what you reach for
    // most; once you start typing, the markets you are describing come first.
    return needle ? [...found, ...pages] : [...pages, ...found];
  }, [query, markets, links, base]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  if (!open) return null;

  return (
    <div className="palette-veil" onPointerDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Jump to">
        <div className="palette-search">
          <Search size={17} />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor((c) => Math.min(items.length - 1, c + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                go(items[cursor]);
              }
            }}
            placeholder="Jump to a market or a page"
            aria-label="Jump to"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="mono">esc</kbd>
        </div>

        <ul className="palette-list" role="listbox" ref={list}>
          {items.map((item, index) => {
            const Icon = item.kind === 'link' ? ICONS[item.icon] : null;
            return (
              <li
                key={item.key}
                role="option"
                aria-selected={index === cursor}
                data-on={index === cursor}
                data-index={index}
                className="palette-item"
                onPointerMove={() => setCursor(index)}
                onClick={() => go(item)}
              >
                <span className="palette-icon">
                  {Icon ? <Icon size={16} /> : <CategoryIcon category={(item as { category: string }).category} size={16} />}
                </span>
                <span className="palette-label">{item.label}</span>
                {item.hint && <span className="palette-hint mono">{item.hint}</span>}
              </li>
            );
          })}
          {items.length === 0 && <li className="palette-empty">Nothing matches that.</li>}
        </ul>

        <div className="palette-foot mono">
          <span>Arrows to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

/** Any button that should open the palette. Shows the shortcut for this machine. */
export function PaletteButton({
  className,
  children,
  hint = true,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { hint?: boolean }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN))} {...rest}>
      {children}
      {hint && <kbd className="palette-kbd mono">{mac ? 'Cmd K' : 'Ctrl K'}</kbd>}
    </button>
  );
}
