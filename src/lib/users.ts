import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, run } from './db';

export interface User {
  id: number;
  handle: string;
  name: string;
  email: string | null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

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

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function availableHandle(preferred: string): string {
  const base = normaliseHandle(preferred).slice(0, 24) || 'member';
  let handle = base;
  let suffix = 2;
  while (get('SELECT id FROM users WHERE handle = ?', handle)) {
    handle = `${base.slice(0, 20)}_${suffix++}`;
  }
  return handle;
}

export function createUser(handle: string, name: string, password: string, email?: string): User {
  const clean = normaliseHandle(handle);
  const cleanEmail = email ? normaliseEmail(email) : null;
  if (clean.length < 2) throw new Error('Pick a handle with at least 2 letters or numbers.');
  if (password.length < 8) throw new Error('Password needs at least 8 characters.');
  if (password.length > 256) throw new Error('Password is too long.');
  if (cleanEmail && !validEmail(cleanEmail)) throw new Error('Enter a valid email address.');
  if (get('SELECT id FROM users WHERE handle = ?', clean)) throw new Error('That handle is taken.');
  if (cleanEmail && get('SELECT id FROM users WHERE email = ?', cleanEmail)) {
    throw new Error('An account already uses that email.');
  }

  const display = name.trim() || clean;
  const res = run(
    'INSERT INTO users (handle, name, pass_hash, email) VALUES (?, ?, ?, ?)',
    clean,
    display,
    hashPassword(password),
    cleanEmail,
  );
  return { id: Number(res.lastInsertRowid), handle: clean, name: display, email: cleanEmail };
}

export function authenticate(identifier: string, password: string): User | null {
  const clean = identifier.trim().toLowerCase();
  const row = get<User & { pass_hash: string }>(
    `SELECT id, handle, name, email, pass_hash FROM users
      WHERE ${clean.includes('@') ? 'email' : 'handle'} = ?`,
    clean.includes('@') ? normaliseEmail(clean) : normaliseHandle(clean),
  );
  if (!row || !verifyPassword(password, row.pass_hash)) return null;
  return { id: row.id, handle: row.handle, name: row.name, email: row.email };
}

export function upsertGoogleUser(input: {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}): User {
  const email = normaliseEmail(input.email);
  if (!input.sub || !input.emailVerified || !validEmail(email)) {
    throw new Error('Google did not return a verified email address.');
  }

  const byGoogle = get<User>(
    'SELECT id, handle, name, email FROM users WHERE google_sub = ?',
    input.sub,
  );
  if (byGoogle) return byGoogle;

  const byEmail = get<User>('SELECT id, handle, name, email FROM users WHERE email = ?', email);
  if (byEmail) {
    run('UPDATE users SET google_sub = ? WHERE id = ?', input.sub, byEmail.id);
    return byEmail;
  }

  const handle = availableHandle(email.split('@')[0]);
  const name = input.name.trim() || handle;
  const res = run(
    `INSERT INTO users (handle, name, pass_hash, email, google_sub)
     VALUES (?, ?, '!google-only', ?, ?)`,
    handle,
    name,
    email,
    input.sub,
  );
  return { id: Number(res.lastInsertRowid), handle, name, email };
}

export function userById(id: number): User | null {
  return get<User>('SELECT id, handle, name, email FROM users WHERE id = ?', id) ?? null;
}
