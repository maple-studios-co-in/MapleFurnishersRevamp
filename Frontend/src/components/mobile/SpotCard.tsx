"use client";

import { useEffect, useRef, useState } from "react";
import { SHOP_URL } from "@/lib/links";
import type { ResolvedScene } from "./scenes";
import styles from "./mobile.module.css";

export interface OpenSpot {
  scene: number;
  index: number;
}

/**
 * The piece behind a tapped dot, in the desktop hotspot card's dress
 * (frosted card, burgundy name, Red Hat line, clay View More), set as a
 * sheet at the foot of the screen where a thumb can reach it. The arrows
 * walk through the other pieces in the same room. Scrolling on, Escape or
 * the close button put it away.
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
  // The last piece stays rendered while the card slides away.
  const [shown, setShown] = useState<OpenSpot | null>(open);
  const cardRef = useRef<HTMLDivElement>(null);
  if (open && (open.scene !== shown?.scene || open.index !== shown?.index)) setShown(open);

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
    <div
      ref={cardRef}
      className={styles.card}
      data-open={!!open}
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
  );
}
