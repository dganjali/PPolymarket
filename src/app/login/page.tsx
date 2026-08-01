import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { currentUser } from '@/lib/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await currentUser()) redirect('/');
  const { next } = await searchParams;

  return (
    <main className="auth" style={{ gap: 26 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="logo">M</div>
        <div>
          <div className="display">Welcome back.</div>
          <div className="lede" style={{ marginTop: 8 }}>
            Minimarket is play money. The only thing at stake is whatever your admin put up.
          </div>
        </div>
      </div>
      <AuthForm mode="login" next={next} />
    </main>
  );
}
