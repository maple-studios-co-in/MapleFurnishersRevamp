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
          <p className="font-medium text-admin-text">{inq.name}</p>
          <p className="text-xs text-admin-text-muted">{inq.email}</p>
        </div>
      ),
    },
    {
      key: "message",
      header: "Message Snippet",
      render: (inq: Inquiry) => (
        <p className="max-w-xs truncate text-xs text-admin-text-muted">{inq.message}</p>
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
        <span className="text-xs text-admin-text-muted">
          {new Date(inq.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-admin-accent/20 bg-gradient-to-r from-admin-surface via-admin-surface to-admin-accent/10 p-6 sm:p-8">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-admin-accent/10 px-3 py-1 text-xs font-semibold text-admin-accent border border-admin-accent/20">
            <Sparkles className="h-3.5 w-3.5" />
            Maple Furnishers Admin Suite
          </div>
          <h2 className="text-2xl font-semibold text-admin-text" style={{ fontFamily: "var(--font-display)" }}>
            Welcome back to the Control Center
          </h2>
          <p className="max-w-xl text-xs text-admin-text-muted">
            Manage your furniture product catalog, review consultation inquiries, and track mailing list subscribers in real-time.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      {error ? (
        <div className="rounded-xl border border-admin-danger/20 bg-admin-danger/10 p-4 text-xs text-admin-danger">
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
            <h3 className="text-base font-medium text-admin-text">Recent Consultation Inquiries</h3>
            <Link
              href={ROUTES.INQUIRIES}
              className="inline-flex items-center gap-1 text-xs font-medium text-admin-accent hover:underline"
            >
              View all inquiries <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Table
            columns={inquiryColumns}
            data={stats?.inquiries.recent ?? []}
            keyExtractor={(i) => i.id}
            isLoading={isLoading}
            emptyMessage="No recent inquiries."
          />
        </div>

        {/* Quick Actions & Recent Subscribers (1 col) */}
        <div className="space-y-6">
          {/* Quick Nav Card */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-medium text-admin-text">Quick Actions</h3>
            <div className="space-y-2.5">
              <Link href={ROUTES.PRODUCTS} className="block">
                <Button variant="secondary" className="w-full justify-start text-xs">
                  <Package className="h-4 w-4 text-admin-accent" />
                  Manage Catalogue Products
                </Button>
              </Link>
              <Link href={ROUTES.INQUIRIES} className="block">
                <Button variant="secondary" className="w-full justify-start text-xs">
                  <MessageSquare className="h-4 w-4 text-admin-info" />
                  Review Inquiries ({stats?.inquiries.new ?? 0} New)
                </Button>
              </Link>
              <Link href={ROUTES.SUBSCRIBERS} className="block">
                <Button variant="secondary" className="w-full justify-start text-xs">
                  <Mail className="h-4 w-4 text-admin-success" />
                  Export Subscriber List
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Subscribers List */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-admin-text">Recent Subscribers</h3>
              <Link href={ROUTES.SUBSCRIBERS} className="text-xs text-admin-accent hover:underline">
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
                  <div key={sub.id} className="flex items-center justify-between text-xs border-b border-admin-border/40 pb-2.5 last:border-b-0 last:pb-0">
                    <span className="font-medium text-admin-text truncate max-w-[180px]">{sub.email}</span>
                    <span className="text-[10px] text-admin-text-muted">
                      {new Date(sub.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-admin-text-muted">No subscribers yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
