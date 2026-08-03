'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Home, Person, Plus, Shield, Trophy, type IconProps } from './Icon';

export interface NavItem {
  href: string;
  label: string;
  /** One line explaining what is behind the link. Revealed on hover and focus. */
  description: string;
  icon: 'home' | 'trophy' | 'person' | 'shield' | 'bell';
  /** Only match this href exactly, rather than as a path prefix. */
  exact?: boolean;
  /** Unread or waiting count. Zero and undefined both render nothing. */
  badge?: number;
}

const ICONS: Record<NavItem['icon'], (props: IconProps) => React.ReactElement> = {
  home: Home,
  trophy: Trophy,
  person: Person,
  shield: Shield,
  bell: Bell,
};

function isOn(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
}

function Badge({ count }: { count?: number }) {
  if (!count) return null;
  return <span className="nav-badge mono">{count > 99 ? '99+' : count}</span>;
}

/**
 * The desktop sidebar.
 *
 * Each row carries a one-line description that stays collapsed until you point
 * at it or tab to it, then unrolls underneath. The reveal is a
 * `grid-template-rows: 0fr -> 1fr` transition, which animates to the real
 * height of the text without anybody having to guess a max-height — and unlike
 * a max-height guess it stays correct when a description wraps to two lines on
 * a narrow sidebar.
 *
 * It is deliberately gated behind `@media (hover: hover)` in shell.css. On a
 * touch screen there is no hover to leave, so the same markup would leave a row
 * stuck open after a tap, permanently shoving the rest of the nav down.
 */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav-list" aria-label="This group">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const on = isOn(pathname, item);
        const descriptionId = `nav-desc-${item.href.replace(/\W+/g, '-')}`;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="nav-row"
            data-on={on}
            aria-current={on ? 'page' : undefined}
            aria-describedby={descriptionId}
          >
            <span className="nav-row-top">
              <span className="nav-icon">
                <Icon size={17} />
              </span>
              <span className="nav-label">{item.label}</span>
              <Badge count={item.badge} />
            </span>
            <span className="nav-reveal">
              <span className="nav-reveal-inner">
                <span className="nav-desc" id={descriptionId}>
                  {item.description}
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The phone tab bar. One indicator slides between tabs rather than four
 * separate borders switching on and off — the movement is the thing that tells
 * you which way you just went.
 */
export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const index = Math.max(0, items.findIndex((item) => isOn(pathname, item)));

  return (
    <nav className="tabbar" aria-label="This group">
      <span
        className="tabbar-marker"
        aria-hidden
        style={{
          width: `${100 / items.length}%`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const on = isOn(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-on={on}
            aria-current={on ? 'page' : undefined}
            className="tabbar-tab"
          >
            <span className="tabbar-icon">
              <Icon size={19} />
              <Badge count={item.badge} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The floating "new market" button — hidden on any screen but the market list. */
export function CreateFab({ href, listHref }: { href: string; listHref: string }) {
  const pathname = usePathname();
  if (pathname !== listHref) return null;
  return (
    <Link href={href} className="fab pressable" aria-label="Ask a question">
      <Plus size={22} weight={2.2} />
    </Link>
  );
}

/**
 * The top bar's border only appears once there is something above it to
 * separate from. A one-pixel sentinel above the bar goes out of view on the
 * first scroll; an IntersectionObserver flips a class when it does.
 */
export function ScrollShadow() {
  return <div className="topbar-sentinel" aria-hidden />;
}
