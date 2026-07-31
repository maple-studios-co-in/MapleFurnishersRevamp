import type { CSSProperties } from "react";

/**
 * The design system's two type roles, verbatim from the supplied specs.
 *
 * Both roles appear in chapter 03 (dark type on the cream craft plate) and
 * again in chapters 04–06 (white type over the outro film) — identical
 * metrics, only the colour changes. Keeping them here means the spec lives
 * in ONE place instead of being re-typed as magic numbers in every scene.
 */

/**
 * Chrome type — the navbar links, the Shop Now button and the intro's
 * Skip button, which share one treatment.
 * Spec: Manrope 14px, letter-spacing 2.8px, centred. Links run 400 and
 * buttons 500, so weight is passed by the caller.
 */
export const chromeType = (fontWeight: 400 | 500): CSSProperties => ({
  color: "#FFF",
  textAlign: "center",
  fontFamily: "var(--font-manrope)",
  fontSize: "14px",
  fontStyle: "normal",
  fontWeight,
  lineHeight: "normal",
  letterSpacing: "2.8px",
});

/**
 * Sub-text — the line that sits under a heading.
 * Spec: Red Hat Display 18.544px / 300, letter-spacing 1.854px.
 */
export const subText = (color: string): CSSProperties => ({
  color,
  fontFamily: "var(--font-redhat)",
  fontSize: "18.544px",
  fontStyle: "normal",
  fontWeight: 300,
  lineHeight: "normal",
  letterSpacing: "1.854px",
});

/**
 * Section heading — TAN PEARL, stroked 1px in its own colour so the light
 * weight still holds up over footage.
 * Spec: 25px / ls 1.25px in chapter 03, 32px / ls 1.6px in chapters 04–06.
 */
export const heading = (
  color: string,
  fontSize: string,
  letterSpacing: string,
): CSSProperties => ({
  color,
  WebkitTextStrokeWidth: 1,
  WebkitTextStrokeColor: color,
  fontFamily: "var(--font-hero)",
  fontSize,
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "normal",
  letterSpacing,
});
