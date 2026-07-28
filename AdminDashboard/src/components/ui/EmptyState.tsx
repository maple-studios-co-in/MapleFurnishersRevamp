import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
      <div className="mb-4 rounded-2xl bg-admin-surface p-5">
        <Icon className="h-8 w-8 text-admin-text-muted/50" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-medium text-admin-text">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-admin-text-muted">
          {description}
        </p>
      )}
    </div>
  );
}
