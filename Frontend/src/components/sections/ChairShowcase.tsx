"use client";

import { useCallback, useRef } from "react";
import FrameSequence from "@/components/sequence/FrameSequence";
import { gsap, useGSAP } from "@/lib/gsap";
import { SEQUENCES } from "@/lib/sequences";

/**
 * Scrub progress at which the chair has visibly begun exploding — the
 * assembled-state copy (wordmark, left block) hands over to the part
 * callouts here. Crossing back re-runs the reveal in reverse.
 */
const EXPLODE_AT = 0.32;

/* ---- Hero → Craft hand-off bridge -----------------------------------
   The craft section overlaps the hero's tail-hold rest by BRIDGE_SCROLL_PX
   of scroll (negative margin on the scope div). Over that range, a
   scrubbed timeline pins the alpha chair at full craft size over the
   hero, shrinks/dims the hero's whole scene beneath it, and grows the
   cream craft stage in around the constant chair. Desktop (lg) only;
   reduced-motion and mobile degrade below. ---------------------------- */

/** Scroll px the hand-off occupies. Must stay UNDER the hero's tail-hold
 *  rest (~1368px = 0.3 × 4560 — widened specifically to slow this
 *  transition down), or the hero unpins mid-crossfade. Funded by the
 *  chair sequence's leadHold — frames rest on the assembled chair until
 *  the bridge completes. */
const BRIDGE_SCROLL_PX = 1250;

/* The chair itself stays PINNED at the craft stage geometry for the whole
 * hand-off (per the user: no chair glide/scale) — the zoom choreography
 * lives on the BACKGROUNDS, in two sequential phases: section 2's scene
 * shrinks down to a tiny card and vanishes, THEN section 3's stage grows
 * up from the same tiny size around the constant chair. */

/** CALIBRATION KNOB — how far section 2's stage shrinks before it
 *  disappears (0.04 ≈ vanishing into a speck, per the user: "more
 *  extreme"). */
const HERO_BG_EXIT = { toScale: 0.04, cardRadius: 24 };

/** CALIBRATION KNOB — the size section 3's stage grows FROM. */
const CRAFT_BG_ENTER = { fromScale: 0.04, cardRadius: 24 };

/**
 * Callouts hug the chair rather than the screen edges: positioned off the
 * stage CENTRE in rem (the chair is always centred), so the composition
 * matches the reference at any viewport width.
 */
/**
 * Callouts hug the exploded chair per the reference key frame: right-side
 * blocks open at ~64% of the stage, the left block's right edge lands at
 * ~30% — tight against the wood frame without ever touching it.
 */
const CALLOUTS = [
  {
    title: "Comfort Is Engineered.",
    body: "Balanced support beneath every moment of relaxation.",
    className: "text-left",
    style: { left: "calc(50% + clamp(11rem, 14.5vw, 17rem))", top: "17%" },
    /** Keep the heading on a single line per the key frame. */
    nowrapTitle: true,
  },
  {
    title: "Every Curve Has A Purpose.",
    body: "Sculpted for comfort. Refined through precision.",
    // w-[17.625rem]: the heading's first line renders 280px wide, so a
    // 282px box makes the centered text FILL it — the left-edge eyebrow
    // rule then sits flush with the text instead of floating 16px out,
    // and the body wraps at the period like the key frame.
    className: "w-[17.625rem] text-center",
    // Anchored via `right` on purpose — a translateX(-100%) here would be
    // clobbered by the cursor-parallax gsap x/y writes.
    style: { right: "calc(50% + clamp(13rem, 20vw, 20rem))", top: "46%" },
    nowrapTitle: false,
  },
  {
    title: "Strength Hidden In Plain Sight.",
    body: "Solid wood craftsmanship that defines every silhouette.",
    className: "text-left",
    style: { left: "calc(50% + clamp(11rem, 14.5vw, 17rem))", top: "66%" },
    nowrapTitle: false,
  },
] as const;

/**
 * Chapter 03 — the chair disassembles under scroll, cut out of its studio
 * plate so it floats in front of the page's own typography.
 *
 * Two copy states share the stage: assembled (giant clay wordmark behind the
 * chair + "Beauty You Can See" block, per the craftsmanship key frame) and
 * exploded (three part callouts). All copy sits BEHIND the canvas; depth
 * comes from the cursor tilting the chair one way while the text layers
 * drift subtly the other.
 */
