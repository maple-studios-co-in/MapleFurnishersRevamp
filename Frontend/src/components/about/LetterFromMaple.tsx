import styles from "./about.module.css";

/** 07 · Letter from Maple — the note card on the dark band. */
export default function LetterFromMaple() {
  return (
    <section
      id="letter"
      className={`${styles.section} ${styles.letter} ${styles.panel}`}
      aria-labelledby="letter-title"
      data-panel="letter"
    >
      <div className={`${styles.frame} ${styles.letterFrame}`}>
        <article className={styles.letterCard} data-reveal="letter">
          <p className={styles.note} data-reveal="write">
            A NOTE FROM MAPLE
          </p>
          <h2
            id="letter-title"
            className={`${styles.pearl} ${styles.letterTitle}`}
            data-reveal="lines"
          >
            To those who
            <br />
            make a home.
          </h2>
          <p className={`${styles.sans} ${styles.letterBody}`} data-reveal="text">
            A home begins long before the first piece of furniture arrives. In
            the way you imagine a quiet morning. In the people you hope to
            gather. In the objects you choose to keep.
          </p>
          <p className={`${styles.sans} ${styles.letterBody}`} data-reveal="text">
            We believe furniture should belong to that story. Thoughtful in
            proportion, expressive in material, and made to be lived with. Our
            role is to help you bring the pieces together.
          </p>
          <p className={styles.note} data-reveal="write">
            Let’s make room for you.
            <br />— Maple Furnishers
          </p>
        </article>
      </div>
    </section>
  );
}
