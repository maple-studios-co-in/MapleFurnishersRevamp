import type { Metadata } from "next";
import PaperHeader from "@/components/layout/PaperHeader";
import { spacesFontVars } from "@/components/spaces/fonts";
import RoomsExperience from "@/components/spaces/rooms/RoomsExperience";
import RoomsStage from "@/components/spaces/rooms/RoomsStage";
import styles from "@/components/spaces/rooms/rooms.module.css";

const description =
  "Step inside Terra: a hotel lobby, a bedroom and a garden terrace grounded in earth, furnished piece by piece as you scroll.";

export const metadata: Metadata = {
  title: "Terra",
  description,
  openGraph: {
    title: "Terra | Maple Furnishers",
    description,
    type: "website",
  },
};

/**
 * /spaces/terra — reached through "Click to Enter" on the Terra scene of
 * /spaces. A lobby, a bedroom and a terrace, each furnished as you scroll
 * and joined by a flight through warm, sunlit haze (the Nimbus engine in
 * Terra's palette: rooms/terra.ts).
 */
export default function TerraPage() {
  return (
    <>
      <PaperHeader variant="spaces" />
      <RoomsExperience world="terra" className={`${styles.page} ${spacesFontVars}`}>
        <RoomsStage world="terra" />
      </RoomsExperience>
    </>
  );
}
