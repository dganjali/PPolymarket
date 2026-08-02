import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { publicGroups } from '@/lib/data';
import { Directory } from '@/components/Discover';

export default async function DiscoverPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/discover');

  const groups = await publicGroups(user.id);

  return (
    <main className="auth" style={{ gap: 22, paddingTop: 48 }}>
      <div className="logo">M</div>
      <div>
        <div className="display" style={{ fontSize: 27 }}>
          Public communities.
        </div>
        <div className="lede" style={{ marginTop: 8 }}>
          Groups that opened themselves up. Everything else is invite-only — you need a code or a link
          for those.
        </div>
      </div>

      <Directory
        groups={groups.map((g) => ({
          id: g.id,
          slug: g.slug,
          name: g.name,
          description: g.description,
          members: g.members,
          liveMarkets: g.live_markets,
          startingBalance: g.starting_balance,
          prize: g.prize,
          season: g.current_season,
          screened: !!g.require_member_approval,
          joined: !!g.joined,
          requested: !!g.requested,
        }))}
      />

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href="/join" className="btn btn-ghost">
          Join with an invite code
        </Link>
        <Link
          href="/groups"
          style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-5)', padding: '4px 0' }}
        >
          Back to your groups
        </Link>
      </div>
    </main>
  );
}
