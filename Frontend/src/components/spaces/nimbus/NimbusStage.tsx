import Image from "next/image";
import { Fragment } from "react";
import { FINALE, plateSrc, ROOMS } from "./content";
import styles from "./nimbus.module.css";

/**
 * Markup for /spaces/nimbus.
 *
 * The film: one fixed stage (the WebGL canvas, the room names that form in
 * the cloud, the piece-by-piece captions, each room's copy, the room rail
 * and the finale) over a tall spacer that only supplies scroll distance.
 *
 * The static page: the three finished rooms as ordinary sections, for
 * reduced motion, no WebGL and no script.
 */
export default function NimbusStage() {
  return (
    <>
      <div className={styles.stage} data-nimbus-stage>
        <canvas className={styles.canvas} data-nimbus-canvas aria-hidden />
        <h1 className={styles.srOnly}>Nimbus: a living room, a dining room and a bedroom above the clouds</h1>

        {ROOMS.map((room, r) => (
          <Fragment key={room.id}>
            <div className={styles.title} data-room-title={r}>
              <div className={styles.titleInner} data-title-inner>
                <p className={styles.titleKicker} data-title-kicker>
                  <span>Nimbus</span>
                  <span className={styles.titleRule} aria-hidden />
                  <span>{room.numeral}</span>
                </p>
                <h2 className={styles.titleName} data-title-name>
                  {room.title}
                </h2>
                <p className={styles.titleLine} data-title-line>
                  {room.line}
                </p>
              </div>
            </div>

            <div className={styles.caption} data-caption={r} aria-hidden>
              <p className={styles.captionKicker}>Furnishing {room.title.replace(/^The /, "the ")}</p>
              <ol className={styles.steps}>
                {room.stages.slice(1).map((stage, k) => (
                  <li key={stage.file} className={styles.step} data-step>
                    <span className={styles.stepNo}>{String(k + 1).padStart(2, "0")}</span>
                    <span className={styles.stepLabel}>{stage.label}</span>
                  </li>
                ))}
              </ol>
              <div className={styles.captionBar}>
                <span className={styles.captionFill} data-caption-fill />
              </div>
            </div>

            <div className={styles.copy} data-copy={r}>
              <p className={styles.copyEyebrow}>{room.eyebrow}</p>
              <p className={styles.copyBody}>{room.body}</p>
            </div>
          </Fragment>
        ))}

        <div className={styles.finale} data-finale>
          <p className={styles.finaleTagline} data-finale-tagline>
            {FINALE.tagline}
          </p>
          <h2 className={styles.finaleTitle} data-finale-title>
            {FINALE.title}
          </h2>
          <p className={styles.finaleBody} data-finale-body>
            {FINALE.body}
          </p>
          <div className={styles.finaleCtas} data-finale-ctas>
            <a href={FINALE.primary.href} className={styles.cta} data-leave="external">
              <span>{FINALE.primary.label}</span>
              <span className={styles.ctaArrow} aria-hidden />
            </a>
            <a href={FINALE.secondary.href} className={`${styles.cta} ${styles.ctaQuiet}`} data-leave="internal">
              <span className={`${styles.ctaArrow} ${styles.ctaArrowBack}`} aria-hidden />
              <span>{FINALE.secondary.label}</span>
            </a>
          </div>
        </div>

        <nav className={styles.rail} aria-label="Nimbus rooms" data-rail>
          {ROOMS.map((room, r) => (
            <a key={room.id} href={`#${room.id}`} className={styles.railItem} data-rail-item={r}>
              <span className={styles.railNo}>{room.numeral}</span>
              <span className={styles.railLabel}>{room.title.replace(/^The /, "")}</span>
              <span className={styles.railTrack} aria-hidden>
                <span className={styles.railFill} data-rail-fill />
              </span>
            </a>
          ))}
        </nav>

        <div className={styles.cue} data-cue aria-hidden>
          <div className={styles.cueInner} data-cue-inner>
            <span className={styles.cueLabel}>
              <span className={styles.cueFine}>Scroll</span>
              <span className={styles.cueTouch}>Swipe</span> to furnish the room
            </span>
            <span className={styles.cueLine}>
              <span className={styles.cueDot} />
            </span>
          </div>
        </div>
      </div>

      <div className={styles.spacer} data-nimbus-spacer aria-hidden />

      <div className={styles.static} data-nimbus-static>
        <header className={styles.staticHead}>
          <p className={styles.staticKicker}>Nimbus</p>
          <h1 className={styles.staticTitle}>Three rooms above the clouds</h1>
          <p className={styles.staticLine}>{FINALE.tagline}</p>
        </header>
        {ROOMS.map((room) => (
          <section key={room.id} id={room.id} className={styles.staticRoom} aria-labelledby={`nimbus-${room.id}`}>
            <div className={styles.staticPlate}>
              <Image
                src={plateSrc(room, 5)}
                alt={room.alt}
                fill
                sizes="(min-width: 1024px) 86vw, 100vw"
                className={styles.staticImg}
              />
            </div>
            <div className={styles.staticText}>
              <p className={styles.staticKicker}>
                Nimbus · {room.numeral}
              </p>
              <h2 id={`nimbus-${room.id}`} className={styles.staticRoomTitle}>
                {room.title}
              </h2>
              <p className={styles.staticLine}>{room.line}</p>
              <p className={styles.staticBody}>{room.body}</p>
            </div>
          </section>
        ))}
        <footer className={styles.staticFoot}>
          <p className={styles.staticBody}>{FINALE.body}</p>
          <div className={styles.finaleCtas}>
            <a href={FINALE.primary.href} className={styles.cta}>
              <span>{FINALE.primary.label}</span>
              <span className={styles.ctaArrow} aria-hidden />
            </a>
            <a href={FINALE.secondary.href} className={`${styles.cta} ${styles.ctaQuiet}`}>
              <span className={`${styles.ctaArrow} ${styles.ctaArrowBack}`} aria-hidden />
              <span>{FINALE.secondary.label}</span>
            </a>
          </div>
        </footer>
      </div>

      {/* Without script the film can't run: show the static page instead. */}
      <noscript>
        <style>{`.${styles.stage}{display:none!important}.${styles.static}{display:block!important}`}</style>
      </noscript>
    </>
  );
}
