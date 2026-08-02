"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { gsap } from "@/lib/gsap";

/**
 * The Axtra Lounge Chair as real geometry.
 *
 * Two render paths share one material contract:
 *
 *  1. `AxtraChairGltf`  — a Blender export dropped at
 *     /media/customizer/models/axtra-chair.glb. Meshes (or their
 *     materials) whose name contains "wood"/"frame"/"shell" take the
 *     finish colour; "fabric"/"cushion"/"leather"/"seat" take the fabric
 *     colour. Nothing else about the export matters.
 *
 *  2. `AxtraChairProcedural` — a sculptural stand-in built here from swept
 *     ribbons and deformed cushions, so the page is genuinely 3D (real
 *     normals, real specular, real shadows) before that .glb exists.
 *
 * Both accept the same colours, so swapping one for the other changes
 * nothing upstream.
 */

export const CHAIR_GLB_URL = "/media/customizer/models/axtra-chair.glb";

/** Shown when no finish/fabric swatch has been picked yet. */
export const DEFAULT_WOOD = "#5E4230";
export const DEFAULT_FABRIC = "#6E7250";

const WOOD_KEYS = ["wood", "frame", "shell", "timber", "walnut", "oak", "leg"];
const FABRIC_KEYS = ["fabric", "cushion", "leather", "seat", "upholst", "pad"];

/* ================= material helpers ============================== */

function makeWoodMaterial(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.36,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.32,
    reflectivity: 0.4,
  });
}

function makeFabricMaterial(color: string) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.94,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.65,
  });
  // The velvet rim-light that reads as suede rather than plastic.
  m.sheenColor = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45);
  return m;
}

/** Tween a material to a new colour instead of snapping to it. */
function useColorTween(
  material: THREE.MeshPhysicalMaterial | null,
  color: string,
) {
  useEffect(() => {
    if (!material) return;
    const target = new THREE.Color(color);
    const tween = gsap.to(material.color, {
      r: target.r,
      g: target.g,
      b: target.b,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        material.needsUpdate = true;
      },
    });
    return () => {
      tween.kill();
    };
  }, [material, color]);
}

/* ================= procedural geometry =========================== */

/** Rounded-rectangle cross-section for the swept walnut ribbons. */
function ribbonProfile(w: number, h: number) {
  const r = Math.min(w, h) * 0.45;
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Sweep a profile along a smoothed 3D spline — one continuous ribbon. */
function sweep(
  points: readonly (readonly [number, number, number])[],
  width: number,
  thickness: number,
  steps = 150,
) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "catmullrom",
    0.4,
  );
  const geo = new THREE.ExtrudeGeometry(ribbonProfile(width, thickness), {
    steps,
    bevelEnabled: false,
    extrudePath: curve,
  });
  geo.computeVertexNormals();
  return geo;
}

/**
 * A cushion: a sphere pushed into an upholstered form.
 * `taper` pinches it toward the top (the backrest's teardrop);
 * `saddle` lifts the left/right edges (the seat's dish).
 */
