/**
 * Terra's foliage: one tileable sheet of leaves, drawn once in 2D and used
 * as a texture (renderer.ts) for the sheets the camera flies through between
 * rooms (shader.ts, FOLIAGE). The planting of the Terra gardens: olive
 * sprays with their silver undersides, broad bay leaves, fern fronds.
 *
 * Every leaf is lit from the same sun (upper left), so its lit half faces
 * it; sprays drawn first sit deeper in the bush, darker. The sheet repeats
 * seamlessly (each spray is drawn again across any edge it crosses) and is
 * mipmapped, so the shader can sample near sheets soft, out of focus.
 */

export const LEAVES_SIZE = 1024;

type Rgb = readonly [number, number, number];

interface Species {
  /** Leaf length and width, px on the sheet. */
  leafLen: readonly [number, number];
  leafWid: readonly [number, number];
  /** Arc length between leaves along the twig. */
  spacing: readonly [number, number];
  /** Twig length. */
  length: readonly [number, number];
  /** Leaf angle off the twig, radians. */
  spread: readonly [number, number];
  tones: readonly Rgb[];
  /** The underside some leaves turn up (olive's silver). */
  under: Rgb | null;
  twig: Rgb;
  /** Leaves on both sides at each node (a fern's pinnae), not alternating. */
  opposite?: boolean;
}

const OLIVE: Species = {
  leafLen: [44, 76],
  leafWid: [7, 12],
  spacing: [13, 19],
  length: [180, 380],
  spread: [0.42, 0.82],
  tones: [
    [86, 100, 62],
    [104, 117, 76],
    [122, 133, 90],
    [74, 90, 56],
  ],
  under: [160, 166, 140],
  twig: [96, 84, 66],
};

const BAY: Species = {
  leafLen: [68, 112],
  leafWid: [22, 34],
  spacing: [24, 36],
  length: [140, 270],
  spread: [0.5, 0.95],
  tones: [
    [46, 68, 36],
    [58, 82, 42],
    [72, 96, 50],
    [92, 110, 58],
  ],
  under: null,
  twig: [74, 64, 48],
};

const FERN: Species = {
  leafLen: [40, 62],
  leafWid: [6, 9],
  spacing: [8, 11],
  length: [260, 470],
  spread: [1.05, 1.3],
  tones: [
    [66, 98, 48],
    [82, 114, 56],
    [98, 126, 62],
  ],
  under: null,
  twig: [84, 104, 56],
  opposite: true,
};

/** Seeded, so every visitor walks through the same garden. */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const css = (c: Rgb, k = 1) =>
  `rgb(${Math.min(255, c[0] * k) | 0} ${Math.min(255, c[1] * k) | 0} ${Math.min(255, c[2] * k) | 0})`;

interface Leaf {
  x: number;
  y: number;
  angle: number;
  len: number;
  wid: number;
  bend: number;
  tone: Rgb;
  /** Brightness: depth in the bush times the leaf's own variation. */
  k: number;
}

interface Spray {
  /** The twig as a polyline, base to tip. */
  twig: Array<[number, number]>;
  twigTone: Rgb;
  twigWidth: number;
  leaves: Leaf[];
  k: number;
  /** Bounds, for drawing again across the sheet's edges. */
  box: [number, number, number, number];
}

/** The sun, from the upper left (canvas y points down). */
const SUN: readonly [number, number] = [-0.6, -0.8];

