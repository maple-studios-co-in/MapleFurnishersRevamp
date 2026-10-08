"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSmoothScroll } from "@/components/layout/SmoothScroll";
import TransitionLink from "@/components/layout/TransitionLink";
import MapleLogo from "@/components/ui/MapleLogo";
import type { SceneProducts } from "@/lib/api";
import { SHOP_URL } from "@/lib/links";
import MobileHeader from "./MobileHeader";
import { resolveScenes, type ResolvedScene } from "./scenes";
import { CRAFT_NOTES, FILMS, INTRO, PHONE_QUERY, frameUrl } from "./script";
import Socials from "./Socials";
import SpotCard, { type OpenSpot } from "./SpotCard";
import styles from "./mobile.module.css";

/**
 * The home page below 1024px — the desktop story, re-shot for a phone held
 * upright (the user's portrait renders of every film) and told the same way:
 *
 *  01  the intro film plays with the page held; "Every home has a story."
 *      rises over the sunlit room and the film rests there
 *  02  the chair weaves itself together under the thumb; "Let's furnish
 *      yours." lands on the settled frame
 *  03  the room dissolves into the cream craft plate; the chair parts with
 *      its three notes, the Maple wordmark gliding away behind it
 *  04–06  one film through the living room (day into evening), dining
 *      room, bedroom and terrace, holding on each settled room for its copy
 *      and shoppable dots
 *      the brand card, with the ways on
 *
 * Every chapter after the first arrives over the last like a sheet laid on
 * a stack. director.ts runs it all from one scroll reading per frame; with
 * reduced motion the same story is a still page.
 */
