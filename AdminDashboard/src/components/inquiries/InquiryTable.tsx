"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_VARIANT } from "@/lib/constants";
import type { Inquiry } from "@/lib/api";

interface InquiryTableProps {
  inquiries: Inquiry[];
  isLoading: boolean;
  onSelectInquiry: (inquiry: Inquiry) => void;
  onStatusChange: (id: string, status: "NEW" | "CONTACTED" | "CLOSED") => void;
}

export default function InquiryTable({
  inquiries,
  isLoading,
  onSelectInquiry,
  onStatusChange,
}: InquiryTableProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = inquiries.filter((inq) => {
    if (filterStatus === "all") return true;
    return inq.status === filterStatus;
  });

  const columns = [
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
      key: "phone",
      header: "Phone",
      render: (inq: Inquiry) => (
        <span className="text-xs text-admin-text-muted">{inq.phone || "—"}</span>
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
      key: "date",
      header: "Submitted",
      render: (inq: Inquiry) => (
        <span className="text-xs text-admin-text-muted">
          {new Date(inq.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inq: Inquiry) => (
        <select
          value={inq.status}
          onChange={(e) =>
            onStatusChange(inq.id, e.target.value as "NEW" | "CONTACTED" | "CLOSED")
          }
          className="rounded-lg border border-admin-border bg-admin-surface px-2.5 py-1 text-xs text-admin-text outline-none focus:border-admin-accent/50"
        >
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="CLOSED">Closed</option>
        </select>
      ),
    },
    {
      key: "actions",
      header: "Action",
      className: "text-right",
      render: (inq: Inquiry) => (
        <button
          type="button"
          onClick={() => onSelectInquiry(inq)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-admin-accent hover:bg-admin-accent/10 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-admin-border pb-3">
        {["all", "NEW", "CONTACTED", "CLOSED"].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`
              rounded-xl px-4 py-2 text-xs font-medium transition-all
              ${
                filterStatus === st
                  ? "bg-admin-accent/15 text-admin-accent border border-admin-accent/20"
                  : "text-admin-text-muted hover:text-admin-text"
              }
            `}
          >
            {st === "all" ? "All Inquiries" : INQUIRY_STATUS_LABELS[st]}
          </button>
        ))}
      </div>

      <Table
        columns={columns}
        data={filtered}
        keyExtractor={(inq) => inq.id}
        isLoading={isLoading}
        emptyMessage="No consultation inquiries match your filter."
      />
    </div>
  );
}
