import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { inspectMagicLink } from '@/lib/magic';
import { MagicConfirm } from '@/components/MagicLink';

/**
 * Where a sign-in link lands. Opening it does not spend it — mail scanners at
 * schools and workplaces follow every link in an inbound message, and would
 * burn the token before the person ever clicked. The button below is what
 * spends it, over POST.
 */
export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const link = await inspectMagicLink(token ?? '');

  const signedIn = await currentUser();
  if (!link && signedIn) redirect('/groups');

  return (
    <main className="auth" style={{ gap: 24 }}>
      <div className="logo">M</div>

      {link ? (
        <>
          <div>
            <div className="display">One tap and you&rsquo;re in.</div>
            <div className="lede" style={{ marginTop: 10 }}>
              This link was sent to <strong style={{ color: 'var(--ink-2)' }}>{link.email}</strong>. It
              works once.
            </div>
          </div>
          <MagicConfirm token={token ?? ''} email={link.email} />
        </>
      ) : (
        <>
          <div>
            <div className="display">That link is done.</div>
            <div className="lede" style={{ marginTop: 10 }}>
              Sign-in links expire quickly and only work once — this one has been used already, or it
              has run out. Getting a fresh one takes a moment.
            </div>
          </div>
          <Link href="/login" className="btn btn-primary">
            Send me a new link
          </Link>
        </>
      )}

      <Link
        href="/login"
        style={{ marginTop: 'auto', textAlign: 'center', fontSize: 13.5, color: 'var(--ink-5)', padding: '10px 0' }}
      >
        Back to sign in
      </Link>
    </main>
  );
}
