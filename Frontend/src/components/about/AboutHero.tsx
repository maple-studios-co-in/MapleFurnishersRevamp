import MediaSlot from "./MediaSlot";
import styles from "./about.module.css";

/** 01 · Hero — headline, the atelier film and the brand line. */
export default function AboutHero() {
  return (
    <section
      className={`${styles.section} ${styles.paper960}`}
      aria-labelledby="about-title"
      data-hero
    >
      <div className={`${styles.frame} ${styles.heroFrame}`}>
        <div className={styles.headerSlot} aria-hidden />

        <div className={styles.headlineBox} data-hero-title-box>
          <h1
            id="about-title"
            className={`${styles.pearl} ${styles.stroke} ${styles.heroTitle}`}
            data-reveal="hero"
          >
            A home, drawn
            <br />
            around you.
          </h1>
        </div>

        <MediaSlot
          media="atelier"
          hero
          className={styles.heroMedia}
          sizes="(min-width: 1024px) min(1392px, 97vw), calc(100vw - 32px)"
        />

        <p className={`${styles.sans} ${styles.tagline}`} data-hero-tagline>
          Furniture with intention. Spaces with soul.
        </p>
      </div>
    </section>
  );
}
