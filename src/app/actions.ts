'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, clearSession, createUser, currentUser, setSession } from '@/lib/auth';
import { groupBySlug } from '@/lib/data';
import { AppError, isUniqueViolation } from '@/lib/errors';
import { consumeMagicLink, requestMagicLink, TTL_MINUTES } from '@/lib/magic';
import { updateProfile } from '@/lib/users';
import {
  addMember,
  announce,
  approveMarket,
  buy,
  buyCategorical,
  createGroup,
  createInvite,
  createMarket,
  disputeResolution,
  finalizeResolution,
  joinGroup,
  joinPublicGroup,
  leaveGroup,
  markNotificationsRead,
  postComment,
  proposeResolution,
  rejectMarket,
  regenerateInviteCode,
  removeMember,
  reopenMarket,
  reviewMembershipRequest,
  revokeInvite,
  sell,
  sellCategorical,
  setGroupPrizes,
  setMemberRole,
  startNextSeason,
  transferOwnership,
  requireAdmin,
  updateGroup,
  updateMarket,
} from '@/lib/engine';
import type { Side } from '@/lib/amm';
import { applyPlan, provider } from '@/lib/billing';
import { ORDER, PLANS, type Cadence, type PlanId } from '@/lib/plans';

export interface FormState {
  error?: string;
  ok?: string;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0);
const safeNext = (value: string) => value.startsWith('/') && !value.startsWith('//') ? value : '/';

/**
 * Turns a thrown error into something the form can show.
 *
 * An unexpected failure used to escape and replace the whole page with Next's
 * "Application error" and a digest — a failed bet took the market screen down
 * with it, and the only way to find out why was the hosting provider's logs.
 * Now the page survives, the person gets told, and the real reason is logged
 * with a code they can quote.
 */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    if (isUniqueViolation(err)) return { error: 'That already exists.' };
    // redirect() and notFound() work by throwing; those have to pass through.
    if (typeof (err as { digest?: unknown })?.digest === 'string') throw err;

    const code = (err as { code?: unknown })?.code;
    console.error('[action] unexpected failure:', code ?? '', err);
    return {
      error:
        'Something went wrong on our side, so nothing was changed. Try again — and if it keeps ' +
        `happening, quote this: ${typeof code === 'string' ? code : 'no code'}.`,
    };
  }
}

async function me() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

// ─── auth ────────────────────────────────────────────────────────────────────

export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const next = safeNext(str(fd, 'next') || '/');
  const res = await guard(() =>
    createUser(str(fd, 'handle'), str(fd, 'name'), String(fd.get('password') ?? ''), str(fd, 'email')),
  );
  if ('error' in res) return res as FormState;

  const opened = await guard(() => setSession((res as { id: number }).id));
  if (opened && typeof opened === 'object' && 'error' in opened) return opened as FormState;
  redirect(next);
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await authenticate(str(fd, 'identifier'), String(fd.get('password') ?? ''));
  if (!user) return { error: 'Wrong email, handle, or password.' };

  // A deployment with no SESSION_SECRET cannot open a session at all; say that
  // on the form rather than failing the request with an opaque digest.
  const opened = await guard(() => setSession(user.id));
  if (opened && typeof opened === 'object' && 'error' in opened) return opened as FormState;
  redirect(safeNext(str(fd, 'next') || '/'));
}

export async function logoutAction() {
  await clearSession();
  redirect('/login');
}

/** Where this deployment lives, for links that have to survive leaving the browser. */
async function appOrigin(): Promise<string> {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) throw new AppError('Could not work out this site’s address.');
  return `${h.get('x-forwarded-proto') ?? 'http'}://${host}`;
}

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const avatar = str(fd, 'avatar');
  const res = await guard(() => updateProfile(user.id, { name: str(fd, 'name'), avatar: avatar || null }));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath('/', 'layout');
  return { ok: 'Profile saved.' };
}

export async function requestMagicLinkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, 'email');
  const next = safeNext(str(fd, 'next') || '/groups');

  const res = await guard(async () => requestMagicLink(email, next, await appOrigin()));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  const issued = res as { delivered: boolean; url?: string };
  if (!issued.delivered && issued.url) {
    // No RESEND_API_KEY, which is the normal state locally. The link goes to the
    // server console so development does not need a mail provider.
    console.log(`\n  Sign-in link for ${email}:\n  ${issued.url}\n`);
  }
  return {
    ok: issued.delivered
      ? `Check ${email} — the link works once and expires in ${TTL_MINUTES} minutes.`
      : `Email is not configured here, so the link was printed to the server console (expires in ${TTL_MINUTES} minutes).`,
  };
}

