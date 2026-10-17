// Flat-shaded geometry builder: boxes and quads written into preallocated arrays. No allocation after makeGeo.
import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from 'three';

export interface Geo {
  pos: Float32Array;
  col: Float32Array;
  /** Vertices used. */
  n: number;
  cap: number;
  geometry: BufferGeometry;
  posAttr: BufferAttribute;
  colAttr: BufferAttribute;
}

export function makeGeo(capVerts: number): Geo {
  const pos = new Float32Array(capVerts * 3);
  const col = new Float32Array(capVerts * 3);
  const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
  const colAttr = new BufferAttribute(col, 3).setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('color', colAttr);
  geometry.setDrawRange(0, 0);
  return { pos, col, n: 0, cap: capVerts, geometry, posAttr, colAttr };
}

export function clearGeo(g: Geo): void {
  g.n = 0;
}

/** Push the written vertices to the GPU and refresh the culling sphere. */
export function flushGeo(g: Geo): void {
  g.posAttr.needsUpdate = true;
  g.colAttr.needsUpdate = true;
  g.geometry.setDrawRange(0, g.n);
  g.geometry.computeBoundingSphere();
}

function vert(g: Geo, x: number, y: number, z: number, r: number, gr: number, b: number): void {
  const i = g.n * 3;
  g.pos[i] = x;
  g.pos[i + 1] = y;
  g.pos[i + 2] = z;
  g.col[i] = r;
  g.col[i + 1] = gr;
  g.col[i + 2] = b;
  g.n++;
}

/** Two triangles a-b-c, a-c-d with one flat colour. Full policy: skip the quad when the buffer is full. */
export function quad(g: Geo, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, r: number, gr: number, b: number): void {
  if (g.n + 6 > g.cap) return;
  vert(g, ax, ay, az, r, gr, b);
  vert(g, bx, by, bz, r, gr, b);
  vert(g, cx, cy, cz, r, gr, b);
  vert(g, ax, ay, az, r, gr, b);
  vert(g, cx, cy, cz, r, gr, b);
  vert(g, dx, dy, dz, r, gr, b);
}

const C = new Float64Array(24);
const SHADE_TOP = 1;
const SHADE_BOTTOM = 0.55;
const SHADE_X = 0.7;
const SHADE_Z = 0.85;

function face(g: Geo, i0: number, i1: number, i2: number, i3: number, s: number, r: number, gr: number, b: number): void {
  quad(g, C[i0 * 3]!, C[i0 * 3 + 1]!, C[i0 * 3 + 2]!, C[i1 * 3]!, C[i1 * 3 + 1]!, C[i1 * 3 + 2]!, C[i2 * 3]!, C[i2 * 3 + 1]!, C[i2 * 3 + 2]!, C[i3 * 3]!, C[i3 * 3 + 1]!, C[i3 * 3 + 2]!, r * s, gr * s, b * s);
}

/**
 * Box with its bottom-centre at (x, y, z) relative to the origin (ox, oy, oz), rotated by `yaw` about the origin.
 * Local +x is the road's right, local +z points backward along the road.
 */
export function box(g: Geo, ox: number, oy: number, oz: number, yaw: number, x: number, y: number, z: number, w: number, h: number, d: number, r: number, gr: number, b: number): void {
  if (g.n + 36 > g.cap) return;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  for (let i = 0; i < 8; i++) {
    const lx = x + (i & 1 ? w : -w) / 2;
    const lz = z + (i & 2 ? d : -d) / 2;
    C[i * 3] = ox + lx * cy - lz * sy;
    C[i * 3 + 1] = oy + y + (i & 4 ? h : 0);
    C[i * 3 + 2] = oz + lx * sy + lz * cy;
  }
  face(g, 4, 5, 7, 6, SHADE_TOP, r, gr, b);
  face(g, 0, 1, 3, 2, SHADE_BOTTOM, r, gr, b);
  face(g, 1, 5, 7, 3, SHADE_X, r, gr, b);
  face(g, 0, 2, 6, 4, SHADE_X, r, gr, b);
  face(g, 2, 3, 7, 6, SHADE_Z, r, gr, b);
  face(g, 0, 1, 5, 4, SHADE_Z, r, gr, b);
}

/** Boxes from a parts table: [x, y, z, w, h, d, paletteIndex] per part; palette is 16 rgb triples. */
export function parts(g: Geo, ox: number, oy: number, oz: number, yaw: number, list: readonly (readonly number[])[], palette: Float32Array, shade = 1): void {
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    const c = (p[6] ?? 0) * 3;
    box(g, ox, oy, oz, yaw, p[0]!, p[1]!, p[2]!, p[3]!, p[4]!, p[5]!, palette[c]! * shade, palette[c + 1]! * shade, palette[c + 2]! * shade);
  }
}

/**
 * Parts table moved by (dx, dz) in the table's own frame and stretched upward by `sy`, rotated by `yaw` about the origin.
 * Used for animated world objects: sliding trains, dropping pianos.
 */
export function partsMoved(g: Geo, ox: number, oy: number, oz: number, yaw: number, list: readonly (readonly number[])[], palette: Float32Array, dx: number, dy: number, dz: number, sy: number, from = 0, to = list.length): void {
  for (let i = from; i < to; i++) {
    const p = list[i]!;
    const c = (p[6] ?? 0) * 3;
    box(g, ox, oy, oz, yaw, p[0]! + dx, p[1]! * sy + dy, p[2]! + dz, p[3]!, p[4]! * sy, p[5]!, palette[c]!, palette[c + 1]!, palette[c + 2]!);
  }
}

/** '#rrggbb' strings to a Float32Array of rgb triples (sRGB values used as-is: colour management is off). */
export function paletteFloats(hex: readonly string[]): Float32Array {
  const out = new Float32Array(48);
  for (let i = 0; i < 16; i++) {
    const s = hex[i] ?? '#ff00ff';
    out[i * 3] = parseInt(s.slice(1, 3), 16) / 255;
    out[i * 3 + 1] = parseInt(s.slice(3, 5), 16) / 255;
    out[i * 3 + 2] = parseInt(s.slice(5, 7), 16) / 255;
  }
  return out;
}
