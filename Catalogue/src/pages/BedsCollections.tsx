import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import { BED_COLLECTIONS, MOBILE_PDF, type BedSlug } from "../catalogues";
import fabricBed from "../assets/figma/fabric-bed.png";
import solidwoodBed from "../assets/figma/solidwood-bed.png";
import kidsBed from "../assets/figma/kids-bed.png";
import allBeds from "../assets/figma/all-beds.png";

/**
 * Beds collections page — Figma "Scene 30" (2525:110), opened from the
 * Beds card on the landing. Same recipe as the other collection pages;
 * the All Beds lead card (merged catalogue) pushed it to two rows.
 *
 * Each card opens its bed catalogue PDF — in the in-app viewer on desktop
 * (/catalogue-3/:slug), natively on touch devices.
 */

const COLS = ["75px", "calc(33.33% + 54.42px)", "calc(66.67% + 15.47px)"];
const ROWS = ["307px", "709px"];

const SLOTS: { slug: BedSlug; sub: string; furniture: Furniture; img: string }[] = [
  { slug: "all-beds", furniture: "allBeds", img: allBeds, sub: "Explore every silhouette, size, and expression." },
  { slug: "fabric-beds", furniture: "fabric", img: fabricBed, sub: "Softly upholstered for comfort you can sink into." },
  { slug: "solidwood-beds", furniture: "solidwood", img: solidwoodBed, sub: "Crafted from enduring wood with timeless character." },
  { slug: "kids-bed", furniture: "kids", img: kidsBed, sub: "Playful designs made for growing imaginations." },
];

export default function BedsCollections() {
  return (
    <div className="scene">
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
              x={COLS[i % 3]}
              y={ROWS[Math.floor(i / 3)]}
              {...(MOBILE_PDF ? { href: cat.pdf } : { to: `/beds-collections/${s.slug}` })}
            />
          );
        })}
      </main>
    </div>
  );
}
