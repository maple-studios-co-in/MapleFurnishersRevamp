/**
 * Frame store for the About film.
 *
 * - Loads a numbered sequence with a bounded number of requests in flight,
 *   always picking the unrequested frame nearest the playhead, so a reader
 *   who scrolls ahead gets the frames under their thumb first.
 * - decode()s frames around the playhead off the main thread: drawImage on a
 *   cold image decodes synchronously and hitches the scrub.
 * - get() falls back to the nearest loaded frame, so the window is never
 *   blank while the sequence streams in.
 */
export class FrameStore {
  readonly count: number;
  private readonly images: Array<HTMLImageElement | null>;
  private readonly loaded: Uint8Array;
  private readonly requested: Uint8Array;
  private readonly decodeQueued: Uint8Array;
  private inFlight = 0;
  private focus = 0;
  private destroyed = false;
  private firstReady: Promise<void>;
  private resolveFirst: () => void = () => {};

  /** Called with an index whenever a frame finishes loading. */
  onLoad: ((index: number) => void) | null = null;

  constructor(
    private readonly src: (index: number) => string,
    count: number,
    private readonly concurrency = 6,
  ) {
    this.count = count;
    this.images = new Array<HTMLImageElement | null>(count).fill(null);
    this.loaded = new Uint8Array(count);
    this.requested = new Uint8Array(count);
    this.decodeQueued = new Uint8Array(count);
    this.firstReady = new Promise<void>((resolve) => (this.resolveFirst = resolve));
    this.pump();
  }

  /** Resolves once frame 0 is loaded and decoded. */
  whenFirstReady() {
    return this.firstReady;
  }

  /** Move the loading and decoding focus to the playhead. */
  setFocus(index: number) {
    if (index === this.focus) return;
    this.focus = index;
    this.decodeAround(index);
    this.pump();
  }

  /** The frame at `index`, or the nearest loaded one; null if none yet. */
  get(index: number): HTMLImageElement | null {
    if (this.loaded[index]) return this.images[index];
    for (let d = 1; d < this.count; d++) {
      const back = index - d;
      const ahead = index + d;
      if (back >= 0 && this.loaded[back]) return this.images[back];
      if (ahead < this.count && this.loaded[ahead]) return this.images[ahead];
    }
    return null;
  }

  isLoaded(index: number) {
    return this.loaded[index] === 1;
  }

  destroy() {
    this.destroyed = true;
    this.onLoad = null;
  }

  private nextIndex(): number {
    for (let d = 0; d < this.count; d++) {
      const ahead = this.focus + d;
      if (ahead < this.count && !this.requested[ahead]) return ahead;
      const back = this.focus - d - 1;
      if (back >= 0 && !this.requested[back]) return back;
    }
    return -1;
  }

  private pump() {
    while (!this.destroyed && this.inFlight < this.concurrency) {
      const index = this.nextIndex();
      if (index < 0) return;
      this.requested[index] = 1;
      this.inFlight++;
      const img = new Image();
      img.decoding = "async";
      const settle = () => {
        img.onload = null;
        img.onerror = null;
        this.inFlight--;
        if (this.destroyed) return;
        if (img.naturalWidth) {
          this.images[index] = img;
          this.loaded[index] = 1;
          if (Math.abs(index - this.focus) <= 12) this.decode(index);
          if (index === 0) {
            img
              .decode()
              .catch(() => {})
              .finally(() => this.resolveFirst());
          }
          this.onLoad?.(index);
        }
        this.pump();
      };
      img.onload = settle;
      img.onerror = settle;
      img.src = this.src(index);
    }
  }

  private decodeAround(index: number) {
    const lo = Math.max(0, index - 8);
    const hi = Math.min(this.count - 1, index + 14);
    for (let j = lo; j <= hi; j++) if (this.loaded[j]) this.decode(j);
  }

  private decode(index: number) {
    if (this.decodeQueued[index]) return;
    this.decodeQueued[index] = 1;
    this.images[index]?.decode().catch(() => {});
  }
}
