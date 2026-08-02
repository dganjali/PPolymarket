import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Never echo a connection string, which carries the database password. */
const scrub = (text: string) => text.replace(/[a-z]+:\/\/[^\s]*/gi, '<url>').slice(0, 300);

/**
 * What this deployment is missing, in one request.
 *
 * Next hides server errors behind a digest in production, which leaves an
 * operator staring at "Application error" with nothing to act on. This reports
 * whether each piece of configuration is present — never its value — and
 * whether the database actually answers.
 */
export async function GET() {
  const configured = {
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    DATABASE_URL: !!process.env.DATABASE_URL,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    APP_ORIGIN: !!process.env.APP_ORIGIN,
  };

  const problems: string[] = [];
  if (!configured.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    problems.push('SESSION_SECRET is not set, so nobody can sign in. Generate one with: openssl rand -base64 32');
  }
  if (!configured.POSTGRES_URL && !configured.DATABASE_URL && process.env.NODE_ENV === 'production') {
    problems.push(
      'Neither POSTGRES_URL nor DATABASE_URL is set. A deployed Minimarket needs Postgres — ' +
        'the SQLite fallback cannot be written on a serverless filesystem. ' +
        'If your connection string is under another name, copy it to POSTGRES_URL.',
    );
  }

  // Imported lazily: this module throws on load when the database cannot open,
  // and a health check that cannot run is no use to anybody.
  let database: Record<string, unknown>;
  try {
    const { get } = await import('@/lib/db');
    const row = await get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM users');
    database = { ok: true, users: row?.n ?? 0 };
  } catch (error) {
    const e = (error ?? {}) as { code?: unknown; name?: unknown; message?: unknown };
    database = {
      ok: false,
      code: typeof e.code === 'string' ? e.code : undefined,
      name: typeof e.name === 'string' ? e.name : undefined,
      message: typeof e.message === 'string' ? scrub(e.message) : 'unknown failure',
    };
    problems.push('The database did not answer — see database.message below.');
  }

  return NextResponse.json(
    {
      ok: problems.length === 0 && database.ok === true,
      driver: configured.POSTGRES_URL || configured.DATABASE_URL ? 'postgres' : 'sqlite',
      environment: process.env.NODE_ENV ?? 'unknown',
      configured,
      database,
      problems,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
