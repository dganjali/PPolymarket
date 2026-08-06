import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { currentUser, type User } from './auth';
import { get } from './db';
import { type GroupRow, type MembershipRow } from './data';

/** The group plus the caller's own membership, as one row. */
type GroupAccess = GroupRow & {
  ms_role: MembershipRow['role'] | null;
  ms_balance: number | null;
};

/**
 * The group behind a slug, and whether this user is in it.
 *
 * One query, memoized per request. The layout and the page render *concurrently*
 * and each has to resolve the same two things, so this used to be four round trips
 * per navigation — `groupBySlug` then `membership`, twice over — on a critical path
 * where every round trip is network latency to the database.
 *
 * Deliberately here and not in data.ts: `groupBySlug` and `membership` are also the
 * guards behind trades and payouts (`requireMember`, the balance checks in
 * engine.ts), and those must keep reading live rows. This is the render path only,
 * where one row for the whole request is exactly what is wanted.
 *
 * A LEFT JOIN rather than two queries because a missing membership is a normal
 * answer, not an error — `role` is NOT NULL, so `ms_role === null` unambiguously
 * means "not a member".
 */
const groupAccess = cache(async (slug: string, userId: number) =>
  get<GroupAccess>(
    `SELECT g.*, ms.role AS ms_role, ms.balance AS ms_balance
       FROM groups g
       LEFT JOIN memberships ms ON ms.group_id = g.id AND ms.user_id = ?
      WHERE g.slug = ?`,
    userId,
    slug,
  ),
);

export interface GroupContext {
  user: User;
  group: GroupRow;
  /** Only what the render path reads. `engine.ts` fetches its own full row. */
  ms: Pick<MembershipRow, 'role' | 'balance'>;
  isAdmin: boolean;
  base: string;
}

/**
 * Resolves the signed-in user and their membership for a group route.
 * Layouts and pages render in parallel, so every page re-checks rather than
 * trusting the layout to have redirected first. The check is free after the first
 * caller — the redirect is not, and skipping it would serve a group's markets to
 * somebody who was removed from it.
 */
export async function groupContext(slug: string): Promise<GroupContext> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/g/${slug}`)}`);

  const row = await groupAccess(slug, user.id);
  if (!row) notFound();
  if (row.ms_role === null) redirect('/join');

  return {
    user,
    group: row,
    ms: { role: row.ms_role, balance: row.ms_balance ?? 0 },
    isAdmin: row.ms_role === 'admin',
    base: `/g/${slug}`,
  };
}
