/**
 * A frame sequence for the phone films, kept within a phone's memory.
 *
 * Decoded frames are big (a rooms frame is ~4.8 MB of pixels), so the bank
 * never holds the whole film: it keeps a coarse set of keyframes (every
 * `stride`-th) so a scrub always has something near to show, plus a
 * window of `keep` frames either side of the playhead, filled nearest
 * first. Frames that fall out of the window are let go and come back from
 * the HTTP cache (/media is served immutable) when the playhead returns.
 * A chapter far from the viewport releases everything.
 *
 * Images are decoded before they count as ready, so drawing never stalls
 * the main thread on a decode.
 *
 * A film that plays one way (the phone home's Previous / Next) leans its
 * window that way (`setLead`), and the beat it is likely to play next can
 * be fetched ahead into the HTTP cache (`warm`) without decoding a frame.
 */
export type Frame = HTMLImageElement | ImageBitmap;

export interface FrameBankOptions {
  keep?: number;
  stride?: number;
  concurrency?: number;
  /**
   * Fetch each frame and decode it into an ImageBitmap off the main thread.
   * A canvas then only copies pixels that are already decoded. With plain
   * images Chrome decodes the WebP again, synchronously, in the very frame
   * that first draws it into a canvas — the stutter a fast scrub runs into
   * on a phone (traced: ~40% of the main thread). Evicted bitmaps are
   * closed, so their memory comes back at once.
   */
  bitmaps?: boolean;
}

const isBitmap = (f: Frame): f is ImageBitmap => typeof (f as ImageBitmap).close === "function";

export class FrameBank {
  readonly count: number;
  private readonly url: (i: number) => string;
  private readonly frames: Array<Frame | null>;
  private readonly ready: boolean[];
  /** Bitmap fetches in flight, aborted when their frame is evicted. */
  private readonly fetches: Array<AbortController | null>;
  private readonly keep: number;
  private readonly stride: number;
  private readonly concurrency: number;
  private readonly bitmaps: boolean;
  private queue: number[] = [];
  private inFlight = 0;
  private active = false;
  private destroyed = false;
  private focusAt = 0;
  private plannedAt = Number.NaN;
  /** Which way the playhead is heading: 1, -1, or 0 for either. */
  private lead = 0;
  /** Every `step`-th frame only, while the film plays fast (see setStep). */
  private step = 1;
  /** Frames fetched into the HTTP cache ahead of time, and the queue. */
  private readonly warmed: boolean[];
  private warmQueue: number[] = [];
  private warming = 0;
  private warmJob = new AbortController();
  /** Images still loading or decoding, each settled exactly once. */
  private readonly pending = new WeakSet<HTMLImageElement>();
  /** Called whenever a frame finishes decoding. */
  onLoad: ((index: number) => void) | null = null;

  constructor(path: string, count: number, { keep = 18, stride = 8, concurrency = 4, bitmaps = false }: FrameBankOptions = {}) {
    this.count = count;
    this.url = (i) => `${path}/frame-${String(i + 1).padStart(3, "0")}.webp`;
    this.frames = new Array(count).fill(null);
    this.ready = new Array(count).fill(false);
    this.fetches = new Array(count).fill(null);
    this.warmed = new Array(count).fill(false);
    this.keep = keep;
    this.stride = stride;
    this.concurrency = concurrency;
    this.bitmaps = bitmaps && typeof createImageBitmap === "function" && typeof fetch === "function";
  }

  /** Begin (or resume) fetching around the current focus. */
  start() {
    if (this.active || this.destroyed) return;
    this.active = true;
    this.plan(true);
  }

  /** Let every frame go; start() brings them back. */
  release() {
    this.active = false;
    this.queue = [];
    for (let i = 0; i < this.count; i++) this.evict(i);
    this.plannedAt = Number.NaN;
  }

  /** The playhead moved: re-centre the window on it. */
  focus(index: number) {
    this.focusAt = Math.max(0, Math.min(this.count - 1, Math.round(index)));
    if (this.active && Math.abs(this.focusAt - this.plannedAt) >= 3) this.plan(false);
  }

  /**
   * Thin the window to every `step`-th frame while the film plays fast: as
   * many frames decoded, over `step` times the footage, and a half or a
   * third of the decoding and uploading per second.
   */
  setStep(step: number) {
    const s = Math.max(1, Math.round(step));
    if (s === this.step) return;
    this.step = s;
    if (this.active) this.plan(false);
  }

  /** Lean the window the way the film is about to play. */
  setLead(dir: number) {
    const lead = Math.sign(dir);
    if (lead === this.lead) return;
    this.lead = lead;
    if (this.active) this.plan(false);
  }

  /**
   * Fetch frames `from`..`to` into the HTTP cache, two at a time and in
   * playing order, so the next beat decodes from disk instead of waiting
   * on the network. Nothing is decoded or kept in memory.
   */
  warm(from: number, to: number) {
    if (!this.bitmaps || this.destroyed) return;
    const a = Math.max(0, Math.min(this.count - 1, Math.round(from)));
    const b = Math.max(0, Math.min(this.count - 1, Math.round(to)));
    const dir = b >= a ? 1 : -1;
    const queue: number[] = [];
    for (let i = a; i !== b + dir; i += dir) if (!this.warmed[i] && !this.ready[i]) queue.push(i);
    this.warmQueue = queue;
    this.pumpWarm();
  }

