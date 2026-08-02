import { createHmac, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { userById, type User } from './users';

const COOKIE = 'mm_session';
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type { User };
export { authenticate, createUser } from './users';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production.');
  }
  // Dev fallback: stable across restarts so sessions survive a reload.
  return `minimarket-dev-${process.env.DATABASE_PATH ?? 'data/minimarket.db'}`;
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export async function setSession(userId: number) {
  const payload = `${userId}.${Date.now()}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * The signed-in user, or null. Wrapped in React's `cache` so the layout, the
 * page and any server action in one request resolve the session with a single
 * row lookup instead of one apiece.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const idx = raw.lastIndexOf('.');
  if (idx < 0) return null;
  const payload = raw.slice(0, idx);

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(raw.slice(idx + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const [idStr, issued] = payload.split('.');
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (Date.now() - Number(issued) > MAX_AGE * 1000) return null;

  return await userById(id);
});