export async function magicSignInAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await guard(() => consumeMagicLink(str(fd, 'token')));
  if ('error' in res) return res as FormState;

  const { user, nextPath } = res as { user: { id: number }; nextPath: string };
  const opened = await guard(() => setSession(user.id));
  if (opened && typeof opened === 'object' && 'error' in opened) return opened as FormState;
  redirect(nextPath);
}

// ─── groups ──────────────────────────────────────────────────────────────────

export async function createGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const res = await guard(() =>
    createGroup(user.id, {
      name: str(fd, 'name'),
      startingBalance: num(fd, 'startingBalance') || 2500,
      marketLiquidity: num(fd, 'marketLiquidity') || 0,
      seasonEnds: str(fd, 'seasonEnds') || null,
      prize: str(fd, 'prize'),
      punishment: str(fd, 'punishment'),
      requireApproval: !!fd.get('requireApproval'),
      requireMemberApproval: !!fd.get('requireMemberApproval'),
      visibility: str(fd, 'visibility') === 'public' ? 'public' : 'private',
      description: str(fd, 'description'),
    }),
  );
  if ('error' in res) return res as FormState;
  redirect(`/g/${(res as { slug: string }).slug}`);
}

export async function joinPublicGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const res = await guard(() => joinPublicGroup(user.id, num(fd, 'groupId')));
  if ('error' in res) return res as FormState;
  if ((res as { join_status: string }).join_status === 'pending') {
    revalidatePath('/discover');
    return { ok: 'Request sent. An admin has to approve you before a bankroll is issued.' };
  }
  redirect(`/g/${(res as { slug: string }).slug}`);
}

export async function leaveGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const group = await groupBySlug(str(fd, 'slug'));
  if (!group) return { error: 'Group not found.' };
  const res = await guard(() => leaveGroup(user.id, group.id));
  if ('error' in res) return res as FormState;
  redirect('/groups');
}

export async function joinGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const res = await guard(() => joinGroup(user.id, str(fd, 'code')));
  if ('error' in res) return res as FormState;
  if ((res as { join_status: string }).join_status === 'pending') {
    return { ok: 'Request sent. An admin must approve you before a bankroll is issued.' };
  }
  redirect(`/g/${(res as { slug: string }).slug}`);
}

export async function updateStakesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const mode = str(fd, 'mode') === 'punishment' ? 'punishment' : 'prize';
  const res = await guard(() => updateGroup(user.id, group.id, { [mode]: str(fd, 'text') }));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: mode === 'prize' ? 'Prize posted to the group.' : 'Punishment posted to the group.' };
}

export async function updateSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const res = await guard(() =>
    updateGroup(user.id, group.id, {
      name: str(fd, 'name') || group.name,
      description: str(fd, 'description').slice(0, 280),
      visibility: str(fd, 'visibility') === 'public' ? 'public' : 'private',
      season_ends: str(fd, 'seasonEnds') || null,
      market_liquidity: Math.max(100, num(fd, 'marketLiquidity') || group.market_liquidity),
      dispute_window_hours: Math.max(1, Math.min(168, num(fd, 'disputeWindowHours') || group.dispute_window_hours)),
      positions_public: fd.get('positionsPublic') ? 1 : 0,
      require_approval: fd.get('requireApproval') ? 1 : 0,
      require_member_approval: fd.get('requireMemberApproval') ? 1 : 0,
    }),
  );
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  revalidatePath('/discover');
  return { ok: 'Settings saved.' };
}

/**
 * The one-switch version of "member markets need your approval".
 *
 * The same flag lives in the settings form further down the admin screen, but
 * the moment an admin wants it off is the moment they are staring at a queue of
 * markets waiting on them — so it is also a single button right there.
 */
export async function setMarketApprovalAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const on = str(fd, 'requireApproval') === '1';
  const res = await guard(() => updateGroup(user.id, group.id, { require_approval: on ? 1 : 0 }));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return {
    ok: on
      ? 'New member markets will wait for an admin.'
      : 'Members can open markets without waiting for an admin.',
  };
}

export async function updatePrizesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const labels = fd.getAll('prize').map((value) => String(value));
  const res = await guard(() => setGroupPrizes(user.id, group.id, labels));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  const saved = res as string[];
  return { ok: saved.length ? `${saved.length} place${saved.length === 1 ? '' : 's'} saved.` : 'Prizes cleared.' };
}

export async function announceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const res = await guard(() => announce(user.id, group.id, str(fd, 'body')));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Announcement sent to every member.' };
}

// ─── markets ─────────────────────────────────────────────────────────────────

