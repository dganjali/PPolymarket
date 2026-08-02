import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, run, tx } from './db';
import { AppError, isUniqueViolation } from './errors';

export interface User {
  id: number;
  handle: string;
  name: string;
  email: string | null;
}

/** Stored in `pass_hash` for accounts that can only ever sign in with Google. */
const GOOGLE_ONLY = '!google-only';

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

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      return { id: Number(res.lastInsertRowid), handle: clean, name: display, email: cleanEmail };
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
        `SELECT id, handle, name, email, pass_hash FROM users WHERE ${column} = ?`,
        value,
      )
    : undefined;

  // Always pay the hashing cost, even with no account to check against, so the
  // time a failed sign-in takes cannot be used to enumerate handles or
  // addresses. Google-only accounts hash against the decoy for the same reason.
  const googleOnly = row?.pass_hash === GOOGLE_ONLY;
  const matches = verifyPassword(password, row && !googleOnly ? row.pass_hash : DECOY_HASH);
  if (!row || googleOnly || !matches) return null;

  return { id: row.id, handle: row.handle, name: row.name, email: row.email };
}

/** An existing account for this Google identity, linking it by address if needed. */
async function linkGoogleUser(sub: string, email: string): Promise<User | undefined> {
  const byGoogle = await get<User>(
    'SELECT id, handle, name, email FROM users WHERE google_sub = ?',
    sub,
  );
  if (byGoogle) return byGoogle;

  // Google has told us it verified this address, so whoever signed up with it
  // is the same person.
  const byEmail = await get<User>('SELECT id, handle, name, email FROM users WHERE email = ?', email);
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

  // Two tabs finishing the OAuth dance at once both find no account and both
  // insert. Rather than lock, let the unique indexes settle it and look again:
  // the retry finds the row the winner wrote, or a free handle.
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await linkGoogleUser(input.sub, email);
    if (existing) return existing;

    const handle = await availableHandle(email.split('@')[0]);
    const name = input.name.trim() || handle;
    try {
      const res = await run(
        `INSERT INTO users (handle, name, pass_hash, email, google_sub) VALUES (?, ?, ?, ?, ?)`,
        handle,
        name,
        GOOGLE_ONLY,
        email,
        input.sub,
      );
      return { id: Number(res.lastInsertRowid), handle, name, email };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new AppError('Could not finish signing you in with Google. Try again.');
}

export async function userById(id: number): Promise<User | null> {
  return await get<User>('SELECT id, handle, name, email FROM users WHERE id = ?', id) ?? null;
}
