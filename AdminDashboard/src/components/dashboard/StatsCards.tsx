"use client";

import { Package, MessageSquare, Mail, AlertCircle } from "lucide-react";
import type { AdminStats } from "@/lib/api";

interface StatsCardsProps {
  stats: AdminStats | null;
  isLoading: boolean;
}

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
      title: "Total Products",
      value: stats.products.total,
      subtext: `${stats.products.published} Published · ${stats.products.draft} Draft`,
      icon: Package,
      accent: "text-admin-accent",
    },
    {
      title: "New Inquiries",
      value: stats.inquiries.new,
      subtext: "Requires follow-up response",
      icon: AlertCircle,
      accent: "text-admin-warning",
    },
    {
      title: "Total Inquiries",
      value: stats.inquiries.total,
      subtext: `${stats.inquiries.contacted} Contacted · ${stats.inquiries.closed} Closed`,
      icon: MessageSquare,
      accent: "text-admin-info",
    },
    {
      title: "Active Subscribers",
      value: stats.subscribers.active,
      subtext: "Audience newsletter list",
      icon: Mail,
      accent: "text-admin-success",
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
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-admin-text-muted">
                {card.title}
              </span>
              <div className="rounded-xl bg-admin-surface p-2.5">
                <Icon className={`h-5 w-5 ${card.accent}`} strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-semibold text-admin-text" style={{ fontFamily: "var(--font-display)" }}>
                {card.value}
              </span>
            </div>
            <p className="mt-2 text-xs text-admin-text-muted">{card.subtext}</p>
          </div>
        );
      })}
    </div>
  );
}
