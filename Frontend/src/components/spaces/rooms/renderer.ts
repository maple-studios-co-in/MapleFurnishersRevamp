import { cloudNoise, NOISE_SIZE } from "./noise";
import type { CloudPalette, RoomsWorld } from "./content";
import { leafSheet } from "./leaves";
import { ROOMS_VERT, roomsFrag } from "./shader";

/** One frame of the rooms pass (see shader.ts). Amounts are 0–1 unless noted. */
export interface RoomsFrame {
  time: number;
  /** 0 transparent (cloud only), 1 the room plates, 2 the finale sky. */
  base: number;
  plateA: WebGLTexture | null;
  plateB: WebGLTexture | null;
  /** Dissolve from plate A to plate B. */
  mix: number;
  /** Camera: scale (≥ 1), look-at x and y in plate uv, forward edge magnification. */
  cam: readonly [number, number, number, number];
  streak: number;
  cloud: number;
  /** How far the cloud reaches from cloudAt, in screen heights (≈ 2.6 covers any screen). */
  spread: number;
  /** Opens the cloud from cloudAt outward. */
  clear: number;
  /** Distance flown through the cloud sheets (5 sheets per unit). */
  travel: number;
  /** Screen uv the cloud streams from. */
  cloudAt: readonly [number, number];
  white: number;
  skyDrift: number;
  grade: number;
}

const UNIFORMS = [
  "uRes",
  "uTime",
  "uPlateAspect",
  "uBase",
  "uPlateA",
  "uPlateB",
  "uMix",
  "uCam",
  "uStreak",
  "uNoise",
  "uLeaves",
  "uCloud",
  "uSpread",
  "uClear",
  "uTravel",
  "uCloudAt",
  "uWhite",
  "uSkyDrift",
  "uGrade",
] as const;

type UniformName = (typeof UNIFORMS)[number];

/**
 * Full-screen WebGL pass for a world's rooms and what the camera flies
 * through between them, cloud or foliage (one triangle, one program). Plates are uploaded by PlateBank through
 * upload(); after a lost context, onRestored asks it to upload them again.
 */
export class RoomsRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private noise: WebGLTexture | null = null;
  /** The leaf sheet, in a foliage world. */
  private leaves: WebGLTexture | null = null;
  private blank: WebGLTexture | null = null;
  private loc = {} as Record<UniformName, WebGLUniformLocation | null>;
  private width = 1;
  private height = 1;
  private lost = false;

  /** The context came back: every plate texture is gone and must be uploaded again. */
  onRestored: (() => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: {
      transparent?: boolean;
      plateAspect: number;
      palette: CloudPalette;
      transit: RoomsWorld["transit"];
    },
  ) {
    canvas.addEventListener("webglcontextlost", this.onLost, false);
    canvas.addEventListener("webglcontextrestored", this.onRestore, false);
    this.init();
  }

  get ok() {
    return Boolean(this.program) && !this.lost;
  }

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.program = null;
  };

  private onRestore = () => {
    this.lost = false;
    this.init();
    this.applySize();
    this.onRestored?.();
  };

  private init() {
    const gl = this.canvas.getContext("webgl", {
      alpha: Boolean(this.opts.transparent),
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, ROOMS_VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, roomsFrag(this.opts.palette, this.opts.transit));
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Nimbus: program failed to link.", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (const name of UNIFORMS) this.loc[name] = gl.getUniformLocation(program, name);
    gl.uniform1i(this.loc.uPlateA, 0);
    gl.uniform1i(this.loc.uPlateB, 1);
    gl.uniform1i(this.loc.uNoise, 2);
    gl.uniform1i(this.loc.uLeaves, 3);
    gl.uniform1f(this.loc.uPlateAspect, this.opts.plateAspect);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    // Tileable noise: REPEAT and mipmaps, so the sheets can sample it at any scale.
    this.noise = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NOISE_SIZE, NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, cloudNoise());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    // A foliage world's leaves: premultiplied, so the mipmaps (soft, out of
    // focus leaves) average colour by coverage and never fringe dark.
    if (this.opts.transit === "foliage") {
      this.leaves = gl.createTexture();
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.leaves);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, leafSheet());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    // Stands in for a plate that hasn't arrived (drawn under the whiteout).
    this.blank = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    const [r, g, b] = this.opts.palette.whiteout.map(Math.round);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, 255]));
    setPlateParams(gl);

    this.program = program;
  }

  /** For plates of another shape (the screen turned: see content.ts). */
  setPlateAspect(aspect: number) {
    this.opts.plateAspect = aspect;
    if (this.gl && this.program) this.gl.uniform1f(this.loc.uPlateAspect, aspect);
  }

  resize(cssWidth: number, cssHeight: number, ratio: number) {
    this.width = Math.max(1, Math.round(cssWidth * ratio));
    this.height = Math.max(1, Math.round(cssHeight * ratio));
    this.applySize();
  }

  private applySize() {
    if (this.canvas.width !== this.width) this.canvas.width = this.width;
    if (this.canvas.height !== this.height) this.canvas.height = this.height;
    this.gl?.viewport(0, 0, this.width, this.height);
  }

  /** Uploads a decoded plate; null if the context is gone. */
  upload(source: TexImageSource): WebGLTexture | null {
    const gl = this.gl;
    if (!gl || !this.program || this.lost) return null;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    setPlateParams(gl);
    return tex;
  }

  /** Frees a plate's GPU memory (PlateBank re-uploads it if it is wanted again). */
  release(tex: WebGLTexture) {
    if (this.gl && !this.lost) this.gl.deleteTexture(tex);
  }

  render(f: RoomsFrame) {
    const gl = this.gl;
    if (!gl || !this.program || this.lost) return;
    const u = this.loc;
    gl.uniform2f(u.uRes, this.width, this.height);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform1f(u.uBase, f.base);
    gl.uniform1f(u.uMix, f.mix);
    gl.uniform4f(u.uCam, f.cam[0], f.cam[1], f.cam[2], f.cam[3]);
    gl.uniform1f(u.uStreak, f.streak);
    gl.uniform1f(u.uCloud, f.cloud);
    gl.uniform1f(u.uSpread, f.spread);
    gl.uniform1f(u.uClear, f.clear);
    gl.uniform1f(u.uTravel, f.travel);
    gl.uniform2f(u.uCloudAt, f.cloudAt[0], f.cloudAt[1]);
    gl.uniform1f(u.uWhite, f.white);
    gl.uniform1f(u.uSkyDrift, f.skyDrift);
    gl.uniform1f(u.uGrade, f.grade);

    const a = f.plateA ?? this.blank;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, f.plateB ?? a);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    if (this.leaves) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.leaves);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost, false);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestore, false);
    this.onRestored = null;
    const gl = this.gl;
    if (!gl) return;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.program = null;
  }
}

/** Plates are NPOT: WebGL 1 needs clamped edges and no mipmaps. */
function setPlateParams(gl: WebGLRenderingContext) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Nimbus: shader failed to compile.", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
