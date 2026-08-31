import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

// The app is served from two places: its own domain at "/" and the main
// Maple Furnishers site, which proxies it under "/catalogue". Pick the
// router basename from where we actually got mounted so both work.
// (Exact-match check so our own "/catalogue-1" route isn't mistaken for
// the mount prefix.)
const { pathname } = window.location;
const basename =
  pathname === "/catalogue" || pathname.startsWith("/catalogue/")
    ? "/catalogue"
    : "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>
);