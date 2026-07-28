"use client";

import { Download } from "lucide-react";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import type { Subscriber } from "@/lib/api";

interface SubscriberTableProps {
  subscribers: Subscriber[];
  isLoading: boolean;
}

export default function SubscriberTable({ subscribers, isLoading }: SubscriberTableProps) {
  const exportCSV = () => {
    if (!subscribers.length) return;
    const headers = "Email,Source,SubscribedAt\n";
    const rows = subscribers
      .map((s) => `"${s.email}","${s.source}","${s.createdAt}"`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maple-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const columns = [
    {
      key: "email",
      header: "Subscriber Email",
      render: (s: Subscriber) => (
        <span className="font-medium text-admin-text">{s.email}</span>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (s: Subscriber) => (
        <span className="rounded-md bg-admin-surface border border-admin-border px-2 py-0.5 text-xs text-admin-text-muted">
          {s.source}
        </span>
      ),
    },
    {
      key: "date",
      header: "Subscribed Date",
      render: (s: Subscriber) => (
        <span className="text-xs text-admin-text-muted">
          {new Date(s.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-admin-text-muted">
          Showing {subscribers.length} active email subscribers
        </span>
        <Button variant="secondary" size="sm" onClick={exportCSV} disabled={!subscribers.length}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <Table
        columns={columns}
        data={subscribers}
        keyExtractor={(s) => s.id}
        isLoading={isLoading}
        emptyMessage="No newsletter subscribers recorded yet."
      />
    </div>
  );
}
