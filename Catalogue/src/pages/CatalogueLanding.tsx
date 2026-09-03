import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import { DIRECT, MOBILE_PDF } from "../catalogues";
import chairGreen from "../assets/figma/chair-green.png";
import sofa from "../assets/figma/sofa.png";
import bed from "../assets/figma/bed.png";
import cafe from "../assets/figma/cafe.png";
import restaurant from "../assets/figma/restaurant.png";
import nimbusBed from "../assets/figma/nimbus-bed.png";

/**
 * Catalogue landing — Figma "Scene 27" (2511:113), a 1440×1087 canvas.
 *
 * Column anchors and row tops are transcribed verbatim from the node
 * coordinates: columns keep Figma's %-based x anchors so the layout spreads
 * with the viewport exactly like the design, rows are fixed canvas y.
 *
 * Destinations: Chairs, Sofas and Beds open their designed collection
 * pages; Cafe, Restaurants and Nimbus open their PDF catalogues directly
 * (in the in-app viewer on desktop, natively on touch devices).
 */

const COLS = ["86px", "calc(33.33% + 65.42px)", "calc(66.67% + 26.47px)"];
const ROWS = ["256px", "669px"];

interface Slot {
  title: string;
  sub: string;
  furniture: Furniture;
  img: string;
  to?: string;
  href?: string;
}

const direct = (pdf: string, route: string) => (MOBILE_PDF ? { href: pdf } : { to: route });

const SLOTS: Slot[][] = [
  [
    {
      title: "Chairs Collections",
      sub: "Statement seating for every corner.",
      furniture: "chair",
      img: chairGreen,
      to: "/chairs-collections",
    },
    {
      title: "Sofas Collections",
      sub: "Made for conversations that linger.",
      furniture: "sofa",
      img: sofa,
      to: "/sofa-collections",
    },
    {
      title: "Beds Collections",
      sub: "Because every day deserves a beautiful ending.",
      furniture: "bed",
      img: bed,
      to: "/beds-collections",
    },
  ],
  [
    {
      title: "Cafe Collections",
      sub: "Designed for spaces people love to return to.",
      furniture: "cafe",
      img: cafe,
      ...direct(DIRECT.cafe.pdf, "/cafe-collections"),
    },
    {
      title: "Restaurants",
      sub: "Furniture that sets the mood before the first course.",
      furniture: "restaurant",
      img: restaurant,
      ...direct(DIRECT.restaurant.pdf, "/restaurants"),
    },
    {
      title: "Nimbus Collection",
      sub: "Soft forms, elevated comfort, unmistakable presence.",
      furniture: "nimbus",
      img: nimbusBed,
      ...direct(DIRECT.nimbus.pdf, "/nimbus-collection"),
    },
  ],
];

export default function CatalogueLanding() {
  return (
    <div className="scene">
      <Backdrop />
      <Header />
      <Watermark top={401} />
      <main className="cards">
        {SLOTS.map((row, r) =>
          row.map((s, c) => (
            <CollectionCard
              key={`${r}-${c}`}
              title={s.title}
              sub={s.sub}
              furniture={s.furniture}
              img={s.img}
              x={COLS[c]}
              y={ROWS[r]}
              to={s.to}
              href={s.href}
            />
          )),
        )}
      </main>
    </div>
  );
}
