"use client";

import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import PhotoRoomViewport from "./PhotoRoomViewport";
import type { PublicManifest } from "@/lib/three-d/manifest";

const MODEL_URL = "/media/models/taro/taro-v4.glb";
// Linear multipliers preserve the authored reference materials. The old
// model used neutral maps and multiplied full swatch colours directly.
const WOOD_TINTS: Record<string, [number, number, number]> = {
  "#d6883b": [2.0, 1.65, 1.2],
  "#5e4230": [0.65, 0.56, 0.48],
  "#9c8364": [0.80, 0.74, 0.61],
  "#63595a": [0.14, 0.25, 0.45],
};
const FABRIC_TINTS: Record<string, [number, number, number]> = {
  "#beb4a5": [1, 1, 1],
  "#958068": [0.68, 0.56, 0.40],
  "#6a5759": [0.36, 0.24, 0.26],
  "#6b6b6b": [0.12, 0.15, 0.20],
};
const MODEL_HEIGHT = 0.7628;
const MODEL_DIAGONAL = Math.hypot(0.6604, 0.7662);
const FOV = 34;
const TARGET: [number, number, number] = [0, 0.385, 0];
// Keep the room and its light fixed. The chair turns on the rug, so even the
// rear view cannot move the camera behind a wall. glTF uses Y up and +Z front.
const HERO_AZIMUTH = Math.atan2(1.45, 2.02);
const CAMERA_DIRECTION = new THREE.Vector3(1.45, 0.43, 2.02).normalize();
const VIEWS = [
  0,
  HERO_AZIMUTH - Math.PI / 2,
  HERO_AZIMUTH,
  HERO_AZIMUTH + Math.PI,
] as const;

// PCSS uses the same blocker search / Vogel disk approach as Drei SoftShadows.
// Reference-count the shared shader installation: main and dialog canvases
// can briefly overlap while React disposes one and mounts the other.
let windowShadowUsers = 0;
let originalShadowChunk: string | null = null;
const WINDOW_SHADOW_GLSL = `
vec2 taroVogelDisk(int index, float angle) {
  float radius = sqrt((float(index) + 0.5) / 16.0);
  float theta = float(index) * 2.399963 + angle;
  return radius * vec2(cos(theta), sin(theta));
}
float taroWindowShadow(sampler2D map, vec4 coords) {
  float texel = 1.0 / float(textureSize(map, 0).x);
  float angle = fract(sin(dot(gl_FragCoord.xy, vec2(12.75613, 38.12123))) * 13234.76575) * PI2;
  float depthSum = 0.0;
  float blockers = 0.0;
  for (int i = 0; i < 16; i++) {
    vec2 offset = taroVogelDisk(i, angle) * texel * 96.0;
    float depth = unpackRGBAToDepth(texture2D(map, coords.xy + offset));
    if (depth < coords.z) { depthSum += depth; blockers += 1.0; }
  }
  if (blockers == 0.0) return 1.0;
  float blockerDepth = max(depthSum / blockers, 0.00001);
  float penumbra = max(0.0, (coords.z - blockerDepth) / blockerDepth);
  float radius = 1.0 + 1.25 * penumbra * 48.0;
  float shadow = 0.0;
  for (int i = 0; i < 16; i++) {
    vec2 offset = taroVogelDisk(i, angle) * texel * radius;
    shadow += step(coords.z, unpackRGBAToDepth(texture2D(map, coords.xy + offset)));
  }
  return shadow / 16.0;
}
`;

function WindowShadows() {
  const { scene, invalidate } = useThree();
  // Install before the first renderer frame, including cached-model remounts.
  // A passive effect could leave an unpatched program in Three's shader cache.
  useLayoutEffect(() => {
    if (windowShadowUsers === 0) {
      originalShadowChunk = THREE.ShaderChunk.shadowmap_pars_fragment;
      THREE.ShaderChunk.shadowmap_pars_fragment = originalShadowChunk
        .replace("#ifdef USE_SHADOWMAP", `#ifdef USE_SHADOWMAP\n${WINDOW_SHADOW_GLSL}`)
        .replace("#if defined( SHADOWMAP_TYPE_PCF )", "return mix(1.0, taroWindowShadow(shadowMap, shadowCoord), shadowIntensity);\n#if defined( SHADOWMAP_TYPE_PCF )");
    }
    windowShadowUsers += 1;
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => { material.needsUpdate = true; });
    });
    invalidate();
    return () => {
      windowShadowUsers -= 1;
      if (windowShadowUsers === 0 && originalShadowChunk !== null) {
        THREE.ShaderChunk.shadowmap_pars_fragment = originalShadowChunk;
        originalShadowChunk = null;
      }
    };
  }, [scene, invalidate]);
  return null;
}

