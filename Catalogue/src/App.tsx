import { Routes, Route, Link } from "react-router-dom";
import CatalogueLanding from "./pages/CatalogueLanding";
import ChairsCollections from "./pages/ChairsCollections";
import { MOBILE_PDF } from "./catalogues";
import "./App.css";

interface Pdf {
  title: string;
  pdf: string;
}

const CHAIR: Pdf = { title: "Chair Collection", pdf: "/catalogues/Chair_Collection.pdf" };
const NIMBUS: Pdf = { title: "Nimbus Collection", pdf: "/catalogues/Nimbus_Collection.pdf" };

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

function App() {
  return (
    <Routes>
      <Route path="/" element={<CatalogueLanding />} />
      {/* Opening a collection shows its designed page; the PDF itself
          lives one level deeper (or opens natively on touch devices). */}
      <Route path="/catalogue-1" element={<ChairsCollections />} />
      <Route path="/catalogue-1/view" element={<PdfViewer cat={CHAIR} />} />
      <Route path="/catalogue-2" element={<PdfViewer cat={NIMBUS} />} />
    </Routes>
  );
}

export default App;
