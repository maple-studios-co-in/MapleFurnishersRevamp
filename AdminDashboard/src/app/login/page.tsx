"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";
import MapleLogoSvg from "@/components/ui/MapleLogoSvg";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      router.push(ROUTES.DASHBOARD);
    } catch (err) {
      // Distinguish "server unreachable" from "wrong credentials". A dead
      // API surfaces as a TypeError from fetch, which previously fell
      // through to the generic message and made a stopped backend look
      // like a rejected password.
      const unreachable =
        err instanceof TypeError ||
        (err instanceof Error && /fetch|network|failed to fetch/i.test(err.message));
      // In production the API is proxied through this site's own origin, so
      // an unreachable fetch means the user's own connection dropped — name
      // that, not a backend host the browser never talks to. Local dev still
      // calls the backend directly, where naming the endpoint helps.
      const message =
        process.env.NODE_ENV === "production"
          ? "Network error — check your internet connection and try again."
          : `Cannot reach the API server at ${
              process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
            }. Check that it is running and reachable.`;
      setError(
        unreachable
          ? message
          : err instanceof Error
            ? err.message
            : "Invalid email or password",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: "#FDECC8" }}
    >
      {/* Background glow ambient effects */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#741a14]/10 blur-[120px]" />

      <div
        className="w-full max-w-lg space-y-8 p-10 sm:p-12 animate-fade-in-up rounded-2xl shadow-xl"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E8BDB6",
        }}
      >
        {/* Header with SVG Logo */}
        <div className="flex flex-col items-center text-center">
          {/* 274×98 logo box, per the supplied SVG frame. */}
          <MapleLogoSvg width={274} height={98} />

          {/* Heading typography requested by user */}
          <h2
            className="mt-6 max-w-md"
            style={{
              color: "#1E1E1E",
              textAlign: "center",
              fontFamily: "var(--font-redhat)",
              fontSize: "18px",
              fontStyle: "normal",
              fontWeight: 400,
              lineHeight: "1.4",
              letterSpacing: "2.2px",
            }}
          >
            Where everyday moments become lasting memories.
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {error && (
            <div className="rounded-xl border border-[#b91c1c]/20 bg-[#b91c1c]/10 p-3.5 text-xs text-[#b91c1c] text-center animate-shake">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label
              className="block text-xs font-bold uppercase tracking-wider"
              style={{ color: "#1E1E1E", letterSpacing: "1.5px" }}
            >
              EMAIL
            </label>
            <input
              type="email"
              placeholder="admin@maplestudios.co.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#741a14]"
              style={{
                backgroundColor: "#FFFDF7",
                border: "1px solid #E8BDB6",
                color: "#1E1E1E",
              }}
            />
          </div>

          <div className="space-y-1">
            <label
              className="block text-xs font-bold uppercase tracking-wider"
              style={{ color: "#1E1E1E", letterSpacing: "1.5px" }}
            >
              PASSWORD
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#741a14]"
              style={{
                backgroundColor: "#FFFDF7",
                border: "1px solid #E8BDB6",
                color: "#1E1E1E",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl py-4 text-sm font-semibold uppercase tracking-wider text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 shadow-md"
            style={{
              backgroundColor: "#741a14",
              letterSpacing: "2px",
            }}
          >
            {isLoading ? "Authenticating..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
