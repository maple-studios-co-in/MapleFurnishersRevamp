"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, useState } from "react";

/* ── Text Input ── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium tracking-wide text-admin-text-muted"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-xl border border-admin-border bg-admin-surface px-4 py-2.5
            text-sm text-admin-text placeholder-admin-text-muted/50
            outline-none transition-all duration-200
            focus:border-admin-accent/50 focus:ring-1 focus:ring-admin-accent/20
            ${error ? "border-admin-danger/50 focus:border-admin-danger/50 focus:ring-admin-danger/20" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-admin-danger">{error}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

/* ── Textarea ── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium tracking-wide text-admin-text-muted"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-xl border border-admin-border bg-admin-surface px-4 py-2.5
            text-sm text-admin-text placeholder-admin-text-muted/50
            outline-none transition-all duration-200 resize-none
            focus:border-admin-accent/50 focus:ring-1 focus:ring-admin-accent/20
            ${error ? "border-admin-danger/50 focus:border-admin-danger/50 focus:ring-admin-danger/20" : ""}
            ${className}
          `}
          rows={4}
          {...props}
        />
        {error && (
          <p className="text-xs text-admin-danger">{error}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

/* ── Toggle ── */

interface ToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative h-6 w-11 rounded-full transition-colors duration-200
          ${checked ? "bg-admin-accent" : "bg-admin-border"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <span
          className={`
            absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white
            shadow-sm transition-transform duration-200
            ${checked ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
      {label && (
        <span className="text-sm text-admin-text-muted">{label}</span>
      )}
    </label>
  );
}

/* ── Select ── */

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function Select({ label, value, onChange, options, className = "" }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium tracking-wide text-admin-text-muted">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full rounded-xl border border-admin-border bg-admin-surface px-4 py-2.5
          text-sm text-admin-text outline-none transition-all duration-200
          focus:border-admin-accent/50 focus:ring-1 focus:ring-admin-accent/20
          ${className}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
