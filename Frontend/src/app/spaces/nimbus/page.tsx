import type { Metadata } from "next";
import PaperHeader from "@/components/layout/PaperHeader";
import { spacesFontVars } from "@/components/spaces/fonts";
import RoomsExperience from "@/components/spaces/rooms/RoomsExperience";
import RoomsStage from "@/components/spaces/rooms/RoomsStage";
import styles from "@/components/spaces/rooms/rooms.module.css";

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
      <RoomsExperience world="nimbus" className={`${styles.page} ${spacesFontVars}`}>
        <RoomsStage world="nimbus" />
      </RoomsExperience>
    </>
  );
}
