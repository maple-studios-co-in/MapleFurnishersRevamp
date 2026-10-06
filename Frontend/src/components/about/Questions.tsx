"use client";

import { useId, useState } from "react";
import { FAQS } from "./content";
import styles from "./about.module.css";

/**
 * 09 · Questions. Each "FAQ / Collapsed" row is a disclosure button; the
 * answer is inert while closed so it stays out of the tab order and the
 * accessibility tree.
 */
export default function Questions() {
  const [open, setOpen] = useState<readonly boolean[]>(() => FAQS.map(() => false));
  const baseId = useId();

  const toggle = (index: number) =>
    setOpen((prev) => prev.map((isOpen, i) => (i === index ? !isOpen : isOpen)));

  return (
    <section
      id="questions"
      className={`${styles.section} ${styles.questions} ${styles.panel}`}
      aria-labelledby="questions-title"
      data-panel="faq"
    >
      <div className={`${styles.frame} ${styles.questionsFrame}`}>
        <div className={styles.faqIntro}>
          <p className={styles.eyebrow} data-reveal="fade">
            NEED A LITTLE CLARITY?
          </p>
          <h2
            id="questions-title"
            className={`${styles.pearl} ${styles.stroke} ${styles.faqTitle}`}
            data-reveal="lines"
          >
            A few good
            <br />
            questions.
          </h2>
        </div>

        <div className={styles.faqList} data-reveal-group="faq">
          {FAQS.map((item, i) => {
            const questionId = `${baseId}-q${i}`;
            const answerId = `${baseId}-a${i}`;
            return (
              <div key={item.q} className={styles.faqItem} data-open={open[i]}>
                <h3 className={styles.faqHeading}>
                  <button
                    type="button"
                    id={questionId}
                    className={styles.faqQ}
                    aria-expanded={open[i]}
                    aria-controls={answerId}
                    onClick={() => toggle(i)}
                    data-reveal="question"
                  >
                    <span className={styles.faqText}>{item.q}</span>
                    <span className={styles.faqIcon} aria-hidden>
                      <span className={styles.faqPlus}>+</span>
                    </span>
                  </button>
                </h3>
                <div
                  id={answerId}
                  role="region"
                  aria-labelledby={questionId}
                  className={styles.faqA}
                  inert={!open[i]}
                >
                  <div className={styles.faqAInner}>
                    <p className={`${styles.sans} ${styles.faqAnswer}`}>{item.a}</p>
                  </div>
                </div>
                <span className={styles.faqRule} data-reveal="rule" aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
