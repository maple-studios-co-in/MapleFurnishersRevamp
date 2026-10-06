"use client";

import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

/**
 * GSAP for the editorial routes (/about, /spaces): the shared core
 * (lib/gsap) plus SplitText and CustomEase, registered here so the home
 * page bundle doesn't carry them.
 *
 * The house curves:
 *  - mapleOut    long, soft landing for anything arriving (lines, cards)
 *  - mapleInOut  symmetric sweep for wipes, curtains and reveals
 *  - mapleDraw   even, pen-like pace for strokes being drawn
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText, CustomEase);
  CustomEase.create("mapleOut", "0.16, 1, 0.3, 1");
  CustomEase.create("mapleInOut", "0.76, 0, 0.24, 1");
  CustomEase.create("mapleDraw", "0.55, 0.05, 0.35, 1");
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
