import { ENQUIRY_URL } from "@/lib/links";
import { SERVICES } from "./content";
import styles from "./about.module.css";

/** 08 · Project folder — the three ways to work with Maple. */
export default function ProjectFolder() {
  return (
    <section
      id="start-your-project"
      className={`${styles.section} ${styles.folder} ${styles.paper650} ${styles.panel}`}
      aria-labelledby="folder-title"
      data-panel="folder"
    >
      <div className={`${styles.frame} ${styles.folderFrame}`}>
        <p className={`${styles.sans} ${styles.tab}`} data-reveal="tab">
          START YOUR PROJECT
        </p>

        <h2
          id="folder-title"
          className={`${styles.pearl} ${styles.stroke} ${styles.folderTitle}`}
          data-reveal="lines"
        >
          However you begin,
          <br />
          make it yours.
        </h2>

        <ul className={styles.cards} data-reveal-group="cards">
          {SERVICES.map((card) => (
            <li
              key={card.title}
              className={`${styles.card} ${card.rose ? styles.cardRose : ""}`}
              data-reveal="card"
            >
              <h3 className={`${styles.sans} ${styles.cardTitle}`}>{card.title}</h3>
              <p className={`${styles.sans} ${styles.cardBody}`}>{card.body}</p>
              <a href={card.href} className={styles.cardLink}>
                {card.cta}{" "}
                <span className={styles.arrow} aria-hidden>
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>

        <a
          href={ENQUIRY_URL}
          className={`${styles.button} ${styles.buttonBurgundy}`}
          data-reveal="fade"
          data-magnetic
        >
          <span>
            Let’s discuss your project{" "}
            <span className={styles.arrow} aria-hidden>
              ↗
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}
