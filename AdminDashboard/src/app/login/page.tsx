"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

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
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-admin-bg p-4">
      {/* Background glow ambient effects */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-admin-accent/10 blur-[120px]" />

      <div className="w-full max-w-md space-y-8 glass-card p-8 sm:p-10 animate-fade-in-up">
        {/* Header */}
        <div className="text-center">
          <span
            className="block text-3xl text-admin-text"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Maple
          </span>
          <span className="mt-1 block text-[9px] tracking-[0.35em] text-admin-accent uppercase font-semibold">
            Admin Access Portal
          </span>
          <p className="mt-4 text-xs text-admin-text-muted">
            Sign in with authorized administrative credentials to manage furnishings, client inquiries, and subscriber lists.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-admin-danger/20 bg-admin-danger/10 p-3.5 text-xs text-admin-danger text-center animate-shake">
              {error}
            </div>
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="admin@maple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" className="w-full py-3" isLoading={isLoading}>
            Authenticate & Access
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-admin-border/50">
          <p className="text-[11px] text-admin-text-muted/60">
            Maple Furnishers Internal Control System · Protected Endpoint
          </p>
        </div>
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
