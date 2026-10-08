import { STORY_ROWS } from "../content";
import aboutStyles from "../about.module.css";
import styles from "./phone.module.css";

/**
 * The About film on a phone (below 1024px, motion allowed), choreographed
 * like illoca's own phone site: the film opens in a framed card under the
 * headline, takes the whole screen as you scroll, and each chapter's words
 * arrive on a paper panel that rises from the bottom, holds while the film
 * plays on above it, then lifts away.
 *
 * The film is one fixed canvas behind everything (phoneDirector draws it);
 * this markup is the page that scrolls over it. The letter, folder,
 * questions and footer follow as ordinary sections.
 */
export default function PhoneFilm() {
  return (
    <div className={`${aboutStyles.phoneOnly} ${styles.root}`} data-phone-film>
      <div className={styles.stage} data-phone-stage aria-hidden>
        <canvas className={styles.canvas} data-phone-canvas />
      </div>

      <section className={styles.hero} aria-labelledby="phone-title">
        <p className={styles.heroNote} data-phone-note>
          Furniture with intention
        </p>
        <h1 id="phone-title" className={styles.heroTitle} data-phone-title>
          A home, drawn
          <br />
          around you.
        </h1>
        <p className={styles.heroAside} data-phone-note>
          <svg className={styles.heroArrow} viewBox="0 0 40 24" fill="none" aria-hidden>
            <path d="M38 3C28 3 17 6 9 14m0 0 1-8m-1 8 8-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          spaces with soul
        </p>
        <div className={styles.card} data-phone-card aria-hidden />
      </section>

      {/* A beat of nothing but film once it has opened, before the first panel. */}
      <div className={styles.gap} aria-hidden />

      {STORY_ROWS.map((row, i) => (
        <section key={row.id} className={styles.chapter} data-phone-chapter aria-labelledby={`phone-${row.id}`}>
          <div className={styles.panel}>
            <p className={styles.label}>
              <span className={styles.no}>{i + 1}</span>
              {row.label}
            </p>
            <h2 id={`phone-${row.id}`} className={styles.title}>
              {row.title.join(" ")}
            </h2>
            <p className={styles.body}>{row.body}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
