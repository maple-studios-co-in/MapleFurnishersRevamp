import CollectionCard, { type Furniture } from "../components/CollectionCard";
import { Backdrop, Header, Watermark } from "../components/SiteChrome";
import { MOBILE_PDF, TABLE_COLLECTIONS, type TableSlug } from "../catalogues";
import tables from "../assets/figma/tables.webp";
import tableDining from "../assets/figma/table-dining.webp";
import tableConsole from "../assets/figma/table-console.webp";
import tableBar from "../assets/figma/table-bar.webp";
import tableSide from "../assets/figma/table-side.webp";
import tableTv from "../assets/figma/table-tv.webp";
import tableCoffee from "../assets/figma/table-coffee.webp";

/**
 * Table collections page — Figma "Scene 32" (2689:177), opened from the
 * landing's Table Collections card. Same canvas recipe as the Chairs page
 * (Scene 29): its column anchors, title and watermark, with the third row
 * at 1091px on a 1461px canvas.
 *
 * Seven table catalogues, each opening its own PDF: in the in-app viewer
 * (/table-collections/:slug) on desktop, natively on touch devices.
 */

const COLS = ["75px", "calc(33.33% + 54.42px)", "calc(66.67% + 15.47px)"];
const ROWS = ["307px", "709px", "1091px"];

const IMGS: Partial<Record<Furniture, string>> = {
  allTables: tables,
  tableDining,
  tableConsole,
  tableBar,
  tableSide,
  tableTv,
  tableCoffee,
};

/* Subtexts verbatim from the design (Scene 32); slugs are the URL segments.
   Three set their line breaks where the design breaks them ("\n"): left to
   the 207px box, the browser would break each a word earlier. */
const SLOTS: { slug: TableSlug; sub: string; furniture: Furniture }[] = [
  { slug: "all-tables", furniture: "allTables", sub: "Distinctive forms, exquisite finishes, timeless presence." },
  { slug: "dining", furniture: "tableDining", sub: "An elegant setting for moments worth savouring." },
  { slug: "consoles", furniture: "tableConsole", sub: "Sculptural statements that leave a lasting first impression." },
  { slug: "bar-collections", furniture: "tableBar", sub: "The art of entertaining, served with\nsophistication." },
  { slug: "side-tables", furniture: "tableSide", sub: "Quiet accents with an unmistakable sense of refinement." },
  { slug: "tv-units", furniture: "tableTv", sub: "A refined focal point for beautifully\ncomposed living spaces." },
  { slug: "coffee-tables", furniture: "tableCoffee", sub: "Statement centrepieces for\nconversation and considered living." },
];

export default function TablesCollections() {
  return (
    <div className="scene scene--three">
      <Backdrop />
      <Header />
      <Watermark top={441} />
      <h1 className="pageTitle">Table Collections</h1>
      <main className="cards">
        {SLOTS.map((s, i) => {
          const cat = TABLE_COLLECTIONS[s.slug];
          return (
            <CollectionCard
              key={s.slug}
              title={cat.title}
              sub={s.sub}
              furniture={s.furniture}
              img={IMGS[s.furniture] ?? tables}
              x={COLS[i % 3]}
              y={ROWS[Math.floor(i / 3)]}
              {...(MOBILE_PDF ? { href: cat.pdf } : { to: `/table-collections/${s.slug}` })}
            />
          );
        })}
      </main>
    </div>
  );
}
