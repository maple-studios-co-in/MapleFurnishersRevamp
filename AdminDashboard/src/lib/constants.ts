/** Route paths used across the admin dashboard. */
export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  PRODUCTS: "/dashboard/products",
  INQUIRIES: "/dashboard/inquiries",
  SUBSCRIBERS: "/dashboard/subscribers",
} as const;

/** Human-readable labels for inquiry statuses. */
export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CLOSED: "Closed",
};

/** Badge colour variants keyed by inquiry status. */
export const INQUIRY_STATUS_VARIANT: Record<string, "warning" | "info" | "success"> = {
  NEW: "warning",
  CONTACTED: "info",
  CLOSED: "success",
};

/** Token key in localStorage. */
export const TOKEN_KEY = "maple_admin_token";
