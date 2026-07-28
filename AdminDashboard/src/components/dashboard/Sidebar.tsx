"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, MessageSquare, Mail, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { label: "Overview", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: "Products", href: ROUTES.PRODUCTS, icon: Package },
  { label: "Inquiries", href: ROUTES.INQUIRIES, icon: MessageSquare },
  { label: "Subscribers", href: ROUTES.SUBSCRIBERS, icon: Mail },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-admin-border bg-admin-surface/90 backdrop-blur-xl
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Brand Header */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-admin-border/50">
        {!collapsed ? (
          <Link href={ROUTES.DASHBOARD} className="group">
            <span
              className="block text-xl text-admin-text transition-colors group-hover:text-admin-accent"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
            >
              Maple
            </span>
            <span className="block text-[8px] tracking-[0.3em] text-admin-accent">
              ADMIN DASHBOARD
            </span>
          </Link>
        ) : (
          <span
            className="block text-xl text-admin-accent"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            M
          </span>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-1.5 text-admin-text-muted hover:bg-admin-surface-hover hover:text-admin-text transition-colors"
          aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 px-3 py-6">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-admin-accent/15 text-admin-accent border border-admin-accent/20 shadow-[0_0_15px_rgba(192,133,82,0.1)]"
                    : "text-admin-text-muted hover:bg-admin-surface-hover hover:text-admin-text"
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-admin-accent" : "text-admin-text-muted"}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-admin-border/50">
        <button
          type="button"
          onClick={logout}
          className={`
            flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium text-admin-danger/80
            hover:bg-admin-danger/10 hover:text-admin-danger transition-colors duration-200
          `}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
