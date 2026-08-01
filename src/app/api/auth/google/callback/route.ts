import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/auth';
import { upsertGoogleUser } from '@/lib/users';

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export async function GET(request: NextRequest) {
  const origin = (process.env.APP_ORIGIN || request.nextUrl.origin).replace(/\/$/, '');
  const fail = () => NextResponse.redirect(new URL('/login?error=google_failed', origin));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const jar = await cookies();
  const expectedState = jar.get('mm_google_state')?.value;
  const verifier = jar.get('mm_google_verifier')?.value;
  const next = jar.get('mm_google_next')?.value || '/';
  jar.delete('mm_google_state');
  jar.delete('mm_google_verifier');
  jar.delete('mm_google_next');

  if (!clientId || !clientSecret || !code || !state || state !== expectedState || !verifier) {
    return fail();
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    });
    if (!tokenResponse.ok) return fail();
    const tokens = await tokenResponse.json() as { access_token?: string };
    if (!tokens.access_token) return fail();

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    });
    if (!profileResponse.ok) return fail();
    const profile = await profileResponse.json() as GoogleUserInfo;
    const user = await upsertGoogleUser({
      sub: profile.sub || '',
      email: profile.email || '',
      emailVerified: profile.email_verified === true,
      name: profile.name || '',
    });
    await setSession(user.id);
    const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    return NextResponse.redirect(new URL(destination, origin));
  } catch {
    return fail();
  }
}
