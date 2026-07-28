/**
 * Frame-sequence registry.
 *
 * `frames` is printed by the asset scripts (scripts/*) — keeping the counts
 * here means a re-render only ever changes one line, instead of a magic
 * number buried in a component.
 *
 * scrollPerFrame is tuned so every sequence advances FOOTAGE at the same
 * rate per pixel scrolled. hero-title and chair are sampled at 10fps, so
 * they use 32px; outro is sampled every 2nd frame (5fps) and therefore needs
 * double, 64px, to feel identical under the thumb.
 */
export const SEQUENCES = {
  /**
   * The title-free 240-frame render of the chapter (supplied Cine_frames,
   * 1280×720 full-bleed, 24fps): empty room → the chair weaves itself
   * together → settles wide with lamp and plant. Built by the scratchpad
   * build-cine script (corner-sparkle inpaint on every frame). The
   * "Let's furnish yours." card is DOM Catilde over the settled frames.
   * The intro before the scrub plays hero-intro-clean.mp4 (the supplied
   * HeroTxt_frames re-render, title-free, bars cropped) with the
   * "Every home has a story." card as DOM text in Catilde Light.
   * scrollPerFrame keeps the shared footage pace for 24fps material
   * (10fps↔40px ⇒ 24fps↔17px), and funds the 22% tailHold hosting the
   * title moment.
   */
  heroTitle: {
    path: "/media/sequences/hero-title",
    frames: 240,
    // 19 (not the pace-matched 17): the film still plays at the same
    // scroll pace because HeroFilm's tailHold grew to 0.3 — the extra
    // distance all lands in the tail rest, funding the 1250px hand-off
    // bridge into the chair chapter.
    scrollPerFrame: 19,
  },
  /** Chair assembling/disassembling, background removed (alpha WebP).
   *  Deliberately paced SLOWER than the shared footage rate (26 would match
   *  it): the explosion reads as sudden when a wheel notch spans ~7 frames.
   *  61px/frame keeps the tuned ~29px-per-frame footage pace AND funds the
   *  1250px hero→craft hand-off bridge, which lives in this section's
   *  leadHold (see ChairShowcase's BRIDGE_SCROLL_PX) while the frames rest
   *  on the assembled chair. */
  chair: {
    path: "/media/sequences/chair",
    frames: 79,
    scrollPerFrame: 61,
  },
  /** Closing scene: room → exterior → brand card. */
  outro: {
    path: "/media/sequences/outro",
    frames: 242,
    scrollPerFrame: 64,
  },
} as const;
