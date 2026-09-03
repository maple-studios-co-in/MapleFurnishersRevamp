import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import { SOFA_COLLECTIONS, MOBILE_PDF, type SofaSlug } from "../catalogues";
import sofa2 from "../assets/figma/sofa-2.png";
import sofa3 from "../assets/figma/sofa-3.png";
import sofa5 from "../assets/figma/sofa-5.png";
import sofa7 from "../assets/figma/sofa-7.png";
import sofaAll from "../assets/figma/sofa.png";

/**
 * Sofa collections page — Figma "Scene 31" (2525:282), opened from the
 * Sofas card on the landing. Same canvas recipe as the chairs page
 * (rows 307/709, columns 75 / 33.33%+54.42 / 66.67%+15.47) but with five
 * cards: three seat sizes up top, 7+ Seater and All Sofas below.
 *
 * Each card opens its own PDF chapter; All Sofas opens the merged master
 * catalogue (see ../catalogues). Native viewer on touch devices.
 */

const COLS = ["75px", "calc(33.33% + 54.42px)", "calc(66.67% + 15.47px)"];
const ROWS = ["307px", "709px"];

const SLOTS: { slug: SofaSlug; sub: string; furniture: Furniture; img: string; col: number; row: number }[] = [
  { slug: "2-seater", furniture: "sofa2", img: sofa2, col: 0, row: 0, sub: "Compact comfort with a refined presence." },
  { slug: "3-seater", furniture: "sofa3", img: sofa3, col: 1, row: 0, sub: "Generous seating shaped for everyday comfort." },
  { slug: "5-seater", furniture: "sofa5", img: sofa5, col: 2, row: 0, sub: "Made for bigger moments and longer conversations." },
  { slug: "7-seater", furniture: "sofa7", img: sofa7, col: 0, row: 1, sub: "Designed to bring everyone together beautifully." },
  { slug: "all-sofas", furniture: "sofaAll", img: sofaAll, col: 1, row: 1, sub: "Explore every silhouette, size, and expression." },
];

export default function SofasCollections() {
  return (
    <div className="scene">
      <Backdrop />
      <Header />
      <Watermark top={441} />
      <h1 className="pageTitle">Sofa Collections</h1>
      <main className="cards">
        {SLOTS.map((s) => {
          const cat = SOFA_COLLECTIONS[s.slug];
          return (
            <CollectionCard
              key={s.slug}
              title={cat.title}
              sub={s.sub}
              furniture={s.furniture}
              img={s.img}
              x={COLS[s.col]}
              y={ROWS[s.row]}
              {...(MOBILE_PDF ? { href: cat.pdf } : { to: `/sofa-collections/${s.slug}` })}
            />
          );
        })}
      </main>
    </div>
  );
}
