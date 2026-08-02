import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { groupContext } from '@/lib/context';
import {
  groupInvites,
  inviteState,
  marketDisputes,
  marketOptions,
  marketsByGroup,
  membershipRequests,
  standings,
} from '@/lib/data';
import { dateLabel, money0, relative, volLabel } from '@/lib/format';
import { AdminMarketControls } from '@/components/AdminControls';
import {
  AnnouncementForm,
  InviteManager,
  MemberList,
  MembershipRequests,
  SeasonControls,
  SettingsForm,
  StakesEditor,
} from '@/components/AdminPanels';

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, group, isAdmin, base } = await groupContext(slug);
  if (!isAdmin) redirect(base);

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const origin = host ? `${proto}://${host}` : undefined;

  const [pending, resolvable, members, joinRequests, invites] = await Promise.all([
    marketsByGroup(group.id, ['pending']),
    marketsByGroup(group.id, ['resolving', 'closed', 'open']),
    standings(group.id, group.starting_balance),
    membershipRequests(group.id),
    groupInvites(group.id),
  ]);
  const resolvableRows = await Promise.all(resolvable.map(async (market) => {
    const disputes = market.status === 'resolving' ? (await marketDisputes(market.id)).length : 0;
    const reviewOpen =
      !!market.dispute_ends_at &&
      new Date(`${market.dispute_ends_at.replace(' ', 'T')}Z`).getTime() > Date.now();
    const options = market.market_type === 'categorical' ? await marketOptions(market.id) : [];
    return { market, disputes, canFinalize: disputes > 0 || !reviewOpen, options };
  }));

  return (
    <div className="wrap narrow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Admin</h1>
        <span
          className="mono"
          style={{
            padding: '3px 7px',
            borderRadius: 5,
            background: 'var(--gold-bg)',
            border: '1px solid var(--gold-line)',
            fontSize: 9.5,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
          }}
        >
          You run this group
        </span>
      </div>

      <StakesEditor slug={slug} prize={group.prize} punishment={group.punishment} />

      <MembershipRequests slug={slug} requests={joinRequests} />

      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow">Pending markets</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gold)' }}>
            {pending.length} waiting
          </div>
        </div>
        {pending.map((m) => (
          <div
            key={m.id}
            style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingBottom: 11, borderBottom: '1px solid #262320' }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{m.question}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
              proposed by @{m.creator_handle} · opens at {Math.round(m.open_price * 100)}% ·{' '}
              {money0(m.subsidy)} seed · closes {dateLabel(m.closes_at)}
            </div>
            {m.rules && (
              <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-4)' }}>{m.rules}</div>
            )}
            <AdminMarketControls slug={slug} marketId={m.id} status="pending" compact />
          </div>
        ))}
        {pending.length === 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim-2)' }}>
            Nothing in the queue.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="eyebrow">Resolve markets</div>
        {resolvableRows.map(({ market: m, disputes, canFinalize, options }) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Link href={`${base}/m/${m.id}`} style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>
              {m.question}
            </Link>
            <div className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
              {volLabel(m.volume)} · {money0(m.collateral)} at stake ·{' '}
              {m.status === 'closed' ? 'closed' : `closes ${relative(m.closes_at)}`}
            </div>
            <AdminMarketControls
              slug={slug}
              marketId={m.id}
              status={m.status}
              proposedOutcome={m.proposed_outcome}
              disputeCount={disputes}
              canFinalize={canFinalize}
              resolutionOutcomes={
                m.market_type === 'categorical'
                    ? options.map((option) => ({ value: String(option.id), label: option.label }))
                  : undefined
              }
              compact
            />
          </div>
        ))}
        {resolvable.length === 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim-2)' }}>
            No live markets.
          </div>
        )}
        <div className="mono" style={{ fontSize: 10, color: 'var(--dim-2)', lineHeight: 1.5 }}>
          Proposing a result stops trading and opens the member review window. Undisputed results
          finalize automatically; disputed results return here for an admin decision.
        </div>
      </div>

      <InviteManager
        slug={slug}
        code={group.invite_code}
        origin={origin}
        invites={invites.map((invite) => ({
          id: invite.id,
          code: invite.code,
          label: invite.label,
          state: inviteState(invite),
          expiresAt: invite.expires_at,
          maxUses: invite.max_uses,
          uses: invite.uses,
          createdBy: invite.created_by_name,
        }))}
      />

      <AnnouncementForm slug={slug} />

      <SettingsForm
        slug={slug}
        name={group.name}
        description={group.description}
        visibility={group.visibility}
        seasonEnds={group.season_ends}
        marketLiquidity={group.market_liquidity}
        disputeWindowHours={group.dispute_window_hours}
        positionsPublic={!!group.positions_public}
        requireApproval={!!group.require_approval}
        requireMemberApproval={!!group.require_member_approval}
      />

      {user.id === group.owner_id && (
        <SeasonControls
          slug={slug}
          currentSeason={group.current_season}
          unfinishedMarkets={pending.length + resolvable.length}
          prize={group.prize}
          punishment={group.punishment}
          champion={members[0] && { name: members[0].name, total: members[0].total }}
          lastPlace={
            members.length > 1
              ? { name: members[members.length - 1].name, total: members[members.length - 1].total }
              : undefined
          }
        />
      )}

      <MemberList
        slug={slug}
        ownerId={group.owner_id}
        canManageRoles={user.id === group.owner_id}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          handle: m.handle,
          role: m.role,
          total: m.total,
          openPositions: m.openPositions,
        }))}
      />
    </div>
  );
}
