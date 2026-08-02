"use client";

import { useState } from "react";
import { submitInquiry } from "@/lib/api";
import { heading, subText } from "@/lib/typography";

type State = "idle" | "sending" | "sent" | "error";

export default function InquiryForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      await submitInquiry({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,   // backend expects undefined, not ""
        message: form.message,
      });
      setState("sent");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  if (state === "sent") {
    return (
      <p style={subText("#F4F2EC")} className="max-w-md">
        Thank you — we&apos;ll be in touch within two business days.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <h3 style={heading("#FFF", "32px", "1.6px")}>Start a conversation.</h3>

      <input required minLength={2} maxLength={100} placeholder="Your name"
        value={form.name} onChange={set("name")}
        className="w-full rounded-lg border border-white/25 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
        style={subText("#FFF")} />

      <input required type="email" placeholder="your@email.com"
        value={form.email} onChange={set("email")}
        className="w-full rounded-lg border border-white/25 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
        style={subText("#FFF")} />

      <input type="tel" maxLength={30} placeholder="Phone (optional)"
        value={form.phone} onChange={set("phone")}
        className="w-full rounded-lg border border-white/25 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
        style={subText("#FFF")} />

      {/* backend requires 10–2000 chars — mirror it so users see it client-side */}
      <textarea required minLength={10} maxLength={2000} rows={4}
        placeholder="Tell us about your space…"
        value={form.message} onChange={set("message")}
        className="w-full rounded-lg border border-white/25 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
        style={subText("#FFF")} />

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button type="submit" disabled={state === "sending"}
        className="rounded-full bg-[#DFA35C] px-7 py-3 text-[#2E1D10] transition-opacity disabled:opacity-60">
        {state === "sending" ? "Sending…" : "Request a consultation"}
      </button>
    </form>
  );
}