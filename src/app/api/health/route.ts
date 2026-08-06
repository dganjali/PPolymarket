import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Never echo a connection string, which carries the database password. */
const scrub = (text: string) => text.replace(/[a-z]+:\/\/[^\s]*/gi, '<url>').slice(0, 300);

/**
 * Where the driver is actually pointed, password omitted.
 *
 * "password authentication failed for user X" is only actionable once you can
 * see which user and host were used — through Supabase's pooler the username
 * has to carry the project ref, and a password with unescaped punctuation
 * silently mangles the whole userinfo section.
 */
function connectionTarget(raw: string | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const password = decodeURIComponent(url.password);
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: decodeURIComponent(url.username),
      database: url.pathname.replace(/^\//, '') || null,
      passwordSet: password.length > 0,
      passwordLength: password.length,
      // The usual cause of a mangled connection string.
      passwordNeedsEscaping: /[@:/?#[\]]/.test(password),
      looksLikePooler: url.hostname.includes('pooler.supabase.com'),
      userCarriesProjectRef: url.username.includes('.'),
    };
  } catch {
    return { parseError: 'Could not be parsed as a URL. It must start with postgresql:// and have any special characters in the password percent-encoded.' };
  }
}

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

  const target = connectionTarget(process.env.POSTGRES_URL ?? process.env.DATABASE_URL);

  const problems: string[] = [];
  if (!configured.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    problems.push('SESSION_SECRET is not set, so nobody can sign in. Generate one with: openssl rand -base64 32');
  }
  if (target && 'looksLikePooler' in target) {
    if (target.looksLikePooler && !target.userCarriesProjectRef) {
      problems.push(
        `Supabase's pooler needs the project ref in the username. Change user "${target.user}" to ` +
          `"${target.user}.<your-project-ref>" — the ref is the subdomain of your db.<ref>.supabase.co host.`,
      );
    }
    if (!target.looksLikePooler) {
      problems.push(
        `Host "${target.host}" is the direct connection. On Vercel use the transaction pooler ` +
          '(aws-0-<region>.pooler.supabase.com, port 6543) — direct connections are IPv6-only and unpooled.',
      );
    }
    if (target.passwordNeedsEscaping) {
      problems.push(
        'The password contains characters that must be percent-encoded in a URL (@ : / ? # [ ]). ' +
          'Encode them, or reset the database password to something alphanumeric.',
      );
    }
    if (!target.passwordSet) problems.push('The connection string carries no password.');
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
      // Every query is a round trip, so where this function runs relative to the
      // database is a multiplier on every page in the app. `target.host` names the
      // database's region (the aws-0-<region> segment); this names the function's.
      // If they differ, moving one of them is the largest single win available and
      // needs no code change.
      region: process.env.VERCEL_REGION ?? 'local',
      configured,
      target,
      database,
      problems,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
