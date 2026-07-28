type Variant = "warning" | "info" | "success" | "default";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  warning: "bg-admin-warning/15 text-admin-warning border-admin-warning/20",
  info: "bg-admin-info/15 text-admin-info border-admin-info/20",
  success: "bg-admin-success/15 text-admin-success border-admin-success/20",
  default: "bg-admin-text-muted/15 text-admin-text-muted border-admin-text-muted/20",
};

export default function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full border px-2.5 py-0.5
        text-[11px] font-semibold tracking-wide uppercase
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
