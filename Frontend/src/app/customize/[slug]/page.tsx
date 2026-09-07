import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import TaroExperience from '@/components/experience/TaroExperience';
import { loadManifest } from '@/lib/three-d/load-manifest';

export const metadata: Metadata = {
  title: 'Explore your furniture',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function FurniturePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const result = await loadManifest(slug, preview);
  if (result.status === 'missing') notFound();
  if (result.status === 'unavailable') return <main className="flex min-h-screen items-center justify-center bg-[#17130f] px-6 text-white">
    <div className="max-w-md text-center"><h1 className="text-2xl">The 3D view is temporarily unavailable</h1><p className="mt-4">Please try again shortly.</p><Link className="mt-6 inline-block underline" href="/customize">Back to the customizer</Link></div>
  </main>;
  return <TaroExperience manifest={result.manifest} preview={!!preview} />;
}
