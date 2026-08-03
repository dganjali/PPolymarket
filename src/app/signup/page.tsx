import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { AuthAside } from '@/components/AuthAside';
import { currentUser, SESSION_MISCONFIGURED, sessionsConfigured } from '@/lib/auth';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (await currentUser()) redirect('/groups');
  const { next, error } = await searchParams;

  return (
    <main className="auth-shell">
      <div className="auth">
      <div className="auth-head">
        <div className="logo">M</div>
        <div>
          <div className="display">
            Private prediction
            <br />
            markets.
          </div>
          <div className="lede auth-lede">
            Invite-only groups, fake bankrolls, real odds. Pick a handle your group will recognise.
          </div>
        </div>
      </div>
      <AuthForm
        mode="signup"
        next={next}
        googleEnabled={!!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        externalError={error === 'google_failed' ? 'Google sign-in could not be completed. Please try again.' : undefined}
        configError={sessionsConfigured() ? undefined : SESSION_MISCONFIGURED}
      />
      </div>
      <AuthAside />
    </main>
  );
}
