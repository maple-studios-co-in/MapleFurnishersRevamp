import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import { BED_COLLECTIONS, MOBILE_PDF, type BedSlug } from "../catalogues";
import fabricBed from "../assets/figma/fabric-bed.png";
import solidwoodBed from "../assets/figma/solidwood-bed.png";
import kidsBed from "../assets/figma/kids-bed.png";

/**
 * Beds collections page — Figma "Scene 30" (2525:110), opened from the
 * Beds card on the landing. Same recipe as the other collection pages but
 * a shorter 824px canvas with a single row of three cards.
 *
 * Each card opens its bed catalogue PDF — in the in-app viewer on desktop
 * (/catalogue-3/:slug), natively on touch devices.
 */

const COLS = ["75px", "calc(33.33% + 54.42px)", "calc(66.67% + 15.47px)"];

const SLOTS: { slug: BedSlug; sub: string; furniture: Furniture; img: string }[] = [
  { slug: "fabric", furniture: "fabric", img: fabricBed, sub: "Softly upholstered for comfort you can sink into." },
  { slug: "solidwood", furniture: "solidwood", img: solidwoodBed, sub: "Crafted from enduring wood with timeless character." },
  { slug: "kids", furniture: "kids", img: kidsBed, sub: "Playful designs made for growing imaginations." },
];

export default function BedsCollections() {
  return (
    <div className="scene scene--short">
      <Backdrop />
      <Header />
      <Watermark top={441} />
      <h1 className="pageTitle">Beds Collections</h1>
      <main className="cards">
        {SLOTS.map((s, i) => {
          const cat = BED_COLLECTIONS[s.slug];
          return (
            <CollectionCard
              key={s.slug}
              title={cat.title}
              sub={s.sub}
              furniture={s.furniture}
              img={s.img}
              x={COLS[i]}
              y="307px"
              {...(MOBILE_PDF ? { href: cat.pdf } : { to: `/catalogue-3/${s.slug}` })}
            />
          );
        })}
      </main>
    </div>
  );
}
