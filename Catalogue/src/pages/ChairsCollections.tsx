import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import chairGreen from "../assets/figma/chair-green.png";
import chairDining from "../assets/figma/chair-dining.png";
import chairAccent from "../assets/figma/chair-accent.png";

/**
 * Chairs collection page — Figma "Scene 29" (2511:420), opened from any
 * card on the landing. Same canvas recipe as Scene 27 but with the page
 * title, the watermark 40px lower, rows at 307/709 and every column anchor
 * 11px left of the landing's.
 *
 * The cards are display-only for now — per the client, nothing opens a PDF
 * yet, so they render without a destination.
 */

const COLS = ["75px", "calc(33.33% + 54.42px)", "calc(66.67% + 15.47px)"];
const ROWS = ["307px", "709px"];

const SLOTS: { title: string; furniture: Furniture; img: string }[] = [
  { title: "Chairs Collections", furniture: "chair", img: chairGreen },
  { title: "Dining Collections", furniture: "dining", img: chairDining },
  { title: "Accent Collections", furniture: "accent", img: chairAccent },
];

export default function ChairsCollections() {
  return (
    <div className="scene">
      <Backdrop />
      <Header />
      <Watermark top={441} />
      <h1 className="pageTitle">Chairs Collections</h1>
      <main className="cards">
        {ROWS.map((y, r) =>
          SLOTS.map((s, c) => (
            <CollectionCard
              key={`${r}-${c}`}
              title={s.title}
              furniture={s.furniture}
              img={s.img}
              x={COLS[c]}
              y={y}
            />
          )),
        )}
      </main>
    </div>
  );
}
