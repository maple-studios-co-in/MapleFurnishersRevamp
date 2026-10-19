/**
 * Tileable 256² RGBA noise for the Nimbus cloud shader, generated once in
 * the browser (tens of milliseconds) instead of shipped as an image.
 *
 *  R, G, B  gradient-noise fBm from base periods of 4, 8 and 16 cells
 *  A        inverted cellular noise: the round, billowing bodies of cloud
 *
 * Every channel wraps at its edges, so the shader samples it at any scale
 * with REPEAT and mipmaps and never shows a seam.
 */

export const NOISE_SIZE = 256;

let cached: Uint8Array | null = null;

export function cloudNoise(): Uint8Array {
  if (cached) return cached;
  const N = NOISE_SIZE;
  const r = fbm(N, 4, 4, 11);
  const g = fbm(N, 8, 4, 23);
  const b = fbm(N, 16, 3, 37);
  const a = cells(N, [5, 11], 53);
  const out = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    out[i * 4] = r[i];
    out[i * 4 + 1] = g[i];
    out[i * 4 + 2] = b[i];
    out[i * 4 + 3] = a[i];
  }
  cached = out;
  return out;
}

/** mulberry32: small, fast, seedable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Periodic gradient noise summed over `octaves` doublings of `period`. */
function fbm(N: number, period: number, octaves: number, seed: number) {
  const rand = rng(seed);
  const acc = new Float32Array(N * N);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const P = period << o;
    const gx = new Float32Array(P * P);
    const gy = new Float32Array(P * P);
    for (let i = 0; i < P * P; i++) {
      const angle = rand() * Math.PI * 2;
      gx[i] = Math.cos(angle);
      gy[i] = Math.sin(angle);
    }
    for (let y = 0; y < N; y++) {
      const fy = (y / N) * P;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const y1 = (y0 + 1) % P;
      const sy = fade(ty);
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * P;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const x1 = (x0 + 1) % P;
        const sx = fade(tx);
        const d00 = gx[y0 * P + x0] * tx + gy[y0 * P + x0] * ty;
        const d10 = gx[y0 * P + x1] * (tx - 1) + gy[y0 * P + x1] * ty;
        const d01 = gx[y1 * P + x0] * tx + gy[y1 * P + x0] * (ty - 1);
        const d11 = gx[y1 * P + x1] * (tx - 1) + gy[y1 * P + x1] * (ty - 1);
        const top = d00 + (d10 - d00) * sx;
        const bottom = d01 + (d11 - d01) * sx;
        acc[y * N + x] += (top + (bottom - top) * sy) * amp;
      }
    }
    amp *= 0.5;
  }
  return normalise(acc);
}

/** Periodic cellular noise, inverted so each cell is a soft rounded mound. */
function cells(N: number, counts: number[], seed: number) {
  const rand = rng(seed);
  const acc = new Float32Array(N * N);
  counts.forEach((C, layer) => {
    const weight = layer === 0 ? 0.68 : 0.32;
    const px = new Float32Array(C * C);
    const py = new Float32Array(C * C);
    for (let i = 0; i < C * C; i++) {
      px[i] = rand();
      py[i] = rand();
    }
    for (let y = 0; y < N; y++) {
      const fy = (y / N) * C;
      const cy = Math.floor(fy);
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * C;
        const cx = Math.floor(fx);
        let best = 9;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const ix = (cx + i + C) % C;
            const iy = (cy + j + C) % C;
            const dx = cx + i + px[iy * C + ix] - fx;
            const dy = cy + j + py[iy * C + ix] - fy;
            const d = dx * dx + dy * dy;
            if (d < best) best = d;
          }
        }
        const v = 1 - Math.min(1, Math.sqrt(best));
        acc[y * N + x] += weight * v * v * (3 - 2 * v);
      }
    }
  });
  return normalise(acc);
}

/** Stretches a channel over the full 0–255 range, so shader thresholds read predictably. */
function normalise(v: Float32Array) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < v.length; i++) {
    if (v[i] < lo) lo = v[i];
    if (v[i] > hi) hi = v[i];
  }
  const k = 255 / (hi - lo || 1);
  const out = new Uint8Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = Math.round((v[i] - lo) * k);
  return out;
}
