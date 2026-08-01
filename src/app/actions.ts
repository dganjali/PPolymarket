'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authenticate, clearSession, createUser, currentUser, setSession } from '@/lib/auth';
import { groupBySlug } from '@/lib/data';
import {
  AppError,
  approveMarket,
  buy,
  createGroup,
  createMarket,
  joinGroup,
  postComment,
  rejectMarket,
  removeMember,
  reopenMarket,
  resolveMarket,
  sell,
  updateGroup,
} from '@/lib/engine';
import type { Side } from '@/lib/amm';

export interface FormState {
  error?: string;
  ok?: string;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0);

/** Turns thrown AppErrors into form state; anything else is a real bug. */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | FormState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    if (err instanceof Error && /UNIQUE|constraint/i.test(err.message)) {
      return { error: 'That already exists.' };
    }
    throw err;
  }
}

async function me() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

// ─── auth ────────────────────────────────────────────────────────────────────

export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const handle = str(fd, 'handle');
  const name = str(fd, 'name');
  const password = String(fd.get('password') ?? '');
  const next = str(fd, 'next') || '/';

  let userId: number;
  try {
    userId = createUser(handle, name, password).id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create that account.' };
  }
  await setSession(userId);
  redirect(next);
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = authenticate(str(fd, 'handle'), String(fd.get('password') ?? ''));
  if (!user) return { error: 'Wrong handle or password.' };
  await setSession(user.id);
  redirect(str(fd, 'next') || '/');
}

export async function logoutAction() {
  await clearSession();
  redirect('/login');
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
    }),
  );
  if ('error' in res) return res as FormState;
  redirect(`/g/${(res as { slug: string }).slug}`);
}

export async function joinGroupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const res = await guard(() => joinGroup(user.id, str(fd, 'code')));
  if ('error' in res) return res as FormState;
  redirect(`/g/${(res as { slug: string }).slug}`);
}

export async function updateStakesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = groupBySlug(slug);
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
  const group = groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const res = await guard(() =>
    updateGroup(user.id, group.id, {
      season_ends: str(fd, 'seasonEnds') || null,
      market_liquidity: Math.max(100, num(fd, 'marketLiquidity') || group.market_liquidity),
      positions_public: fd.get('positionsPublic') ? 1 : 0,
      require_approval: fd.get('requireApproval') ? 1 : 0,
    }),
  );
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Settings saved.' };
}

// ─── markets ─────────────────────────────────────────────────────────────────

export async function createMarketAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const group = groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };

  const days = Math.max(1, Math.min(365, num(fd, 'days') || 14));
  const closesAt = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');

  const res = await guard(() =>
    createMarket(user.id, group, {
      question: str(fd, 'question'),
      category: str(fd, 'category') || 'Other',
      rules: str(fd, 'rules'),
      closesAt,
      openPrice: (num(fd, 'openPrice') || 50) / 100,
      funding: num(fd, 'funding') || 25,
    }),
  );
  if ('error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  const market = res as { id: number; status: string };
  if (market.status === 'open') redirect(`/g/${slug}/m/${market.id}`);
  redirect(`/g/${slug}?proposed=1`);
}

export async function marketAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const marketId = num(fd, 'marketId');
  const op = str(fd, 'op');

  const res = await guard(() => {
    switch (op) {
      case 'approve':
        return approveMarket(user.id, marketId);
      case 'reject':
        return rejectMarket(user.id, marketId);
      case 'resolve-yes':
        return resolveMarket(user.id, marketId, 'YES');
      case 'resolve-no':
        return resolveMarket(user.id, marketId, 'NO');
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
    'resolve-yes': 'Resolved YES. Payouts are in.',
    'resolve-no': 'Resolved NO. Payouts are in.',
    reopen: 'Reopened for another week.',
  };
  return { ok: done[op] ?? 'Done.' };
}

// ─── trading ─────────────────────────────────────────────────────────────────

export async function tradeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await me();
  const slug = str(fd, 'slug');
  const marketId = num(fd, 'marketId');
  const side = (str(fd, 'side') === 'NO' ? 'NO' : 'YES') as Side;
  const action = str(fd, 'action') === 'SELL' ? 'SELL' : 'BUY';

  const res = await guard(() =>
    action === 'BUY'
      ? buy(user.id, marketId, side, num(fd, 'amount'))
      : sell(user.id, marketId, side, num(fd, 'shares')),
  );
  if ('error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  const fill = res as { shares: number; avgPrice: number; cash: number };
  const qty = Math.round(fill.shares).toLocaleString('en-US');
  const price = `${(fill.avgPrice * 100).toFixed(1)}¢`;
  return {
    ok:
      action === 'BUY'
        ? `Filled — bought ${qty} ${side} @ ${price}.`
        : `Filled — sold ${qty} ${side} @ ${price}.`,
  };
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
  const group = groupBySlug(slug);
  if (!group) return { error: 'Group not found.' };
  const target = num(fd, 'userId');

  const res = await guard(() => removeMember(user.id, group.id, target));
  if (res && typeof res === 'object' && 'error' in res) return res as FormState;

  revalidatePath(`/g/${slug}`, 'layout');
  return { ok: 'Member removed.' };
}
