import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import chairGreen from "../assets/figma/chair-green.png";
import sofa from "../assets/figma/sofa.png";
import bed from "../assets/figma/bed.png";

/**
 * Catalogue landing — Figma "Scene 27" (2511:113), a 1440×1087 canvas.
 *
 * Column anchors and row tops are transcribed verbatim from the node
 * coordinates: columns keep Figma's %-based x anchors so the layout spreads
 * with the viewport exactly like the design file, rows are fixed canvas y.
 *
 * Per the client: every card opens the chairs collection page for now —
 * the other collection pages (and the PDFs) come later.
 */

const COLS = ["86px", "calc(33.33% + 65.42px)", "calc(66.67% + 26.47px)"];
const ROWS = ["256px", "669px"];

interface Slot {
  title: string;
  furniture: Furniture;
  img: string;
}

const SLOTS: Slot[][] = [
  [
    { title: "Chairs Collections", furniture: "chair", img: chairGreen },
    { title: "Sofas Collections", furniture: "sofa", img: sofa },
    { title: "Beds Collections", furniture: "bed", img: bed },
  ],
  [
    { title: "Chairs Collections", furniture: "chair", img: chairGreen },
    { title: "Chairs Collections", furniture: "chair", img: chairGreen },
    { title: "Beds Collections", furniture: "bed", img: bed },
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
              furniture={s.furniture}
              img={s.img}
              x={COLS[c]}
              y={ROWS[r]}
              to="/catalogue-1"
            />
          )),
        )}
      </main>
    </div>
  );
}
