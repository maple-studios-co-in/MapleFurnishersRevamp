import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { AppError } from '../../lib/errors';
import type { AssetKind } from './validation';

export const MAX_ASSET_BYTES = 50 * 1024 * 1024;
export interface ArtifactStorage {
  put(bytes: Buffer): Promise<string>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export class LocalArtifactStorage implements ArtifactStorage {
  constructor(private readonly root: string) {
    if (!isAbsolute(root)) throw new Error('THREE_D_STORAGE_DIR must be an absolute private directory');
    if (root.split(/[\\/]/).includes('public')) throw new Error('3D artifacts must not be stored in a public directory');
  }
  private path(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key)) throw new AppError(404, 'Artifact not found');
    return resolve(this.root, key);
  }
  async put(bytes: Buffer) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = randomUUID();
    await writeFile(this.path(key), bytes, { flag: 'wx', mode: 0o600 });
    return key;
  }
  async read(key: string) {
    try { return await readFile(this.path(key)); }
    catch { throw new AppError(404, 'Artifact not found'); }
  }
  async remove(key: string) { await unlink(this.path(key)).catch(() => undefined); }
}
export function validateArtifact(kind: AssetKind, bytes: Buffer) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_ASSET_BYTES) throw new AppError(400, 'An artifact between 1 byte and 50 MiB is required');
  let contentType: string;
  if (kind === 'web_model') {
    if (bytes.length < 24 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new AppError(400, 'Upload a valid GLB 2.0 file');
    const jsonLength = bytes.readUInt32LE(12);
    if (jsonLength % 4 || jsonLength + 20 > bytes.length) throw new AppError(400, 'Invalid GLB JSON chunk');
    let gltf;
    try { gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)); } catch { throw new AppError(400, 'Invalid GLB JSON chunk'); }
    if (gltf?.asset?.version !== '2.0') throw new AppError(400, 'GLB asset must use glTF 2.0');
    if ((gltf.buffers !== undefined && !Array.isArray(gltf.buffers)) || (gltf.images !== undefined && !Array.isArray(gltf.images))) throw new AppError(400, 'Invalid GLB resource collection');
    for (const entry of [...(gltf.buffers || []), ...(gltf.images || [])]) {
      if (!entry || typeof entry !== 'object' || (entry.uri !== undefined && typeof entry.uri !== 'string')) throw new AppError(400, 'Invalid GLB resource');
      if (entry.uri && !/^data:(image\/(png|jpeg|webp)|application\/octet-stream);base64,/.test(entry.uri)) throw new AppError(400, 'GLB files must embed all textures and buffers');
    }
    let offset = 20 + jsonLength;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) throw new AppError(400, 'Truncated GLB chunk');
      const length = bytes.readUInt32LE(offset);
      if (length % 4 || offset + 8 + length > bytes.length) throw new AppError(400, 'Invalid GLB chunk length');
      offset += 8 + length;
    }
    contentType = 'model/gltf-binary';
  } else if (kind === 'blender_master') {
    if (bytes.length < 12 || !/^BLENDER[_-][vV][0-9]{3}$/.test(bytes.toString('ascii', 0, 12))) throw new AppError(400, 'Upload an uncompressed Blender .blend master');
    contentType = 'application/x-blender';
  } else if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    if (bytes.length < 45 || bytes.readUInt32BE(8) !== 13 || !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20)) throw new AppError(400, 'Invalid PNG header');
    let offset = 8, hasImage = false, hasEnd = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
      if (offset + 12 + length > bytes.length) throw new AppError(400, 'Truncated PNG chunk');
      if (type === 'IDAT') hasImage = true;
      offset += length + 12;
      if (type === 'IEND') { hasEnd = length === 0 && offset === bytes.length; break; }
    }
    if (!hasImage || !hasEnd) throw new AppError(400, 'Incomplete PNG image');
    contentType = 'image/png';
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) {
    contentType = 'image/jpeg';
  } else if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) {
    contentType = 'image/webp';
  } else throw new AppError(400, 'Upload a PNG, JPEG or WebP image');
  return { contentType, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function modelMaterialNames(bytes: Buffer): string[] {
  validateArtifact('web_model', bytes);
  const document = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  if (!Array.isArray(document.materials)) return [];
  return document.materials.flatMap((material: unknown) => material && typeof material === 'object' && 'name' in material && typeof material.name === 'string' ? [material.name] : []);
}
