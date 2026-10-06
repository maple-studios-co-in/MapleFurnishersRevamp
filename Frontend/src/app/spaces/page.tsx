import type { Metadata } from "next";
import PaperHeader from "@/components/layout/PaperHeader";
import SpacesExperience from "@/components/spaces/SpacesExperience";
import SpacesStage from "@/components/spaces/SpacesStage";
import { spacesFontVars } from "@/components/spaces/fonts";
import styles from "@/components/spaces/spaces.module.css";

const description =
  "Don’t choose furniture, choose a world. Nimbus, a world shaped by clouds, and Terra, a world shaped by earth: two Maple Furnishers collections.";

export const metadata: Metadata = {
  title: "Spaces",
  description,
  openGraph: {
    title: "Spaces | Maple Furnishers",
    description,
    type: "website",
  },
};

/**
 * /spaces — Figma frames "1"–"4" (nodes 2550:347, 2550:457, 2550:684,
 * 2583:186).
 *
 * Desktop plays them as one film on a fixed stage with no page scroll:
 * the landing, the white box drawn in, the box swelling and bursting into
 * Nimbus, then Terra sliding in from the left. Phones and reduced motion
 * get the same content as ordinary sections. The header sits outside the
 * page so nothing becomes the containing block of its position: fixed.
 */
export default function SpacesPage() {
  return (
    <>
      <PaperHeader variant="spaces" />
      <SpacesExperience className={`${styles.page} ${spacesFontVars}`}>
        <SpacesStage />
      </SpacesExperience>
    </>
  );
}
