/**
 * GLSL for the Nimbus rooms: one full-screen pass that draws
 *
 *  - the room: two neighbouring stage plates, the newer one condensing out
 *    of mist over the older (a noise-shaped dissolve with a soft glow at its
 *    edge, fixed to the plate so it travels with the furniture);
 *  - the camera: a cover-fit view of the plate that can push in, look
 *    toward a point, magnify its edges as it moves forward (near walls and
 *    floor rush past faster than the far window) and smear radially at
 *    speed;
 *  - the cloud: five sheets at depth that the camera flies through, each
 *    sheet growing as it nears and fading as it passes, lit from the upper
 *    left in the plates' own palette (white tops, lavender shade, peach
 *    edges); they stream out from a point (a window, a ring), and part from
 *    the middle of the screen when they clear;
 *  - the finale: a pearl sky over a sea of cloud that drifts toward you;
 *  - the whiteout: the flat colour of the cloud veil (veil.ts), so a page
 *    change hidden inside the cloud is seamless.
 *
 * Coordinates: uv is 0–1 with y down, so plates upload unflipped. Output is
 * premultiplied; with uBase 0 the canvas is transparent and only cloud and
 * whiteout draw (the Spaces "Click to Enter" burst).
 *
 * Written as plain strings: keep backticks out of these sources entirely.
 */

export const NIMBUS_VERT = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const NIMBUS_FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;
uniform float uPlateAspect;

// 0 transparent, 1 the room plates, 2 the finale sky
uniform float uBase;
uniform sampler2D uPlateA;
uniform sampler2D uPlateB;
uniform float uMix;
// scale, look-at x, look-at y (plate uv), forward edge magnification
uniform vec4 uCam;
uniform float uStreak;

uniform sampler2D uNoise;
uniform float uCloud;
uniform float uSpread;
uniform float uClear;
uniform float uTravel;
uniform vec2 uCloudAt;

uniform float uWhite;
uniform float uSkyDrift;
uniform float uGrade;

const vec3 WHITEOUT = vec3(0.960784, 0.945098, 0.917647);
const vec3 C_LIT = vec3(1.0, 0.988235, 0.972549);
const vec3 C_SHADE = vec3(0.768627, 0.788235, 0.847059);
const vec3 C_WARM = vec3(0.992157, 0.894118, 0.819608);
const vec3 SKY_TOP = vec3(0.776471, 0.819608, 0.866667);
const vec3 SKY_LOW = vec3(0.937255, 0.92549, 0.886275);
const vec3 HAZE = vec3(0.972549, 0.964706, 0.952941);
const vec3 MIST = vec3(0.986, 0.976, 0.963);

// Screen uv to plate uv through the camera. The look-at point is clamped so
// the view never leaves the plate; the edge magnification only ever samples
// inward, so it can't either.
vec2 plateUV(vec2 uv, float aspect) {
  vec2 vis = aspect > uPlateAspect ? vec2(1.0, uPlateAspect / aspect) : vec2(aspect / uPlateAspect, 1.0);
  vec2 p = uv - 0.5;
  vec2 q = p * vec2(aspect, 1.0);
  float r2 = dot(q, q) / (0.25 * (aspect * aspect + 1.0));
  float s = uCam.x * (1.0 + uCam.w * r2);
  vec2 halfVis = vis / (2.0 * uCam.x);
  vec2 c = clamp(uCam.yz, halfVis, 1.0 - halfVis);
  return c + p * vis / s;
}