export default function ChairShowcase() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const explodedRef = useRef(false);
  const wordmarkToRef = useRef<((v: number) => void) | null>(null);
  const seq = SEQUENCES.chair;

  /* ---- swap copy states as the scrub crosses the explosion point ---- */
  const handleProgress = useCallback((p: number) => {
    const scope = scopeRef.current;
    if (!scope) return;

    // The wordmark rides the scroll: it glides up and out in step with the
    // scrub (reversible), instead of hanging around while the chair works.
    wordmarkToRef.current?.(-p * 3.2 * 100);
    const assembled = scope.querySelectorAll("[data-assembled-copy]");
    const callouts = scope.querySelectorAll("[data-callout]");

    if (p >= EXPLODE_AT && !explodedRef.current) {
      explodedRef.current = true;
      gsap.to(assembled, {
        autoAlpha: 0,
        y: -36,
        duration: 0.55,
        ease: "power2.in",
        overwrite: "auto",
      });
      gsap.fromTo(
        callouts,
        { autoAlpha: 0, y: 30 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.14,
          overwrite: "auto",
        },
      );
    } else if (p < EXPLODE_AT && explodedRef.current) {
      explodedRef.current = false;
      gsap.to(callouts, {
        autoAlpha: 0,
        y: 30,
        duration: 0.4,
        ease: "power2.in",
        overwrite: "auto",
      });
      gsap.to(assembled, {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out",
        overwrite: "auto",
      });
    }
  }, []);

  /* ---- hero hand-off bridge + cursor parallax ---- */
  useGSAP(
    () => {
      const stage = scopeRef.current;
      if (!stage) return;
      const canvas = stage.querySelector("canvas");
      if (!canvas) return;

      /* ---- hand-off bridge (see the BRIDGE_* constants above) ----
         gsap.matchMedia owns breakpoint + motion forks and reverts its
         own triggers; mm.revert() in the cleanup below covers App-Router
         unmounts. */
      const section = stage.querySelector("section");
      const bridgeLayer = stage.querySelector("[data-bridge-in]");
      const chairWrap = canvas.parentElement;
      const mm = gsap.matchMedia();
      mm.add(
        {
          lg: "(min-width: 1024px)",
          motionOK: "(prefers-reduced-motion: no-preference)",
        },
        (mmCtx) => {
          const { lg, motionOK } = mmCtx.conditions as {
            lg: boolean;
            motionOK: boolean;
          };
          // Reduced motion: no pin, no scrub, no glide — the markup's
          // defaults (opaque stage, identity chair) ARE the end state,
          // and the overlap margin is disabled in CSS via motion-safe.
          if (!motionOK || !section || !bridgeLayer || !chairWrap) return;

          if (lg) {
            // Stage + chair invisible while the section approaches under
            // the resting hero; the scrubbed timeline runs the take-over
            // across the overlap. The chair carries NO transform — it
            // appears already pinned at the craft geometry and never
            // moves; the backgrounds do the zooming.
            const heroStage = document.querySelector("[data-hero-stage]");
            gsap.set(bridgeLayer, {
              autoAlpha: 0,
              scale: CRAFT_BG_ENTER.fromScale,
              borderRadius: CRAFT_BG_ENTER.cardRadius,
              overflow: "hidden",
              transformOrigin: "50% 50%",
            });
            gsap.set(chairWrap, { autoAlpha: 0 });
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: "top top",
                end: `+=${BRIDGE_SCROLL_PX}`,
                // Lazier lerp than the house 0.6 — the zoom drifts after
                // the wheel instead of snapping with it.
                scrub: 1,
                invalidateOnRefresh: true,
              },
            });
            tl
              // 1 — the pinned chair fades on, full size, over the hero.
              .to(chairWrap, { autoAlpha: 1, duration: 0.1, ease: "none" }, 0);
            if (heroStage) {
              tl
                // 2 — PHASE ONE: section 2's whole scene collapses down to
                //     a tiny card behind the constant chair…
                .to(
                  heroStage,
                  {
                    scale: HERO_BG_EXIT.toScale,
                    borderRadius: HERO_BG_EXIT.cardRadius,
                    transformOrigin: "50% 50%",
                    duration: 0.46,
                    ease: "power2.inOut",
                  },
                  0.02,
                )
                //     …and blinks out right as it bottoms.
                .to(heroStage, { autoAlpha: 0, duration: 0.1, ease: "none" }, 0.42);
            }
            tl
              // 3 — PHASE TWO: section 3's stage appears at the same tiny
              //     size and grows smoothly to full around the chair;
              //     opaque well before the hero unpins beneath.
              .to(bridgeLayer, { autoAlpha: 1, duration: 0.08, ease: "none" }, 0.5)
              .to(
                bridgeLayer,
                { scale: 1, borderRadius: 0, duration: 0.48, ease: "power2.out" },
                0.5,
              );
          } else {
            // <lg: no overlap margin (CSS) and no glide — just a plain
            // scrubbed crossfade of the stage as the section scrolls in.
            gsap.fromTo(
              bridgeLayer,
              { autoAlpha: 0 },
              {
                autoAlpha: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top 85%",
                  end: "top 15%",
                  scrub: 0.6,
                  invalidateOnRefresh: true,
                },
              },
            );
          }
        },
      );

      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduce) return () => mm.revert();

      const tiltX = gsap.quickTo(canvas, "rotateY", {
        duration: 0.7,
        ease: "power2.out",
      });
      const tiltY = gsap.quickTo(canvas, "rotateX", {
        duration: 0.7,
        ease: "power2.out",
      });
      gsap.set(canvas, {
        transformPerspective: 1400,
        transformOrigin: "50% 55%",
      });

      // Scroll-linked exit for the wordmark (yPercent, so it scales with its
      // own huge height). Created here so handleProgress can reuse it.
      const wordmark = stage.querySelector<HTMLElement>("[data-wordmark]");
      if (wordmark) {
        wordmarkToRef.current = gsap.quickTo(wordmark, "yPercent", {
          duration: 0.5,
          ease: "power1.out",
        });
      }

      const layers = stage.querySelectorAll<HTMLElement>("[data-depth]");
      const movers = Array.from(layers).map((el) => ({
        depth: Number(el.dataset.depth ?? 0),
        x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power2.out" }),
        y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power2.out" }),
      }));

      const onMove = (e: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        tiltX(dx * 4);
        tiltY(-dy * 3);
        // Copy moves opposite the chair — the differential reads as depth.
        for (const m of movers) {
          m.x(-dx * m.depth);
          m.y(-dy * m.depth);
        }
      };
      stage.addEventListener("pointermove", onMove);
      return () => {
        mm.revert();
        stage.removeEventListener("pointermove", onMove);
      };
    },
    { scope: scopeRef },
  );

  return (
    <div
      ref={scopeRef}
      /* Hand-off overlap: on motion-safe desktop the section is pulled up
         over the hero's tail-hold rest by one viewport + the bridge
         distance, and stacks ABOVE the isolated hero (z-10) so the
         crossfade paints over it. Reduced-motion and <lg keep normal
         flow. */
      className="relative isolate z-10 motion-safe:lg:mt-[calc(-100dvh-var(--bridge-scroll))]"
      style={{ "--bridge-scroll": `${BRIDGE_SCROLL_PX}px` } as React.CSSProperties}
    >
      <FrameSequence
        id="craft"
        label="Craftsmanship — the Maple chair, part by part"
        /* No section background — the stage must be transparent while the
           resting hero shows through during the bridge; all cream lives on
           the [data-bridge-in] layer below. */
        framePath={seq.path}
        totalFrames={seq.frames}
        scrollPerFrame={seq.scrollPerFrame}
        fit="contain"
        transparent
        preloadMargin={1400}
        /* The bridge occupies the head of this pin: frames rest on the
           assembled chair (matching the hero's settled one) until the
           take-over completes. */
        leadHold={BRIDGE_SCROLL_PX / (seq.frames * seq.scrollPerFrame)}
        /* Tail: a fast flick outruns the scrub's lag, and the chair must
           be fully re-assembled and resting before the pin releases —
           never cropped mid-explosion at the exit. 0.26 of the widened
           runway keeps the same rest distance as the old 0.3. */
        tailHold={0.26}
        /* Lazier playhead lerp than the shared 0.6 — makes the
           dis/re-assembly glide instead of jumping several frames per
           wheel notch. */
        scrubSmooth={1.2}
        onProgress={handleProgress}
        /* Stage runs from inside the header band to 50px BELOW the
           viewport: the footage carries ~58px of empty alpha under the
           chair's base (ink spans rows 9–662 of 720), so overhanging that
           padding off-screen buys more chair. The header is TRANSPARENT,
           so "touching the navbar" means reaching the visible links row
           (text bottom ~48px, Shop Now bottom ~58px) — top 36px lands the
           exploded seat back's tip at ~47-57px across 1280×720 through
           1920×1080, pressed against the nav band at every aspect ratio.
           The chrome is z-50 over the canvas's z-10, so the links can
           never be covered. */
        canvasClassName="absolute inset-x-0 bottom-[-50px] top-[36px] z-10"
        background={
          /* One wrapper so the WHOLE stage (backdrop, wordmark, copy,
             callouts, shadow) crossfades as a unit during the hand-off;
             the chair canvas sits above it and persists. */
          <div data-bridge-in className="absolute inset-0">
            {/* Full-bleed studio falloff — the page IS the backdrop, no
                inner panel. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 38%, #F2EBDF 0%, #E8E0D5 48%, #DBD1C1 100%)",
              }}
            />

            {/* ------- assembled-state copy (alignment key frame, 1440×985:
                em-dash eyebrow at x255/y172, flanking the wordmark's left
                edge) ------- */}
            <p
              data-assembled-copy
              className="absolute left-[17.7%] top-[17.5%] font-ui text-[22px] font-medium uppercase tracking-[0.2em] text-timber-900"
            >
              — Craftmanship
            </p>

            {/* Centring lives on the wrapper; gsap animates the inner span.
                One element for both would break: gsap's x/y/yPercent writes
                replace the Tailwind -translate-x-1/2 transform, which is
                exactly what shoved the wordmark half a screen to the right. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-[37%] -translate-x-1/2 -translate-y-1/2"
            >
              <span
                data-wordmark
                data-assembled-copy
                className="block select-none whitespace-nowrap text-center"
                style={{
                  color: "#741A14",
                  fontFamily: "var(--font-hero)",
                  fontWeight: 300,
                  // 350px on the 1440px key frame (24.3vw) — the frame's
                  // ~1006px wordmark = 2.87em of 350px incl. tracking —
                  // with the glyph centre at ~37% of the stage height.
                  fontSize: "clamp(8rem, 24.3vw, 21.875rem)",
                  fontStyle: "normal",
                  lineHeight: "normal",
                  letterSpacing: "0.05em",
                }}
              >
                Maple
              </span>
            </span>

            <div
              data-assembled-copy
              data-depth="12"
              className="absolute left-[11.3%] top-[57.7%] max-w-[18rem]"
            >
              {/* Catilde per the alignment key frame — the mock's thin
                  high-contrast letterforms are the hero face, not
                  Playfair. */}
              <p
                className="text-[1.75rem] leading-snug text-timber-900"
                style={{
                  fontFamily: "var(--font-hero)",
                  fontWeight: 300,
                  letterSpacing: "1.4px",
                }}
              >
                Beauty You Can See.
                <br />
                Craftsmanship You
                <br />
                Can Feel.
              </p>
            </div>

            {/* ------- exploded-state callouts (hidden until the scrub
                crosses EXPLODE_AT; gsap owns their opacity) ------- */}
            {CALLOUTS.map((c, i) => (
              <div
                key={c.title}
                data-callout
                data-depth={10 + i * 6}
                className={`invisible absolute max-w-[19.5rem] opacity-0 ${c.className}`}
                style={c.style}
              >
                {/* `block` so the rule hugs the LEFT edge even inside the
                    text-centered middle callout, per the key frame. */}
                <span
                  aria-hidden
                  className="mb-3 block h-px w-10 bg-[#741A14]/80"
                />
                {/* Key-frame spec: Catilde 30px/300 headings in the deep
                    clay, Red Hat Display 18.544px/300 black body, both at
                    0.05em/0.1em tracking respectively. */}
                <h3
                  className={c.nowrapTitle ? "whitespace-nowrap" : undefined}
                  style={{
                    color: "#741A14",
                    fontFamily: "var(--font-hero)",
                    fontSize: "30px",
                    fontStyle: "normal",
                    fontWeight: 300,
                    lineHeight: "normal",
                    letterSpacing: "1.5px",
                  }}
                >
                  {c.title}
                </h3>
                <p
                  className="mt-2.5"
                  style={{
                    color: "#000",
                    fontFamily: "var(--font-redhat)",
                    fontSize: "18.544px",
                    fontStyle: "normal",
                    fontWeight: 300,
                    lineHeight: "normal",
                    letterSpacing: "1.854px",
                  }}
                >
                  {c.body}
                </p>
              </div>
            ))}

            {/* Contact shadow — the plate's own shadow was removed with the
                background; without one the chair looks pasted on. The outer
                div mirrors the canvas wrapper's insets so the ellipse tracks
                the chair's base (ink row 662/720 ≈ 92% of the drawn frame)
                instead of drifting when the stage geometry changes. */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-[-50px] top-[36px]"
            >
              <div
                className="absolute bottom-[4.5%] left-1/2 h-[6%] w-[36%] -translate-x-1/2 rounded-[50%]"
                style={{
                  background:
                    "radial-gradient(50% 50% at 50% 50%, rgba(70,45,25,0.28) 0%, rgba(70,45,25,0) 70%)",
                  filter: "blur(6px)",
                }}
              />
            </div>
          </div>
        }
      />
    </div>
  );
}
