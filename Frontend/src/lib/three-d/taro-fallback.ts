import type { PublicManifest } from './manifest';

/** Existing deployed pilot. Used only for Taro during backend adoption. */
export const TARO_FALLBACK: PublicManifest = {
  schemaVersion: 1, productId: 'taro-pilot', versionId: 'bundled-v4', slug: 'taro', name: 'Taro Armchair',
  modelUrl: '/media/models/taro/taro-v4.glb',
  angles: [
    { src: '/media/models/taro/taro-v4-perspective.webp', label: 'Three-quarter view' },
    { src: '/media/models/taro/taro-v4-side.webp', label: 'Side view' },
    { src: '/media/models/taro/taro-v4-front.webp', label: 'Front view' },
    { src: '/media/models/taro/taro-v4-back.webp', label: 'Back view' },
  ],
  dimensionsMm: { width: 660.4, depth: 766.2, height: 762.8 },
  viewerProfile: 'taro-photo-room-v1',
  materialSlots: { finish: ['Wood_Frame'], fabric: ['Fabric_Seat', 'Fabric_Back', 'Fabric_Seam'] },
  finishes: [
    { name: 'Natural Ash', hex: '#d6883b', linearColor: [2, 1.65, 1.2] },
    { name: 'Walnut Brown', hex: '#5e4230', linearColor: [0.65, 0.56, 0.48] },
    { name: 'Dark Oak', hex: '#9c8364', linearColor: [0.80, 0.74, 0.61] },
    { name: 'Ebony', hex: '#63595a', linearColor: [0.14, 0.25, 0.45] },
  ],
  fabrics: [
    { name: 'Ivory', hex: '#beb4a5', linearColor: [1, 1, 1] },
    { name: 'Sand', hex: '#958068', linearColor: [0.68, 0.56, 0.40] },
    { name: 'Mauve', hex: '#6a5759', linearColor: [0.36, 0.24, 0.26] },
    { name: 'Charcoal', hex: '#6b6b6b', linearColor: [0.12, 0.15, 0.20] },
  ],
  defaults: { finish: 'Walnut Brown', fabric: 'Ivory' }, variantBindings: [],
  disclaimer: 'Illustrative model | Measurements & finishes unverified',
};
