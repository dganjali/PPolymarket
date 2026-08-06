import Link from 'next/link';
import { groupContext } from '@/lib/context';
import { CATEGORIES } from '@/lib/data';
import { all, get } from '@/lib/db';
import { NewMarketForm } from '@/components/NewMarketForm';

export default async function NewMarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { group, ms, isAdmin, base } = await groupContext(slug);

  // The form only needs each member's name and handle, for the "who is connected to
  // this outcome" picker. It used to call standings(), which marks every position
  // held by every member to market — five round trips and the group's whole
  // portfolio, to fill a dropdown.
  const [owner, members] = await Promise.all([
    get<{ handle: string }>('SELECT handle FROM users WHERE id = ?', group.owner_id),
    isAdmin
      ? all<{ userId: number; name: string; handle: string }>(
          `SELECT ms.user_id AS "userId", u.name, u.handle
             FROM memberships ms JOIN users u ON u.id = ms.user_id
            WHERE ms.group_id = ? ORDER BY u.name, u.handle`,
          group.id,
        )
      : Promise.resolve([]),
  ]);
  const needsApproval = !isAdmin && !!group.require_approval;

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
        members={members}
      />
    </div>
  );
}