vec3 plates(vec2 puv) {
  vec3 a = texture2D(uPlateA, puv).rgb;
  if (uMix <= 0.0005) return a;
  vec3 b = texture2D(uPlateB, puv).rgb;
  if (uMix >= 0.9995) return b;
  // Where the new piece will stand, softened over ~2% of the plate so the
  // mist gathers around it instead of tracing its outline. (Plates of one
  // room differ only where furniture arrives.)
  vec2 o = vec2(0.016, 0.016 * uPlateAspect);
  float diff = length(b - a);
  diff += length(texture2D(uPlateB, puv + vec2(o.x, 0.0)).rgb - texture2D(uPlateA, puv + vec2(o.x, 0.0)).rgb);
  diff += length(texture2D(uPlateB, puv - vec2(o.x, 0.0)).rgb - texture2D(uPlateA, puv - vec2(o.x, 0.0)).rgb);
  diff += length(texture2D(uPlateB, puv + vec2(0.0, o.y)).rgb - texture2D(uPlateA, puv + vec2(0.0, o.y)).rgb);
  diff += length(texture2D(uPlateB, puv - vec2(0.0, o.y)).rgb - texture2D(uPlateA, puv - vec2(0.0, o.y)).rgb);
  float region = smoothstep(0.03, 0.16, diff * 0.2);
  // The form resolves through soft, large wisps rather than grain.
  vec2 np = puv * vec2(uPlateAspect, 1.0);
  float n = texture2D(uNoise, np * 0.8).r * 0.55 + texture2D(uNoise, np * 1.9 + 0.37).a * 0.3
          + texture2D(uNoise, np * 4.0 + 0.71).b * 0.15;
  float e = uMix * uMix * (3.0 - 2.0 * uMix);
  float m = smoothstep(n - 0.32, n + 0.32, e * 1.64 - 0.32);
  vec3 c = mix(a, b, m);
  // Mist rises where the piece will stand, the piece condenses inside it,
  // and the mist lifts off it.
  float rise = pow(max(0.0, sin(3.14159265 * clamp(uMix * 1.05, 0.0, 1.0))), 1.3);
  float wisp = texture2D(uNoise, np * 1.4 + vec2(uTime * 0.012, -uTime * 0.006)).a;
  return mix(c, MIST, region * rise * (0.38 + 0.32 * wisp));
}

// Cumulus: round puffs carrying smaller puffs (cellular noise at three
// scales), the cauliflower structure of real cloud.
float puffs(vec2 p) {
  return texture2D(uNoise, p * 0.55).a * 0.56 + texture2D(uNoise, p * 1.21 + 0.31).a * 0.29
       + texture2D(uNoise, p * 2.63 + 0.67).a * 0.15;
}

// The finale: a pearl sky over a floor of cloud receding to a warm horizon,
// drifting slowly toward the viewer. Between the billows the floor falls
// into lavender shade, never through to sky.
vec3 sky(vec2 uv, float aspect) {
  float horizon = 0.62;
  vec3 col = mix(SKY_TOP, SKY_LOW, smoothstep(-0.05, horizon, uv.y));
  col = mix(col, C_WARM, 0.3 * exp(-pow((uv.y - horizon) / 0.09, 2.0)));
  float dy = uv.y - horizon;
  if (dy > -0.015) {
    float d = max(dy, 0.003);
    float depth = 0.14 / d;
    vec2 p = vec2((uv.x - 0.5) * aspect * depth, depth - uSkyDrift) * 0.42;
    vec2 sp = p + (texture2D(uNoise, p * 0.35).gb - 0.5) * 0.2;
    float body = puffs(sp * 0.9);
    float bodyL = puffs((sp + vec2(0.0, 0.07)) * 0.9);
    float sea = smoothstep(0.26, 0.6, body);
    float lit = smoothstep(0.05, 0.95, 0.58 + (body - bodyL) * 2.6);
    vec3 cloud = mix(C_SHADE * 0.94, mix(C_SHADE, C_LIT, lit), sea);
    cloud = mix(cloud, C_WARM, 0.3 * (1.0 - smoothstep(0.0, 0.1, d)));
    // Distance haze folds the floor into the horizon glow.
    float near = smoothstep(0.0, 0.09, d);
    col = mix(col, cloud, near * smoothstep(-0.015, 0.01, dy));
    col = mix(col, mix(SKY_LOW, C_WARM, 0.35), (1.0 - near) * 0.6 * smoothstep(-0.015, 0.01, dy));
  }
  return col;
}

vec3 scene(vec2 uv, float aspect) {
  if (uBase > 1.5) return sky(uv, aspect);
  if (uStreak < 0.002) return plates(plateUV(uv, aspect));
  vec2 dir = (uv - uCloudAt) * uStreak * 0.045;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    acc += plates(plateUV(uv - dir * (float(i) / 5.0), aspect));
  }
  return acc / 6.0;
}

