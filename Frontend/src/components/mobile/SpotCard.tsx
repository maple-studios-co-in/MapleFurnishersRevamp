"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SHOP_URL } from "@/lib/links";
import type { ResolvedScene } from "./scenes";
import styles from "./mobile.module.css";

export interface OpenSpot {
  scene: number;
  index: number;
}

/** Dot centre to the card's near edge: the ring, then a hairline stem. */
const REACH = 30;
/** The ring's radius: the stem starts just outside it. */
const RING = 13;
/** Clear of the screen's sides. */
const SIDE = 12;

/** A room's dot for a piece (sat-out dots too: they keep their spot). */
const dotOf = (scene: number, index: number) =>
  document.querySelectorAll<HTMLElement>(`[data-m-dots="${scene}"] [data-m-dot]`)[index] ?? null;

/** Where a dot sits on screen, read from the spot the director gave it. */
const anchorOf = (dot: HTMLElement) => {
  const frame = dot.closest<HTMLElement>("[data-m-rooms-frame]");
  const x = parseFloat(dot.style.left);
  const y = parseFloat(dot.style.top);
  if (!frame || Number.isNaN(x) || Number.isNaN(y)) return null;
  const r = frame.getBoundingClientRect();
  return { x: r.left + x, y: r.top + y };
};

/**
 * The piece behind a tapped dot, in the desktop hotspot card's dress
 * (frosted card, burgundy name, Red Hat line, clay View More), opened out
 * of the dot itself: a hairline stem draws from the ring and the card grows
 * from the stem's end. It opens below the dot (over the floor, clear of the
 * room's copy) unless only above has the room, and never covers the
 * header or the Previous / Next bar. The arrows walk the
 * room's other pieces, the card gliding from dot to dot. Moving the story
 * on, a tap elsewhere, Escape or the close button put it away.
 */
export default function SpotCard({
  scenes,
  open,
  onChange,
}: {
  scenes: readonly ResolvedScene[];
  open: OpenSpot | null;
  onChange: (next: OpenSpot | null) => void;
}) {
  // The last piece stays rendered while the card folds away.
  const [shown, setShown] = useState<OpenSpot | null>(open);
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  if (open && (open.scene !== shown?.scene || open.index !== shown?.index)) setShown(open);

  // Seat the card by its dot, before the browser paints it anywhere else.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    const card = cardRef.current;
    if (!open || !layer || !card) {
      wasOpen.current = false;
      return;
    }
    const dot = dotOf(open.scene, open.index);
    const place = () => {
      const a = dot ? anchorOf(dot) : null;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const top = (document.querySelector("[data-m-header]")?.getBoundingClientRect().bottom ?? 64) + 4;
      const bottom = (document.querySelector("[data-m-dock]")?.getBoundingClientRect().top ?? vh) - 10;
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const ax = a ? Math.min(vw - SIDE, Math.max(SIDE, a.x)) : vw / 2;
      const ay = a ? a.y : bottom - h - REACH;
      const roomBelow = bottom - (ay + REACH);
      const roomAbove = ay - REACH - top;
      // Below when it fits: the room's copy is up top, the floor is open.
      const below = roomBelow >= h || roomBelow >= roomAbove;
      const y = Math.round(Math.min(bottom - h, Math.max(top, below ? ay + REACH : ay - REACH - h)));
      const x = Math.round(Math.min(vw - SIDE - w, Math.max(SIDE, ax - w / 2)));
      const sx = Math.round(Math.min(x + w - 24, Math.max(x + 24, ax)));
      const from = below ? ay + RING : y + h;
      const to = below ? y : ay - RING;
      layer.dataset.side = below ? "below" : "above";
      layer.style.setProperty("--x", `${x}px`);
      layer.style.setProperty("--y", `${y}px`);
      layer.style.setProperty("--ox", `${sx - x}px`);
      layer.style.setProperty("--sx", `${sx}px`);
      layer.style.setProperty("--sy", `${Math.round(Math.min(from, to))}px`);
      layer.style.setProperty("--sh", `${Math.max(0, Math.round(Math.abs(to - from)))}px`);
    };
    // Opening lands in place and grows; another piece of the room glides.
    layer.toggleAttribute("data-glide", wasOpen.current);
    place();
    wasOpen.current = true;
    dot?.setAttribute("data-active", "");
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      dot?.removeAttribute("data-active");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const startY = window.scrollY;
    const onScroll = () => Math.abs(window.scrollY - startY) > 90 && onChange(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onChange(null);
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || cardRef.current?.contains(target) || target.closest("[data-m-dot]")) return;
      onChange(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, onChange]);

  const scene = shown ? scenes[shown.scene] : null;
  const spot = scene && shown ? scene.spots[shown.index] : null;
  const count = scene?.spots.length ?? 0;
  const step = (d: number) => shown && onChange({ scene: shown.scene, index: (shown.index + d + count) % count });

  return (
    <div ref={layerRef} className={styles.spot} data-open={!!open}>
      <span className={styles.stem} aria-hidden />
      <div
        ref={cardRef}
        className={styles.card}
        inert={!open}
        role="dialog"
        aria-label={spot ? spot.name : "Piece"}
      >
        {spot && scene && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.cardThumb} src={spot.img} alt="" />
            <div className={styles.cardBody}>
              <p className={styles.cardRoom}>
                {scene.label} · {(shown?.index ?? 0) + 1} / {count}
              </p>
              <p className={styles.cardName}>{spot.name}</p>
              <p className={styles.cardDesc}>{spot.desc}</p>
              <div className={styles.cardRow}>
                <a className={styles.cardMore} href={SHOP_URL}>
                  View More
                </a>
                {spot.price && <span className={styles.cardPrice}>{spot.price}</span>}
                {count > 1 && (
                  <>
                    <button type="button" className={styles.cardStep} style={spot.price ? undefined : { marginLeft: "auto" }} onClick={() => step(-1)} aria-label="Previous piece">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                        <path d="m15 6-6 6 6 6" />
                      </svg>
                    </button>
                    <button type="button" className={styles.cardStep} onClick={() => step(1)} aria-label="Next piece">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            <button type="button" className={styles.cardClose} onClick={() => onChange(null)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
