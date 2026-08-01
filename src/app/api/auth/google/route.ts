import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_AGE = 10 * 60;

const safeNext = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/login?error=google_not_configured', request.url));
  }

  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const origin = (process.env.APP_ORIGIN || request.nextUrl.origin).replace(/\/$/, '');
  const redirectUri = `${origin}/api/auth/google/callback`;
  const secure = process.env.NODE_ENV === 'production';
  const jar = await cookies();
  const options = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: COOKIE_AGE };
  jar.set('mm_google_state', state, options);
  jar.set('mm_google_verifier', verifier, options);
  jar.set('mm_google_next', safeNext(request.nextUrl.searchParams.get('next')), options);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return NextResponse.redirect(url);
}