// Where the cloud reaches (spread) and where it has opened (clear), without
// the billow noise: drives the haze inside the bank.
float bank(vec2 uv, float aspect) {
  float rad = length((uv - uCloudAt) * vec2(aspect, 1.0));
  float reach = 1.0 - smoothstep(uSpread * 0.55, uSpread, rad);
  float open = smoothstep(-0.2, 0.2, uClear * 1.7 - rad);
  return reach * (1.0 - open);
}

// Five sheets of cloud at depth. A sheet's world position is the screen
// offset times its distance, so a sheet magnifies as it nears: far sheets
// are fields of small puffs, the nearest a few vast soft billows sweeping
// past the edges of the screen.
vec4 layers(vec2 uv, float aspect) {
  vec2 c = (uv - uCloudAt) * vec2(aspect, 1.0);
  float rad = length(c);
  float t = uTravel * 5.0;
  float base = floor(t);
  float ph = t - base;
  float th = mix(0.72, 0.3, uCloud);
  vec2 drift = vec2(uTime * 0.006, uTime * 0.0025);
  vec4 acc = vec4(0.0);
  // Far to near, each sheet laid over the ones behind it.
  for (int i = 0; i < 5; i++) {
    float k = 4.0 - float(i);
    float z = (k + 1.0 - ph) / 5.0;
    float id = base + k;
    float depth = mix(0.22, 2.6, z);
    float ang = id * 2.39996;
    float ca = cos(ang);
    float sa = sin(ang);
    vec2 pp = mat2(ca, sa, -sa, ca) * c * depth * 0.85 + vec2(fract(id * 0.618034), fract(id * 0.381966)) * 7.0;
    // A light warp only roughens the edges; more and the bank swirls like marble.
    vec2 sp = pp + (texture2D(uNoise, pp * 0.5 + drift).gb - 0.5) * 0.18;
    float body = puffs(sp);
    float n = body - (texture2D(uNoise, sp * 2.7 + 0.67).r - 0.5) * 0.14;
    float reach = 1.0 - smoothstep(uSpread * 0.6, uSpread, rad + (n - 0.5) * 0.4);
    float open = smoothstep(-0.14, 0.14, uClear * 1.7 - rad - (n - 0.5) * 0.5);
    float d = smoothstep(th, th + 0.38, n) * reach * (1.0 - open);
    float a = d * smoothstep(0.0, 0.25, z) * (1.0 - smoothstep(0.7, 1.0, z)) * 0.9;
    if (a > 0.002) {
      // Top-lit from the upper left: compare the body a little toward the sun.
      float lit = smoothstep(0.05, 0.95, 0.6 + (body - puffs(sp + vec2(-0.025, -0.045) * depth * 0.85)) * 2.4);
      vec3 col = mix(C_SHADE, C_LIT, lit);
      // Creases between the puffs sit in soft shade; thin edges glow warm.
      col *= mix(0.94, 1.0, smoothstep(th, th + 0.45, n));
      col = mix(col, C_WARM, (1.0 - d) * 0.3 * lit);
      acc = vec4(col * a, a) + acc * (1.0 - a);
    }
  }
  return acc;
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  float aspect = uRes.x / uRes.y;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (uBase > 0.5) {
    col = scene(uv, aspect);
    alpha = 1.0;
    float vig = 1.0 - smoothstep(0.32, 0.95, length((uv - 0.5) * vec2(1.0, 0.92)) * 1.15);
    col *= mix(1.0, 0.88 + 0.12 * vig, uGrade);
  }

  if (uCloud > 0.001 && uSpread > 0.001) {
    // Inside the bank the world goes soft and white before the sheets pass.
    float hz = bank(uv, aspect) * uCloud * uCloud * 0.62;
    col = col * (1.0 - hz) + HAZE * hz;
    alpha = alpha * (1.0 - hz) + hz;
    vec4 cl = layers(uv, aspect);
    col = cl.rgb + col * (1.0 - cl.a);
    alpha = cl.a + alpha * (1.0 - cl.a);
  }

  col = mix(col, WHITEOUT, uWhite);
  alpha = mix(alpha, 1.0, uWhite);

  // Dither against banding in the long pale gradients (none in the whiteout).
  float g = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col += (g - 0.5) / 255.0 * alpha * (1.0 - uWhite);

  gl_FragColor = vec4(col, alpha);
}
`;
