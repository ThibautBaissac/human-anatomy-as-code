// Reads selected nodes from a remote, uncompressed GLB through HTTP Range requests,
// without downloading the whole file (the HRA "united" body is 357 MB).
export interface ExtractedNode {
  name: string;
  extras: Record<string, unknown>;
  /** world-space positions, in the file's units (metres for the HRA) */
  positions: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
}

interface GltfJson {
  nodes: { name?: string; mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; extras?: Record<string, unknown> }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; mode?: number }[] }[];
  accessors: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  extensionsRequired?: string[];
}

async function range(url: string, start: number, end: number): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
  if (res.status !== 206) throw new Error(`${url} : requête Range refusée (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** The JSON chunk of a GLB and the absolute offset of its binary chunk data. */
export async function readGlbJson(url: string): Promise<{ json: GltfJson; binOffset: number }> {
  const head = new DataView((await range(url, 0, 19)).buffer);
  if (head.getUint32(0, true) !== 0x46546c67) throw new Error(`${url} : pas un fichier GLB`);
  const jsonLength = head.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(await range(url, 20, 20 + jsonLength - 1))) as GltfJson;
  if (json.extensionsRequired?.length) throw new Error(`${url} : extensions requises non prises en charge (${json.extensionsRequired.join(', ')})`);
  return { json, binOffset: 20 + jsonLength + 8 };
}

type M = number[]; // column-major 4×4, as in glTF
const mul = (a: M, b: M): M => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
function local(n: GltfJson['nodes'][number]): M {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation ?? [0, 0, 0], [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const SIZE: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };

async function readAccessor(url: string, json: GltfJson, binOffset: number, index: number, components: number): Promise<number[]> {
  const a = json.accessors[index];
  const bv = json.bufferViews[a.bufferView!];
  const size = SIZE[a.componentType] * components;
  const stride = bv.byteStride ?? size;
  const start = binOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const bytes = await range(url, start, start + stride * (a.count - 1) + size - 1);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < components; c++) {
      const o = i * stride + c * SIZE[a.componentType];
      out.push(a.componentType === 5126 ? view.getFloat32(o, true) : a.componentType === 5125 ? view.getUint32(o, true) : a.componentType === 5123 ? view.getUint16(o, true) : view.getUint8(o));
    }
  }
  return out;
}

export async function extractNodes(url: string, names: string[]): Promise<ExtractedNode[]> {
  const { json, binOffset } = await readGlbJson(url);
  const parent = new Map<number, number>();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const world = (i: number): M => { const p = parent.get(i); return p === undefined ? local(json.nodes[i]) : mul(world(p), local(json.nodes[i])); };
  const out: ExtractedNode[] = [];
  for (const name of names) {
    const i = json.nodes.findIndex((n) => n.name === name);
    if (i < 0 || json.nodes[i].mesh === undefined) throw new Error(`${url} : nœud « ${name} » absent ou sans mesh`);
    const m = world(i);
    const positions: number[] = [], indices: number[] = [];
    for (const prim of json.meshes[json.nodes[i].mesh!].primitives) {
      if ((prim.mode ?? 4) !== 4) continue; // triangles only
      const base = positions.length / 3;
      const p = await readAccessor(url, json, binOffset, prim.attributes.POSITION, 3);
      for (let k = 0; k < p.length; k += 3) {
        const [x, y, z] = [p[k], p[k + 1], p[k + 2]];
        positions.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
      const idx = prim.indices !== undefined ? await readAccessor(url, json, binOffset, prim.indices, 1) : [...Array(p.length / 3).keys()];
      for (const k of idx) indices.push(k + base);
    }
    out.push({ name, extras: json.nodes[i].extras ?? {}, positions: new Float32Array(positions), indices: new Uint32Array(indices) });
  }
  return out;
}
