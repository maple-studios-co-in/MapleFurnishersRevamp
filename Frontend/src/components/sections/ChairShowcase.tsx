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
  },
  {
    title: "Every Curve Has A Purpose.",
    body: "Sculpted for comfort. Refined through precision.",
    className: "text-center",
    // Anchored via `right` on purpose — a translateX(-100%) here would be
    // clobbered by the cursor-parallax gsap x/y writes.
    style: { right: "calc(50% + clamp(13rem, 20vw, 20rem))", top: "46%" },
  },
  {
    title: "Strength Hidden In Plain Sight.",
    body: "Solid wood craftsmanship that defines every silhouette.",
    className: "text-left",
    style: { left: "calc(50% + clamp(11rem, 14.5vw, 17rem))", top: "66%" },
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

  /* ---- cursor parallax: chair tilts, copy drifts against it ---- */
  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduce) return;

      const stage = scopeRef.current;
      if (!stage) return;
      const canvas = stage.querySelector("canvas");
      if (!canvas) return;

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
      return () => stage.removeEventListener("pointermove", onMove);
    },
    { scope: scopeRef },
  );

  return (
    <div ref={scopeRef}>
      <FrameSequence
        id="craft"
        label="Craftsmanship — the Maple chair, part by part"
        className="bg-[#E8E0D5]"
        framePath={seq.path}
        totalFrames={seq.frames}
        scrollPerFrame={seq.scrollPerFrame}
        fit="contain"
        transparent
        preloadMargin={1400}
        /* Longer tail than the default: a fast flick outruns the scrub's
           lag, and the chair must be fully re-assembled and resting before
           the pin releases — never cropped mid-explosion at the exit. */
        tailHold={0.3}
        onProgress={handleProgress}
        /* Stage starts below the fixed header and breathes at the bottom, so
           the exploded seat back never disappears underneath the chrome. */
        canvasClassName="absolute inset-x-0 bottom-[3vh] top-[92px] z-10"
        background={
          <>
            {/* Full-bleed studio falloff — the page IS the backdrop, no
                inner panel. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 38%, #F2EBDF 0%, #E8E0D5 48%, #DBD1C1 100%)",
              }}
            />

            {/* ------- assembled-state copy (craftsmanship key frame) ------- */}
            <p
              data-assembled-copy
              className="absolute left-[10%] top-[15%] font-ui text-[13px] font-medium uppercase tracking-[0.3em] text-timber-900"
            >
              <span className="mr-3 inline-block h-px w-8 translate-y-[-4px] bg-timber-900/70 align-middle" />
              Craftmanship
            </p>

            {/* Centring lives on the wrapper; gsap animates the inner span.
                One element for both would break: gsap's x/y/yPercent writes
                replace the Tailwind -translate-x-1/2 transform, which is
                exactly what shoved the wordmark half a screen to the right. */}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <span
                data-wordmark
                data-assembled-copy
                className="block select-none whitespace-nowrap leading-none text-clay-700"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: "clamp(8rem, 26vw, 26rem)",
                }}
              >
                Maple
              </span>
            </span>

            <div
              data-assembled-copy
              data-depth="12"
              className="absolute left-[7%] top-[52%] max-w-[17rem]"
            >
              <p
                className="text-[1.45rem] leading-snug tracking-[0.04em] text-timber-900"
                style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
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
                className={`invisible absolute max-w-[17rem] opacity-0 ${c.className}`}
                style={c.style}
              >
                <span
                  aria-hidden
                  className="mb-3 inline-block h-px w-10 bg-clay-700/80"
                />
                <h3
                  className="text-[2.05rem] leading-[1.15] text-clay-700"
                  style={{ fontFamily: "var(--font-hero)", fontWeight: 400 }}
                >
                  {c.title}
                </h3>
                <p className="mt-2.5 font-ui text-[15px] leading-relaxed text-timber-900/65">
                  {c.body}
                </p>
              </div>
            ))}

            {/* Contact shadow — the plate's own shadow was removed with the
                background; without one the chair looks pasted on. */}
            <div
              aria-hidden
              className="absolute bottom-[9%] left-1/2 h-[6%] w-[36%] -translate-x-1/2 rounded-[50%]"
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(70,45,25,0.28) 0%, rgba(70,45,25,0) 70%)",
                filter: "blur(6px)",
              }}
            />
          </>
        }
      />
    </div>
  );
}
