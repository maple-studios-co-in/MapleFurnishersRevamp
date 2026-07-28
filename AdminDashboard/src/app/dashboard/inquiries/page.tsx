"use client";

import { useState } from "react";
import InquiryTable from "@/components/inquiries/InquiryTable";
import InquiryDetail from "@/components/inquiries/InquiryDetail";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/hooks/useApi";
import { fetchInquiries, updateInquiryStatus, type Inquiry } from "@/lib/api";

export default function InquiriesPage() {
  const { data, isLoading, refetch } = useApi(fetchInquiries);
  const { toast } = useToast();
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const handleStatusChange = async (id: string, status: "NEW" | "CONTACTED" | "CLOSED") => {
    try {
      await updateInquiryStatus(id, status);
      toast("success", `Updated inquiry status to ${status}.`);
      refetch();
      if (selectedInquiry && selectedInquiry.id === id) {
        setSelectedInquiry((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      toast("error", "Failed to update inquiry status.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-admin-text">Consultation Inquiries</h2>
        <p className="text-xs text-admin-text-muted">
          Review consultation requests submitted by clients via the main website.
        </p>
      </div>

      <InquiryTable
        inquiries={data?.inquiries ?? []}
        isLoading={isLoading}
        onSelectInquiry={(inq) => setSelectedInquiry(inq)}
        onStatusChange={handleStatusChange}
      />

      <InquiryDetail
        inquiry={selectedInquiry}
        onClose={() => setSelectedInquiry(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