export type TaroRoomSceneProps = {
  manifest?: PublicManifest;
  finishName?: string | null;
  fabricName?: string | null;
  view: number;
  finishColor: string | null;
  fabricColor: string | null;
  className?: string;
  expanded?: boolean;
};

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Furniture({ finishColor, fabricColor, finishName, fabricName, manifest, onReady }: Pick<TaroRoomSceneProps, "finishColor" | "fabricColor" | "finishName" | "fabricName" | "manifest"> & { onReady: () => void }) {
  const { scene } = useGLTF(manifest?.modelUrl ?? MODEL_URL);
  const invalidate = useThree((state) => state.invalidate);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((material) => material.clone()) : mesh.material.clone();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const physical = material as THREE.MeshPhysicalMaterial;
        if (physical.isMeshStandardMaterial) physical.userData.authoredColor = physical.color.toArray();
        if (physical.isMeshPhysicalMaterial) {
          physical.userData.authoredSheenColor = physical.sheenColor.toArray();
        }
      }
    });
    if (manifest?.viewerProfile === 'studio-v1') {
      const bounds = new THREE.Box3().setFromObject(clone);
      const center = bounds.getCenter(new THREE.Vector3());
      clone.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
    }
    return clone;
  }, [scene, manifest?.viewerProfile]);

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((source) => {
        const material = source as THREE.MeshPhysicalMaterial;
        if (!material.isMeshStandardMaterial) return;
        // Keep the authored grain, weave, normals, roughness and UVs. These
        // per-view clones tint the reference material without discarding it.
        const isFinish = manifest ? manifest.materialSlots.finish.includes(material.name) : material.name === 'Wood_Frame';
        const isFabric = manifest ? manifest.materialSlots.fabric.includes(material.name) : material.name.startsWith('Fabric_');
        if (manifest && material.userData.authoredColor) material.color.fromArray(material.userData.authoredColor);
        const applySwatch = (options: PublicManifest['finishes'], color: string | null, name?: string | null) => {
          const swatch = name ? options.find(item => item.name === name) : options.find(item => item.hex === color);
          if (swatch?.linearColor) material.color.setRGB(...swatch.linearColor);
          else if (swatch) material.color.set(swatch.hex);
          // Explicit linear factors preserve calibrated materials. A hex-only
          // choice is an illustrative tint; it is reviewed with the version.
        };
        if (isFinish) {
          if (manifest) applySwatch(manifest.finishes, finishColor, finishName);
          else material.color.setRGB(...(WOOD_TINTS[finishColor ?? ''] ?? WOOD_TINTS['#5e4230']));
        }
        if (isFabric) {
          if (manifest) applySwatch(manifest.fabrics, fabricColor, fabricName);
          else material.color.setRGB(...(FABRIC_TINTS[fabricColor ?? ''] ?? FABRIC_TINTS['#beb4a5']));
          // Preserve the low-intensity sheen authored in the exported asset.
          // Always tint from the source so repeated swatch changes do not compound.
          if (material.isMeshPhysicalMaterial && material.userData.authoredSheenColor) {
            material.sheenColor.fromArray(material.userData.authoredSheenColor).multiply(material.color);
          }
        }
        material.needsUpdate = true;
      });
    });
    invalidate();
  }, [model, finishColor, fabricColor, finishName, fabricName, manifest, invalidate]);

  useEffect(() => { onReady(); }, [onReady]);
  useEffect(() => () => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
    });
  }, [model]);

  return <primitive object={model} dispose={null} />;
}

