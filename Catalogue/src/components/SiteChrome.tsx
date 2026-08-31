import MapleLogo from "./MapleLogo";
import backdrop from "../assets/figma/backdrop.png";

/**
 * Chrome shared by both catalogue scenes (Figma 2511:113 & 2511:420): the
 * moody backdrop raster, the fixed-height header and the giant TAN PEARL
 * watermark.
 *
 * The header mirrors the main site's nav so the catalogue feels like the
 * same site. Under the /catalogue proxy these anchors resolve against
 * maple-furnishers.vercel.app, landing on the homepage chapters the labels
 * name (About US → craftsmanship, Services/Spaces → curated spaces). The
 * pill CTA matches the main site's header: Shop Now → the storefront.
 */

const NAV = [
  { label: "Home", href: "/", active: true },
  { label: "About US", href: "/#craft", active: false },
  { label: "Services", href: "/#spaces", active: false },
  { label: "Spaces", href: "/#spaces", active: false },
];

export function Backdrop() {
  return <img className="backdrop" src={backdrop} alt="" aria-hidden />;
}

export function Header() {
  return (
    <header className="siteHeader">
      <div className="siteHeader-inner">
        <a className="siteHeader-logo" href="/" aria-label="Maple Furnishers — home">
          <MapleLogo />
        </a>
        <nav className="siteHeader-nav" aria-label="Primary">
          {NAV.map((l) => (
            <a
              key={l.label}
              className={l.active ? "siteHeader-link is-active" : "siteHeader-link"}
              href={l.href}
            >
              {l.label}
              {l.active && <span className="siteHeader-underline" aria-hidden />}
            </a>
          ))}
        </nav>
        <a className="shopNow" href="https://shop.maplefurnishers.com/">
          <span className="shopNow-label">Shop Now</span>
          <span className="shopNow-burger" aria-hidden>
            <span style={{ width: "14.642px" }} />
            <span style={{ width: "17.369px" }} />
            <span style={{ width: "14.366px" }} />
          </span>
        </a>
      </div>
    </header>
  );
}

/** The near-invisible oversized "Maple Furnishers Catalogue" behind the
 *  cards. `top` differs per scene (401px landing, 441px chairs page). */
export function Watermark({ top }: { top: number }) {
  return (
    <p className="watermark" style={{ top }} aria-hidden>
      Maple Furnishers Catalogue
    </p>
  );
}
