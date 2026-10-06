import { PORTAL_FRAG, PORTAL_VERT } from "./portalShader";

/** One frame of the portal, in CSS px and 0–1 amounts. */
export interface PortalFrame {
  time: number;
  /** Box centre and half size. */
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  ink: number;
  bulge: number;
  wobble: number;
  burst: number;
  cloud: number;
  clear: number;
  shadow: number;
  /** Pointer, -1…1 from the centre of the screen. */
  px: number;
  py: number;
}

const UNIFORMS = [
  "uRes",
  "uDpr",
  "uTime",
  "uCenter",
  "uHalf",
  "uInk",
  "uBulge",
  "uWobble",
  "uBurst",
  "uCloud",
  "uClear",
  "uShadow",
  "uPointer",
] as const;

type UniformName = (typeof UNIFORMS)[number];

/**
 * Full-screen WebGL pass for the white box and its burst (see
 * portalShader). One triangle, one program; it only draws while the
 * director says the box is on screen.
 */
export class PortalRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private loc = {} as Record<UniformName, WebGLUniformLocation | null>;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private lost = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener("webglcontextlost", this.onLost, false);
    canvas.addEventListener("webglcontextrestored", this.onRestored, false);
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

  private onRestored = () => {
    this.lost = false;
    this.init();
    this.applySize();
  };

  private init() {
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, PORTAL_VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, PORTAL_FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Spaces portal: program failed to link.", gl.getProgramInfoLog(program));
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
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    this.program = program;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.dpr = dpr;
    this.width = Math.max(1, Math.round(cssWidth * dpr));
    this.height = Math.max(1, Math.round(cssHeight * dpr));
    this.applySize();
  }

  private applySize() {
    if (this.canvas.width !== this.width) this.canvas.width = this.width;
    if (this.canvas.height !== this.height) this.canvas.height = this.height;
    this.gl?.viewport(0, 0, this.width, this.height);
  }

  render(f: PortalFrame) {
    const gl = this.gl;
    if (!gl || !this.program || this.lost) return;
    const u = this.loc;
    gl.uniform2f(u.uRes, this.width, this.height);
    gl.uniform1f(u.uDpr, this.dpr);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform2f(u.uCenter, f.cx, f.cy);
    gl.uniform2f(u.uHalf, f.hx, f.hy);
    gl.uniform1f(u.uInk, f.ink);
    gl.uniform1f(u.uBulge, f.bulge);
    gl.uniform1f(u.uWobble, f.wobble);
    gl.uniform1f(u.uBurst, f.burst);
    gl.uniform1f(u.uCloud, f.cloud);
    gl.uniform1f(u.uClear, f.clear);
    gl.uniform1f(u.uShadow, f.shadow);
    gl.uniform2f(u.uPointer, f.px, f.py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  clear() {
    const gl = this.gl;
    if (!gl || this.lost) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  destroy() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost, false);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored, false);
    const gl = this.gl;
    if (!gl) return;
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.program = null;
  }
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Spaces portal: shader failed to compile.", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
