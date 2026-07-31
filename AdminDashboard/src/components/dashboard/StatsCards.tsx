"use client";

import { Package, MessageSquare, Mail, AlertCircle } from "lucide-react";
import type { AdminStats } from "@/lib/api";

interface StatsCardsProps {
  stats: AdminStats | null;
  isLoading: boolean;
}

const WavyLine = () => (
  <svg
    viewBox="0 0 120 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-4 mt-3"
  >
    <path
      d="M0 10 Q 15 2, 30 10 T 60 10 T 90 10 T 120 10"
      stroke="#741A14"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

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
    },
    {
      title: "NEW INQUIRIES",
      value: stats.inquiries.new,
      subtext: "Requires follow-up response",
      icon: AlertCircle,
    },
    {
      title: "TOTAL INQUIRIES",
      value: stats.inquiries.total,
      subtext: `${stats.inquiries.contacted} Contacted · ${stats.inquiries.closed} Closed`,
      icon: MessageSquare,
    },
    {
      title: "ACTIVE SUBSCRIBERS",
      value: stats.subscribers.active,
      subtext: "Audience newsletter list",
      icon: Mail,
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
            <WavyLine />
          </div>
        );
      })}
    </div>
  );
}
