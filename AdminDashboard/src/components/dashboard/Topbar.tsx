"use client";

import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  [ROUTES.DASHBOARD]: { title: "Overview", subtitle: "Real-time metrics & recent activity" },
  [ROUTES.PRODUCTS]: { title: "Products Catalogue", subtitle: "Manage furniture items, pricing & publishing" },
  [ROUTES.INQUIRIES]: { title: "Consultation Inquiries", subtitle: "Track client inquiry requests & status" },
  [ROUTES.SUBSCRIBERS]: { title: "Newsletter Subscribers", subtitle: "Audience mailing list & subscriptions" },
};

export default function Topbar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const meta = PAGE_TITLES[pathname] ?? { title: "Admin", subtitle: "Maple Furnishers Control Center" };

  return (
    <header
      className={`
        sticky top-0 z-30 flex h-20 items-center justify-between border-b border-admin-border bg-admin-bg/80 px-8 backdrop-blur-md
        transition-all duration-300
        ${collapsed ? "pl-28" : "pl-72"}
      `}
    >
      <div>
        <h1 className="text-xl font-medium text-admin-text" style={{ fontFamily: "var(--font-display)" }}>
          {meta.title}
        </h1>
        <p className="text-xs text-admin-text-muted">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 rounded-full border border-admin-border bg-admin-surface px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-admin-success animate-pulse" />
          <span className="text-xs font-medium text-admin-text-muted">System Active</span>
        </div>
      </div>
    </header>
  );
}
