import { redirect } from 'next/navigation';

/** Merged into /standings. Kept so older links and bookmarks still land somewhere. */
export default async function SeasonsRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/g/${slug}/standings`);
}