export async function createMarketAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  // An explicit "closes by" date wins; otherwise fall back to the shortcut.
  const chosen = str(fd, 'closesOn');
  const days = Math.max(1, Math.min(365, num(fd, 'days') || 14));
  const deadline = chosen
    ? new Date(`${chosen}T23:59:59Z`)
    : new Date(Date.now() + days * 86_400_000);
  if (Number.isNaN(deadline.getTime())) return { error: 'That closing date is not a real date.' };
  if (deadline.getTime() < Date.now()) return { error: 'Pick a closing date in the future.' };
  const closesAt = deadline.toISOString().slice(0, 19).replace('T', ' ');

  const res = await guard(() =>
    createMarket(user.id, group, {
      question: str(fd, 'question'),
      category: str(fd, 'category') || 'Other',
      rules: str(fd, 'rules'),
      closesAt,
      openPrice: (num(fd, 'openPrice') || 50) / 100,
      funding: num(fd, 'funding') || 25,
      marketType: str(fd, 'marketType') === 'categorical' ? 'categorical' : 'binary',
      options: fd.getAll('option').map((value) => String(value)),
      excludedUserIds: fd.getAll('excludedUserId').map((value) => Number(value)),
    }),
  );
  if ('error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  const market = res as { id: number; status: string };
  if (market.status === 'open') redirect(`/g/${slug}/m/${market.id}`);
  redirect(`/g/${slug}?proposed=1`);
}

/** Corrects a market's wording, rules, category or deadline. See updateMarket. */
export async function editMarketAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const marketId = num(fd, 'marketId');

  const chosen = str(fd, 'closesOn');
  if (!chosen) return { error: 'Give the market a closing date.' };
  const deadline = new Date(`${chosen}T23:59:59Z`);
  if (Number.isNaN(deadline.getTime())) return { error: 'That closing date is not a real date.' };

  const res = await guard(() =>
    updateMarket(user.id, marketId, {
      question: str(fd, 'question'),
      category: str(fd, 'category') || 'Other',
      rules: str(fd, 'rules'),
      closesAt: deadline.toISOString().slice(0, 19).replace('T', ' '),
    }),
  );
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Saved. The change is in the group log.' };
}

export async function marketAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const marketId = num(fd, 'marketId');
  const op = str(fd, 'op');

  const res = await guard(() => {
    if (op.startsWith('propose:')) {
      return proposeResolution(user.id, marketId, op.slice('propose:'.length), str(fd, 'evidence'));
    }
    switch (op) {
      case 'approve':
        return approveMarket(user.id, marketId);
      case 'reject':
        return rejectMarket(user.id, marketId);
      case 'propose-yes':
        return proposeResolution(user.id, marketId, 'YES', str(fd, 'evidence'));
      case 'propose-no':
        return proposeResolution(user.id, marketId, 'NO', str(fd, 'evidence'));
      case 'finalize':
        return finalizeResolution(user.id, marketId);
      case 'reopen': {
        const closesAt = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
        return reopenMarket(user.id, marketId, closesAt);
      }
      default:
        return undefined;
    }
  });
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  const done: Record<string, string> = {
    approve: 'Market is live — the group can trade it.',
    reject: 'Rejected. The seed went back to the author.',
    'propose-yes': 'YES proposed. Members can review the evidence and dispute it.',
    'propose-no': 'NO proposed. Members can review the evidence and dispute it.',
    finalize: 'Result finalized. Payouts are in.',
    reopen: 'Reopened for another week.',
  };
  return { ok: op.startsWith('propose:') ? 'Result proposed. Members can review the evidence and dispute it.' : done[op] ?? 'Done.' };
}

export async function disputeResolutionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const marketId = num(fd, 'marketId');
  const res = await guard(() => disputeResolution(user.id, marketId, str(fd, 'reason')));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Dispute submitted. The admins have been notified.' };
}

// ─── trading ─────────────────────────────────────────────────────────────────

export async function tradeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const marketId = num(fd, 'marketId');
  const side = (str(fd, 'side') === 'NO' ? 'NO' : 'YES') as Side;
  const action = str(fd, 'action') === 'SELL' ? 'SELL' : 'BUY';
  const optionId = num(fd, 'optionId');

  const res = await guard(() =>
    optionId
      ? action === 'BUY'
        ? buyCategorical(user.id, marketId, optionId, num(fd, 'amount'))
        : sellCategorical(user.id, marketId, optionId, num(fd, 'shares'))
      : action === 'BUY'
        ? buy(user.id, marketId, side, num(fd, 'amount'))
        : sell(user.id, marketId, side, num(fd, 'shares')),
  );
  if ('error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  const fill = res as { shares: number; avgPrice: number; cash: number; side: string };
  const qty = Math.round(fill.shares).toLocaleString('en-US');
  const price = `${(fill.avgPrice * 100).toFixed(1)}¢`;
  return {
    ok:
      action === 'BUY'
        ? `Filled — bought ${qty} ${fill.side} @ ${price}.`
        : `Filled — sold ${qty} ${fill.side} @ ${price}.`,
  };
}

