import MapleLogo from "@/components/ui/MapleLogo";
import { ENQUIRY_URL } from "@/lib/links";
import styles from "./about.module.css";

/**
 * 10 · Burgundy blueprint footer — the closing call to action. In the
 * desktop film it is the last sheet, with the wordmark sketched in
 * hairline behind the copy as it arrives.
 */
export default function BlueprintFooter() {
  return (
    <footer
      className={`${styles.section} ${styles.footer} ${styles.panel}`}
      aria-labelledby="footer-title"
      data-panel="footer"
    >
      <div className={`${styles.frame} ${styles.footerFrame}`}>
        <p className={`${styles.eyebrow} ${styles.footerEyebrow}`} data-reveal="fade">
          YOUR NEXT CHAPTER, SKETCHED HERE.
        </p>
        <h2
          id="footer-title"
          className={`${styles.pearl} ${styles.stroke} ${styles.footerTitle}`}
          data-reveal="lines"
        >
          Good spaces
          <br />
          start with a
          <br />
          conversation.
        </h2>
        <a
          href={ENQUIRY_URL}
          className={`${styles.button} ${styles.buttonPaper}`}
          data-reveal="fade"
          data-magnetic
        >
          <span>
            Start your project{" "}
            <span className={styles.arrow} aria-hidden>
              ↗
            </span>
          </span>
        </a>
        <p className={`${styles.sans} ${styles.copyright}`} data-reveal="fade">
          © {new Date().getFullYear()} Maple Furnishers
        </p>
      </div>
      <div className={`${styles.footerMark} ${styles.filmOnly}`} aria-hidden="true" data-footer-mark>
        <MapleLogo outline idPrefix="maple-footer-mark" />
      </div>
    </footer>
  );
}