function makeSpray(rand: () => number, species: Species, k: number): Spray {
  const r = (range: readonly [number, number]) => range[0] + rand() * (range[1] - range[0]);
  const S = LEAVES_SIZE;
  const x0 = rand() * S;
  const y0 = rand() * S;
  const heading = rand() * Math.PI * 2;
  const length = r(species.length);
  const bend = (rand() - 0.5) * 0.9;
  // A quadratic twig, bowed to one side.
  const x2 = x0 + Math.cos(heading) * length;
  const y2 = y0 + Math.sin(heading) * length;
  const mx = (x0 + x2) / 2 - Math.sin(heading) * length * bend * 0.5;
  const my = (y0 + y2) / 2 + Math.cos(heading) * length * bend * 0.5;
  const at = (t: number): [number, number] => [
    (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x2,
    (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y2,
  ];
  const tangent = (t: number) => {
    const dx = 2 * (1 - t) * (mx - x0) + 2 * t * (x2 - mx);
    const dy = 2 * (1 - t) * (my - y0) + 2 * t * (y2 - my);
    return Math.atan2(dy, dx);
  };

  const twig: Array<[number, number]> = [];
  for (let i = 0; i <= 24; i++) twig.push(at(i / 24));

  const leaves: Leaf[] = [];
  const tone = () => species.tones[Math.floor(rand() * species.tones.length)];
  const leaf = (t: number, side: number, scale: number, forward = 0) => {
    const [x, y] = at(t);
    const off = r(species.spread) * side;
    const turnUp = species.under && rand() < 0.3;
    leaves.push({
      x,
      y,
      angle: tangent(t) + off - forward * side,
      len: r(species.leafLen) * scale,
      wid: r(species.leafWid) * Math.max(0.6, scale),
      bend: (rand() - 0.5) * 1.2,
      tone: turnUp && species.under ? species.under : tone(),
      k: k * (0.86 + rand() * 0.26),
    });
  };

  // Leaves along the twig, smaller toward its tip; a fern's pinnae taper at
  // both ends.
  let side = rand() < 0.5 ? 1 : -1;
  let s = r(species.spacing) * 0.6;
  while (s < length * 0.96) {
    const t = s / length;
    const scale = species.opposite ? Math.sin(Math.PI * Math.pow(t, 0.75)) * 0.85 + 0.15 : 1 - t * 0.35;
    if (species.opposite) {
      leaf(t, 1, scale, 0.25);
      leaf(t, -1, scale, 0.25);
    } else {
      leaf(t, side, scale);
      side = -side;
    }
    s += r(species.spacing);
  }
  // The tip: a leaf straight on (or a bay's closing whorl).
  if (!species.opposite) {
    const tip = tangent(1);
    const [x, y] = at(1);
    const n = species === BAY ? 3 : 1;
    for (let i = 0; i < n; i++) {
      leaves.push({
        x,
        y,
        angle: tip + (i - (n - 1) / 2) * 0.55,
        len: r(species.leafLen) * 0.85,
        wid: r(species.leafWid) * 0.85,
        bend: (rand() - 0.5) * 1.2,
        tone: tone(),
        k: k * (0.9 + rand() * 0.2),
      });
    }
  }

  const reach = species.leafLen[1] + 4;
  const xs = twig.map((p) => p[0]);
  const ys = twig.map((p) => p[1]);
  return {
    twig,
    twigTone: species.twig,
    twigWidth: species === FERN ? 1.6 : species === BAY ? 2.6 : 2.0,
    leaves,
    k,
    box: [Math.min(...xs) - reach, Math.min(...ys) - reach, Math.max(...xs) + reach, Math.max(...ys) + reach],
  };
}

function drawLeaf(g: CanvasRenderingContext2D, l: Leaf) {
  const { len, wid } = l;
  g.save();
  g.translate(l.x, l.y);
  g.rotate(l.angle);
  const tipY = l.bend * len * 0.1;
  const p = new Path2D();
  p.moveTo(0, 0);
  p.bezierCurveTo(len * 0.18, -wid * 0.62, len * 0.6, -wid * 0.5 + tipY * 0.5, len, tipY);
  p.bezierCurveTo(len * 0.6, wid * 0.5 + tipY * 0.5, len * 0.18, wid * 0.62, 0, 0);
  // The half facing the sun is lit, the other in its own shade, with the
  // fold of the midrib between them.
  const facing = -Math.sin(l.angle) * SUN[0] + Math.cos(l.angle) * SUN[1];
  const litSide = facing > 0 ? 1 : -1;
  const grad = g.createLinearGradient(0, (-litSide * wid) / 2, 0, (litSide * wid) / 2);
  grad.addColorStop(0, css(l.tone, l.k * 0.7));
  grad.addColorStop(0.46, css(l.tone, l.k * 0.92));
  grad.addColorStop(0.54, css(l.tone, l.k * 1.12));
  grad.addColorStop(1, css(l.tone, l.k * 1.28));
  g.fillStyle = grad;
  g.fill(p);
  // The midrib, a pale line most of the way to the tip.
  g.strokeStyle = css(l.tone, l.k * 1.45);
  g.globalAlpha = 0.55;
  g.lineWidth = Math.max(0.6, wid * 0.07);
  g.beginPath();
  g.moveTo(len * 0.03, 0);
  g.quadraticCurveTo(len * 0.5, tipY * 0.3, len * 0.9, tipY * 0.85);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

function drawSpray(g: CanvasRenderingContext2D, s: Spray) {
  const n = s.twig.length - 1;
  g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    g.strokeStyle = css(s.twigTone, s.k);
    g.lineWidth = s.twigWidth * (1 - (i / n) * 0.65);
    g.beginPath();
    g.moveTo(s.twig[i][0], s.twig[i][1]);
    g.lineTo(s.twig[i + 1][0], s.twig[i + 1][1]);
    g.stroke();
  }
  for (const l of s.leaves) drawLeaf(g, l);
}

let sheet: HTMLCanvasElement | null = null;

/** The foliage sheet (straight alpha; upload it premultiplied). Drawn on first use. */
export function leafSheet(): HTMLCanvasElement {
  if (sheet) return sheet;
  const S = LEAVES_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  const rand = mulberry32(20261022);
  const plan: Species[] = [
    ...Array<Species>(42).fill(OLIVE),
    ...Array<Species>(16).fill(BAY),
    ...Array<Species>(9).fill(FERN),
  ];
  // Shuffle, then draw deepest (darkest) first.
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  plan.forEach((species, i) => {
    const spray = makeSpray(rand, species, 0.7 + 0.32 * (i / (plan.length - 1)));
    const [x0, y0, x1, y1] = spray.box;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        if (x1 + dx < 0 || x0 + dx > S || y1 + dy < 0 || y0 + dy > S) continue;
        g.save();
        g.translate(dx, dy);
        drawSpray(g, spray);
        g.restore();
      }
    }
  });
  sheet = canvas;
  return canvas;
}
