import { redirect } from 'next/navigation';

/** Merged into /you. Kept so older links and bookmarks still land somewhere. */
export default async function PortfolioRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/g/${slug}/you`);
}
