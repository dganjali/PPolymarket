import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { currentUser, SESSION_MISCONFIGURED, sessionsConfigured } from '@/lib/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (await currentUser()) redirect('/groups');
  const { next, error } = await searchParams;
  const externalError = error === 'google_failed'
    ? 'Google sign-in could not be completed. Please try again.'
    : error === 'google_not_configured'
      ? 'Google sign-in has not been configured on this installation.'
      : undefined;

  return (
    <main className="auth" style={{ gap: 26 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="logo">M</div>
        <div>
          <div className="display">Welcome back.</div>
          <div className="lede" style={{ marginTop: 8 }}>
            Play money. The only thing really at stake is whatever your admin put up.
          </div>
        </div>
      </div>
      <AuthForm
        mode="login"
        next={next}
        googleEnabled={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        externalError={externalError}
        configError={sessionsConfigured() ? undefined : SESSION_MISCONFIGURED}
      />
    </main>
  );
}
