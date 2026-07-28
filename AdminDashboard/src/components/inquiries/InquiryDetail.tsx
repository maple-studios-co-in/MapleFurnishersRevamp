"use client";

import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_VARIANT } from "@/lib/constants";
import type { Inquiry } from "@/lib/api";

interface InquiryDetailProps {
  inquiry: Inquiry | null;
  onClose: () => void;
  onStatusChange: (id: string, status: "NEW" | "CONTACTED" | "CLOSED") => Promise<void>;
}

export default function InquiryDetail({
  inquiry,
  onClose,
  onStatusChange,
}: InquiryDetailProps) {
  if (!inquiry) return null;

  return (
    <Modal isOpen={!!inquiry} onClose={onClose} title="Consultation Details" maxWidth="max-w-xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-admin-border/50 pb-4">
          <div>
            <h3 className="text-lg font-medium text-admin-text">{inquiry.name}</h3>
            <a href={`mailto:${inquiry.email}`} className="text-xs text-admin-accent hover:underline">
              {inquiry.email}
            </a>
          </div>
          <Badge variant={INQUIRY_STATUS_VARIANT[inquiry.status]}>
            {INQUIRY_STATUS_LABELS[inquiry.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="block text-admin-text-muted">Phone Number</span>
            <span className="font-medium text-admin-text">{inquiry.phone || "Not provided"}</span>
          </div>
          <div>
            <span className="block text-admin-text-muted">Submission Date</span>
            <span className="font-medium text-admin-text">
              {new Date(inquiry.createdAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </div>

        <div>
          <span className="block text-xs text-admin-text-muted mb-2">Message</span>
          <div className="rounded-xl border border-admin-border bg-admin-surface/50 p-4 text-sm text-admin-text leading-relaxed whitespace-pre-wrap">
            {inquiry.message}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-admin-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-admin-text-muted">Change Status:</span>
            <select
              value={inquiry.status}
              onChange={(e) =>
                onStatusChange(inquiry.id, e.target.value as "NEW" | "CONTACTED" | "CLOSED")
              }
              className="rounded-lg border border-admin-border bg-admin-surface px-3 py-1.5 text-xs text-admin-text outline-none focus:border-admin-accent/50"
            >
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <Button variant="secondary" onClick={onClose}>
            Close Window
          </Button>
        </div>
      </div>
    </Modal>
  );
}
