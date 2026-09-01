import { Routes, Route, Link, Navigate, useParams } from "react-router-dom";
import CatalogueLanding from "./pages/CatalogueLanding";
import ChairsCollections from "./pages/ChairsCollections";
import SofasCollections from "./pages/SofasCollections";
import BedsCollections from "./pages/BedsCollections";
import {
  CHAIR_COLLECTIONS,
  SOFA_COLLECTIONS,
  BED_COLLECTIONS,
  DIRECT,
  MOBILE_PDF,
  type ChairSlug,
  type SofaSlug,
  type BedSlug,
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
        <Link to="/catalogue-1" className="pdfFallback-back">
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

/** /catalogue-1/:slug — one chair sub-collection's PDF catalogue. */
function ChairPdf() {
  const { slug } = useParams();
  if (!slug || !(slug in CHAIR_COLLECTIONS)) {
    return <Navigate to="/catalogue-1" replace />;
  }
  return <PdfViewer cat={CHAIR_COLLECTIONS[slug as ChairSlug]} />;
}

/** /catalogue-2/:slug — one sofa collection's PDF catalogue. */
function SofaPdf() {
  const { slug } = useParams();
  if (!slug || !(slug in SOFA_COLLECTIONS)) {
    return <Navigate to="/catalogue-2" replace />;
  }
  return <PdfViewer cat={SOFA_COLLECTIONS[slug as SofaSlug]} />;
}

/** /catalogue-3/:slug — one bed collection's PDF catalogue. */
function BedPdf() {
  const { slug } = useParams();
  if (!slug || !(slug in BED_COLLECTIONS)) {
    return <Navigate to="/catalogue-3" replace />;
  }
  return <PdfViewer cat={BED_COLLECTIONS[slug as BedSlug]} />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<CatalogueLanding />} />
      {/* Chairs, Sofas and Beds open their designed collection pages, whose
          cards open per-collection PDFs (natively on touch devices).
          Cafe/Restaurants/Nimbus open their catalogues directly. */}
      <Route path="/catalogue-1" element={<ChairsCollections />} />
      <Route path="/catalogue-1/:slug" element={<ChairPdf />} />
      <Route path="/catalogue-2" element={<SofasCollections />} />
      <Route path="/catalogue-2/:slug" element={<SofaPdf />} />
      <Route path="/catalogue-3" element={<BedsCollections />} />
      <Route path="/catalogue-3/:slug" element={<BedPdf />} />
      <Route path="/cafe" element={<PdfViewer cat={DIRECT.cafe} />} />
      <Route path="/restaurants" element={<PdfViewer cat={DIRECT.restaurant} />} />
      <Route path="/nimbus" element={<PdfViewer cat={DIRECT.nimbus} />} />
    </Routes>
  );
}

export default App;
