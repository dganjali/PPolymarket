'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  /** Only match this href exactly, rather than as a path prefix. */
  exact?: boolean;
}

function isOn(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="nav" data-on={isOn(pathname, item)}>
          {item.label}
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
        <Link key={item.href} href={item.href} data-on={isOn(pathname, item)}>
          <span className="dot" />
          {item.label}
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
