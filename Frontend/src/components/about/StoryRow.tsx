import { Fragment, type CSSProperties } from "react";
import MediaSlot from "./MediaSlot";
import type { StoryRowData } from "./content";
import styles from "./about.module.css";

/**
 * Sections 01–05: a 372px copy column beside an 828 × 530 film. The copy
 * comes first in the DOM (heading before film for screen readers); rows
 * with the film on the left reorder it visually on desktop.
 */
export default function StoryRow({ row }: { row: StoryRowData }) {
  const titleId = `${row.id}-title`;

  // Per-row type spec, read by .rowTitle in about.module.css.
  const titleVars = {
    "--hs": row.size,
    "--hlh": row.lineHeight,
    "--hbox": row.box ?? 0,
    ...(row.stroke ? { "--stroke-color": row.stroke } : {}),
  } as CSSProperties;

  return (
    <section
      id={row.id}
      className={`${styles.section} ${styles.paper680}`}
      aria-labelledby={titleId}
    >
      <div
        className={`${styles.frame} ${styles.rowFrame} ${row.mediaFirst ? styles.rowMediaFirst : ""}`}
      >
        <div className={styles.copy}>
          <h2
            id={titleId}
            className={`${styles.pearl} ${styles.rowTitle} ${row.stroke ? styles.stroke : ""}`}
            style={titleVars}
          >
            <span data-reveal="lines">
              {row.title.map((line, i) => (
                <Fragment key={line}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </span>
          </h2>
          <p className={`${styles.sans} ${styles.rowBody}`} data-reveal="text">
            {row.body}
          </p>
        </div>

        <MediaSlot
          media={row.media}
          className={styles.media}
          sizes="(min-width: 1024px) min(828px, 58vw), calc(100vw - 32px)"
        />
      </div>
    </section>
  );
}
