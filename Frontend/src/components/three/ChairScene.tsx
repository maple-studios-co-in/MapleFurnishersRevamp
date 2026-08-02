"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import {
  AxtraChairGltf,
  AxtraChairProcedural,
  CHAIR_GLB_URL,
  DEFAULT_FABRIC,
  DEFAULT_WOOD,
} from "./AxtraChair";

/**
 * The customizer's 3D stage — a real WebGL scene, not a flat image.
 *
 * The chair is lit by an in-scene studio environment (built from
 * Lightformers, so nothing is fetched from a CDN), grounded by a real
 * projected contact shadow, and orbitable by dragging. Picking one of the
 * panel's four views flies the camera there on a GSAP tween rather than
 * cutting, and the finish/fabric swatches drive actual PBR material
 * colours on the mesh.
 */

/**
 * The panel's reference renders were all shot from the chair's LEFT, and
 * the camera stations have to sit on that same side or the piece turns the
 * wrong way against its own thumbnail.
 *
 * Derivation: for a camera at azimuth t, screen-right in world space is
 * (cos t, 0, -sin t). The model faces +Z, so its forward direction projects
 * onto screen-right as -sin(t). In every thumbnail the chair's forward
 * points screen-right, so -sin(t) > 0, so t must be NEGATIVE.
 *
 * Front and back are unaffected — sin(0) and sin(PI) are both 0, which is
 * why only the three-quarter and side views looked mirrored.
 */
const VIEW_SIDE = -1;

/** The four panel views, as camera positions on the orbit sphere. */
const VIEWS = [
  { azimuth: VIEW_SIDE * 0.62, polar: 1.27 }, // three-quarter
  { azimuth: VIEW_SIDE * (Math.PI / 2), polar: 1.31 }, // side
  { azimuth: 0, polar: 1.29 }, // front
  { azimuth: Math.PI, polar: 1.29 }, // back
] as const;

/* ---- how large the piece reads -----------------------------------
 *
 * Scaling the model and pulling the camera back cancel each other out, so
 * apparent size is set by ONE number: how much of the stage's height the
 * chair fills. The camera distance falls out of it.
 *
 * At 0.491 the piece occupies just under half the stage height, sitting
 * clearly within the room rather than filling it. Against the full-bleed
 * stage in CustomizerHero that is ~1.24x the on-screen height it had
 * originally.
 *
 * TUNING: this is the dial, and the only one. 1.0 = exactly frame height;
 * above 1.0 the piece starts bleeding past the bottom edge. Nothing else
 * needs to change — the camera distance is derived from it. */
/* Matches CustomizerHero's STAGE_FILL, so the piece is the same size on
 * screen whichever stage is active — swapping between them should not
 * resize the chair. */
const FRAME_FILL = 0.495;
/** The height AxtraChairGltf normalises every model to. Keep in sync. */
const MODEL_HEIGHT = 0.92;
const FOV = 38;

/** Distance that makes a MODEL_HEIGHT-tall piece fill FRAME_FILL of frame. */
const RADIUS =
  MODEL_HEIGHT / (2 * FRAME_FILL * Math.tan((FOV * Math.PI) / 180 / 2));

/* Aiming slightly above the piece's own centre seats it a touch low in
 * frame, which leaves headroom over the backrest and keeps the base near
 * the floor line rather than floating mid-shot. */
const ORBIT_TARGET: [number, number, number] = [0, 0.1, 0];

/** Structural view of the bits of OrbitControls this rig drives. */
type OrbitLike = {
  getAzimuthalAngle: () => number;
  getPolarAngle: () => number;
  setAzimuthalAngle: (v: number) => void;
  setPolarAngle: (v: number) => void;
  update: () => void;
};

/** Signed shortest way round the circle from `from` to `to`. */
function shortestDelta(from: number, to: number) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function CameraRig({ view }: { view: number }) {
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const first = useRef(true);

  useEffect(() => {
    if (!controls) return;
    const target = VIEWS[view] ?? VIEWS[0];

    if (first.current) {
      first.current = false;
      controls.setAzimuthalAngle(target.azimuth);
      controls.setPolarAngle(target.polar);
      controls.update();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      controls.setAzimuthalAngle(target.azimuth);
      controls.setPolarAngle(target.polar);
      controls.update();
      return;
    }

    // Tween through a proxy: OrbitControls has no animatable properties,
    // it only exposes setters.
    const proxy = {
      azimuth: controls.getAzimuthalAngle(),
      polar: controls.getPolarAngle(),
    };
    const tween = gsap.to(proxy, {
      azimuth: proxy.azimuth + shortestDelta(proxy.azimuth, target.azimuth),
      polar: target.polar,
      duration: 1.05,
      ease: "power3.inOut",
      onUpdate: () => {
        controls.setAzimuthalAngle(proxy.azimuth);
        controls.setPolarAngle(proxy.polar);
        controls.update();
      },
    });
    return () => {
      tween.kill();
    };
  }, [controls, view]);

  return null;
}