export async function membershipRequestAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const decision = str(fd, 'decision') === 'approve' ? 'approve' : 'reject';
  const res = await guard(() => reviewMembershipRequest(user.id, group.id, num(fd, 'userId'), decision));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: decision === 'approve' ? 'Member approved and bankroll issued.' : 'Join request declined.' };
}

export async function commentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const res = await guard(() => postComment(user.id, num(fd, 'marketId'), str(fd, 'body')));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${str(fd, 'slug')}/m/${num(fd, 'marketId')}`);
  return { ok: '' };
}

export async function kickMemberAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const target = num(fd, 'userId');
  const force = !!fd.get('force');

  const res = await guard(() => removeMember(user.id, group.id, target, { force }));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: force ? 'Member removed and their open positions forfeited.' : 'Member removed.' };
}

export async function addMemberAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const res = await guard(() => addMember(user.id, group.id, str(fd, 'identifier')));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: `${(res as { name: string }).name} was added to the group.` };
}

export async function transferOwnershipAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const res = await guard(() => transferOwnership(user.id, group.id, num(fd, 'userId')));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Ownership handed over.' };
}

export async function memberRoleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'member';
  const res = await guard(() => setMemberRole(user.id, group.id, num(fd, 'userId'), role));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: role === 'admin' ? 'Admin added.' : 'Admin access removed.' };
}

export async function regenerateInviteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const res = await guard(() => regenerateInviteCode(user.id, group.id));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Invite code rotated. Old links no longer work.' };
}

export async function createInviteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const expiresIn = num(fd, 'expiresInHours');
  const maxUses = num(fd, 'maxUses');
  const res = await guard(() =>
    createInvite(user.id, group.id, {
      label: str(fd, 'label'),
      code: str(fd, 'code'),
      expiresInHours: expiresIn > 0 ? expiresIn : null,
      maxUses: maxUses > 0 ? maxUses : null,
    }),
  );
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: `Link ${(res as { code: string }).code} is live.` };
}

export async function revokeInviteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const res = await guard(() => revokeInvite(user.id, group.id, num(fd, 'inviteId')));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;
  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Link revoked.' };
}

export async function markNotificationsReadAction() {
  const user = await me();
  await markNotificationsRead(user.id);
  revalidatePath('/notifications');
}

export async function startNextSeasonAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const res = await guard(() =>
    startNextSeason(user.id, group.id, {
      seasonEnds: str(fd, 'seasonEnds') || null,
      note: str(fd, 'note'),
      nextPrize: str(fd, 'nextPrize'),
      nextPunishment: str(fd, 'nextPunishment'),
    }),
  );
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  const close = res as { season: number; champion?: { name: string } };
  return {
    ok: close.champion
      ? `Season ${close.season} closed — ${close.champion.name} won. Season ${close.season + 1} is open.`
      : `Season ${close.season} closed. Season ${close.season + 1} is open.`,
  };
}

// ─── billing ─────────────────────────────────────────────────────────────────

/**
 * Starts a checkout for a group.
 *
 * With no payment provider configured this applies the plan immediately and
 * says so — see src/lib/billing.ts. With Stripe configured it returns a hosted
 * checkout URL and the plan only moves when the webhook confirms payment.
 */
export async function upgradeGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const plan = str(fd, 'plan') as PlanId;
  if (!ORDER.includes(plan) || plan === 'free') return { error: 'Pick a plan.' };
  const asked = str(fd, 'cadence');
  const cadence: Cadence = asked === 'monthly' || asked === 'season' ? asked : 'annual';

  const res = await guard(async () => {
    await requireAdmin(user.id, group.id);
    return provider.checkout({
      groupId: group.id,
      groupName: group.name,
      plan,
      cadence,
      actorId: user.id,
      email: user.email,
      returnPath: `/g/${slug}/billing`,
    });
  });
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  const checkout = res as { url: string; simulated: boolean };
  revalidatePath(`/g/${slug}`, 'layout');
  if (checkout.simulated) {
    return {
      ok: `${PLANS[plan].name} is on — no card was charged, because no payment provider is configured.`,
    };
  }
  redirect(checkout.url);
}

/** Drops a group back to Free. Nothing is deleted; see plans.ts. */
export async function downgradeGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = await groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const res = await guard(async () => {
    await requireAdmin(user.id, group.id);
    if (group.owner_id !== user.id) throw new AppError('Only the community owner can change the plan.');
    await applyPlan(group.id, 'free', { actorId: user.id, reason: 'downgraded by owner' });
  });
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return {
    ok: 'Back on Free. Nobody was removed and no market was closed — you just cannot add more until you are under the limits.',
  };
}
