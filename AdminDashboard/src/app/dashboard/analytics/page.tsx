"use client";

import { useApi } from "@/hooks/useApi";
import { fetchStats } from "@/lib/api";

/** Card chrome shared with the Overview page. */
const CARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E8DAB7",
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl p-5" style={CARD}>
      <p className="text-[11px] uppercase tracking-[0.12em] text-admin-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-admin-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-admin-text-muted">{hint}</p>}
    </div>
  );
}

/**
 * A share-of-total bar. Kept as plain divs rather than pulling in a chart
 * library for six numbers — the whole page is derived from the same
 * /api/admin/stats payload the Overview already loads.
 */
function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-admin-text">{label}</span>
        <span className="text-xs text-admin-text-muted">
          {value} · {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0E4C8]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useApi(fetchStats);

  const inq = data?.inquiries;
  const prod = data?.products;
  const subs = data?.subscribers;
  const conversion =
    inq && inq.total > 0 ? Math.round((inq.closed / inq.total) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-admin-text">Analytics</h2>
        <p className="text-xs text-admin-text-muted">
          Catalogue, inquiry and subscriber breakdown across the store.
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 text-sm text-admin-danger"
          style={{ ...CARD, borderColor: "#E8BDB6" }}
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl" style={CARD} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Total products"
              value={prod?.total ?? 0}
              hint={`${prod?.published ?? 0} published · ${prod?.draft ?? 0} draft`}
            />
            <Metric
              label="Total inquiries"
              value={inq?.total ?? 0}
              hint={`${inq?.new ?? 0} awaiting a first reply`}
            />
            <Metric
              label="Active subscribers"
              value={subs?.active ?? 0}
              hint="Opted in via the site"
            />
            <Metric
              label="Inquiries closed"
              value={`${conversion}%`}
              hint={`${inq?.closed ?? 0} of ${inq?.total ?? 0} resolved`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl p-6" style={CARD}>
              <h3 className="mb-4 text-sm font-semibold text-admin-text">
                Inquiries by status
              </h3>
              <div className="space-y-4">
                <Bar label="New" value={inq?.new ?? 0} total={inq?.total ?? 0} color="#b45309" />
                <Bar label="Contacted" value={inq?.contacted ?? 0} total={inq?.total ?? 0} color="#1d4ed8" />
                <Bar label="Closed" value={inq?.closed ?? 0} total={inq?.total ?? 0} color="#15803d" />
              </div>
            </div>

            <div className="rounded-xl p-6" style={CARD}>
              <h3 className="mb-4 text-sm font-semibold text-admin-text">
                Catalogue status
              </h3>
              <div className="space-y-4">
                <Bar label="Published" value={prod?.published ?? 0} total={prod?.total ?? 0} color="#741A14" />
                <Bar label="Draft" value={prod?.draft ?? 0} total={prod?.total ?? 0} color="#C08552" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
