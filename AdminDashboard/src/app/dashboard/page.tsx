"use client";

import Link from "next/link";
import { ArrowRight, Package, MessageSquare, Mail, Sparkles } from "lucide-react";
import StatsCards from "@/components/dashboard/StatsCards";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useApi } from "@/hooks/useApi";
import { fetchStats, type Inquiry, type Subscriber } from "@/lib/api";
import { ROUTES, INQUIRY_STATUS_LABELS, INQUIRY_STATUS_VARIANT } from "@/lib/constants";

export default function DashboardOverviewPage() {
  const { data: stats, isLoading, error } = useApi(fetchStats);

  const inquiryColumns = [
    {
      key: "client",
      header: "Client Name",
      render: (inq: Inquiry) => (
        <div>
          <p className="font-medium text-[#1E1E1E]">{inq.name}</p>
          <p className="text-xs text-[#665E55]">{inq.email}</p>
        </div>
      ),
    },
    {
      key: "message",
      header: "Message Snippet",
      render: (inq: Inquiry) => (
        <p className="max-w-xs truncate text-xs text-[#665E55]">{inq.message}</p>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inq: Inquiry) => (
        <Badge variant={INQUIRY_STATUS_VARIANT[inq.status]}>
          {INQUIRY_STATUS_LABELS[inq.status]}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (inq: Inquiry) => (
        <span className="text-xs text-[#665E55]">
          {new Date(inq.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner matching Image 2 */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8 shadow-sm"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #EFE2C9",
        }}
      >
        <div className="relative z-10 space-y-3">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: "#FAF5EB",
              color: "#741A14",
              border: "1px solid #EFE2C9",
            }}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#741A14]" />
            Maple Furnishers Admin Suite
          </div>
          <h2
            className="text-3xl font-semibold text-[#741A14]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Welcome back to the Control Center
          </h2>
          <p className="max-w-2xl text-xs text-[#665E55] leading-relaxed">
            Manage your furniture product catalog, review consultation inquiries, and track mailing list subscribers in real-time.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          Error loading dashboard metrics: {error}
        </div>
      ) : (
        <StatsCards stats={stats} isLoading={isLoading} />
      )}

      {/* Quick Actions & Recent Activity Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Inquiries (2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#1E1E1E]">Recent Consultation Inquiries</h3>
            <Link
              href={ROUTES.INQUIRIES}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#741A14] hover:underline"
            >
              View all inquiries <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div
            className="rounded-2xl overflow-hidden shadow-sm"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8DAB7" }}
          >
            <Table
              columns={inquiryColumns}
              data={stats?.inquiries.recent ?? []}
              keyExtractor={(i) => i.id}
              isLoading={isLoading}
              emptyMessage="No recent inquiries."
            />
          </div>
        </div>

        {/* Quick Actions & Recent Subscribers (1 col) */}
        <div className="space-y-6">
          {/* Quick Nav Card */}
          <div
            className="p-6 space-y-4 rounded-2xl shadow-sm"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8DAB7" }}
          >
            <h3 className="text-sm font-semibold text-[#1E1E1E]">Quick Actions</h3>
            <div className="space-y-2.5">
              <Link href={ROUTES.PRODUCTS} className="block">
                <Button variant="secondary" className="w-full justify-start text-xs">
                  <Package className="h-4 w-4 text-[#741A14]" />
                  Manage Catalogue Products
                </Button>
              </Link>
              <Link href={ROUTES.INQUIRIES} className="block">
                <Button variant="secondary" className="w-full justify-start text-xs">
                  <MessageSquare className="h-4 w-4 text-[#1d4ed8]" />
                  Review Inquiries ({stats?.inquiries.new ?? 0} New)
                </Button>
              </Link>
              <Link href={ROUTES.SUBSCRIBERS} className="block">
                <Button variant="secondary" className="w-full justify-start text-xs">
                  <Mail className="h-4 w-4 text-[#15803d]" />
                  Export Subscriber List
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Subscribers List */}
          <div
            className="p-6 space-y-4 rounded-2xl shadow-sm"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8DAB7" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1E1E1E]">Recent Subscribers</h3>
              <Link href={ROUTES.SUBSCRIBERS} className="text-xs text-[#741A14] font-semibold hover:underline">
                View list
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-8 w-full" />
                ))}
              </div>
            ) : stats?.subscribers.recent.length ? (
              <div className="space-y-3">
                {stats.subscribers.recent.map((sub: Subscriber) => (
                  <div key={sub.id} className="flex items-center justify-between text-xs border-b border-[#E8DAB7]/50 pb-2.5 last:border-b-0 last:pb-0">
                    <span className="font-medium text-[#1E1E1E] truncate max-w-[180px]">{sub.email}</span>
                    <span className="text-[10px] text-[#665E55]">
                      {new Date(sub.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#665E55]">No subscribers yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
