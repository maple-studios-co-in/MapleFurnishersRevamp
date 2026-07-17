"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The intro uses only the first 7.8s of the film — freeze exactly here. */
const INTRO_END_S = 7.8;
/** Reveal the HTML title as the film's baked-in text starts fading (~7.0s). */
const TITLE_REVEAL_S = 7.2;
/** Hard ceiling in case playback stalls (slow network, codec issue). */
const INTRO_MAX_MS = 16_000;
/**
 * Backstop matching the title's 2s reveal animation (+ cushion): release
 * scroll at this point even if animationend never fires.
 */
const TITLE_LANDING_MAX_MS = 2_300;

/** Dev-only event trail (window.__mfIntroLog) for verifying intro sequencing. */
function devLog(event: string, videoT?: number) {
  if (process.env.NODE_ENV === "production") return;
  type IntroLog = { event: string; at: number; videoT?: number }[];
  const w = window as unknown as { __mfIntroLog?: IntroLog };
  (w.__mfIntroLog ??= []).push({
    event,
    at: Math.round(performance.now()),
    videoT,
  });
}

/**
 * Full-viewport hero. On every page load the blueprint-to-reality film plays
 * with scrolling locked; at 7.2s the Catilde title fades in (taking over
 * from the film's baked-in text as it fades out) and at exactly 7.8s the
 * film freezes on the finished room. Scrolling unlocks only once the title
 * has fully landed (its reveal animation completes). Reduced-motion users
 * and any playback failure skip straight to the settled end state.
 */
export default function HeroIntro() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const frozenRef = useRef(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [settled, setSettled] = useState(false);
  const [skippedIntro, setSkippedIntro] = useState(false);

  /** Freeze the film on the finished room (7.8s) without unlocking scroll. */
  const freezeFilm = useCallback(() => {
    if (frozenRef.current) return;
    frozenRef.current = true;
    const video = videoRef.current;
    if (video) {
      video.pause();
      try {
        if (Math.abs(video.currentTime - INTRO_END_S) > 0.1) {
          video.currentTime = INTRO_END_S;
        }
      } catch {
        // Seek before metadata — the poster underneath covers this case.
      }
    }
    devLog("film-frozen", video?.currentTime);
  }, []);

  /** Unlock the page. Called only after the title has properly landed. */
  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    freezeFilm();
    devLog("settled", videoRef.current?.currentTime);
    setTitleVisible(true);
    setSettled(true);
  }, [freezeFilm]);

  // Lock page scroll while the intro plays and the title lands.
  useEffect(() => {
    if (settled) return;
    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    devLog("scroll-locked");
    return () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      devLog("scroll-unlocked");
    };
  }, [settled]);

  // Watch playback and act on the 7.2s / 7.8s marks. Frame-accurate where
  // supported (requestVideoFrameCallback), with timeupdate as fallback.
  const checkProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || frozenRef.current) return;
    const t = video.currentTime;
    if (t >= TITLE_REVEAL_S) {
      setTitleVisible((prev) => {
        if (!prev) devLog("title-revealed", t);
        return true;
      });
    }
    if (t >= INTRO_END_S) {
      devLog("intro-end-reached", t);
      freezeFilm();
    }
  }, [freezeFilm]);

  // Safety net: if the title's animationend never fires (edge browsers),
  // still release the page shortly after the title becomes visible.
  useEffect(() => {
    if (!titleVisible || settled) return;
    const id = window.setTimeout(() => {
      devLog("title-landing-timeout");
      settle();
    }, TITLE_LANDING_MAX_MS);
    return () => window.clearTimeout(id);
  }, [titleVisible, settled, settle]);

  // Decide whether to play the intro, and start it.
  useEffect(() => {
    const video = videoRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !video) {
      devLog("skip:reduced-motion");
      setSkippedIntro(true);
      settle();
      return;
    }

    fallbackTimerRef.current = window.setTimeout(settle, INTRO_MAX_MS);

    // Frame-accurate progress loop where the browser supports it.
    const hasRVFC = "requestVideoFrameCallback" in video;
    const frameLoop = () => {
      if (frozenRef.current) return;
      checkProgress();
      if (!frozenRef.current) video.requestVideoFrameCallback(frameLoop);
    };

    video
      .play()
      .then(() => {
        devLog("video-playing", video.currentTime);
        if (hasRVFC) video.requestVideoFrameCallback(frameLoop);
      })
      .catch(() => {
        // Autoplay blocked — don't hold the page hostage.
        devLog("skip:autoplay-blocked");
        setSkippedIntro(true);
        settle();
      });
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [settle, checkProgress]);

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-clay-900">
      {/* Blueprint frame sits underneath so the video's first frame never flashes black. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/videos/hero-blueprint.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />

      {skippedIntro ? (
        // Skip path: show the finished room immediately, no video download needed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/videos/hero-final.jpg"
          alt="Sunlit interior with slatted timber wall and stone floor by Maple Furnishers"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src="/videos/hero-transformation.mp4"
          muted
          playsInline
          preload="auto"
          onTimeUpdate={checkProgress}
          onError={() => {
            devLog("skip:video-error");
            setSkippedIntro(true);
            settle();
          }}
        />
      )}

      {/* Soft vignette so the title stays readable on the bright final frame. */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-ink/30 transition-opacity duration-[1500ms] ${
          titleVisible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Skip control while the film plays. */}
      {!titleVisible && !settled && (
        <button
          type="button"
          onClick={() => {
            devLog("skip-button");
            freezeFilm();
            setTitleVisible(true);
          }}
          className="absolute bottom-6 right-6 z-20 rounded-full border border-cream/40 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-cream/80 backdrop-blur-sm transition hover:border-cream hover:text-cream"
        >
          Skip intro
        </button>
      )}

      {/* Title card — takes over from the film's baked-in text as it fades.
          Scroll releases only once its reveal animation has fully landed. */}
      {titleVisible && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <h1
            className="hero-title-reveal max-w-5xl text-5xl uppercase leading-[1.15] tracking-[0.03em] text-cream/95 sm:text-7xl lg:text-8xl"
            style={{
              fontFamily: "var(--font-hero)",
              fontWeight: 300,
              textShadow: "0 2px 40px rgba(23, 19, 16, 0.45)",
            }}
            onAnimationEnd={(e) => {
              if (e.animationName === "title-reveal") {
                devLog("title-landed");
                settle();
              }
            }}
          >
            Every home
            <br />
            has a story.
          </h1>
        </div>
      )}
    </section>
  );
}
