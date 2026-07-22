import ChairShowcase from "@/components/sections/ChairShowcase";
import HeroFilm from "@/components/sections/HeroFilm";
import OutroScene from "@/components/sections/OutroScene";

/**
 * Chapter order matches lib/sections.ts, which drives the header theme and
 * the left rail. "furnish", "promise" and "contact" are markers inside the
 * two scrub sections — those beats are part of the films, not DOM sections.
 * The page ends on the outro's brand card; there is no static closing page.
 */
export default function Home() {
  return (
    <main>
      <HeroFilm />      {/* 01 intro + 02 furnish (in-scrub marker) */}
      <ChairShowcase /> {/* 03 craft   */}
      <OutroScene />    {/* 04 spaces + 05 promise + 06 contact (in-scrub) */}
    </main>
  );
}
