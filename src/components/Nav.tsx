'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  /** Only match this href exactly, rather than as a path prefix. */
  exact?: boolean;
  /** Unread or waiting count. Zero and undefined both render nothing. */
  badge?: number;
}

/** The count that makes a nav item worth looking at. */
function Badge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="mono"
      style={{
        minWidth: 17,
        height: 17,
        padding: '0 5px',
        borderRadius: 99,
        background: 'var(--gold)',
        color: '#141312',
        fontSize: 10,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function isOn(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="nav"
          data-on={isOn(pathname, item)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span>{item.label}</span>
          <Badge count={item.badge} />
        </Link>
      ))}
    </div>
  );
}

export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="tabbar">
      {items.map((item) => (
        <Link key={item.href} href={item.href} data-on={isOn(pathname, item)} style={{ position: 'relative' }}>
          <span className="dot" />
          {item.label}
          {!!item.badge && (
            <span
              className="mono"
              style={{
                position: 'absolute',
                top: -1,
                right: 'calc(50% - 26px)',
                minWidth: 15,
                height: 15,
                padding: '0 4px',
                borderRadius: 99,
                background: 'var(--gold)',
                color: '#141312',
                fontSize: 9,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** The floating "new market" button — hidden on any screen but the market list. */
export function CreateFab({ href, listHref }: { href: string; listHref: string }) {
  const pathname = usePathname();
  if (pathname !== listHref) return null;
  return (
    <Link href={href} className="fab" aria-label="New market">
      +
    </Link>
  );
}
