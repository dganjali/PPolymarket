import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { myGroups } from '@/lib/data';
import { money0 } from '@/lib/format';
import { ProfileForm } from '@/components/ProfileForm';
import { Avatar } from '@/components/Avatar';

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/profile');
  const groups = await myGroups(user.id);

  return (
    <main className="account">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/groups" className="btn btn-ghost btn-sm">←</Link>
        <div className="display" style={{ fontSize: 25 }}>Profile</div>
      </div>

      <ProfileForm name={user.name} handle={user.handle} avatar={user.avatar} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="eyebrow">Your groups · {groups.length}</div>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/g/${g.slug}`}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12 }}
          >
            <Avatar name={g.name} size={32} radius={9} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{g.name}</div>
            <div className="mono" style={{ fontSize: 12 }}>{money0(g.balance)}</div>
          </Link>
        ))}
        {groups.length === 0 && <div className="empty">You are not in a group yet.</div>}
      </section>

      <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.6 }}>
        Your picture and name show up wherever you appear — standings, markets, activity — in every
        group you are in.
      </div>
    </main>
  );
}
