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
        sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[#E8BDB6] px-8 backdrop-blur-md
        transition-all duration-300
        ${collapsed ? "pl-28" : "pl-72"}
      `}
      style={{ backgroundColor: "#FDECC8" }}
    >
      <div>
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "#741A14" }}
        >
          {meta.title}
        </h1>
        <p className="text-xs text-[#665E55] mt-0.5">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2.5 rounded-full px-4 py-1.5 shadow-sm"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8BDB6" }}
        >
          <span className="h-2 w-2 rounded-full bg-[#15803d] animate-pulse" />
          <span className="text-xs font-semibold text-[#1E1E1E]">System Active</span>
        </div>
      </div>
    </header>
  );
}
