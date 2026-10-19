import type { Metadata } from "next";
import PaperHeader from "@/components/layout/PaperHeader";
import { spacesFontVars } from "@/components/spaces/fonts";
import NimbusExperience from "@/components/spaces/nimbus/NimbusExperience";
import NimbusStage from "@/components/spaces/nimbus/NimbusStage";
import styles from "@/components/spaces/nimbus/nimbus.module.css";

const description =
  "Step inside Nimbus: a living room, a dining room and a bedroom above the clouds, furnished piece by piece as you scroll.";

export const metadata: Metadata = {
  title: "Nimbus",
  description,
  openGraph: {
    title: "Nimbus | Maple Furnishers",
    description,
    type: "website",
  },
};

/**
 * /spaces/nimbus — reached through "Click to Enter" on the Nimbus scene of
 * /spaces. Three rooms above the clouds, each furnished as you scroll and
 * joined by a flight through cloud. The header sits outside the page so
 * nothing becomes the containing block of its position: fixed.
 */
export default function NimbusPage() {
  return (
    <>
      <PaperHeader variant="spaces" />
      <NimbusExperience className={`${styles.page} ${spacesFontVars}`}>
        <NimbusStage />
      </NimbusExperience>
    </>
  );
}
