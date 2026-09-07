"use client";

import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

export const fieldClass =
  "w-full rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5 text-sm text-admin-text outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent/20";

export function FieldSelect({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-admin-text-muted"
      >
        {label}
      </label>
      <select {...props} id={id} className={fieldClass}>
        {children}
      </select>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-admin-danger"
    >
      {message}
    </p>
  ) : null;
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export const assetLabels = {
  web_model: "Web model (GLB)",
  blender_master: "Blender master",
  preview: "Viewer image",
  texture: "Texture",
  reference: "Private reference",
};
