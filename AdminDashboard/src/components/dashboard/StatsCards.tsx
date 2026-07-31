"use client";

import { Package, MessageSquare, Mail, AlertCircle } from "lucide-react";
import type { AdminStats } from "@/lib/api";

interface StatsCardsProps {
  stats: AdminStats | null;
  isLoading: boolean;
}

/**
 * Card footer. Replaces the decorative wave that used to sit here: a card
 * of numbers is a better place for one more real number than for an
 * ornament. Where a card has a meaningful denominator it draws the share
 * as a thin meter; where it does not, it prints the caption alone so the
 * four cards still line up.
 */
const CardMeter = ({
  label,
  ratio,
}: {
  label: string;
  ratio: number | null;
}) => (
  <div className="mt-4 border-t border-[#F2E7D0] pt-3">
    {ratio !== null && (
      <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-[#F5EDDD]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.round(ratio * 100)}%`,
            backgroundColor: "#741A14",
          }}
        />
      </div>
    )}
    <p className="text-[11px] tracking-wide text-[#8A8078]">{label}</p>
  </div>
);

/** Share of a total, guarded against divide-by-zero. */
const pct = (part: number, total: number) => (total > 0 ? part / total : 0);
const pctLabel = (part: number, total: number) =>
  `${total > 0 ? Math.round((part / total) * 100) : 0}%`;

export default function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-6">
            <div className="skeleton h-4 w-24 mb-3" />
            <div className="skeleton h-8 w-16 mb-2" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: "TOTAL PRODUCTS",
      value: stats.products.total,
      subtext: `${stats.products.published} Published · ${stats.products.draft} Draft`,
      icon: Package,
      meter: pct(stats.products.published, stats.products.total),
      meterLabel: `${pctLabel(stats.products.published, stats.products.total)} live on the site`,
    },
    {
      title: "NEW INQUIRIES",
      value: stats.inquiries.new,
      subtext: "Requires follow-up response",
      icon: AlertCircle,
      meter: pct(stats.inquiries.new, stats.inquiries.total),
      meterLabel: `${pctLabel(stats.inquiries.new, stats.inquiries.total)} of all inquiries`,
    },
    {
      title: "TOTAL INQUIRIES",
      value: stats.inquiries.total,
      subtext: `${stats.inquiries.contacted} Contacted · ${stats.inquiries.closed} Closed`,
      icon: MessageSquare,
      meter: pct(stats.inquiries.closed, stats.inquiries.total),
      meterLabel: `${pctLabel(stats.inquiries.closed, stats.inquiries.total)} resolved`,
    },
    {
      title: "ACTIVE SUBSCRIBERS",
      value: stats.subscribers.active,
      subtext: "Audience newsletter list",
      icon: Mail,
      meter: null,
      meterLabel: "Opted in through the site",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className={`glass-card p-6 animate-fade-in-up stagger-${idx + 1}`}
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #EFE2C9",
              boxShadow: "0 4px 16px rgba(116, 26, 20, 0.04)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#665E55]">
                {card.title}
              </span>
              <div
                className="rounded-xl p-2.5"
                style={{ backgroundColor: "#FAF5EB" }}
              >
                <Icon className="h-5 w-5 text-[#741A14]" strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-4">
              <span
                className="text-4xl font-semibold text-[#741A14]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {card.value}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-[#665E55]">{card.subtext}</p>
            <CardMeter label={card.meterLabel} ratio={card.meter} />
          </div>
        );
      })}
    </div>
  );
}
