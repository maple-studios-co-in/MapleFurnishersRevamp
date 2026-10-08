import { Routes, Route, Link, Navigate, useParams } from "react-router-dom";
import CatalogueLanding from "./pages/CatalogueLanding";
import ChairsCollections from "./pages/ChairsCollections";
import SofasCollections from "./pages/SofasCollections";
import BedsCollections from "./pages/BedsCollections";
import TablesCollections from "./pages/TablesCollections";
import {
  CHAIR_COLLECTIONS,
  SOFA_COLLECTIONS,
  BED_COLLECTIONS,
  TABLE_COLLECTIONS,
  DIRECT,
  LEGACY_CHAIR_SLUGS,
  LEGACY_SOFA_SLUGS,
  LEGACY_BED_SLUGS,
  MOBILE_PDF,
  type ChairSlug,
  type SofaSlug,
  type BedSlug,
  type TableSlug,
} from "./catalogues";
import "./App.css";

interface Pdf {
  title: string;
  pdf: string;
}

function PdfViewer({ cat }: { cat: Pdf }) {
  // Someone landing on this route directly on a phone would hit the dead
  // first-page-only iframe — give them the native-viewer door instead.
  if (MOBILE_PDF) {
    return (
      <div className="pdfFallback">
        <span className="pdfFallback-eyebrow">Maple Furnishers</span>
        <h1 className="pdfFallback-title">{cat.title}</h1>
        <a href={cat.pdf} className="pdfFallback-open">
          Open the catalogue →
        </a>
        <Link to="/" className="pdfFallback-back">
          ← All collections
        </Link>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <iframe
        src={cat.pdf}
        style={{ width: "100%", height: "100%", border: "none" }}
        title={cat.title}
      />
    </div>
  );
}

/** /chairs-collections/:slug — one chair sub-collection's PDF catalogue. */
function ChairPdf() {
  const { slug } = useParams();
  if (!slug || !(slug in CHAIR_COLLECTIONS)) {
    return <Navigate to="/chairs-collections" replace />;
  }
  return <PdfViewer cat={CHAIR_COLLECTIONS[slug as ChairSlug]} />;
}

/** /sofa-collections/:slug — one sofa collection's PDF catalogue. */
function SofaPdf() {
  const { slug } = useParams();
  if (!slug || !(slug in SOFA_COLLECTIONS)) {
    return <Navigate to="/sofa-collections" replace />;
  }
  return <PdfViewer cat={SOFA_COLLECTIONS[slug as SofaSlug]} />;
}

/** /beds-collections/:slug — one bed collection's PDF catalogue. */
function BedPdf() {
  const { slug } = useParams();
  if (!slug || !(slug in BED_COLLECTIONS)) {
    return <Navigate to="/beds-collections" replace />;
  }
  return <PdfViewer cat={BED_COLLECTIONS[slug as BedSlug]} />;
}

/** /table-collections/:slug — one table collection's PDF catalogue. */
function TablePdf() {
  const { slug } = useParams();
  if (!slug || !(slug in TABLE_COLLECTIONS)) {
    return <Navigate to="/table-collections" replace />;
  }
  return <PdfViewer cat={TABLE_COLLECTIONS[slug as TableSlug]} />;
}

/** /tables/:slug, the short form, lands on its named route. */
function TablesAlias() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/table-collections/${slug}` : "/table-collections"} replace />;
}

/** Redirect an old /catalogue-N/:slug child onto its named route. */
function LegacyChild({ map, base }: { map: Record<string, string>; base: string }) {
  const { slug } = useParams();
  const next = slug ? map[slug] : undefined;
  return <Navigate to={next ? `${base}/${next}` : base} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<CatalogueLanding />} />

      {/* Named routes: the URL is the collection. Family pages list their
          sub-collections; each child opens that catalogue's PDF (natively
          on touch devices). */}
      <Route path="/chairs-collections" element={<ChairsCollections />} />
      <Route path="/chairs-collections/:slug" element={<ChairPdf />} />
      <Route path="/sofa-collections" element={<SofasCollections />} />
      <Route path="/sofa-collections/:slug" element={<SofaPdf />} />
      <Route path="/beds-collections" element={<BedsCollections />} />
      <Route path="/beds-collections/:slug" element={<BedPdf />} />
      <Route path="/table-collections" element={<TablesCollections />} />
      <Route path="/table-collections/:slug" element={<TablePdf />} />
      <Route path="/cafe-collections" element={<PdfViewer cat={DIRECT.cafe} />} />
      <Route path="/restaurants" element={<PdfViewer cat={DIRECT.restaurant} />} />
      <Route path="/nimbus-collection" element={<PdfViewer cat={DIRECT.nimbus} />} />
      <Route path="/storage" element={<PdfViewer cat={DIRECT.storage} />} />
      <Route path="/outdoor" element={<PdfViewer cat={DIRECT.outdoor} />} />

      {/* Short forms for the tables family: /tables, /tables/side-tables. */}
      <Route path="/tables" element={<Navigate to="/table-collections" replace />} />
      <Route path="/tables/:slug" element={<TablesAlias />} />

      {/* Legacy /catalogue-N routes shipped for a while — keep every old
          bookmark and shared link working via client-side redirects. */}
      <Route path="/catalogue-1" element={<Navigate to="/chairs-collections" replace />} />
      <Route
        path="/catalogue-1/:slug"
        element={<LegacyChild map={LEGACY_CHAIR_SLUGS} base="/chairs-collections" />}
      />
      <Route path="/catalogue-2" element={<Navigate to="/sofa-collections" replace />} />
      <Route
        path="/catalogue-2/:slug"
        element={<LegacyChild map={LEGACY_SOFA_SLUGS} base="/sofa-collections" />}
      />
      <Route path="/catalogue-3" element={<Navigate to="/beds-collections" replace />} />
      <Route
        path="/catalogue-3/:slug"
        element={<LegacyChild map={LEGACY_BED_SLUGS} base="/beds-collections" />}
      />
      <Route path="/cafe" element={<Navigate to="/cafe-collections" replace />} />
      <Route path="/nimbus" element={<Navigate to="/nimbus-collection" replace />} />
    </Routes>
  );
}

export default App;
