import { createHmac, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { AppError } from './errors';
import { userById, type User } from './users';

const COOKIE = 'mm_session';
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type { User };
export { authenticate, createUser } from './users';

/**
 * The key session cookies are signed with, or null when this deployment has not
 * been given one. Production must never fall back to a guessable value —
 * anyone who knew it could mint a cookie for any account — so the honest answer
 * there is "no key", handled by the callers below.
 */
function secret(): string | null {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return null;
  // Dev fallback: stable across restarts so sessions survive a reload.
  return `minimarket-dev-${process.env.DATABASE_PATH ?? 'data/minimarket.db'}`;
}

/** False when the deployment cannot sign anybody in, so the pages can say so. */
export function sessionsConfigured(): boolean {
  return secret() !== null;
}

/** Aimed at whoever runs the deployment: nothing works until this is fixed. */
export const SESSION_MISCONFIGURED =
  'This deployment has no SESSION_SECRET set, so nobody can sign in. ' +
  'Set it in the hosting environment (openssl rand -base64 32) and redeploy.';

let reported = false;

/**
 * Missing configuration used to throw from inside a render, which reaches the
 * browser as a bare "Application error" and a digest — the operator is left
 * guessing. Now it says what to do, once, in the logs and on the sign-in page.
 */
function missingSecret(): AppError {
  if (!reported) {
    reported = true;
    console.error(
      '\n[auth] SESSION_SECRET is not set, so nobody can sign in.\n' +
        '       Set it in the hosting environment and redeploy. Generate one with:\n' +
        '         openssl rand -base64 32\n',
    );
  }
  return new AppError(
    'This deployment has no SESSION_SECRET set, so it cannot sign anyone in. ' +
      'Whoever runs it needs to set that and redeploy.',
  );
}

function sign(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('base64url');
}

export async function setSession(userId: number) {
  const key = secret();
  if (!key) throw missingSecret();

  const payload = `${userId}.${Date.now()}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload, key)}`, {
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

  const key = secret();
  // With no key there is nothing to verify against. Report it and treat the
  // request as signed out, rather than turning every page into a 500.
  if (!key) {
    missingSecret();
    return null;
  }

  const idx = raw.lastIndexOf('.');
  if (idx < 0) return null;
  const payload = raw.slice(0, idx);

  const expected = Buffer.from(sign(payload, key));
  const actual = Buffer.from(raw.slice(idx + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const [idStr, issued] = payload.split('.');
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (Date.now() - Number(issued) > MAX_AGE * 1000) return null;

  return await userById(id);
});
