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

export const subscribeNewsletter = (email: string) =>
  post<{ message: string }>("/api/newsletter", { email });

export const submitInquiry = (data: {
  name: string;
  email: string;
  phone?: string;
  message: string;
}) => post<{ message: string }>("/api/inquiries", data);
