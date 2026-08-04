import { SkeletonGrid } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="wrap stack">
      <div className="surface" style={{ height: 78 }} />
      <SkeletonGrid />
    </div>
  );
}