function cushion({
  rx,
  ry,
  rz,
  taper = 0,
  saddle = 0,
}: {
  rx: number;
  ry: number;
  rz: number;
  taper?: number;
  saddle?: number;
}) {
  const geo = new THREE.SphereGeometry(1, 72, 52);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const up = v.y * 0.5 + 0.5; // 0 at the bottom, 1 at the top
    const pinch = 1 - taper * up * up;
    const x = v.x * rx * pinch;
    const z = v.z * rz * pinch;
    let y = v.y * ry;
    if (saddle && v.y > 0) {
      // Lift in units of `ry`, not of `v.y / ry` — the latter divides a
      // unit-sphere coordinate by a world radius, so at ry=0.105 it scaled
      // the rim up ~9.5x and speared a 2.18-unit spike through the chair.
      const across = x / rx;
      y += saddle * ry * v.y * across * across;
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* The two walnut ribbons. Together they read as one continuous sculpted
 * band: the first climbs the back and comes over the crown, the second
 * cradles the seat — they cross at the waist and each lands a foot on
 * the floor, which is what gives the piece its S-profile. */
const SHELL_PATH = [
  [-0.26, 0.02, 0.34],
  [-0.40, 0.20, 0.12],
  [-0.44, 0.46, -0.12],
  [-0.32, 0.74, -0.28],
  [-0.06, 0.90, -0.28],
  [0.18, 0.84, -0.18],
  [0.30, 0.62, -0.06],
  [0.36, 0.42, 0.10],
  [0.34, 0.30, 0.26],
  [0.14, 0.24, 0.34],
  [-0.06, 0.20, 0.28],
  [-0.10, 0.10, 0.04],
  [0.06, 0.03, -0.22],
] as const;

const CRADLE_PATH = [
  [0.30, 0.02, 0.30],
  [0.20, 0.18, 0.20],
  [0.02, 0.26, 0.24],
  [-0.22, 0.30, 0.18],
  [-0.36, 0.34, 0.00],
  [-0.38, 0.30, -0.18],
  [-0.26, 0.14, -0.30],
  [-0.14, 0.03, -0.34],
] as const;

export function AxtraChairProcedural({
  finishColor,
  fabricColor,
}: {
  finishColor: string;
  fabricColor: string;
}) {
  const wood = useMemo(() => makeWoodMaterial(finishColor), []); // eslint-disable-line react-hooks/exhaustive-deps
  const fabric = useMemo(() => makeFabricMaterial(fabricColor), []); // eslint-disable-line react-hooks/exhaustive-deps

  useColorTween(wood, finishColor);
  useColorTween(fabric, fabricColor);

  const shellGeo = useMemo(() => sweep(SHELL_PATH, 0.085, 0.05), []);
  const cradleGeo = useMemo(() => sweep(CRADLE_PATH, 0.075, 0.045), []);
  const backGeo = useMemo(
    () => cushion({ rx: 0.33, ry: 0.30, rz: 0.155, taper: 0.42 }),
    [],
  );
  const seatGeo = useMemo(
    () => cushion({ rx: 0.34, ry: 0.105, rz: 0.29, saddle: 0.55 }),
    [],
  );

  // Dispose the generated geometry when the scene unmounts — these are
  // built here rather than loaded, so nothing else will free them.
  useEffect(
    () => () => {
      [shellGeo, cradleGeo, backGeo, seatGeo].forEach((g) => g.dispose());
      wood.dispose();
      fabric.dispose();
    },
    [shellGeo, cradleGeo, backGeo, seatGeo, wood, fabric],
  );

  return (
    <group>
      <mesh geometry={shellGeo} material={wood} castShadow receiveShadow />
      <mesh geometry={cradleGeo} material={wood} castShadow receiveShadow />
      <mesh
        geometry={backGeo}
        material={fabric}
        position={[-0.02, 0.60, -0.15]}
        rotation={[-0.30, 0.10, 0.05]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={seatGeo}
        material={fabric}
        position={[0.01, 0.36, 0.13]}
        rotation={[-0.06, 0, 0.02]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

/* ================= .glb path ====================================== */

/**
 * Hue-split tinting, for models that bake wood and fabric into ONE
 * material.
 *
 * A Blender export can name its materials so the swatches bind by name
 * (see the models/README). A photogrammetry or image-to-3D export cannot:
 * it arrives as a single mesh with a single baked atlas. Measuring this
 * chair's atlas gives a cleanly bimodal hue histogram — walnut piles up at
 * 0-30 deg, olive velvet at 60-80 deg, and the 30-60 deg valley holds under
 * 6% of texels — so the split can be made per-fragment instead of
 * per-material.
 *
 * The remap runs after `map_fragment`, where `diffuseColor` is the decoded
 * base colour in LINEAR space, and keeps each texel's luminance so all the
 * baked shading, grain and velvet nap survive the recolour.
 */

/** Hue band, in degrees, that separates the two materials. */
const SPLIT_LO = 42;
const SPLIT_HI = 56;
/** Above this the texel is neither walnut nor olive — leave it alone. */
const SPLIT_MAX_LO = 140;
const SPLIT_MAX_HI = 170;
/** Mean linear luminance of each class in the baked atlas. Re-measure
 * whenever the model is replaced — these move with the bake. */
const WOOD_REF_LUM = 0.0458;
const FABRIC_REF_LUM = 0.0696;

/**
 * Mean colour of each class in the atlas, measured. These are what the
 * piece shows before any swatch is picked, so the untouched state keeps
 * the real chair's walnut and olive rather than inventing a look.
 */
const BAKE_WOOD = "#593323";
const BAKE_FABRIC = "#4B4D2F";

/** Object-space frequency of the procedural grain. Higher = finer. */
const GRAIN_SCALE = 1.0;

type TintUniforms = {
  uWood: { value: THREE.Color };
  uFabric: { value: THREE.Color };
  uGrain: { value: number };
};

/**
 * The bake is 5x softer than the source renders it came from (measured:
 * 5.19 vs 26.73 high-frequency energy), because the four input views top
 * out at 802px spread over ~24 UV islands. No amount of texture resolution
 * recovers detail that was never captured.
 *
 * So the atlas is demoted to a *material-ID mask* — it is still the only
 * thing that knows which fragment is walnut and which is velvet, and large
 * soft blobs mask perfectly well — while the actual surface is synthesised
 * procedurally. That is resolution-independent: it stays sharp at any zoom
 * and any camera distance, which no baked map can do.
 *
 * Projection is triplanar in object space, so the atlas's chopped-up UV
 * islands never touch the grain, and the grain stays locked to the piece
 * rather than swimming when the entrance tween turns it.
 */
const SURFACE_DECLS = /* glsl */ `
uniform vec3  uWood;
uniform vec3  uFabric;
uniform float uGrain;
varying vec3  vObjPos;
varying vec3  vObjNrm;
/* Own varyings rather than three's vNormal/vViewPosition: vNormal only
 * exists when FLAT_SHADED is undefined, and depending on that would make
 * the shader fail to compile on a model without normals. */
varying vec3  vSurfNrm;
varying vec3  vSurfView;
float gFabricMask;

float hf_hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float hf_noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hf_hash(i), hf_hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hf_hash(i + vec3(0.0, 1.0, 0.0)), hf_hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hf_hash(i + vec3(0.0, 0.0, 1.0)), hf_hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hf_hash(i + vec3(0.0, 1.0, 1.0)), hf_hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}

float hf_fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * hf_noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

/**
 * Fibres: high frequency across the run, low along it. That anisotropy is
 * what separates laminated bentwood from generic noise.
 *
 * ONE anisotropically-scaled 3D sample, not a triplanar blend of three 2D
 * ones. Triplanar gave each plane a different fibre axis, so on a swept
 * curved form — which is this entire chair — the direction rotated as the
 * blend weights shifted and threw concentric rings across the ribbons.
 * Stretching a single 3D field along Y keeps the fibre direction constant
 * everywhere, so there is nothing to band.
 */
float hf_grain(vec3 p) {
  float fibre = hf_fbm(vec3(p.x * 70.0, p.y * 5.0, p.z * 70.0));
  float band  = hf_fbm(vec3(p.x *  9.0, p.y * 1.1, p.z *  9.0));
  return mix(fibre, band, 0.4);
}
`;

const SURFACE_BODY = /* glsl */ `
{
  vec3  bake = diffuseColor.rgb;
  float mx   = max(bake.r, max(bake.g, bake.b));
  float mn   = min(bake.r, min(bake.g, bake.b));
  float d    = mx - mn;
  float lum  = dot(bake, vec3(0.2126, 0.7152, 0.0722));

  float hue = 0.0;
  if (d > 1e-5) {
    if      (mx == bake.r) hue = mod((bake.g - bake.b) / d, 6.0);
    else if (mx == bake.g) hue = (bake.b - bake.r) / d + 2.0;
    else                   hue = (bake.r - bake.g) / d + 4.0;
    hue *= 60.0;
  }

  // Near-greys carry no material identity: metal glides, shadow, seam AO.
  // Leaving them on the bake is what keeps the piece believable.
  float chroma = smoothstep(0.010, 0.030, d);
  float isFab  = smoothstep(${SPLIT_LO}.0, ${SPLIT_HI}.0, hue)
               * (1.0 - smoothstep(${SPLIT_MAX_LO}.0, ${SPLIT_MAX_HI}.0, hue));
  gFabricMask = isFab;

  // Keep a trace of the bake's crevice shading — that part is real, it
  // comes from the geometry — but only a trace. At 0.85 weight and a 2.2
  // ceiling the bake's own dirt specks came through as marks on the velvet,
  // and its bright texels multiplied the walnut up into orange. Half the
  // weight and a 1.5 ceiling keeps the depth without the artefacts.
  float shade = clamp(lum / mix(${WOOD_REF_LUM}, ${FABRIC_REF_LUM}, isFab), 0.0, 1.5);
  shade = mix(1.0, shade, 0.5);

  vec3 p = vObjPos * uGrain;

  // fbm clusters around 0.5, so raw output modulates by only about +/-18%
  // and reads as a faint wash. Pushing contrast about the mean is what
  // turns it into fibre you can actually see at product-shot size.
  float grain = hf_grain(p);
  grain = clamp((grain - 0.5) * 2.2 + 0.5, 0.0, 1.0);

  // Velvet nap is a sheen effect, not a pattern. At 30x frequency and 0.36
  // depth it stippled the cushions with visible dots; low and shallow is
  // what actually reads as cloth.
  float nap = hf_fbm(vObjPos * uGrain * 11.0);

  vec3 wood = uWood   * (0.66 + 0.68 * grain);
  vec3 fab  = uFabric * (0.94 + 0.12 * nap);

  // Velvet catches light at grazing angles. Kept gentle — pushed harder it
  // stops reading as nap and starts reading as wax.
  float rim = pow(1.0 - clamp(dot(normalize(vSurfNrm), normalize(vSurfView)), 0.0, 1.0), 2.4);
  fab += uFabric * rim * 0.26;

  // Ceiling on the combined gain so a bright bake texel plus a bright grain
  // peak cannot stack into a blown-out highlight.
  vec3 surface = min(mix(wood, fab, isFab) * shade, mix(uWood, uFabric, isFab) * 1.6);
  diffuseColor.rgb = mix(bake, surface, chroma);
}
`;

/* The bake's roughness/metalness maps are as soft as its colour, and a
 * stray metalness is what made the walnut read as wet clay. Drive both
 * from the mask instead: satin-lacquered wood, matte velvet, no metal. */
const SURFACE_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(0.34, 0.92, gFabricMask);
`;
const SURFACE_METALNESS = /* glsl */ `
metalnessFactor = 0.0;
`;

const SURFACE_VERTEX_DECLS = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vObjNrm;
varying vec3 vSurfNrm;
varying vec3 vSurfView;
`;
const SURFACE_VERTEX_BODY = /* glsl */ `
vObjPos = position;
vObjNrm = normal;
vSurfNrm = normalize(normalMatrix * normal);
vSurfView = -(modelViewMatrix * vec4(position, 1.0)).xyz;
`;

/** Give a material the procedural surface. Returns its live uniforms. */
function attachSurface(mat: THREE.MeshStandardMaterial): TintUniforms {
  const existing = mat.userData.tintUniforms as TintUniforms | undefined;
  if (existing) return existing;

  const uniforms: TintUniforms = {
    uWood: { value: new THREE.Color(BAKE_WOOD) },
    uFabric: { value: new THREE.Color(BAKE_FABRIC) },
    uGrain: { value: GRAIN_SCALE },
  };
  mat.userData.tintUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${SURFACE_VERTEX_DECLS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${SURFACE_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${SURFACE_DECLS}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${SURFACE_BODY}`)
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>\n${SURFACE_ROUGHNESS}`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>\n${SURFACE_METALNESS}`,
      );
  };
  mat.needsUpdate = true;
  return uniforms;
}

/** Tween the surface colour for one material class. */
function tintTo(
  uniforms: TintUniforms[],
  which: "wood" | "fabric",
  color: string | null,
) {
  // null = never picked, so fall back to the class's measured colour and
  // the piece keeps looking like itself.
  const target = new THREE.Color(color ?? (which === "wood" ? BAKE_WOOD : BAKE_FABRIC));
  const key = which === "wood" ? "uWood" : "uFabric";
  return uniforms.map((u) =>
    gsap.to(u[key].value, {
      r: target.r,
      g: target.g,
      b: target.b,
      duration: 0.55,
      ease: "power2.out",
    }),
  );
}

export function AxtraChairGltf({
  url,
  finishColor,
  fabricColor,
}: {
  url: string;
  /** null = leave that material at its original baked colour. */
  finishColor: string | null;
  fabricColor: string | null;
}) {
  const { scene } = useGLTF(url);
  const woodRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const fabricRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const tintRef = useRef<TintUniforms[]>([]);

  // Clone so two mounts never fight over one cached scene graph.
  const model = useMemo(() => scene.clone(true), [scene]);

  useMemo(() => {
    const wood: THREE.MeshStandardMaterial[] = [];
    const fabric: THREE.MeshStandardMaterial[] = [];
    const all: THREE.MeshStandardMaterial[] = [];

    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      const wasArray = Array.isArray(child.material);
      const mats = (wasArray ? child.material : [child.material]) as THREE.Material[];
      const cloned = mats.map((mat) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
        // Clone: useGLTF caches materials across mounts, and both the
        // name binding and the shader hook mutate them.
        const m = mat.clone();
        const tag = `${child.name} ${m.name}`.toLowerCase();
        if (FABRIC_KEYS.some((k) => tag.includes(k))) fabric.push(m);
        else if (WOOD_KEYS.some((k) => tag.includes(k))) wood.push(m);
        all.push(m);
        return m;
      });
      child.material = wasArray ? cloned : cloned[0];
    });

    woodRef.current = wood;
    fabricRef.current = fabric;
    // Nothing bound by name → single baked atlas, so demote it to a mask
    // and synthesise the surface instead.
    tintRef.current = wood.length || fabric.length ? [] : all.map(attachSurface);
  }, [model]);

  useEffect(() => {
    const tweens = [
      ...tintTo(tintRef.current, "wood", finishColor),
      ...woodRef.current.map((m) => {
        const t = new THREE.Color(finishColor ?? DEFAULT_WOOD);
        return gsap.to(m.color, { r: t.r, g: t.g, b: t.b, duration: 0.55, ease: "power2.out" });
      }),
    ];
    return () => tweens.forEach((t) => t.kill());
  }, [finishColor]);

  useEffect(() => {
    const tweens = [
      ...tintTo(tintRef.current, "fabric", fabricColor),
      ...fabricRef.current.map((m) => {
        const t = new THREE.Color(fabricColor ?? DEFAULT_FABRIC);
        return gsap.to(m.color, { r: t.r, g: t.g, b: t.b, duration: 0.55, ease: "power2.out" });
      }),
    ];
    return () => tweens.forEach((t) => t.kill());
  }, [fabricColor]);

  // Normalise whatever scale/origin the export came out with, so the
  // camera framing never has to be re-tuned per model.
  const fitted = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = size.y > 0 ? 0.92 / size.y : 1;
    return {
      scale,
      position: [
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      ] as [number, number, number],
    };
  }, [model]);

  return <primitive object={model} scale={fitted.scale} position={fitted.position} />;
}