  /** Whether exactly this frame is decoded and ready to draw. */
  isReady(index: number): boolean {
    return index >= 0 && index < this.count && this.ready[index];
  }

  /** The decoded frame closest to `index`, or null before any has arrived. */
  get(index: number): Frame | null {
    const i = Math.max(0, Math.min(this.count - 1, Math.round(index)));
    if (this.ready[i]) return this.frames[i];
    for (let d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.ready[i - d]) return this.frames[i - d];
      if (i + d < this.count && this.ready[i + d]) return this.frames[i + d];
    }
    return null;
  }

  destroy() {
    this.release();
    this.destroyed = true;
    this.warmQueue = [];
    this.warmJob.abort();
  }

  private isKey(i: number) {
    return i % this.stride === 0 || i === this.count - 1;
  }

  /** The window: `keep` frames either side, or three quarters of it ahead when leaning. */
  private wanted(i: number) {
    if (this.isKey(i)) return true;
    if (i % this.step) return false;
    const d = ((i - this.focusAt) * (this.lead || 1)) / this.step;
    if (!this.lead) return Math.abs(d) <= this.keep;
    return d >= -Math.round(this.keep / 2) && d <= Math.round(this.keep * 1.5);
  }

  /** Fetch order: nearest first, and ahead before behind when leaning. */
  private distance(i: number) {
    const d = (i - this.focusAt) * (this.lead || 1);
    return d >= 0 || !this.lead ? Math.abs(d) : -d * 2;
  }

  /** Loaded, loading or decoding. */
  private requested(i: number) {
    return this.frames[i] !== null || this.fetches[i] !== null;
  }

  private evict(i: number) {
    const fetching = this.fetches[i];
    if (fetching) {
      this.fetches[i] = null;
      this.inFlight--;
      fetching.abort();
    }
    const frame = this.frames[i];
    this.frames[i] = null;
    this.ready[i] = false;
    if (!frame) return;
    if (isBitmap(frame)) {
      frame.close();
      return;
    }
    if (this.pending.delete(frame)) this.inFlight--;
    frame.onload = frame.onerror = null;
    frame.src = "";
  }

  /** Drop what fell out of the window and queue what came into it. */
  private plan(first: boolean) {
    this.plannedAt = this.focusAt;
    for (let i = 0; i < this.count; i++) {
      // A bitmap fetch the playhead has left is cancelled, not finished.
      if (!this.wanted(i) && (this.ready[i] || this.fetches[i])) this.evict(i);
    }
    const missing: number[] = [];
    for (let i = 0; i < this.count; i++) {
      if (this.wanted(i) && !this.requested(i)) missing.push(i);
    }
    // Nearest to the playhead first; on a cold start the keyframes lead so
    // the whole film has a rough cut almost at once.
    missing.sort((a, b) => {
      if (first) {
        const ka = this.isKey(a) ? 0 : 1;
        const kb = this.isKey(b) ? 0 : 1;
        if (ka !== kb && Math.min(Math.abs(a - this.focusAt), Math.abs(b - this.focusAt)) > 2) return ka - kb;
      }
      return this.distance(a) - this.distance(b);
    });
    this.queue = missing;
    this.pump();
  }

  private pump() {
    while (this.active && this.inFlight < this.concurrency && this.queue.length) {
      const i = this.queue.shift()!;
      if (this.requested(i) || !this.wanted(i)) continue;
      this.inFlight++;
      if (this.bitmaps) this.fetchBitmap(i);
      else this.loadImage(i);
    }
  }

  private pumpWarm() {
    while (this.warming < 2 && this.warmQueue.length && !this.destroyed) {
      const i = this.warmQueue.shift()!;
      if (this.warmed[i] || this.ready[i]) continue;
      this.warming++;
      fetch(this.url(i), { signal: this.warmJob.signal, priority: "low" } as RequestInit)
        .then((res) => (res.ok ? res.blob() : null))
        .then(
          () => {
            this.warmed[i] = true;
          },
          () => {},
        )
        .finally(() => {
          this.warming--;
          this.pumpWarm();
        });
    }
  }

  private loadImage(i: number) {
    const img = new Image();
    img.decoding = "async";
    this.frames[i] = img;
    this.pending.add(img);
    const done = (ok: boolean) => {
      // An evicted image was already settled by evict().
      if (!this.pending.delete(img)) return;
      this.inFlight--;
      if (ok) {
        this.ready[i] = true;
        this.onLoad?.(i);
      } else {
        this.frames[i] = null;
      }
      this.pump();
    };
    img.onload = () => {
      img.decode().then(
        () => done(true),
        () => done(true),
      );
    };
    img.onerror = () => done(false);
    img.src = this.url(i);
  }

  private fetchBitmap(i: number) {
    const job = new AbortController();
    this.fetches[i] = job;
    fetch(this.url(i), { signal: job.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`frame ${i + 1}: ${res.status}`);
        return res.blob();
      })
      .then((blob) => createImageBitmap(blob))
      .then(
        (bitmap) => {
          // Evicted while it decoded: evict() already settled the slot.
          if (this.fetches[i] !== job) {
            bitmap.close();
            return;
          }
          this.fetches[i] = null;
          this.inFlight--;
          this.frames[i] = bitmap;
          this.ready[i] = true;
          this.onLoad?.(i);
          this.pump();
        },
        () => {
          if (this.fetches[i] !== job) return;
          this.fetches[i] = null;
          this.inFlight--;
          this.pump();
        },
      );
  }
}
