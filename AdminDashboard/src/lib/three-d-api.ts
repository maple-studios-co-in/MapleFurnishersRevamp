import { adminRequest } from "./api";

export type AssetKind =
  "web_model" | "blender_master" | "preview" | "texture" | "reference";
export interface Swatch {
  name: string;
  hex: string;
  linearColor?: [number, number, number];
}
export interface ManifestInput {
  schemaVersion: 1;
  modelAssetId: string;
  angles: { assetId: string; label: string }[];
  dimensionsMm: { width: number; depth: number; height: number };
  viewerProfile: "taro-photo-room-v1" | "studio-v1";
  materialSlots: { finish: string[]; fabric: string[] };
  finishes: Swatch[];
  fabrics: Swatch[];
  defaults: { finish: string; fabric: string };
  variantBindings: { variantId: string; finish: string; fabric: string }[];
  disclaimer: string;
}
export interface ThreeDAsset {
  id: string;
  productId: string;
  kind: AssetKind;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}
export interface ThreeDJob {
  id: string;
  productId: string;
  recipeId: string;
  recipeVersion: string;
  status: "awaiting_delivery" | "completed";
  importId: string | null;
  inputSnapshot: unknown;
  idempotencyKey: string;
  createdAt: string;
  completedAt: string | null;
}
export interface ThreeDVersion {
  id: string;
  productId: string;
  jobId: string | null;
  masterAssetId: string | null;
  sequence: number;
  status: "draft" | "approved" | "rejected";
  manifest: ManifestInput;
  notes: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
export interface ThreeDImport {
  id: string;
  sourceRevision: string;
  snapshot: unknown;
  createdAt: string;
}
export interface ThreeDProduct {
  id: string;
  name: string;
  slug: string;
  sourceType: "manual" | "keeri";
  sourceTenantId: string | null;
  sourceModelId: string | null;
  sourceRevision: string | null;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ThreeDProductDetail extends ThreeDProduct {
  assets: ThreeDAsset[];
  jobs: ThreeDJob[];
  versions: ThreeDVersion[];
  imports: ThreeDImport[];
}
export interface ThreeDConfig {
  keeriConfigured: boolean;
  recipes: { id: string; version: string; name: string }[];
}
export interface SyncResult {
  imported: number;
  unchanged: number;
  failed: { modelId: string; message: string }[];
  nextCursor: string | null;
}
export interface VersionInput {
  jobId?: string;
  masterAssetId?: string;
  manifest: ManifestInput;
  notes?: string;
}

const base = "/api/admin/3d";
const post = <T>(path: string, body?: unknown) =>
  adminRequest<T>(`${base}${path}`, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const fetchThreeDProducts = () =>
  adminRequest<{ products: ThreeDProduct[] }>(`${base}/products`);
export const fetchThreeDConfig = () =>
  adminRequest<ThreeDConfig>(`${base}/config`);
export const fetchThreeDProduct = (id: string) =>
  adminRequest<{ product: ThreeDProductDetail }>(
    `${base}/products/${encodeURIComponent(id)}`,
  );
export const createThreeDProduct = (input: { slug: string; name: string }) =>
  post<{ product: ThreeDProduct }>("/products", input);
export const syncKeeri = (cursor?: string) =>
  post<SyncResult>("/keeri/sync", cursor ? { cursor } : {});
export const queueThreeDJob = (
  id: string,
  recipeId: string,
  idempotencyKey: string,
) =>
  post<{ job: ThreeDJob }>(`/products/${encodeURIComponent(id)}/jobs`, {
    recipeId,
    idempotencyKey,
  });
export const uploadThreeDAsset = (id: string, kind: AssetKind, file: File) =>
  adminRequest<{ asset: ThreeDAsset }>(
    `${base}/products/${encodeURIComponent(id)}/assets?${new URLSearchParams({ kind, filename: file.name })}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    },
  );
export const createThreeDVersion = (id: string, input: VersionInput) =>
  post<{ version: ThreeDVersion }>(
    `/products/${encodeURIComponent(id)}/versions`,
    input,
  );
export const reviewThreeDVersion = (
  id: string,
  decision: "approved" | "rejected",
  notes: string,
) =>
  post<{ version: ThreeDVersion }>(
    `/versions/${encodeURIComponent(id)}/review`,
    { decision, notes },
  );
export const publishThreeDVersion = (id: string) =>
  post<{ product: ThreeDProduct }>(
    `/versions/${encodeURIComponent(id)}/publish`,
  );
export const previewThreeDVersion = (id: string) =>
  post<{ path: string; expiresAt: string }>(
    `/versions/${encodeURIComponent(id)}/preview`,
  );
export const downloadThreeDAsset = (id: string) =>
  adminRequest<Blob>(`${base}/assets/${encodeURIComponent(id)}`, {}, "blob");

/** Preview paths are scoped by the backend; always open them on the Maple viewer. */
export function customizerUrl(path: string): string {
  if (
    !path.startsWith("/customize/") ||
    path.startsWith("//") ||
    path.includes("\\")
  )
    throw new Error("The preview link was invalid. Please try again.");
  const origin =
    process.env.NEXT_PUBLIC_STOREFRONT_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://maplefurnishers.com"
      : "http://localhost:3000");
  const url = new URL(path, origin);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("The Maple viewer address is not configured correctly.");
  return url.href;
}
