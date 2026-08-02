import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, run, tx } from './db';
import { AppError, isUniqueViolation } from './errors';

export interface User {
  id: number;
  handle: string;
  name: string;
  email: string | null;
  avatar: string | null;
}

/**
 * Placed in `pass_hash` for accounts that sign in some other way. Nothing can
 * verify against them: every real hash is "salt:hash", and these hold no colon.
 */
const GOOGLE_ONLY = '!google-only';
const EMAIL_ONLY = '!email-only';

/** Whether this account can be signed into with a password at all. */
export function hasPassword(passHash: string): boolean {
  return passHash.includes(':');
}

export const validEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

/**
 * A real hash of a value nobody knows, used to spend the same CPU on a sign-in
 * for an account that does not exist as on one that does.
 */
const DECOY_HASH = hashPassword(randomBytes(32).toString('hex'));

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function normaliseHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Which column a typed identifier refers to. The app prints handles as
 * "@priya" everywhere, so a leading @ is stripped before deciding: what still
 * holds an @ after that is an address, anything else is a handle.
 */
export function identifierColumn(identifier: string): { column: 'email' | 'handle'; value: string } {
  const trimmed = identifier.trim().replace(/^@+/, '');
  return trimmed.includes('@')
    ? { column: 'email', value: normaliseEmail(trimmed) }
    : { column: 'handle', value: normaliseHandle(trimmed) };
}

/**
 * A presentable display name for somebody who only ever gave us an address:
 * "priya.raman@school.edu" reads better on a leaderboard as "Priya Raman".
 */
function nameFromEmail(email: string): string {
  return (
    email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .slice(0, 60) || email
  );
}

async function availableHandle(preferred: string): Promise<string> {
  const base = normaliseHandle(preferred).slice(0, 24) || 'member';
  let handle = base;
  let suffix = 2;
  while (await get('SELECT id FROM users WHERE handle = ?', handle)) {
    handle = `${base.slice(0, 20)}_${suffix++}`;
  }
  return handle;
}

/**
 * Finds or creates the account for an address whose owner has just proved they
 * control it — by clicking a sign-in link, or by signing in with Google.
 *
 * Two tabs can finish that proof at the same instant and both find nothing, so
 * rather than lock, the unique indexes settle it: on a collision the retry
 * finds the row the winner wrote, or picks another free handle.
 */
async function provisionVerified(
  email: string,
  preferredName: string,
  sentinel: string,
  googleSub: string | null,
): Promise<User> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = googleSub
      ? await linkGoogleUser(googleSub, email)
      : await get<User>('SELECT id, handle, name, email, avatar FROM users WHERE email = ?', email);
    if (existing) return existing;

    const handle = await availableHandle(email.split('@')[0]);
    const name = preferredName.trim() || nameFromEmail(email);
    try {
      const res = await run(
        'INSERT INTO users (handle, name, pass_hash, email, google_sub) VALUES (?, ?, ?, ?, ?)',
        handle,
        name,
        sentinel,
        email,
        googleSub,
      );
      return { id: Number(res.lastInsertRowid), handle, name, email, avatar: null };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new AppError('Could not finish setting up your account. Try again.');
}

/**
 * The account behind an address the holder has just proved they control, via a
 * sign-in link. New addresses get a passwordless account — a typo cannot create
 * one, because nobody can open a link sent to a mailbox they do not have.
 */
export async function userForVerifiedEmail(email: string): Promise<User> {
  const clean = normaliseEmail(email);
  if (!validEmail(clean)) throw new AppError('Enter a valid email address.');
  return provisionVerified(clean, '', EMAIL_ONLY, null);
}

