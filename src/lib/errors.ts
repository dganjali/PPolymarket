/** An error whose message is meant for the person who triggered it. */
export class AppError extends Error {}

/**
 * True when a write lost a race against a unique index. The two drivers report
 * it differently: `node:sqlite` only says so in the message, while Postgres
 * sets SQLSTATE 23505.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '23505') return true;
  return typeof message === 'string' && /UNIQUE constraint failed|duplicate key value/i.test(message);
}
