import type { Metadata } from "next";
import TaroExperience from "@/components/experience/TaroExperience";
import { loadManifest } from "@/lib/three-d/load-manifest";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Explore Taro",
  description: "Explore a Taro armchair prototype in Maple's original customizer and save your material choices.",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function TaroPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const result = await loadManifest('taro', preview);
  // A broken/expired private preview must never masquerade as the live pilot.
  if (preview && result.status !== 'ready') notFound();
  return <TaroExperience manifest={result.status === 'ready' ? result.manifest : undefined} preview={!!preview} />;
}