export async function createUser(handle: string, name: string, password: string, email?: string): Promise<User> {
  const clean = normaliseHandle(handle);
  const cleanEmail = email ? normaliseEmail(email) : null;
  if (clean.length < 2) throw new AppError('Pick a handle with at least 2 letters or numbers.');
  if (password.length < 8) throw new AppError('Password needs at least 8 characters.');
  if (password.length > 256) throw new AppError('Password is too long.');
  if (cleanEmail && !validEmail(cleanEmail)) throw new AppError('Enter a valid email address.');

  const display = name.trim() || clean;
  // Hashed before the transaction opens: scrypt is deliberately slow, and on
  // SQLite this runs under a write lock the rest of the app is waiting on.
  const passHash = hashPassword(password);

  try {
    return await tx(async () => {
      if (await get('SELECT id FROM users WHERE handle = ?', clean)) throw new AppError('That handle is taken.');
      if (cleanEmail && await get('SELECT id FROM users WHERE email = ?', cleanEmail)) {
        throw new AppError('An account already uses that email.');
      }
      const res = await run(
        'INSERT INTO users (handle, name, pass_hash, email) VALUES (?, ?, ?, ?)',
        clean,
        display,
        passHash,
        cleanEmail,
      );
      return { id: Number(res.lastInsertRowid), handle: clean, name: display, email: cleanEmail, avatar: null };
    });
  } catch (error) {
    // Two signups can clear those checks in the same instant. The unique
    // indexes are the real arbiter, and the loser gets told so in plain words
    // rather than being shown the driver's constraint message.
    if (isUniqueViolation(error)) throw new AppError('That handle or email is already taken.');
    throw error;
  }
}

export async function authenticate(identifier: string, password: string): Promise<User | null> {
  const { column, value } = identifierColumn(identifier);
  const row = value
    ? await get<User & { pass_hash: string }>(
        `SELECT id, handle, name, email, avatar, pass_hash FROM users WHERE ${column} = ?`,
        value,
      )
    : undefined;

  // Always pay the hashing cost, even with no account to check against, so the
  // time a failed sign-in takes cannot be used to enumerate handles or
  // addresses. Passwordless accounts hash against the decoy for the same reason.
  const passwordless = !row || !hasPassword(row.pass_hash);
  const matches = verifyPassword(password, passwordless ? DECOY_HASH : row!.pass_hash);
  if (!row || passwordless || !matches) return null;

  return { id: row.id, handle: row.handle, name: row.name, email: row.email, avatar: row.avatar };
}

/** An existing account for this Google identity, linking it by address if needed. */
async function linkGoogleUser(sub: string, email: string): Promise<User | undefined> {
  const byGoogle = await get<User>(
    'SELECT id, handle, name, email, avatar FROM users WHERE google_sub = ?',
    sub,
  );
  if (byGoogle) return byGoogle;

  // Google has told us it verified this address, so whoever signed up with it
  // is the same person.
  const byEmail = await get<User>('SELECT id, handle, name, email, avatar FROM users WHERE email = ?', email);
  if (byEmail) {
    await run('UPDATE users SET google_sub = ? WHERE id = ? AND google_sub IS NULL', sub, byEmail.id);
    return byEmail;
  }
  return undefined;
}

export async function upsertGoogleUser(input: {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}): Promise<User> {
  const email = normaliseEmail(input.email);
  if (!input.sub || !input.emailVerified || !validEmail(email)) {
    throw new AppError('Google did not return a verified email address.');
  }

  return provisionVerified(email, input.name, GOOGLE_ONLY, input.sub);
}

/**
 * Only raster formats. SVG is an image to a browser and a script host to an
 * attacker, so it never gets stored — a group's avatars render in everyone
 * else's page.
 */
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

/** Roughly 90 KB of base64, which a 256px square never approaches. */
const AVATAR_MAX = 120_000;

export async function updateProfile(
  userId: number,
  patch: { name?: string; avatar?: string | null },
): Promise<User> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 60);
    if (name.length < 1) throw new AppError('Give yourself a display name.');
    fields.push('name = ?');
    values.push(name);
  }

  if (patch.avatar !== undefined) {
    const avatar = patch.avatar?.trim() || null;
    if (avatar !== null) {
      if (avatar.length > AVATAR_MAX) throw new AppError('That picture is too large — try a smaller one.');
      if (!AVATAR_PATTERN.test(avatar)) throw new AppError('That is not a PNG, JPEG or WebP image.');
    }
    fields.push('avatar = ?');
    values.push(avatar);
  }

  if (fields.length) await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...values, userId);
  return (await userById(userId))!;
}

export async function userById(id: number): Promise<User | null> {
  return await get<User>('SELECT id, handle, name, email, avatar FROM users WHERE id = ?', id) ?? null;
}
