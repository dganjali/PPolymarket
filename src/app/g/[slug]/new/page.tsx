import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { CATEGORIES, standings } from '@/lib/data';
import { get } from '@/lib/db';
import { NewMarketForm } from '@/components/NewMarketForm';

export default async function NewMarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { group, ms, isAdmin, base } = await groupContext(slug);

  const owner = await get<{ handle: string }>('SELECT handle FROM users WHERE id = ?', group.owner_id);
  const needsApproval = !isAdmin && !!group.require_approval;
  const members = isAdmin ? await standings(group.id, group.starting_balance) : [];

  return (
    <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href={base}
          className="avatar"
          style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--card)', fontSize: 15 }}
        >
          ←
        </Link>
        <h1 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>New market</h1>
      </div>

      <NewMarketForm
        slug={slug}
        categories={CATEGORIES}
        balance={ms.balance}
        houseLiquidity={group.market_liquidity}
        needsApproval={needsApproval}
        adminHandle={owner?.handle ?? 'admin'}
        members={members.map((member) => ({
          userId: member.userId,
          name: member.name,
          handle: member.handle,
        }))}
      />
    </div>
  );
}
