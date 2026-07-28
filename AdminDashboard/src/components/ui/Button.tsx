"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-admin-accent text-admin-bg hover:bg-admin-accent-hover active:scale-[0.97] shadow-[0_2px_12px_rgba(192,133,82,0.25)]",
  secondary:
    "bg-admin-surface text-admin-text border border-admin-border hover:bg-admin-surface-hover hover:border-admin-accent/30",
  ghost:
    "bg-transparent text-admin-text-muted hover:text-admin-text hover:bg-admin-surface",
  danger:
    "bg-admin-danger/10 text-admin-danger border border-admin-danger/20 hover:bg-admin-danger/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-6 py-2.5 text-sm rounded-xl gap-2.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-200 ease-out cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="60"
              strokeDashoffset="20"
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
