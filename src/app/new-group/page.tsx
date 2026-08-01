import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { NewGroupForm } from '@/components/NewGroupForm';

export default async function NewGroupPage() {
  if (!(await currentUser())) redirect('/login?next=/new-group');

  return (
    <main className="auth" style={{ gap: 22 }}>
      <div className="logo">M</div>
      <div>
        <div className="display">Start a group.</div>
        <div className="lede" style={{ marginTop: 10 }}>
          You&rsquo;ll be the admin: you approve markets, you resolve them, and you set what the
          season is actually for.
        </div>
      </div>

      <NewGroupForm />

      <Link
        href="/groups"
        style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-5)', padding: '10px 0' }}
      >
        Back to your groups
      </Link>
    </main>
  );
}