function ChairTurntable({ view, children, name = 'Taro' }: { view: number; children: ReactNode; name?: string }) {
  const group = useRef<THREE.Group>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const { gl, invalidate } = useThree();
  const first = useRef(true);
  useEffect(() => {
    if (!group.current) return;
    const rotation = group.current.rotation;
    const target = VIEWS[view] ?? 0;
    tween.current?.kill();
    if (first.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      first.current = false;
      rotation.y = target;
      invalidate();
      return;
    }
    const delta = THREE.MathUtils.euclideanModulo(target - rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    tween.current = gsap.to(rotation, {
      y: rotation.y + delta,
      duration: 0.85,
      ease: "power3.inOut",
      onUpdate: invalidate,
    });
    return () => { tween.current?.kill(); };
  }, [view, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const pointers = new Set<number>();
    let drag: { pointer: number; x: number } | null = null;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${name} in 3D. Drag or use left and right arrow keys to turn the piece. Home restores the selected view.`);
    const turn = (amount: number) => {
      if (!group.current) return;
      tween.current?.kill();
      group.current.rotation.y += amount;
      invalidate();
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointers.add(event.pointerId);
      // Two fingers belong to the expanded viewer's pinch zoom.
      if (pointers.size > 1) { drag = null; return; }
      tween.current?.kill();
      drag = { pointer: event.pointerId, x: event.clientX };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId || pointers.size !== 1) return;
      turn((event.clientX - drag.x) * 0.007);
      drag.x = event.clientX;
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (drag?.pointer === event.pointerId) drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = "grab";
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        turn(event.key === "ArrowLeft" ? -0.15 : 0.15);
      } else if (event.key === "Home" && group.current) {
        event.preventDefault();
        tween.current?.kill();
        group.current.rotation.y = VIEWS[view] ?? 0;
        invalidate();
      }
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("keydown", keyDown);
    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("keydown", keyDown);
    };
  }, [gl, invalidate, view, name]);
  return <group ref={group}>{children}</group>;
}

function ResponsiveFraming({ expanded, manifest }: { expanded: boolean; manifest?: PublicManifest }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !size.width || !size.height) return;
    const aspect = size.width / size.height;
    const tangent = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const desktopHero = !expanded && size.width >= 1024;
    const height = manifest ? manifest.dimensionsMm.height / 1000 : MODEL_HEIGHT;
    const diagonal = manifest ? Math.hypot(manifest.dimensionsMm.width, manifest.dimensionsMm.depth) / 1000 : MODEL_DIAGONAL;
    const studio = manifest?.viewerProfile === 'studio-v1';
    const target: [number, number, number] = studio ? [0, height / 2, 0] : TARGET;
    const heightRadius = height / (2 * (desktopHero ? 0.55 : 0.62) * tangent) + 0.30;
    const widthRadius = diagonal / (2 * (desktopHero ? 0.40 : 0.82) * tangent * aspect) + 0.20;
    const radius = Math.max(heightRadius, widthRadius);
    camera.position.set(...target).addScaledVector(CAMERA_DIRECTION, radius);
    camera.lookAt(...target);
    camera.far = Math.max(30, radius * 4);
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // The plate is cover-sized and bottom-aligned. Land the chair on the same
    // rug location in that crop; reserve the original desktop material panel.
    // Camera metadata is unavailable, so this is visual alignment, not a scan.
    const plateHeight = Math.max(size.height, size.width * 1086 / 1448);
    const floorY = studio ? size.height * 0.78 : size.height - plateHeight * 0.22;
    const floorX = size.width * (desktopHero ? (aspect >= 1.5 ? 0.52 : 0.47) : 0.50);
    const floor = new THREE.Vector3(0, 0, 0).project(camera);
    camera.setViewOffset(size.width, size.height,
      (floor.x * 0.5 + 0.5) * size.width - floorX,
      (-floor.y * 0.5 + 0.5) * size.height - floorY,
      size.width, size.height);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, expanded, invalidate, size.height, size.width, manifest]);
  return null;
}

function RoomLighting() {
  return <>
    {/* Warm daylight enters from the left of the existing room image.
        The image itself supplies no lighting: these lights approximate it. */}
    <directionalLight position={[-3, 3.4, 2]} intensity={2.0} color="#fff0d7" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.00006} shadow-normalBias={0.0012}>
      <orthographicCamera attach="shadow-camera" args={[-1.5, 1.5, 1.5, -1.5, 0.1, 10]} />
    </directionalLight>
    <directionalLight position={[1.2, 1.5, 2.6]} intensity={0.25} color="#e8e5df" />
    <hemisphereLight args={["#eee6d8", "#79604a", 0.30]} />
    <Environment resolution={256} frames={1} environmentIntensity={0.65}>
      <Lightformer form="rect" intensity={3} color="#fff0d7" position={[-3, 3.4, 2]} target={TARGET} scale={[1.65, 2.4, 1]} />
      <Lightformer form="rect" intensity={0.4} color="#e8e5df" position={[1.2, 1.5, 2.6]} target={TARGET} scale={[2, 1.8, 1]} />
      <Lightformer form="rect" intensity={0.3} color="#c49b68" position={[0, 2.6, -1]} target={TARGET} scale={[3, 3, 1]} />
    </Environment>
  </>;
}

function Backdrop({ studio, expanded, children }: { studio: boolean; expanded: boolean; children: ReactNode }) {
  return <PhotoRoomViewport expanded={expanded} mode={studio ? 'studio' : 'photo'}>{children}</PhotoRoomViewport>;
}

export default function TaroRoomScene({ view, finishColor, fabricColor, finishName, fabricName, className, expanded = false, manifest }: TaroRoomSceneProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markReady = useCallback(() => setReady(true), []);
  const modelUrl = manifest?.modelUrl ?? MODEL_URL;
  const studio = manifest?.viewerProfile === 'studio-v1';
  const modelExtent = manifest ? Math.max(manifest.dimensionsMm.width, manifest.dimensionsMm.depth) / 1000 : 1;

  useEffect(() => {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2");
    setSupported(!!context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }, [attempt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const onLost = (event: Event) => { event.preventDefault(); setContextLost(true); };
    canvas?.addEventListener("webglcontextlost", onLost);
    return () => { canvas?.removeEventListener("webglcontextlost", onLost); };
  }, [supported, ready, attempt]);

  const retry = () => {
    useGLTF.clear(modelUrl);
    setReady(false);
    setContextLost(false);
    setSupported(null);
    setAttempt((value) => value + 1);
  };
  const fallback = <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white" role="status">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={manifest?.angles[2].src ?? '/media/models/taro/reference-front.webp'} alt={`${manifest?.name ?? 'Taro'} reference; selected finishes are not shown`} className="max-h-[35%] w-auto rounded object-contain" />
    <div className="max-w-[320px] rounded bg-black/75 p-4 font-sans text-sm">
      <p className="font-semibold">3D view is unavailable</p>
      <p className="mt-1 text-xs text-white/75">This reference does not reflect your selected materials. The 3D model is an illustrative prototype.</p>
      <button type="button" onClick={retry} className="mt-3 rounded border border-white/50 px-4 py-2 text-xs hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DFA35C]">Try 3D again</button>
    </div>
  </div>;

  return <div className={className} style={{ width: "100%", height: "100%", position: "relative", background: "#17130f" }} aria-label={`Interactive ${manifest?.name ?? 'Taro chair'} in ${studio ? 'a studio' : 'a furnished room'}`} data-lenis-prevent>
    <Backdrop studio={studio} expanded={expanded}>
    {supported === false || contextLost ? fallback : <ModelBoundary key={`${modelUrl}-${attempt}`} fallback={fallback}>
      {supported && <Canvas ref={canvasRef} resize={{ offsetSize: true }} shadows dpr={[1, 1.75]} frameloop="demand" style={{ touchAction: expanded ? "none" : "pan-y" }} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: false }} camera={{ position: [1.45, 1.08, 2.02], fov: FOV, near: 0.05, far: 30 }}>
        <WindowShadows />
        <RoomLighting />
        <Suspense fallback={null}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[12, 12]} />
            <shadowMaterial transparent opacity={0.32} color="#21170e" depthWrite={false} />
          </mesh>
          <ChairTurntable view={view} name={manifest?.name}>
            <Furniture manifest={manifest} finishColor={finishColor} fabricColor={fabricColor} finishName={finishName} fabricName={fabricName} onReady={markReady} />
          </ChairTurntable>
          {/* Demand rendering redraws contact shadows during turns and zoom,
              then sleeps. A one-frame shadow would retain the previous pose. */}
          <ContactShadows frames={Infinity} position={[0, 0.002, 0]} opacity={0.30} scale={studio ? Math.max(2.35, modelExtent * 2.5) : 2.35} blur={2.0} far={0.18} resolution={512} color="#21170e" />
        </Suspense>
        <ResponsiveFraming expanded={expanded} manifest={manifest} />
      </Canvas>}
      {!ready && <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status"><span className="rounded bg-black/65 px-4 py-2 font-sans text-xs text-white">Preparing your room…</span></div>}
    </ModelBoundary>}
    </Backdrop>
  </div>;
}
