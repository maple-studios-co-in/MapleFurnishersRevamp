import type { Metadata } from "next";
import CustomizerHero from "@/components/sections/CustomizerHero";

export const metadata: Metadata = {
  title: "Make It Yours",
  description:
    "Configure the Axtra Lounge Chair — finishes, fabrics and details, made to order exclusively for you.",
};

/**
 * /customize — the step-06 product customizer. The fixed site header comes
 * from the root layout; the home page's chapter/social rails hide
 * themselves off the home route so this page's own 01–07 stepper stands
 * alone.
 */
export default function CustomizePage() {
  return (
    <main>
      <CustomizerHero />
    </main>
  );
}
