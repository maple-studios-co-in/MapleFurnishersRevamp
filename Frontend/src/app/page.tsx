import ChairShowcase from "@/components/sections/ChairShowcase";
import HeroFilm from "@/components/sections/HeroFilm";
import OutroScene from "@/components/sections/OutroScene";
import { fetchSceneProducts } from "@/lib/api";

/**
 * Chapter order matches lib/sections.ts, which drives the header theme and
 * the left rail. "furnish", "promise" and "contact" are markers inside the
 * two scrub sections — those beats are part of the films, not DOM sections.
 * The page ends on the outro's brand card; there is no static closing page.
 *
 * Async server component so the outro's shoppable hotspots are fetched
 * BEFORE first paint. OutroScene matches cached DOM nodes to hotspots by
 * index, so the list has to be settled by the time it mounts — fetching in
 * the client after mount would change the dot count underneath those caches.
 */
export default async function Home() {
  // null when the API is unreachable; OutroScene then falls back to its
  // built-in scene data, so the film never loses its hotspots.
  const sceneProducts = await fetchSceneProducts();

  return (
    <main>
      <HeroFilm />      {/* 01 intro + 02 furnish (in-scrub marker) */}
      <ChairShowcase /> {/* 03 craft   */}
      {/* 04 spaces + 05 promise + 06 contact (in-scrub) */}
      <OutroScene sceneProducts={sceneProducts} />
    </main>
  );
}
