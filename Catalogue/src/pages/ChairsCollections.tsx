import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import { CHAIR_COLLECTIONS, MOBILE_PDF, type ChairSlug } from "../catalogues";
import chairGreen from "../assets/figma/chair-green.png";
import chairDining from "../assets/figma/chair-dining.png";
import chairAccent from "../assets/figma/chair-accent.png";
import rocking from "../assets/figma/rocking.png";
import barStool from "../assets/figma/bar-stool.png";
import bedroomChair from "../assets/figma/bedroom-chair.png";

/**
 * Chairs collection page — Figma "Scene 29" (2511:420), opened from any
 * card on the landing. Same canvas recipe as Scene 27 but with the page
 * title, the watermark 40px lower, rows at 307/709 and every column anchor
 * 11px left of the landing's.
 *
 * Six chair sub-collections, each opening its own PDF catalogue: in the
 * in-app viewer (/catalogue-1/:slug) on desktop, natively on touch
 * devices. Titles/renders follow the client's revised mock: green chair =
 * Arm/Rocking, cream chair = Dining/Bar, houndstooth = Accent/Bedroom.
 */

const COLS = ["75px", "calc(33.33% + 54.42px)", "calc(66.67% + 15.47px)"];
const ROWS = ["307px", "709px"];

const IMGS: Record<string, string> = {
  chair: chairGreen,
  dining: chairDining,
  accent: chairAccent,
  rocking,
  bar: barStool,
  bedroom: bedroomChair,
};

/* Subtexts verbatim from the design (Scene 29). */
const SLOTS: { slug: ChairSlug; sub: string; furniture: Furniture }[] = [
  { slug: "arm", furniture: "chair", sub: "Comfort shaped with a confident silhouette." },
  { slug: "dining", furniture: "dining", sub: "Crafted to complement every table beautifully." },
  { slug: "accent", furniture: "accent", sub: "A bold finishing touch for refined spaces." },
  { slug: "rocking", furniture: "rocking", sub: "Gentle motion, timeless comfort, quiet luxury." },
  { slug: "bar", furniture: "bar", sub: "Made for counters, conversations, and stylish gatherings." },
  { slug: "bedroom", furniture: "bedroom", sub: "Perfect for reading, dressing, or simply unwinding." },
];

export default function ChairsCollections() {
  return (
    <div className="scene">
      <Backdrop />
      <Header />
      <Watermark top={441} />
      <h1 className="pageTitle">Chairs Collections</h1>
      <main className="cards">
        {SLOTS.map((s, i) => {
          const cat = CHAIR_COLLECTIONS[s.slug];
          return (
            <CollectionCard
              key={s.slug}
              title={cat.title}
              sub={s.sub}
              furniture={s.furniture}
              img={IMGS[s.furniture]}
              x={COLS[i % 3]}
              y={ROWS[Math.floor(i / 3)]}
              {...(MOBILE_PDF ? { href: cat.pdf } : { to: `/catalogue-1/${s.slug}` })}
            />
          );
        })}
      </main>
    </div>
  );
}
