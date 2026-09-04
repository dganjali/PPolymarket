import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';

/**
 * Who is signed in, for pages that are otherwise static.
 *
 * The landing page used to read the session cookie during render, which made
 * the whole route dynamic: every anonymous visitor paid for a server render
 * before seeing a single pixel. Now the page is prerendered once at build and
 * served from the CDN, and the header asks this route *after* it has painted
 * to swap "Log in" for "Your groups" when there is somebody to greet.
 *
 * Signed-out visitors cost one cookie parse and no database at all.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  return NextResponse.json(user ? { name: user.name, handle: user.handle } : null, {
    headers: { 'cache-control': 'private, no-store' },
  });
}
