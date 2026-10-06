import Image from "next/image";
import type { CSSProperties } from "react";
import { MEDIA, type MediaKey } from "./content";
import styles from "./about.module.css";

/**
 * One artwork slot. The DOM carries the poster (with its alt text) and a
 * lazy <video>; on desktop the WebGL stage draws over the slot instead and
 * these stay hidden. The inner layer is oversized for the parallax drift.
 */
export default function MediaSlot({
  media,
  className,
  sizes,
  hero = false,
}: {
  media: MediaKey;
  className: string;
  sizes: string;
  hero?: boolean;
}) {
  const m = MEDIA[media];
  return (
    <div className={className} data-media data-clip={m.clip} data-media-hero={hero ? "" : undefined}>
      <div
        className={styles.mediaInner}
        data-media-inner
        style={{ "--tone": m.tone } as CSSProperties}
      >
        <Image src={m.poster} alt={m.alt} fill priority={hero} sizes={sizes} className={styles.cover} />
        <video
          className={styles.mediaVideo}
          data-media-video
          src={m.video}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
