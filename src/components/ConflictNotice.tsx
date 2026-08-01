import type { MarketRestrictionRow } from '@/lib/data';

export function ConflictNotice({
  restrictions,
  isRestricted,
}: {
  restrictions: MarketRestrictionRow[];
  isRestricted: boolean;
}) {
  if (restrictions.length === 0) return null;

  return (
    <div className="panel" style={{ borderColor: 'var(--gold-line)', background: 'var(--gold-bg)' }}>
      <div className="eyebrow">Conflict restrictions</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-3)', marginTop: 7 }}>
        {restrictions.map((restriction) => `@${restriction.handle}`).join(', ')}{' '}
        {restrictions.length === 1 ? 'is' : 'are'} connected to the outcome and cannot trade this market.
      </div>
      {isRestricted && (
        <div className="mono" style={{ fontSize: 10.5, lineHeight: 1.5, color: 'var(--gold)', marginTop: 7 }}>
          This restriction applies to every outcome, including selling and buying.
        </div>
      )}
    </div>
  );
}
