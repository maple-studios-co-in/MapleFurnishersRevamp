"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Mail,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Settings,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import MapleLogoSvg from "@/components/ui/MapleLogoSvg";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { label: "Overview", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: "Products", href: ROUTES.PRODUCTS, icon: Package },
  { label: "Inquiries", href: ROUTES.INQUIRIES, icon: MessageSquare },
  { label: "Subscribers", href: ROUTES.SUBSCRIBERS, icon: Mail },
  { label: "Analytics", href: ROUTES.ANALYTICS, icon: BarChart3 },
  { label: "Settings", href: ROUTES.SETTINGS, icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300 ease-in-out shadow-2xl
        ${collapsed ? "w-20" : "w-64"}
      `}
      style={{
        backgroundColor: "#741A14",
        borderRight: "1px solid rgba(0, 0, 0, 0.15)",
      }}
    >
      {/* Brand Header */}
      <div className="flex h-24 items-center justify-between px-5 border-b border-white/10">
        {!collapsed ? (
          <Link href={ROUTES.DASHBOARD} className="group block py-2">
            <MapleLogoSvg width={140} height={45} light />
            <span
              className="block text-[9px] tracking-[0.25em] font-semibold mt-1"
              style={{ color: "#FFF3D3", opacity: 0.8 }}
            >
              ADMIN DASHBOARD
            </span>
          </Link>
        ) : (
          <span
            className="block text-xl font-bold"
            style={{ color: "#FFF3D3", fontFamily: "var(--font-display)" }}
          >
            M
          </span>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-1.5 text-[#FFF3D3]/70 hover:bg-white/10 hover:text-[#FFF3D3] transition-colors"
          aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-3 py-6">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`
                flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "shadow-md"
                    : "hover:bg-white/10"
                }
              `}
              style={{
                backgroundColor: isActive ? "#58120D" : "transparent",
                color: "#FFF3D3",
                border: isActive ? "1px solid rgba(255, 243, 211, 0.2)" : "1px solid transparent",
              }}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" style={{ color: "#FFF3D3" }} />
              {!collapsed && <span style={{ color: "#FFF3D3" }}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
          style={{ color: "#FFF3D3" }}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" style={{ color: "#FFF3D3" }} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
