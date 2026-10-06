import { Fragment, type CSSProperties } from "react";
import { STORY_ROWS } from "../content";
import aboutStyles from "../about.module.css";
import styles from "./film.module.css";

/**
 * Desktop About: one fixed stage. Nothing on it scrolls — the tall spacer
 * below only supplies scroll distance, which filmDirector turns into a
 * single timeline: the film scrubs inside its window in the graph paper,
 * the window opens, narrows to one side as each chapter's copy is written
 * in, and widens again; then the letter, folder, questions and footer
 * sheets slide up over it.
 *
 * Hidden on phones and under reduced motion, where the stacked page runs.
 */
export default function FilmStage() {
  return (
    <div className={`${styles.film} ${aboutStyles.filmOnly}`} data-film>
      <div className={styles.stage} data-film-stage>
        <div className={styles.layer} data-film-layer>
          <canvas className={styles.canvas} data-film-canvas aria-hidden="true" />

          <div className={styles.hero} data-film-hero>
            <h1 className={styles.heroTitle} data-film-hero-title>
              A home, drawn
              <br />
              around you.
            </h1>
          </div>

          <p className={styles.tagline} data-film-tagline>
            <span data-film-tagline-inner>Furniture with intention. Spaces with soul.</span>
          </p>

          {STORY_ROWS.map((row, i) => {
            const side = i % 2 === 0 ? "left" : "right";
            const titleVars = {
              "--hs": row.size,
              "--hlh": row.lineHeight,
              "--stroke-color": row.stroke ?? "transparent",
            } as CSSProperties;
            return (
              <article
                key={row.id}
                className={`${styles.chapter} ${side === "left" ? styles.chapterLeft : styles.chapterRight}`}
                data-film-chapter
                data-side={side}
                aria-labelledby={`film-${row.id}`}
              >
                <div className={styles.chapterInner} data-film-chapter-inner>
                  <p className={styles.chapterLabel} data-film-label>
                    <span className={styles.chapterNo} aria-hidden>
                      {i + 1}
                    </span>
                    {row.label}
                  </p>
                  <h2
                    id={`film-${row.id}`}
                    className={`${styles.chapterTitle} ${row.title.length > 1 ? styles.chapterTitleSet : ""}`}
                    style={titleVars}
                    data-film-title
                  >
                    {row.title.map((line, n) => (
                      <Fragment key={line}>
                        {n > 0 && <br />}
                        {line}
                      </Fragment>
                    ))}
                  </h2>
                  <p className={styles.chapterBody} data-film-body>
                    {row.body}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.progress} aria-hidden="true">
          <span data-film-progress />
        </div>
        <p className={styles.coords} aria-hidden="true">
          <span className={styles.axis}>X</span> <span data-film-x>720.00</span>
          <br />
          <span className={styles.axis}>Y</span> <span data-film-y>450.00</span>
        </p>
      </div>

      <div className={styles.spacer} data-film-spacer aria-hidden="true" />
    </div>
  );
}
