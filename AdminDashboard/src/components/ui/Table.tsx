import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (item: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyMessage = "No data found",
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-admin-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border bg-admin-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-admin-text-muted ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-admin-border/50 last:border-b-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-4">
                    <div className="skeleton h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-admin-border bg-admin-surface py-16 text-center">
        <div className="mb-3 text-3xl opacity-30">📭</div>
        <p className="text-sm text-admin-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-admin-border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border bg-admin-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-admin-text-muted ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr
                key={keyExtractor(item)}
                className={`
                  border-b border-admin-border/50 last:border-b-0
                  transition-colors duration-150 hover:bg-admin-surface/80
                  animate-fade-in stagger-${Math.min(i + 1, 5)}
                `}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-4 text-sm ${col.className ?? ""}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
