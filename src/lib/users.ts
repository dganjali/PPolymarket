import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, run } from './db';

export interface User {
  id: number;
  handle: string;
  name: string;
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

export function createUser(handle: string, name: string, password: string): User {
  const clean = normaliseHandle(handle);
  if (clean.length < 2) throw new Error('Pick a handle with at least 2 letters or numbers.');
  if (password.length < 6) throw new Error('Password needs at least 6 characters.');
  if (get('SELECT id FROM users WHERE handle = ?', clean)) throw new Error('That handle is taken.');

  const display = name.trim() || clean;
  const res = run(
    'INSERT INTO users (handle, name, pass_hash) VALUES (?, ?, ?)',
    clean,
    display,
    hashPassword(password),
  );
  return { id: Number(res.lastInsertRowid), handle: clean, name: display };
}

export function authenticate(handle: string, password: string): User | null {
  const row = get<User & { pass_hash: string }>(
    'SELECT id, handle, name, pass_hash FROM users WHERE handle = ?',
    normaliseHandle(handle),
  );
  if (!row || !verifyPassword(password, row.pass_hash)) return null;
  return { id: row.id, handle: row.handle, name: row.name };
}

export function userById(id: number): User | null {
  return get<User>('SELECT id, handle, name FROM users WHERE id = ?', id) ?? null;
}