export default function MobileHome({ sceneProducts }: { sceneProducts?: SceneProducts | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scenes = useMemo(() => resolveScenes(sceneProducts), [sceneProducts]);
  const [spot, setSpot] = useState<OpenSpot | null>(null);
  const smooth = useSmoothScroll();
  const smoothRef = useRef(smooth);
  const heldRef = useRef(false);

  // Lenis comes up after this tree's first effects: re-apply a hold it missed.
  useEffect(() => {
    smoothRef.current = smooth;
    if (heldRef.current) smooth.stop();
  }, [smooth]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !window.matchMedia(PHONE_QUERY).matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let disposed = false;
    let director: { destroy(): void } | null = null;
    // The films (and their director) load only on phones.
    void import("./director").then(({ createDirector }) => {
      if (disposed) return;
      director = createDirector(root, {
        lock: (on) => {
          heldRef.current = on;
          if (on) smoothRef.current.stop();
          else smoothRef.current.start();
        },
      });
    });
    return () => {
      disposed = true;
      director?.destroy();
    };
  }, []);

  const openSpot = useCallback((scene: number, index: number) => {
    setSpot({ scene, index });
    navigator.vibrate?.(8);
  }, []);

  return (
    <div ref={rootRef} className={styles.home} data-m-home>
      <MobileHeader />

      <div className={styles.motion}>
        {/* 01–02 · Every home has a story / Let's furnish yours. */}
        <section id="m-intro" className={`${styles.chapter} ${styles.hero}`} data-m-hero aria-labelledby="m-title">
          <div className={styles.stage}>
            <div className={styles.frame} data-m-hero-frame>
              {/* The director sets the sources: a desktop never fetches them. */}
              <video className={styles.media} data-m-video muted playsInline preload="none" aria-hidden tabIndex={-1} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={`${styles.media} ${styles.rest}`} data-m-rest alt="" aria-hidden />
              <canvas className={`${styles.media} ${styles.furnishCanvas}`} data-m-furnish-canvas aria-hidden />
            </div>
            <div className={styles.heroScrim} data-m-hero-scrim aria-hidden />
            <div className={styles.ui}>
              <h1 id="m-title" className={styles.title} data-m-title>
                Every home
                <br />
                has a story.
              </h1>
              <p className={styles.furnish} data-m-furnish-copy>
                Let&rsquo;s furnish
                <br />
                yours.
              </p>
              <p className={styles.kicker} data-m-furnish-copy>
                Crafted for the
                <br />
                moments you&rsquo;ll
                <br />
                remember.
              </p>
              <div className={styles.cue} data-m-cue aria-hidden>
                <ScrollCueArt />
              </div>
              <button type="button" className={styles.skip} data-m-skip>
                Skip intro
              </button>
            </div>
          </div>
        </section>

        {/* 03 · Craftsmanship */}
        <section id="m-craft" className={`${styles.chapter} ${styles.craft}`} data-m-craft aria-label="Craftsmanship">
          <div className={styles.stage}>
            <div className={styles.frame} data-m-craft-frame>
              <div className={styles.plate} data-m-plate />
              <div className={styles.ui}>
                <p className={styles.eyebrow} data-m-assembled>
                  &mdash; Craftmanship
                </p>
                <span className={styles.wordmarkWrap} aria-hidden>
                  <span className={styles.wordmark} data-m-wordmark data-m-assembled>
                    Maple
                  </span>
                </span>
                <div className={styles.chairBox} data-m-chair-box>
                  <div className={styles.podShadow} aria-hidden />
                  <canvas
                    className={styles.chairCanvas}
                    data-m-chair-canvas
                    role="img"
                    aria-label="The Maple lounge chair, coming apart piece by piece"
                  />
                </div>
                <p className={styles.beauty} data-m-assembled>
                  Beauty You Can See.
                  <br />
                  Craftsmanship You
                  <br />
                  Can Feel.
                </p>
                {CRAFT_NOTES.map((n) => (
                  <div key={n.title} className={styles.note} data-m-note>
                    <span className={styles.noteRule} aria-hidden />
                    <h3 className={styles.noteTitle}>{n.title}</h3>
                    <p className={styles.noteBody}>{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.dim} data-m-dim aria-hidden />
          </div>
        </section>

        {/* 04–06 · The rooms */}
        <section
          id="m-spaces"
          className={`${styles.chapter} ${styles.rooms}`}
          data-m-rooms
          aria-label="Spaces: the living room, dining room, bedroom and terrace"
        >
          <div className={`${styles.stage} ${styles.roomsStage}`} data-m-rooms-stage>
            <div className={styles.frame} data-m-rooms-frame>
              <canvas className={styles.media} data-m-rooms-canvas aria-hidden />
              <div className={`${styles.scrim} ${styles.scrimTop}`} data-m-scrim-top aria-hidden />
              <div className={`${styles.scrim} ${styles.scrimBottom}`} data-m-scrim-bottom aria-hidden />
              {/* Dots ride the footage (projected from the frame); the copy
                  lives in the always-visible box above them. */}
              {scenes.map((scene, s) => (
                <div key={scene.key} data-m-dots={s}>
                  {scene.spots.map((piece, i) => (
                    <button
                      key={piece.name}
                      type="button"
                      className={styles.dot}
                      data-m-dot
                      data-x={piece.x}
                      data-y={piece.y}
                      aria-label={`${piece.name}: see the piece`}
                      onClick={() => openSpot(s, i)}
                    >
                      <span className={styles.dotCore} />
                    </button>
                  ))}
                </div>
              ))}
              <div className={styles.ui}>
                {scenes.map((scene, s) => (
                  <div key={scene.key} data-m-scene={s}>
                    <SceneText scene={scene} />
                  </div>
                ))}
                <p className={styles.hint} data-m-hint aria-hidden>
                  Tap a dot to see the piece
                </p>
              </div>
            </div>
            <div className={styles.dim} data-m-dim aria-hidden />
          </div>
        </section>
      </div>

      <StillPage scenes={scenes} />

      {/* The brand card — the desktop film's last frame, and the ways on. */}
      <footer className={styles.finale} data-m-finale>
        <div className={styles.finaleGlow} aria-hidden />
        <div className={styles.finaleMark} data-m-finale-in>
          <MapleLogo className={styles.finaleLogo} idPrefix="maple-m-finale" />
          <p className={styles.finaleLine}>Crafted for the moments you&rsquo;ll remember.</p>
        </div>
        <div className={styles.finaleCtas} data-m-finale-in>
          <a href={SHOP_URL} className={styles.ctaPrimary}>
            Shop Now
          </a>
          <TransitionLink href="/spaces" className={styles.ctaGhost}>
            Explore Spaces
          </TransitionLink>
          <TransitionLink href="/about" className={styles.ctaGhost}>
            About Us
          </TransitionLink>
        </div>
        <Socials className={styles.socials} />
        <p className={styles.legal}>&copy; Maple Furnishers</p>
      </footer>

      <SpotCard scenes={scenes} open={spot} onChange={setSpot} />

      <div className={styles.turn} aria-hidden>
        Turn your phone upright
      </div>
    </div>
  );
}

/** A room's copy, in the desktop's stack: rule, headline, bold line, body. */
function SceneText({ scene }: { scene: ResolvedScene }) {
  const { text } = scene;
  const line = (cls: string) => `${cls} ${styles.line}`;
  const below = (
    <>
      {text.subBold && (
        <p className={line(styles.sceneSub)} data-m-line>
          {text.subBold}
        </p>
      )}
      {text.body && (
        <p className={line(styles.sceneBody)} data-m-line>
          {text.body}
        </p>
      )}
    </>
  );
  return (
    <>
      <div className={styles.sceneCopy} data-m-copy="top">
        {text.eyebrowAbove && <span className={line(styles.sceneRule)} data-m-line aria-hidden />}
        <h2 className={line(styles.sceneTitle)} data-m-line>
          {text.headline}
        </h2>
        {!text.split && below}
      </div>
      {text.split && (
        <div className={styles.sceneSplit} data-m-copy="low">
          {below}
        </div>
      )}
    </>
  );
}

/** The desktop scroll cue, drawn smaller: arched label, plumb line, drifting ring. */
function ScrollCueArt() {
  return (
    <svg viewBox="0 0 300 195">
      <defs>
        <path id="m-scroll-arc" d="M 32,108 Q 150,-20 268,108" fill="none" />
      </defs>
      <text
        fill="#F4F2EC"
        fontSize="21.863"
        fontWeight="500"
        style={{ fontFamily: "var(--font-pearl), var(--font-redhat)", letterSpacing: "5px" }}
      >
        <textPath href="#m-scroll-arc" startOffset="50%" textAnchor="middle">
          SCROLL DOWN
        </textPath>
      </text>
      <line x1="150" y1="103" x2="150" y2="188" stroke="#F4F2EC" strokeOpacity="0.7" strokeWidth="1.2" />
      <circle className={styles.cueRing} cx="150" cy="134" r="17" fill="none" stroke="#F4F2EC" strokeOpacity="0.95" strokeWidth="1.6" />
    </svg>
  );
}

/** Reduced motion: the same story as stills, top to bottom. */
function StillPage({ scenes }: { scenes: readonly ResolvedScene[] }) {
  return (
    <div className={styles.still}>
      <section className={styles.shot} aria-label="Every home has a story">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={INTRO.rest} alt="" loading="lazy" />
        <p className={styles.title}>
          Every home
          <br />
          has a story.
        </p>
      </section>
      <section className={styles.shot} aria-label="Let's furnish yours">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frameUrl(FILMS.furnish, FILMS.furnish.frames - 1)} alt="The Maple lounge chair in a quiet room" loading="lazy" />
        <div className={styles.heroScrim} style={{ opacity: 1 }} aria-hidden />
        <p className={styles.furnish}>
          Let&rsquo;s furnish
          <br />
          yours.
        </p>
        <p className={styles.kicker}>
          Crafted for the
          <br />
          moments you&rsquo;ll
          <br />
          remember.
        </p>
      </section>
      <section className={styles.stillCraft} aria-label="Craftsmanship">
        <p className={styles.eyebrow}>&mdash; Craftmanship</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.stillChair} src={frameUrl(FILMS.chair, 0)} alt="The Maple lounge chair" loading="lazy" />
        <p className={styles.beauty}>
          Beauty You Can See.
          <br />
          Craftsmanship You Can Feel.
        </p>
        <ul className={styles.stillNotes}>
          {CRAFT_NOTES.map((n) => (
            <li key={n.title}>
              <span className={styles.noteRule} aria-hidden />
              <h3 className={styles.noteTitle}>{n.title}</h3>
              <p className={styles.noteBody}>{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
      {scenes.map((scene) => (
        <section key={scene.key} className={styles.shot} aria-label={scene.label}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frameUrl(FILMS.rooms, scene.still)} alt={scene.label} loading="lazy" />
          <div className={`${styles.scrim} ${styles.scrimTop}`} style={{ opacity: 1 }} aria-hidden />
          {scene.text.split && <div className={`${styles.scrim} ${styles.scrimBottom}`} style={{ opacity: 1 }} aria-hidden />}
          <SceneText scene={scene} />
        </section>
      ))}
    </div>
  );
}
