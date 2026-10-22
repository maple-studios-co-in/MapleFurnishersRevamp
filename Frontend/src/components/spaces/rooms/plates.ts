import type { RoomsRenderer } from "./renderer";

type Source = ImageBitmap | HTMLImageElement;
type Decoded = { source: Source; url?: string };

/**
 * Loads the room plates and keeps them on the GPU.
 *
 * - Fetches in priority order, a few at a time: the room in view first,
 *   then the rest of the page in reading order.
 * - Decodes off the main thread (createImageBitmap) and uploads at most one
 *   plate per frame from pump(), so a texture upload never stacks on top of
 *   a scroll frame's other work.
 * - Keeps the compressed bytes (about 3 MB in all). That lets a phone hold
 *   only the rooms around the one in view on the GPU (keepRooms: each plate
 *   is 6 MB decoded, all eighteen over 110 MB), and lets a lost WebGL
 *   context be refilled without refetching.
 */
export class PlateBank {
  private readonly urls = new Map<string, string>();
  private readonly blobs = new Map<string, Blob>();
  private readonly started = new Set<string>();
  private readonly decoding = new Set<string>();
  private readonly ready: Array<{ key: string } & Decoded> = [];
  private readonly textures = new Map<string, WebGLTexture>();
  private waiters: Array<{ keys: string[]; resolve: () => void }> = [];
  private queue: string[] = [];
  /** Rooms allowed on the GPU; null keeps them all. */
  private wanted: Set<number> | null = null;
  private inFlight = 0;
  private readonly concurrency = 4;
  private destroyed = false;

  /** A plate reached the GPU. */
  onChange: (() => void) | null = null;

  constructor(
    private readonly renderer: RoomsRenderer,
    urls: string[][],
    /** The room fetched first: the one in view. */
    first = 0,
  ) {
    urls.forEach((stages, room) =>
      stages.forEach((url, stage) => {
        const key = `${room}:${stage}`;
        this.queue.push(key);
        this.urls.set(key, url);
      }),
    );
    this.prioritise(first);
    renderer.onRestored = () => this.refill();
    this.fetchMore();
  }

  /** Moves a room's plates to the front of the queue. */
  prioritise(room: number) {
    const mine = this.queue.filter((k) => roomOf(k) === room);
    this.queue = [...mine, ...this.queue.filter((k) => roomOf(k) !== room)];
  }

  /**
   * Holds only these rooms on the GPU. The others drop back to their
   * compressed bytes and are decoded again when they are wanted.
   */
  keepRooms(rooms: number[]) {
    this.wanted = new Set(rooms);
    for (const [key, tex] of this.textures) {
      if (this.isWanted(key)) continue;
      this.renderer.release(tex);
      this.textures.delete(key);
    }
    for (const [key, blob] of this.blobs) this.ensureDecoded(key, blob);
  }

  get(room: number, stage: number) {
    return this.textures.get(`${room}:${stage}`) ?? null;
  }

  /** The plate, or the closest stage of the same room already on the GPU. */
  nearest(room: number, stage: number) {
    for (let d = 0; d < 6; d++) {
      const lo = this.get(room, stage - d);
      if (lo) return lo;
      const hi = this.get(room, stage + d);
      if (hi) return hi;
    }
    return null;
  }

  /** Resolves once every listed stage of `room` is on the GPU. */
  whenStages(room: number, stages: number[]) {
    const keys = stages.map((s) => `${room}:${s}`);
    if (keys.every((k) => this.textures.has(k))) return Promise.resolve();
    if (this.wanted && !this.wanted.has(room)) this.keepRooms([...this.wanted, room]);
    this.prioritise(room);
    return new Promise<void>((resolve) => this.waiters.push({ keys, resolve }));
  }

  /** Call once a frame. Uploads at most one decoded plate; true if it did. */
  pump() {
    for (;;) {
      const item = this.ready.shift();
      if (!item || this.destroyed) return false;
      this.decoding.delete(item.key);
      // Scrolled on before it arrived: leave it as bytes.
      if (!this.isWanted(item.key) || this.textures.has(item.key)) {
        release(item);
        continue;
      }
      const tex = this.renderer.upload(item.source);
      release(item);
      if (!tex) return false;
      this.textures.set(item.key, tex);
      this.waiters = this.waiters.filter((w) => {
        if (!w.keys.every((k) => this.textures.has(k))) return true;
        w.resolve();
        return false;
      });
      this.onChange?.();
      return true;
    }
  }

  destroy() {
    this.destroyed = true;
    this.onChange = null;
    for (const item of this.ready) release(item);
    this.ready.length = 0;
    // The renderer may outlive the bank (a set of plates swapped for another).
    for (const tex of this.textures.values()) this.renderer.release(tex);
    this.textures.clear();
    for (const w of this.waiters) w.resolve();
    this.waiters = [];
  }

  private isWanted(key: string) {
    return !this.wanted || this.wanted.has(roomOf(key));
  }

  private fetchMore() {
    while (!this.destroyed && this.inFlight < this.concurrency) {
      const key = this.queue.find((k) => !this.started.has(k));
      if (!key) return;
      this.started.add(key);
      this.inFlight++;
      void this.load(key).finally(() => {
        this.inFlight--;
        this.fetchMore();
      });
    }
  }

  private async load(key: string) {
    try {
      let blob = this.blobs.get(key);
      if (!blob) {
        const res = await fetch(this.urls.get(key)!, { cache: "force-cache" });
        if (!res.ok) return;
        blob = await res.blob();
        this.blobs.set(key, blob);
      }
      this.ensureDecoded(key, blob);
    } catch {
      // A missing plate falls back to its nearest neighbour (see nearest()).
    }
  }

  private ensureDecoded(key: string, blob: Blob) {
    if (this.destroyed || !this.isWanted(key) || this.textures.has(key) || this.decoding.has(key)) return;
    this.decoding.add(key);
    decode(blob)
      .then((d) => {
        if (this.destroyed) release(d);
        else this.ready.push({ key, ...d });
      })
      .catch(() => this.decoding.delete(key));
  }

  /** After a lost context: decode every wanted plate again and re-upload it. */
  private refill() {
    this.textures.clear();
    this.decoding.clear();
    for (const item of this.ready) release(item);
    this.ready.length = 0;
    for (const [key, blob] of this.blobs) this.ensureDecoded(key, blob);
  }
}

const roomOf = (key: string) => Number(key.slice(0, key.indexOf(":")));

function release(d: Decoded) {
  if ("close" in d.source) d.source.close();
  if (d.url) URL.revokeObjectURL(d.url);
}

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      return { source: await createImageBitmap(blob) };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("plate failed to load"));
  });
  return { source: img, url };
}
