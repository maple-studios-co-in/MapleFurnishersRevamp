"use client";

import { useCallback, useRef } from "react";
import FrameSequence from "@/components/sequence/FrameSequence";
import { gsap, useGSAP } from "@/lib/gsap";
import { SEQUENCES } from "@/lib/sequences";
import { heading, subText } from "@/lib/typography";

/**
 * Scrub progress at which the chair has visibly begun exploding — the
 * assembled-state copy (wordmark, left block) hands over to the part
 * callouts here. Crossing back re-runs the reveal in reverse.
 */
const EXPLODE_AT = 0.32;

/* ---- Hero → Craft hand-off bridge -----------------------------------
   The craft section overlaps the hero's tail-hold rest by BRIDGE_SCROLL_PX
   of scroll (negative margin on the scope div). Over that range a scrubbed
   timeline hands section 02 over to section 03 around a chair that never
   moves. Desktop (lg) only; reduced-motion and mobile degrade below.

   STICKY-POD MECHANIC (per the user's reference, quietcubes.com):
   ONE pod stays put and only the things AROUND it change. Nothing scales,
   nothing is swapped, and there is never a frame where neither section is
   painted — so no black flash and no chance of cropping the chair.

   This replaces the previous two-phase zoom, which shrank the whole hero
   scene to a 4% speck, blinked it out, then grew the craft plate back up
   from 4%. That read exactly as the user described: the screen going
   black and a "new" chair appearing, rather than one continuous chair.

   The order matters. The cream plate is OPAQUE and fades in ON TOP of the
   hero; the hero is only switched off afterwards, once it is already
   covered. Cross-fading both at once would leave both layers partly
   transparent mid-way and let the page's dark ink bleed through — the
   very darkening we are removing. ---------------------------------- */

/** Scroll px the hand-off occupies. Must stay UNDER the hero's tail-hold
 *  rest (~2401px = 0.435 × 5520 — widened specifically to slow this
 *  transition down), or the hero unpins mid-crossfade. Funded by the
 *  chair sequence's leadHold — frames rest on the assembled chair until
 *  the bridge completes.
 *
 *  1250 → 2200 per the user: the hand-off read too fast even on a slow
 *  scroll. Everything below is expressed as a fraction of the timeline,
 *  so the beats stretch with it automatically. */
const BRIDGE_SCROLL_PX = 2200;

/** CALIBRATION KNOB — how far the pod drifts DOWN as section 03 settles
 *  in around it, matching the reference's nudge. This is the ONLY
 *  movement in the whole hand-off. */
const POD_SETTLE_Y = 70;

/** Bottom ink row of the chair inside a frame (measured: row 662 of
 *  720), as a fraction. The footage carries empty alpha below the chair,
 *  so the frame box is taller than the chair actually is. */
const CHAIR_INK_BOTTOM = 662 / 720;

/**
 * The drift the current viewport can actually afford.
 *
 * The pod MUST start at y=0: at that offset the cut-out chair lands
 * exactly on top of the chair baked into the hero's settled footage
 * (verified by compositing the two — they read as a single chair). Any
 * starting offset would show the cut-out ghosting away from the filmed
 * one, which is the "a new chair is appearing" the user reported.
 *
 * So the drift can only go DOWN, and is bounded by the gap between the
 * chair's base and the bottom of the viewport. That gap is generous on a
 * tall window (~71px at 900) but nearly nothing on a short one (~10px at
 * 730), where a fixed 70px drift would saw the legs off. Below the margin
 * this simply returns 0 — no drift beats a cropped chair.
 */
