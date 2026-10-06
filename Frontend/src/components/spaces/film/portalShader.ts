/**
 * GLSL for the Spaces portal: the white box of frame 2, drawn open by an
 * ink line, then swelling into a pillow and bursting into the cloud bank
 * that clears onto Nimbus.
 *
 * Everything is computed in CSS pixels (y down) so the uniforms match the
 * DOM layout. Output is premultiplied alpha.
 *
 * Written as plain strings: keep backticks out of these sources entirely.
 */

export const PORTAL_VERT = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const PORTAL_FRAG = /* glsl */ `
precision highp float;

uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uInk;
uniform float uBulge;
uniform float uWobble;
uniform float uBurst;
uniform float uCloud;
uniform float uClear;
uniform float uShadow;
uniform vec2 uPointer;

const vec3 SKY_TOP = vec3(0.839216, 0.850980, 0.862745);
const vec3 SKY_FOOT = vec3(0.933333, 0.921569, 0.882353);
const vec3 INK = vec3(0.454902, 0.101961, 0.078431);
const vec3 UMBER = vec3(0.231, 0.165, 0.118);
const vec3 CLOUD_LIT = vec3(1.0, 1.0, 1.0);
const vec3 CLOUD_SHADE = vec3(0.788, 0.820, 0.847);

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += amp * vnoise(p);
    p = turn * p * 2.02 + vec2(11.7, 5.3);
    amp *= 0.5;
  }
  return v;
}

// The Nimbus page background: linear-gradient(178.738deg, #D6D9DC 23.108%,
// #EEEBE1 111.01%), evaluated exactly as CSS does so the hand-off is seamless.
vec3 sky(vec2 css, vec2 size) {
  const float SA = 0.0220248;
  const float CA = -0.9997574;
  vec2 dir = vec2(SA, -CA);
  float span = abs(size.x * SA) + abs(size.y * CA);
  float t = dot(css - 0.5 * size, dir) / span + 0.5;
  return mix(SKY_TOP, SKY_FOOT, clamp((t - 0.23108) / 0.87902, 0.0, 1.0));
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// The box as a membrane: under pressure its sides bow outward and its
// corners round off, like a cushion filling with air.
float membrane(vec2 p, vec2 h, float bulge) {
  vec2 k = clamp(p / max(h, vec2(1.0)), -1.0, 1.0);
  vec2 hb = h + bulge * vec2(h.x * 0.085 * (1.0 - k.y * k.y), h.y * 0.12 * (1.0 - k.x * k.x));
  float r = min(h.x, h.y) * 0.42 * smoothstep(0.0, 1.0, bulge);
  return sdRoundBox(p, hb, r);
}

void main() {
  vec2 size = uRes / uDpr;
  vec2 css = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 p = css - uCenter;
  float px = 1.0 / uDpr;
  float diag = length(size);
  float b = uBurst;

  // Tension: the swollen box trembles just before it gives way.
  float wob = uWobble * (0.6 * sin(uTime * 23.0) + 0.4 * sin(uTime * 37.0 + 1.7));
  vec2 h = uHalf * (1.0 + vec2(wob, -wob) * 0.02);
  float d = membrane(p, h, uBulge);

  // The burst: the field turns radial and races outward, its front broken
  // into billows.
  float dist = d;
  float feather = px;
  if (b > 0.0) {
    float reach = max(h.x, h.y * 1.25);
    float radial = length(p * vec2(1.0, 1.25)) - reach;
    float field = mix(d, radial, smoothstep(0.0, 0.3, b));
    float billow = fbm(p * 0.0042 + vec2(2.3, 7.1) + uTime * 0.03);
    float spread = smoothstep(0.0, 0.3, b);
    dist = field - diag * 0.95 * b + (billow - 0.5) * 0.44 * diag * spread;
    feather = mix(px, 0.05 * diag, smoothstep(0.0, 0.25, b));
  }
  float inside = 1.0 - smoothstep(-feather, feather, dist);

  // A soft umber shadow lifts the swelling cushion off the paper.
  float sd = membrane(p - vec2(0.0, 16.0 * uBulge), h, uBulge);
  float shadow = uShadow * 0.2 * exp(-max(sd, 0.0) / (20.0 + 30.0 * uBulge)) * (1.0 - smoothstep(0.0, 0.3, b));

  // The ink line that draws the window open (1.5px, one device px of AA).
  float ink = uInk * (1.0 - smoothstep(0.75 - 0.5 * px, 0.75 + 0.5 * px, abs(d)));

  if (b <= 0.0 && inside <= 0.0) {
    gl_FragColor = vec4(INK * ink + UMBER * shadow * (1.0 - ink), ink + shadow * (1.0 - ink));
    return;
  }

  vec3 base = sky(css, size);

  // Clouds: faint wisps drifting in the window, a dense bank in the burst,
  // then thinning from the centre outward (flying through them) as Nimbus
  // clears.
  vec2 c0 = css - 0.5 * size;
  vec2 q = (c0 / (1.0 + uClear * 2.4) + uPointer * 14.0) * 0.0034;
  q += vec2(uTime * 0.010, uTime * 0.004);
  float n1 = fbm(q);
  float n2 = fbm(q * 2.3 + vec2(5.2, 1.3) - uTime * 0.02);
  float cn = n1 * 0.72 + n2 * 0.28;
  float open = uClear * (1.0 + 0.9 * (1.0 - smoothstep(0.0, 0.6, length(c0 / size))));
  float lo = mix(0.64, -0.04, uCloud) + open * 0.8;
  float dens = smoothstep(lo, lo + 0.26, cn) * mix(0.55, 1.0, smoothstep(0.2, 0.6, uCloud + uClear));
  vec3 cloud = mix(CLOUD_SHADE, CLOUD_LIT, smoothstep(0.32, 0.78, n2 + 0.18));

  // Cushion light: a sheen near the upper left, a little shade to the foot.
  vec3 skyC = base;
  if (uBulge > 0.0) {
    vec2 nrm = p / max(h, vec2(1.0));
    float rest = 1.0 - smoothstep(0.0, 0.3, b);
    float sheen = exp(-pow(length(nrm - vec2(-0.45, -0.55)) / 0.6, 2.0));
    float rim = 1.0 - smoothstep(0.0, 0.1, clamp(-d / max(min(h.x, h.y), 1.0), 0.0, 1.0));
    skyC += uBulge * rest * (sheen * 0.09 + rim * 0.07);
    skyC -= uBulge * rest * 0.05 * smoothstep(0.2, 1.0, nrm.y);
    cloud += uBulge * rest * sheen * 0.05;
  }

  // The pop: a white flash through the bank as it breaks.
  float flash = smoothstep(0.0, 0.1, b) * (1.0 - smoothstep(0.1, 0.5, b));
  skyC = mix(skyC, vec3(1.0), flash * 0.55);
  cloud = mix(cloud, vec3(1.0), flash * 0.55);

  // Puffs thrown ahead of the front, and a faint shock ring.
  float spray = 0.0;
  float ring = 0.0;
  if (b > 0.0 && b < 1.0) {
    vec2 pp = p / (1.0 + 2.0 * b);
    float s = fbm(pp * 0.010 + vec2(9.1, 3.7));
    spray = smoothstep(0.56, 0.78, s) * exp(-max(dist, 0.0) / (0.12 * diag));
    spray *= smoothstep(0.02, 0.2, b) * (1.0 - smoothstep(0.7, 1.0, b));
    float rr = length(p) - (max(h.x, h.y) + diag * 1.7 * b);
    ring = exp(-rr * rr / (40.0 + 2400.0 * b)) * smoothstep(0.0, 0.06, b) * (1.0 - smoothstep(0.3, 0.55, b)) * 0.35;
  }

  // Composite, premultiplied: shadow, puffs and ring under the world inside
  // the front, the ink line over everything.
  float skyA = 1.0 - smoothstep(0.0, 0.3, uClear);
  float worldA = inside * (dens + (1.0 - dens) * skyA);
  vec3 worldC = inside * (cloud * dens + (1.0 - dens) * skyC * skyA);

  vec3 under = UMBER * shadow;
  float underA = shadow;
  under = cloud * spray + under * (1.0 - spray);
  underA = spray + underA * (1.0 - spray);
  under = vec3(ring) + under * (1.0 - ring);
  underA = ring + underA * (1.0 - ring);

  vec3 col = worldC + under * (1.0 - worldA);
  float alpha = worldA + underA * (1.0 - worldA);
  col = INK * ink + col * (1.0 - ink);
  alpha = ink + alpha * (1.0 - ink);

  // Dither against banding in the long, pale gradients.
  float dn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  col += dn / 255.0 * alpha;

  gl_FragColor = vec4(col, alpha);
}
`;
