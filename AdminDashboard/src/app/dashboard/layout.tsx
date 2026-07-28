"use client";

import { useState } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import AuthGuard from "@/components/auth/AuthGuard";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGuard>
          <div className="min-h-screen bg-admin-bg text-admin-text">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
            <Topbar collapsed={collapsed} />
            <main
              className={`
                min-h-[calc(100vh-5rem)] p-8 transition-all duration-300
                ${collapsed ? "pl-28" : "pl-72"}
              `}
            >
              <div className="mx-auto max-w-7xl">{children}</div>
            </main>
          </div>
        </AuthGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
