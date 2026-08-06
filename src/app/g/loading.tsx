import { SkeletonGrid } from '@/components/Skeleton';

/**
 * The boundary that lets the document start streaming.
 *
 * `g/[slug]/loading.tsx` sits in the same segment as the group layout, so Next
 * wraps only that segment's *children* — the fallback lives inside the layout's own
 * output and cannot be flushed until the layout has finished awaiting everything it
 * needs. This file sits one segment above, so the browser gets markup while the
 * group's shell is still resolving.
 */
export default function LoadingGroup() {
  return (
    <div className="wrap stack" style={{ maxWidth: 1100, paddingTop: 'var(--s-4)' }}>
      <SkeletonGrid />
    </div>
  );
}
