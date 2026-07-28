"use client";

import SubscriberTable from "@/components/subscribers/SubscriberTable";
import { useApi } from "@/hooks/useApi";
import { fetchSubscribers } from "@/lib/api";

export default function SubscribersPage() {
  const { data, isLoading } = useApi(fetchSubscribers);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-admin-text">Newsletter Subscribers</h2>
        <p className="text-xs text-admin-text-muted">
          View and export active email subscribers registered through the site footer and popups.
        </p>
      </div>

      <SubscriberTable
        subscribers={data?.subscribers ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
