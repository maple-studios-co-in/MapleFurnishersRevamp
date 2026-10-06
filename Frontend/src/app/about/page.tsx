import type { Metadata } from "next";
import PaperHeader from "@/components/layout/PaperHeader";
import AboutExperience from "@/components/about/AboutExperience";
import AboutHero from "@/components/about/AboutHero";
import BlueprintFooter from "@/components/about/BlueprintFooter";
import LetterFromMaple from "@/components/about/LetterFromMaple";
import ProjectFolder from "@/components/about/ProjectFolder";
import Questions from "@/components/about/Questions";
import StoryRow from "@/components/about/StoryRow";
import FilmStage from "@/components/about/film/FilmStage";
import { STORY_ROWS } from "@/components/about/content";
import { aboutFontVars } from "@/components/about/fonts";
import styles from "@/components/about/about.module.css";

const description =
  "A home, drawn around you. Furniture with intention, spaces with soul: how Maple Furnishers shapes furniture and rooms around the way you live.";

export const metadata: Metadata = {
  title: "About",
  description,
  openGraph: {
    title: "About | Maple Furnishers",
    description,
    type: "website",
  },
};

/**
 * /about — Figma "Desktop · 1440" (node 2664:172).
 *
 * Desktop runs it as one fixed, scroll-driven film (FilmStage); the letter,
 * folder, questions and footer become sheets that slide up over it. Phones
 * and reduced motion get the same content as stacked sections. CSS picks
 * which markup shows from the first paint; AboutExperience directs motion.
 *
 * The header and the intro sheet sit outside .page so nothing can become
 * the containing block of their position: fixed.
 */
export default function AboutPage() {
  return (
    <>
      <PaperHeader />
      <AboutExperience className={`${styles.page} ${aboutFontVars}`} fontVars={aboutFontVars}>
        <FilmStage />
        <main>
          <div className={styles.stackedOnly}>
            <AboutHero />
            {STORY_ROWS.map((row) => (
              <StoryRow key={row.id} row={row} />
            ))}
          </div>
          <LetterFromMaple />
          <ProjectFolder />
          <Questions />
        </main>
        <BlueprintFooter />
      </AboutExperience>
    </>
  );
}