function podSettle() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Mirrors the canvas wrapper: inset-x-0, top 36px, bottom -50px.
  const boxTop = 36;
  const boxH = vh + 50 - boxTop;
  const s = Math.min(vw / 1920, boxH / 1080);
  const drawnH = 1080 * s;
  const drawnTop = boxTop + (boxH - drawnH) / 2;
  const inkBottom = drawnTop + CHAIR_INK_BOTTOM * drawnH;
  const roomBelow = vh - inkBottom;
  return Math.max(0, Math.min(POD_SETTLE_Y, Math.round(roomBelow - 10)));
}

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
    ruleClassName: "",
    style: { left: "calc(50% + clamp(11rem, 14.5vw, 17rem))", top: "17%" },
    /** Keep the heading on a single line per the key frame. */
    nowrapTitle: true,
  },
  {
    // Explicit break (rendered via whitespace-pre-line): "Every Curve Has"
    // on line 1, "A Purpose." on line 2 — width-driven wrapping would
    // re-flow it as the box scales.
    title: "Every Curve Has\nA Purpose.",
    body: "Sculpted for comfort. Refined through precision.",
    // Right-aligned per the user's key frame: both heading lines, both
    // body lines and the eyebrow rule all hang off the box's RIGHT edge,
    // so the block reads as a mirror of the two left-anchored callouts.
    // w-18rem (288px): "Every Curve Has" measures 277px in TAN PEARL at
    // the spec'd 25px/1.25px, so the old 15rem (240px) split it across a
    // third line. The body copy still wraps inside this width.
    className: "w-[18rem] text-right",
    ruleClassName: "ml-auto",
    // Anchored via `right` on purpose — a translateX(-100%) here would be
    // clobbered by the cursor-parallax gsap x/y writes.
    style: { right: "calc(50% + clamp(13rem, 20vw, 20rem))", top: "46%" },
    nowrapTitle: false,
  },
  {
    title: "Strength Hidden In Plain Sight.",
    body: "Solid wood craftsmanship that defines every silhouette.",
    className: "text-left",
    ruleClassName: "",
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
  /** Cached copy-state nodes — handleProgress runs on every painted frame
   *  of the scrub, and the section's DOM is static for its whole life. */
  const assembledRef = useRef<HTMLElement[] | null>(null);
  const calloutsRef = useRef<HTMLElement[] | null>(null);
  const seq = SEQUENCES.chair;

  /* ---- swap copy states as the scrub crosses the explosion point ---- */
  const handleProgress = useCallback((p: number) => {
    const scope = scopeRef.current;
    if (!scope) return;

    // The wordmark rides the scroll: it glides up and out in step with the
    // scrub (reversible), instead of hanging around while the chair works.
    wordmarkToRef.current?.(-p * 3.2 * 100);
    let assembled = assembledRef.current;
    let callouts = calloutsRef.current;
    if (!assembled || !callouts) {
      assembled = assembledRef.current = Array.from(
        scope.querySelectorAll<HTMLElement>("[data-assembled-copy]"),
      );
      callouts = calloutsRef.current = Array.from(
        scope.querySelectorAll<HTMLElement>("[data-callout]"),
      );
    }

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
            // The pod is the ONLY constant. It is laid out at its final
            // craft geometry from the very first frame and never scales,
            // so it cannot be cropped or re-fitted mid-transition — it is
            // literally the same canvas continuing into section 03.
            const heroStage = document.querySelector("[data-hero-stage]");
            const settle = podSettle();
            const podShadow = stage.querySelector("[data-pod-shadow]");
            const plate = stage.querySelector("[data-craft-plate]");
            const craftCopy = stage.querySelectorAll("[data-assembled-copy]");
            // Everything that must stay locked together as the pod settles.
            const pod = [chairWrap, podShadow].filter(
              Boolean,
            ) as Element[];
            // The container stays visible; its CHILDREN are timed
            // separately so the plate, the pod and the copy can each
            // arrive on their own beat instead of popping in as one block.
            gsap.set(bridgeLayer, { autoAlpha: 1, scale: 1, borderRadius: 0 });
            gsap.set([plate, podShadow].filter(Boolean), {
              autoAlpha: 0,
            });
            gsap.set(craftCopy, { autoAlpha: 0, y: 26 });
            // Hidden until the timeline brings it in. Nothing belonging to
            // section 03 may paint before the bridge starts: the craft
            // stage sits further down the page until it pins, so anything
            // left switched on is seen sliding up from the bottom of the
            // screen while the hero is still playing.
            gsap.set(chairWrap, { autoAlpha: 0 });
            gsap.set(pod, { y: 0 });
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: section,
                start: "top top",
                end: `+=${BRIDGE_SCROLL_PX}`,
                // Lazier lerp than the house 0.6 — the hand-off drifts
                // after the wheel instead of snapping with it.
                scrub: 1,
                invalidateOnRefresh: true,
              },
            });
            tl
              // 1 — BACKGROUND CROSS-FADE, exactly the demo's mechanic:
              //     section 02's room washes out to section 03's plate and
              //     nothing else about the frame moves. Deliberately quick
              //     (the first 38% of the bridge) so the beige arrives gently,
              //     the footage is gone almost immediately.
              //
              //     There is no separate "pod still" any more. It could
              //     only line up with the filmed chair if its stage were
              //     pinned at the exact instant the bridge began — it is
              //     not, so it rendered offset and read as a second chair
              //     sitting below the first. Removing it is the only way
              //     that cannot happen.
              .to(
                [plate, podShadow].filter(Boolean),
                { autoAlpha: 1, duration: 0.38, ease: "power1.inOut" },
                0,
              )
              // 2 — the pod arrives as the room leaves. It starts at 0.14,
              //     by which point the plate is ~68% opaque, so the filmed
              //     chair is already mostly gone: a chair is on screen the
              //     whole way through, but never two solid ones at once.
              .to(
                chairWrap,
                { autoAlpha: 1, duration: 0.20, ease: "power2.out" },
                0.26,
              )
              // 3 — the pod drifts a little lower as section 03 settles,
              //     the one movement in the whole hand-off. The contact
              //     shadow rides the same offset or it would detach.
              .to(pod, { y: settle, duration: 0.16, ease: "power2.out" }, 0.46)
              // 4 — the three copy blocks arrive ONE AT A TIME, each on its
              //     own stretch of scroll, only after the chair is settled
              //     on the bare cream plate. Order per the user: the Maple
              //     wordmark, then the "— Craftmanship" eyebrow, then the
              //     "Beauty You Can See" block. Separate tweens rather than
              //     a stagger, so each has a real gap of scroll before the
              //     next begins instead of overlapping.
              .to(
                stage.querySelector("[data-wordmark]"),
                { autoAlpha: 1, y: 0, duration: 0.10, ease: "power2.out" },
                0.66,
              )
              .to(
                stage.querySelector("[data-craft-eyebrow]"),
                { autoAlpha: 1, y: 0, duration: 0.10, ease: "power2.out" },
                0.77,
              )
              .to(
                stage.querySelector("[data-craft-beauty]"),
                { autoAlpha: 1, y: 0, duration: 0.10, ease: "power2.out" },
                0.88,
              )
              ;
            if (heroStage) {
              // 4 — only once the plate is fully opaque does the hero stop
              //     compositing. Purely a cleanup: it is already hidden
              //     behind the plate, so this is visually a no-op.
              tl.set(heroStage, { autoAlpha: 0 }, 0.72);
            }
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
              data-craft-plate
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(69.68% 69.68% at 50% 50%, #E7DDD4 0%, #BCAB98 100%)",
              }}
            />

            {/* ------- assembled-state copy (alignment key frame, 1440×985:
                em-dash eyebrow at x255/y172, flanking the wordmark's left
                edge) ------- */}
            <p
              data-assembled-copy
              data-craft-eyebrow
              /* top-[12%] (was 17.5%): the wordmark now runs at its spec'd
                 300px, whose ink is ~425px tall against 306px at the old
                 216px cap. Lifting the eyebrow is what buys that height
                 without dropping the wordmark onto the copy below. */
              className="absolute left-[17.7%] top-[12%] font-ui text-[22px] font-medium uppercase tracking-[0.2em] text-timber-900"
            >
              — Craftmanship
            </p>

            {/* Centring lives on the wrapper; gsap animates the inner span.
                One element for both would break: gsap's x/y/yPercent writes
                replace the Tailwind -translate-x-1/2 transform, which is
                exactly what shoved the wordmark half a screen to the right. */}
            {/* top-[44%] (was 41%): at the spec'd 300px the ink is 425px
                tall, so the block sits lower to keep its cap clear of the
                eyebrow while its baseline stays above the copy below. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2"
            >
              <span
                data-wordmark
                data-assembled-copy
                className="block select-none whitespace-nowrap text-center"
                style={{
                  // User spec: TAN PEARL 300px / 400, #741A14 with a 4px
                  // #741A14 stroke, ls 15px @300 = 0.05em.
                  color: "#741A14",
                  fontFamily: "var(--font-hero)",
                  fontWeight: 400,
                  // The spec's 300px, reached at the 1440-wide design frame
                  // and held as the ceiling above it. Both terms are needed:
                  // 20.8vw hits 300 at 1440 wide, 33.3dvh hits it at 900
                  // tall, and min() means whichever axis is tighter wins —
                  // a short viewport shrinks the glyphs rather than driving
                  // them into the eyebrow, which is how the old 16.6vw
                  // (width-only) rule collided at 1536×730.
                  fontSize: "clamp(5.5rem, min(20.8vw, 33.3dvh), 300px)",
                  fontStyle: "normal",
                  lineHeight: "normal",
                  letterSpacing: "0.05em",
                  WebkitTextStrokeWidth: 4,
                  WebkitTextStrokeColor: "#741A14",
                }}
              >
                Maple
              </span>
            </span>

            <div
              data-assembled-copy
              data-craft-beauty
              data-depth="12"
              /* Widened from 18rem: at the spec'd 30px + 3px tracking the
                 longest line ("Craftsmanship You") needs ~305px. */
              className="absolute left-[11.3%] top-[57.7%] max-w-[26rem]"
            >
              {/* Design spec, verbatim: Red Hat Display 30px/400, 150%
                  leading (45px), ls 3px, capitalised, #1E1E1E. */}
              <p
                style={{
                  color: "#1E1E1E",
                  fontFamily: "var(--font-redhat)",
                  fontSize: "30px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: "150%",
                  letterSpacing: "3px",
                  textTransform: "capitalize",
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
                {/* `block` pins the rule to the box's left edge; the
                    right-aligned callout passes ml-auto to flip it. */}
                <span
                  aria-hidden
                  className={`mb-3 block h-px w-10 bg-[#741A14]/80 ${c.ruleClassName}`}
                />
                {/* Design spec: heading TAN PEARL 25px/400 stroked 1px in
                    #741A14; sub-text Red Hat Display 18.544px/300 in #000. */}
                <h3
                  className={
                    c.nowrapTitle ? "whitespace-nowrap" : "whitespace-pre-line"
                  }
                  style={heading("#741A14", "25px", "1.25px")}
                >
                  {c.title}
                </h3>
                <p className="mt-2" style={subText("#000")}>
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
              data-pod-shadow
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
