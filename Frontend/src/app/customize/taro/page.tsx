import type { Metadata } from "next";
import TaroExperience from "@/components/experience/TaroExperience";

export const metadata: Metadata = {
  title: "Explore Taro",
  description: "Explore a Taro armchair prototype in Maple's original customizer and save your material choices.",
  robots: { index: false, follow: false },
};

export default function TaroPage() {
  return <TaroExperience />;
}
