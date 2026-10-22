import { getImageProps } from "next/image";
import { Fragment } from "react";
import { plateSrc, ROOM_WORLDS, TALL_QUERY, type Room, type RoomsWorld, type RoomsWorldId } from "./content";
import styles from "./rooms.module.css";

/** A finished room for the static page: the tall plate on a portrait screen, like the film. */
function StaticPlate({ world, room }: { world: RoomsWorld; room: Room }) {
  const common = { alt: room.alt, fill: true, sizes: "(min-width: 1024px) 86vw, 100vw" };
  const tall = getImageProps({ ...common, src: plateSrc(world, room, 5, "tall") }).props.srcSet;
  const img = getImageProps({ ...common, src: plateSrc(world, room, 5) }).props;
  return (
    <picture>
      <source media={TALL_QUERY} srcSet={tall} sizes={img.sizes} />
      <img {...img} alt={room.alt} className={styles.staticImg} />
    </picture>
  );
}

/**
 * Markup for a world's rooms (/spaces/nimbus, /spaces/terra).
 *
 * The film: one fixed stage (the WebGL canvas, the room names that form in
 * the cloud, the piece-by-piece captions, each room's copy, the room rail
 * and the finale) over a tall spacer that only supplies scroll distance.
 *
 * The static page: the three finished rooms as ordinary sections, for
 * reduced motion, no WebGL and no script.
 */
export default function RoomsStage({ world: id }: { world: RoomsWorldId }) {
  const world = ROOM_WORLDS[id];
  const { rooms, finale } = world;
  return (
    <>
      <div className={styles.stage} data-rooms-stage>
        <canvas className={styles.canvas} data-rooms-canvas aria-hidden />
        <h1 className={styles.srOnly}>{world.heading}</h1>

        {rooms.map((room, r) => (
          <Fragment key={room.id}>
            <div className={styles.title} data-room-title={r}>
              <div className={styles.titleInner} data-title-inner>
                <p className={styles.titleKicker} data-title-kicker>
                  <span>{world.name}</span>
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
            {finale.tagline}
          </p>
          <h2 className={styles.finaleTitle} data-finale-title>
            {finale.title}
          </h2>
          <p className={styles.finaleBody} data-finale-body>
            {finale.body}
          </p>
          <div className={styles.finaleCtas} data-finale-ctas>
            <a href={finale.primary.href} className={styles.cta} data-leave="external">
              <span>{finale.primary.label}</span>
              <span className={styles.ctaArrow} aria-hidden />
            </a>
            <a href={finale.secondary.href} className={`${styles.cta} ${styles.ctaQuiet}`} data-leave="internal">
              <span className={`${styles.ctaArrow} ${styles.ctaArrowBack}`} aria-hidden />
              <span>{finale.secondary.label}</span>
            </a>
          </div>
        </div>

        <nav className={styles.rail} aria-label={`${world.name} rooms`} data-rail>
          {rooms.map((room, r) => (
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

      <div className={styles.spacer} data-rooms-spacer aria-hidden />

      <div className={styles.static} data-rooms-static>
        <header className={styles.staticHead}>
          <p className={styles.staticKicker}>{world.name}</p>
          <h1 className={styles.staticTitle}>{world.staticTitle}</h1>
          <p className={styles.staticLine}>{finale.tagline}</p>
        </header>
        {rooms.map((room) => (
          <section key={room.id} id={room.id} className={styles.staticRoom} aria-labelledby={`${id}-${room.id}`}>
            <div className={styles.staticPlate}>
              <StaticPlate world={world} room={room} />
            </div>
            <div className={styles.staticText}>
              <p className={styles.staticKicker}>
                {world.name} · {room.numeral}
              </p>
              <h2 id={`${id}-${room.id}`} className={styles.staticRoomTitle}>
                {room.title}
              </h2>
              <p className={styles.staticLine}>{room.line}</p>
              <p className={styles.staticBody}>{room.body}</p>
            </div>
          </section>
        ))}
        <footer className={styles.staticFoot}>
          <p className={styles.staticBody}>{finale.body}</p>
          <div className={styles.finaleCtas}>
            <a href={finale.primary.href} className={styles.cta}>
              <span>{finale.primary.label}</span>
              <span className={styles.ctaArrow} aria-hidden />
            </a>
            <a href={finale.secondary.href} className={`${styles.cta} ${styles.ctaQuiet}`}>
              <span className={`${styles.ctaArrow} ${styles.ctaArrowBack}`} aria-hidden />
              <span>{finale.secondary.label}</span>
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
