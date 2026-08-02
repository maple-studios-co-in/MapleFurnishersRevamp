/**
 * Admin API client for the Maple Furnishers backend.
 *
 * Every authenticated call reads the JWT from localStorage and attaches it
 * as a Bearer header. On 401 the token is cleared and the page reloads to
 * force re-authentication.
 */

import { TOKEN_KEY } from "./constants";

/**
 * In production the admin talks to ITS OWN origin ("" = relative /api/...)
 * and next.config.ts rewrites proxy those calls to the backend server-side.
 * Same-origin requests cannot be killed by ad-block filter lists, tracking
 * prevention, per-subdomain DNS failures or CORS — a user hit exactly that
 * class of failure calling the backend's domain directly from the browser.
 * Local dev keeps hitting the backend dev server directly.
 */
const API_URL =
  process.env.NODE_ENV === "production"
    ? ""
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/* ── Auth ── */

export interface LoginResponse {
  token: string;
  expiresInSeconds: number;
}

export const login = async (email: string, password: string) => {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<LoginResponse>(res);
};

/* ── Admin Stats ── */

export interface AdminStats {
  products: { total: number; published: number; draft: number };
  inquiries: {
    total: number;
    new: number;
    contacted: number;
    closed: number;
    recent: Inquiry[];
  };
  subscribers: {
    active: number;
    recent: Subscriber[];
  };
}

export const fetchStats = async () => {
  const res = await fetch(`${API_URL}/api/admin/stats`, {
    headers: authHeaders(),
  });
  return handleResponse<AdminStats>(res);
};

/* ── Products ── */

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string;
  category: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  slug: string;
  name: string;
  description?: string;
  priceCents: number;
  currency?: string;
  imageUrl: string;
  category: string;
  isPublished?: boolean;
}

export const fetchAllProducts = async () => {
  const res = await fetch(`${API_URL}/api/products/all`, {
    headers: authHeaders(),
  });
  return handleResponse<{ products: Product[] }>(res);
};

export const createProduct = async (data: ProductInput) => {
  const res = await fetch(`${API_URL}/api/products`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ product: Product }>(res);
};

export const updateProduct = async (id: string, data: Partial<ProductInput>) => {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ product: Product }>(res);
};

export const deleteProduct = async (id: string) => {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<void>(res);
};

/* ── Inquiries ── */

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "NEW" | "CONTACTED" | "CLOSED";
  createdAt: string;
}

export const fetchInquiries = async () => {
  const res = await fetch(`${API_URL}/api/inquiries`, {
    headers: authHeaders(),
  });
  return handleResponse<{ inquiries: Inquiry[] }>(res);
};

export const updateInquiryStatus = async (
  id: string,
  status: "NEW" | "CONTACTED" | "CLOSED",
) => {
  const res = await fetch(`${API_URL}/api/inquiries/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse<{ inquiry: Inquiry }>(res);
};

/* ── Newsletter ── */

export interface Subscriber {
  id: string;
  email: string;
  source: string;
  createdAt: string;
  unsubscribedAt: string | null;
}

export const fetchSubscribers = async () => {
  const res = await fetch(`${API_URL}/api/newsletter`, {
    headers: authHeaders(),
  });
  return handleResponse<{ count: number; subscribers: Subscriber[] }>(res);
};
