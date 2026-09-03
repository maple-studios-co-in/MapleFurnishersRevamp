import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

/**
 * One collection card, straight off the Figma card cluster: a maroon plate
 * the furniture render overflows, the TAN PEARL title + Red Hat sub sitting
 * to the plate's right, and the hairline VIEW CATALOGUE button under it.
 *
 * Every text/button offset is identical across the six cards in both scenes
 * (verified against the node coordinates); only the furniture geometry
 * varies, so that ships as a per-furniture class (card--chair etc.). The
 * cluster's canvas anchor arrives as --x/--y custom properties — custom
 * properties, not inline left/top, so the mobile stylesheet can ignore them
 * and reflow each card into its own full-screen section.
 */

export type Furniture =
  | "chair"
  | "sofa"
  | "bed"
  | "dining"
  | "accent"
  | "rocking"
  | "bar"
  | "bedroom"
  | "sofa2"
  | "sofa3"
  | "sofa5"
  | "sofa7"
  | "sofaAll"
  | "cafe"
  | "restaurant"
  | "nimbus"
  | "fabric"
  | "solidwood"
  | "kids"
  | "allChairs"
  | "allBeds";

interface CardProps {
  title: string;
  /** One-line supporting copy under the title. */
  sub: string;
  img: string;
  furniture: Furniture;
  /** Plate anchor within the 1440 canvas, e.g. { x: "86px", y: "256px" }. */
  x: string;
  y: string;
  /** Internal route (collection page)… */
  to?: string;
  /** …or a direct href. Omit both for a display-only card. */
  href?: string;
}

export default function CollectionCard({ title, sub, img, furniture, x, y, to, href }: CardProps) {
  const cls = `card card--${furniture}`;
  const style = { "--x": x, "--y": y } as CSSProperties;
  const body = (
    <>
      <span className="card-plate">
        <img className="card-img" src={img} alt="" />
      </span>
      <span className="card-title">{title}</span>
      <span className="card-sub">{sub}</span>
      <span className="card-cta">View Catalogue</span>
    </>
  );
  if (to) {
    return (
      <Link className={cls} style={style} to={to} aria-label={`${title} — view catalogue`}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a className={cls} style={style} href={href} aria-label={`${title} — view catalogue`}>
        {body}
      </a>
    );
  }
  return (
    <span className={cls} style={style}>
      {body}
    </span>
  );
}
