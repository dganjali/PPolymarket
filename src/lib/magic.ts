import { createHash, randomBytes } from 'node:crypto';
import { get, run, tx } from './db';
import { AppError } from './errors';
import { stamp } from './format';
import { mailConfigured, sendEmail, signInMessage } from './mail';
import { normaliseEmail, userForVerifiedEmail, validEmail, type User } from './users';

/** Long enough to read out of a phone notification, short enough to be worthless if forwarded. */
export const TTL_MINUTES = 15;

/** Per address, so one mailbox cannot be used to pump mail at somebody. */
export const MAGIC_LINKS_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

/** Spent and expired rows are kept briefly so a replay can be told apart from a typo. */
const RETENTION_HOURS = 48;

const minutesFromNow = (minutes: number) => stamp(Date.now() + minutes * 60_000);

/**
 * Tokens are stored as a digest, never in the clear: a leaked database dump
 * then cannot be turned into sessions. A fast hash is the right choice here —
 * the token is 256 bits of randomness, so there is nothing to guess.
 */
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export const safePath = (value: string) =>
  value.startsWith('/') && !value.startsWith('//') ? value : '/groups';

export interface IssuedLink {
  /** True once Resend has accepted the message. */
  delivered: boolean;
  /** Only set when no API key is configured, so local development can follow the link. */
  url?: string;
}

/**
 * Issues a single-use sign-in link and emails it.
 *
 * Whether or not an account exists for the address is never reflected in the
 * result — the caller says "check your inbox" either way — so this cannot be
 * used to find out who has signed up.
 */
export async function requestMagicLink(
  emailInput: string,
  nextPath: string,
  origin: string,
): Promise<IssuedLink> {
  const email = normaliseEmail(emailInput);
  if (!validEmail(email)) throw new AppError('Enter a valid email address.');

  await run("DELETE FROM login_tokens WHERE created_at < ?", stamp(Date.now() - RETENTION_HOURS * 3_600_000));

  const recent = (await get<{ n: number }>(
    'SELECT CAST(COUNT(*) AS INTEGER) AS n FROM login_tokens WHERE email = ? AND created_at >= ?',
    email,
    stamp(Date.now() - WINDOW_MINUTES * 60_000),
  ))!.n;
  if (recent >= MAGIC_LINKS_PER_WINDOW) {
    throw new AppError('That address has been sent several links already. Try again in a few minutes.');
  }

  const token = randomBytes(32).toString('base64url');
  await run(
    'INSERT INTO login_tokens (email, token_hash, next_path, expires_at) VALUES (?, ?, ?, ?)',
    email,
    digest(token),
    safePath(nextPath),
    minutesFromNow(TTL_MINUTES),
  );

  const url = `${origin.replace(/\/$/, '')}/login/magic?token=${encodeURIComponent(token)}`;
  if (!mailConfigured()) return { delivered: false, url };

  await sendEmail(signInMessage(email, url, TTL_MINUTES));
  return { delivered: true };
}

interface TokenRow {
  id: number;
  email: string;
  next_path: string;
  expires_at: string;
  consumed_at: string | null;
}

/** What a link is worth right now, without spending it. Drives the confirm page. */
export async function inspectMagicLink(
  token: string,
): Promise<{ email: string; nextPath: string } | null> {
  if (!token) return null;
  const row = await get<TokenRow>(
    'SELECT id, email, next_path, expires_at, consumed_at FROM login_tokens WHERE token_hash = ?',
    digest(token),
  );
  if (!row || row.consumed_at || row.expires_at <= stamp()) return null;
  return { email: row.email, nextPath: safePath(row.next_path) };
}

/**
 * Spends a link and returns whoever it belongs to.
 *
 * Consumption is a conditional UPDATE rather than a read followed by a write,
 * so a double submit — or a link opened twice at once — can only succeed once.
 */
export async function consumeMagicLink(token: string): Promise<{ user: User; nextPath: string }> {
  const expired = new AppError('That sign-in link has expired or been used already. Request a new one.');
  if (!token) throw expired;

  const row = await get<TokenRow>(
    'SELECT id, email, next_path, expires_at, consumed_at FROM login_tokens WHERE token_hash = ?',
    digest(token),
  );
  if (!row || row.consumed_at || row.expires_at <= stamp()) throw expired;

  const claimed = await tx(async () => {
    const marked = await run(
      "UPDATE login_tokens SET consumed_at = datetime('now') WHERE id = ? AND consumed_at IS NULL",
      row.id,
    );
    if (marked.changes !== 1) return false;
    // Signing in retires every other link outstanding for this address, so an
    // older email sitting in the inbox stops working the moment a newer one is used.
    await run('DELETE FROM login_tokens WHERE email = ? AND id <> ?', row.email, row.id);
    return true;
  });
  if (!claimed) throw expired;

  return { user: await userForVerifiedEmail(row.email), nextPath: safePath(row.next_path) };
}
