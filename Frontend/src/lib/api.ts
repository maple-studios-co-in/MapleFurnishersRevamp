/**
 * Thin client for the Maple Furnishers backend API.
 *
 * The base URL comes from NEXT_PUBLIC_API_URL (Backend dev server on :4000
 * locally, the deployed API in production). Endpoints return friendly
 * `message` strings on success and `{ error, details? }` on failure.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Something went wrong — please try again.");
  }
  return res.json() as Promise<T>;
}

/** One shoppable dot, shaped exactly like OutroScene's Hotspot. */
export interface SceneProduct {
  slug: string;
  name: string;
  desc: string;
  img: string;
  priceCents: number;
  currency: string;
  x: number;
  y: number;
  x0: number | null;
  y0: number | null;
  side: "left" | "right";
}

export type SceneProducts = Record<string, SceneProduct[]>;

/**
 * Hotspots for the outro film, grouped by scene key.
 *
 * Called from the SERVER (page.tsx) on purpose: OutroScene caches DOM nodes
 * per scene and matches them to hotspots positionally, so the dot count must
 * be settled before first paint. Fetching client-side after mount would
 * change the count mid-flight and strand those caches.
 *
 * Returns null on any failure — the film falls back to its built-in data
 * rather than losing its hotspots because the API blipped.
 */
export async function fetchSceneProducts(): Promise<SceneProducts | null> {
  try {
    const res = await fetch(`${API_URL}/api/products/scenes`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { scenes?: SceneProducts };
    return data.scenes ?? null;
  } catch {
    return null;
  }
}

export const subscribeNewsletter = (email: string) =>
  post<{ message: string }>("/api/newsletter", { email });

export const submitInquiry = (data: {
  name: string;
  email: string;
  phone?: string;
  message: string;
}) => post<{ message: string }>("/api/inquiries", data);