import Image from "next/image";
import type { CSSProperties } from "react";
import { CUE_GLYPHS, ENTER_HREF, LANDING, WORLDS, type World } from "./content";
import styles from "./spaces.module.css";

/**
 * The /spaces stage: the landing (frames 1–2), Nimbus (frame 3) and Terra
 * (frame 4), plus the WebGL canvas that draws the white box, its bulge and
 * burst, and the clouds it opens onto.
 *
 * On desktop with motion the scenes are layered inside one fixed stage and
 * the director plays between them; otherwise they are ordinary sections in
 * page order. Paint order matches the frames: Terra arrives over Nimbus,
 * and the canvas sits above the landing and Nimbus while it is in use.
 */
export default function SpacesStage() {
  return (
    <div className={styles.stage} data-spaces-stage>
      <section className={`${styles.scene} ${styles.landing}`} data-scene="landing" aria-labelledby="spaces-title">
        <div className={styles.landingBg} data-landing-bg aria-hidden />

        <h1 id="spaces-title" className={styles.headline} data-headline data-enter>
          {LANDING.headline.map((line) => (
            <span key={line} className={styles.headlineLine}>
              {line}
            </span>
          ))}
        </h1>

        <p className={styles.sub} data-sub data-enter>
          {LANDING.sub}
        </p>

        <div className={styles.cue} data-cue data-enter aria-hidden>
          {CUE_GLYPHS.map((g, i) => (
            <span
              key={i}
              className={styles.cueGlyph}
              style={{ "--x": g.x, "--y": g.y, "--w": g.w, "--h": g.h } as CSSProperties}
              data-cue-glyph
            >
              <span style={{ transform: `rotate(${g.r}deg)` }}>{g.ch}</span>
            </span>
          ))}
          <span className={styles.cueMark} data-cue-mark>
            <span className={styles.cueMarkArt} data-cue-bob />
          </span>
        </div>

        {/* Stands in for the canvas when WebGL is unavailable. */}
        <div className={styles.boxFallback} data-portal-fallback aria-hidden />
      </section>

      <WorldScene world={WORLDS.nimbus} />

      <canvas className={styles.portal} data-portal aria-hidden />

      <div className={styles.terraTrack} data-terra-track>
        <WorldScene world={WORLDS.terra} />
        <div className={styles.terraShadow} data-terra-shadow aria-hidden />
      </div>
    </div>
  );
}

function WorldScene({ world }: { world: World }) {
  const nimbus = world.id === "nimbus";
  const name = nimbus ? "Nimbus" : "Terra";
  const next = world.link.kind === "next";

  return (
    <section
      id={world.id}
      className={`${styles.scene} ${nimbus ? styles.nimbus : styles.terra}`}
      data-scene={world.id}
      aria-label={`${name} collection`}
    >
      <div className={`${styles.sceneBg} ${nimbus ? styles.nimbusBg : styles.terraBg}`} aria-hidden />

      <div className={styles.sceneInner} data-world-inner>
        {/* Parallax layers: the title drifts less than the piece in front. */}
        <div className={styles.depth} data-depth="0.35">
          <h2 className={`${styles.worldTitle} ${nimbus ? styles.titleNimbus : styles.titleTerra}`} data-world-title>
            {world.title}
          </h2>
          <p className={styles.tagline} data-world-tagline>
            {world.tagline}
          </p>
        </div>

        <div className={styles.depth} data-depth="1">
          <div className={`${styles.photo} ${nimbus ? styles.photoNimbus : styles.photoTerra}`} data-world-photo>
            <Image
              src={world.photo.src}
              alt={world.photo.alt}
              fill
              priority
              sizes="(min-width: 1024px) 72vw, 100vw"
              className={styles.photoImg}
            />
          </div>
        </div>

        <div className={nimbus ? styles.copy : `${styles.copy} ${styles.copyWide}`} data-world-copy>
          <p className={styles.eyebrow} data-world-eyebrow>
            {world.eyebrow}
          </p>
          <p className={styles.body} data-world-body>
            {world.body}
          </p>
        </div>

        <a
          href={`#${world.link.to}`}
          className={`${styles.switch} ${next ? styles.switchNext : styles.switchPrev}`}
          data-world-switch={world.link.to}
        >
          <span className={styles.switchLabel}>{world.link.label}</span>
          <span className={`${styles.switchArrow} ${nimbus ? styles.arrowDark : styles.arrowLight}`} aria-hidden />
          <span className={styles.switchCollection}>{world.link.collection}</span>
        </a>

        <a href={ENTER_HREF} className={styles.enter} data-world-enter data-magnetic aria-label={`Enter the ${name} collection`}>
          <span className={styles.enterRing} data-enter-ring aria-hidden />
          <span className={styles.enterText} data-enter-text aria-hidden>
            Click to
            <br />
            Enter
          </span>
        </a>
      </div>

      {nimbus && <div className={styles.dim} data-nimbus-dim aria-hidden />}
    </section>
  );
}
