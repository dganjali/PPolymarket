import { notFound, redirect } from 'next/navigation';
import { currentUser, type User } from './auth';
import { groupBySlug, membership, type GroupRow, type MembershipRow } from './data';

export interface GroupContext {
  user: User;
  group: GroupRow;
  ms: MembershipRow;
  isAdmin: boolean;
  base: string;
}

/**
 * Resolves the signed-in user and their membership for a group route.
 * Layouts and pages render in parallel, so every page re-checks rather than
 * trusting the layout to have redirected first.
 */
export async function groupContext(slug: string): Promise<GroupContext> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/g/${slug}`)}`);

  const group = groupBySlug(slug);
  if (!group) notFound();

  const ms = membership(user.id, group.id);
  if (!ms) redirect('/join');

  return { user, group, ms, isAdmin: ms.role === 'admin', base: `/g/${slug}` };
}
