/**
 * The bridge between the pure plan definitions and the database.
 *
 * Every limit in the app is checked through `requireQuota` or `requireFeature`,
 * which throw an `AppError`. The server actions already funnel `AppError`
 * through `guard()` and render its message in the form's error slot, so a
 * paywall message reaches the person who hit it with no new plumbing at all.
 *
 * What is deliberately *not* here: any check on buying, selling, resolving,
 * disputing, commenting or leaving. Those work identically on every plan,
 * including a group sitting over its limits after a downgrade.
 */
import { all, get } from './db';
import { AppError } from './errors';
import {
  limitsFor,
  limitMessage,
  planOf,
  planThatAllows,
  planWith,
  PLANS,
  type FeatureKey,
  type MarketType,
  type PlanFields,
  type PlanId,
  type QuotaKey,
  type Usage,
} from './plans';

/** Statuses that count a market against the live-market ceiling. */
const LIVE_STATUSES = ['pending', 'open', 'closed', 'resolving'];

/**
 * Everything a group's limits are measured against, in one round trip.
 *
 * Correlated subqueries rather than four separate calls: this runs on the admin
 * screen and inside `createMarket`, and four round trips to Postgres on the hot
 * path of opening a market is three too many.
 */
export async function groupUsage(groupId: number, season: number): Promise<Usage> {
  const row = await get<{
    members: number;
    active_markets: number;
    admins: number;
    invites: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM memberships WHERE group_id = ?) AS members,
       (SELECT COUNT(*) FROM markets
         WHERE group_id = ? AND season_number = ? AND status IN (${LIVE_STATUSES.map(() => '?').join(',')})) AS active_markets,
       (SELECT COUNT(*) FROM memberships WHERE group_id = ? AND role = 'admin') AS admins,
       (SELECT COUNT(*) FROM group_invites
         WHERE group_id = ? AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > datetime('now'))
           AND (max_uses IS NULL OR uses < max_uses)) AS invites`,
    groupId,
    groupId,
    season,
    ...LIVE_STATUSES,
    groupId,
    groupId,
  );

  return {
    members: Number(row?.members ?? 0),
    activeMarkets: Number(row?.active_markets ?? 0),
    admins: Number(row?.admins ?? 0),
    invites: Number(row?.invites ?? 0),
  };
}

type GroupWithPlan = PlanFields & { id: number; current_season: number };

/** The single count behind one quota, for the cheap pre-flight checks. */
async function countFor(group: GroupWithPlan, key: QuotaKey): Promise<number> {
  switch (key) {
    case 'members':
      return single('SELECT COUNT(*) AS n FROM memberships WHERE group_id = ?', group.id);
    case 'admins':
      return single("SELECT COUNT(*) AS n FROM memberships WHERE group_id = ? AND role = 'admin'", group.id);
    case 'activeMarkets':
      return single(
        `SELECT COUNT(*) AS n FROM markets WHERE group_id = ? AND season_number = ?
           AND status IN (${LIVE_STATUSES.map(() => '?').join(',')})`,
        group.id,
        group.current_season,
        ...LIVE_STATUSES,
      );
    case 'invites':
      return single(
        `SELECT COUNT(*) AS n FROM group_invites
          WHERE group_id = ? AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > datetime('now'))
            AND (max_uses IS NULL OR uses < max_uses)`,
        group.id,
      );
    default:
      return 0;
  }
}

async function single(sql: string, ...params: unknown[]): Promise<number> {
  const row = await get<{ n: number }>(sql, ...params);
  return Number(row?.n ?? 0);
}

/**
 * Throws unless the group has room for `addition` more of something.
 *
 * The check is "would this take us over", not "are we over" — a group already
 * in overage after a downgrade is not punished further, it simply cannot grow.
 */
export async function requireQuota(group: GroupWithPlan, key: QuotaKey, addition = 1): Promise<void> {
  const limit = limitsFor(group)[key];
  if (limit === Number.POSITIVE_INFINITY) return;
  const used = await countFor(group, key);
  if (used + addition <= limit) return;
  throw new AppError(limitMessage(key, limit, planThatAllows(key, used + addition)));
}

/** Throws unless the plan includes a feature. */
export function requireFeature(group: PlanFields, feature: FeatureKey): void {
  if (limitsFor(group)[feature]) return;
  const next = planWith(feature);
  throw new AppError(
    `That is a ${next ? PLANS[next].name : 'paid'} feature. Upgrade the group to turn it on.`,
  );
}

/** Throws unless the plan includes a market type. */
export function requireMarketType(group: PlanFields, type: MarketType): void {
  if (limitsFor(group).marketTypes.includes(type)) return;
  const next = planWith(type);
  throw new AppError(
    `${type === 'scalar' ? 'Numeric and range markets are' : 'That market type is'} a ${
      next ? PLANS[next].name : 'paid'
    } feature.`,
  );
}

/** The outcome ceiling, for the create-market form to slice against. */
export const outcomeLimit = (group: PlanFields): number => limitsFor(group).outcomes;

export interface PlanChange {
  id: number;
  from_plan: string;
  to_plan: string;
  reason: string;
  created_at: string;
}

export async function planHistory(groupId: number, limit = 10): Promise<PlanChange[]> {
  return all<PlanChange>(
    'SELECT id, from_plan, to_plan, reason, created_at FROM plan_changes WHERE group_id = ? ORDER BY id DESC LIMIT ?',
    groupId,
    limit,
  );
}

export { planOf, limitsFor };
export type { PlanId };