/**
 * Build the piece out of the screen on first paint.
 *
 * Scale is what sells depth here: the chair starts small and behind, then
 * comes forward and settles. Rising and turning at the same time keeps it
 * from reading as a flat card being zoomed.
 */
function Entrance({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    const node = group.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tl = gsap.timeline();
    tl.from(node.scale, { x: 0.82, y: 0.82, z: 0.82, duration: 1.25, ease: "power3.out" }, 0)
      .from(node.position, { y: -0.3, z: -0.45, duration: 1.25, ease: "power3.out" }, 0)
      .from(node.rotation, { y: -0.34, duration: 1.4, ease: "power3.out" }, 0);

    return () => {
      tl.kill();
    };
  }, []);

  return <group ref={group}>{children}</group>;
}

function StudioEnvironment() {
  return (
    <Environment resolution={256}>
      {/* Key — the broad soft box camera-left. */}
      <Lightformer
        form="rect"
        intensity={3.2}
        color="#fff4e2"
        position={[-2.4, 2.6, 2.2]}
        rotation={[0, -Math.PI / 5, 0]}
        scale={[5, 5, 1]}
      />
      {/* Warm bounce off the interior's floor. */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#c98b4f"
        position={[1.8, -1.4, 1.4]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[6, 4, 1]}
      />
      {/* Rim behind, to separate the walnut from the dark plate. */}
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#dfe6ff"
        position={[2.6, 1.8, -2.6]}
        rotation={[0, Math.PI / 3, 0]}
        scale={[4, 4, 1]}
      />
    </Environment>
  );
}

function ChairModel({
  finishColor,
  fabricColor,
}: {
  /** null = untouched: the .glb keeps its own baked colour there. */
  finishColor: string | null;
  fabricColor: string | null;
}) {
  // Use the Blender export the moment one is dropped in; until then the
  // procedural piece stands in. A HEAD probe avoids useGLTF throwing on a
  // 404 and taking the whole canvas down with it.
  const [hasGlb, setHasGlb] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(CHAIR_GLB_URL, { method: "HEAD" })
      .then((r) => {
        if (!cancelled && r.ok) setHasGlb(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The procedural stand-in has no baked texture, so it always needs a
  // concrete colour; the .glb treats null as "leave the bake alone".
  const proceduralWood = finishColor ?? DEFAULT_WOOD;
  const proceduralFabric = fabricColor ?? DEFAULT_FABRIC;

  if (hasGlb) {
    return (
      <Suspense
        fallback={
          <AxtraChairProcedural
            finishColor={proceduralWood}
            fabricColor={proceduralFabric}
          />
        }
      >
        <AxtraChairGltf
          url={CHAIR_GLB_URL}
          finishColor={finishColor}
          fabricColor={fabricColor}
        />
      </Suspense>
    );
  }
  return (
    <AxtraChairProcedural finishColor={proceduralWood} fabricColor={proceduralFabric} />
  );
}

export default function ChairScene({
  view,
  finishColor,
  fabricColor,
  className,
}: {
  view: number;
  finishColor?: string | null;
  fabricColor?: string | null;
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        preserveDrawingBuffer: false,
      }}
      // fov 38, not 32: the wider lens gives the piece real perspective
      // divergence, so the near arm reads closer to the viewer than the far
      // one instead of flattening like a decal. RADIUS is derived from
      // FRAME_FILL, so the camera always sits where the chair fills the
      // frame by that fraction.
      camera={{
        // Same side as VIEWS, so the first paint does not start mirrored
        // and then swing across when CameraRig snaps to view 0.
        position: [VIEW_SIDE * RADIUS * 0.58, RADIUS * 0.44, RADIUS],
        fov: FOV,
        near: 0.1,
        far: 40,
      }}
    >
      {/* Direct key light — the one that actually casts the shadow. */}
      <directionalLight
        position={[-2.6, 3.4, 2.4]}
        intensity={2.1}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-1.6, 1.6, 1.6, -1.6, 0.1, 12]} />
      </directionalLight>
      <directionalLight position={[3.2, 2.0, -2.4]} intensity={0.85} color="#cfd8ff" />
      <ambientLight intensity={0.28} />

      <StudioEnvironment />

      <Entrance>
        {/* The chair is modelled with its feet at y=0; drop the group so
            the piece sits centred in frame rather than low in it. */}
        <group position={[0, -0.44, 0]}>
          <ChairModel finishColor={finishColor ?? null} fabricColor={fabricColor ?? null} />
        </group>
      </Entrance>

      {/* Outside <Entrance>: the floor must stay put while the piece
          settles onto it, otherwise the shadow rides up with the chair. */}
      <ContactShadows
        position={[0, -0.436, 0]}
        opacity={0.72}
        scale={3.2}
        blur={2.6}
        far={1.4}
        resolution={1024}
        color="#000000"
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.65}
        minPolarAngle={0.85}
        maxPolarAngle={1.52}
        target={ORBIT_TARGET}
      />
      <CameraRig view={view} />
    </Canvas>
  );
}
