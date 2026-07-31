"use client";

import { useAuth } from "@/hooks/useAuth";
import { TOKEN_KEY } from "@/lib/constants";

/** Card chrome shared with the Overview page. */
const CARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E8DAB7",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-[#F0E4C8] py-3 last:border-b-0">
      <span className="text-xs uppercase tracking-[0.1em] text-admin-text-muted">
        {label}
      </span>
      <span className="text-sm text-admin-text">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { logout } = useAuth();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-admin-text">Settings</h2>
        <p className="text-xs text-admin-text-muted">
          Account and environment details for this admin session.
        </p>
      </div>

      <div className="rounded-xl p-6" style={CARD}>
        <h3 className="mb-2 text-sm font-semibold text-admin-text">Session</h3>
        <Row label="Signed in as" value="Administrator" />
        <Row label="Token storage" value={TOKEN_KEY} />
        <Row label="Session length" value="12 hours" />
      </div>

      <div className="rounded-xl p-6" style={CARD}>
        <h3 className="mb-2 text-sm font-semibold text-admin-text">Environment</h3>
        <Row label="API endpoint" value={apiUrl} />
        <Row label="Mode" value={process.env.NODE_ENV ?? "development"} />
      </div>

      <div className="rounded-xl p-6" style={CARD}>
        <h3 className="text-sm font-semibold text-admin-text">Security</h3>
        <p className="mt-1 text-xs leading-relaxed text-admin-text-muted">
          The admin email and password are held on the server as
          <code className="mx-1 rounded bg-[#F7EFD9] px-1 py-0.5 text-[11px]">
            ADMIN_EMAIL
          </code>
          and a bcrypt
          <code className="mx-1 rounded bg-[#F7EFD9] px-1 py-0.5 text-[11px]">
            ADMIN_PASSWORD_HASH
          </code>
          . They are not editable from this dashboard by design — changing them
          means updating the Backend environment and redeploying.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-4 rounded-lg px-4 py-2 text-sm text-white transition-colors"
          style={{ backgroundColor: "#741A14" }}
        >
          Sign out of this session
        </button>
      </div>
    </div>
  );
}
