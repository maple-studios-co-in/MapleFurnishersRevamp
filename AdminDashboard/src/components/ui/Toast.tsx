"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 text-admin-success" />,
  error: <XCircle className="h-4 w-4 shrink-0 text-admin-danger" />,
  info: <Info className="h-4 w-4 shrink-0 text-admin-info" />,
  warning: <AlertCircle className="h-4 w-4 shrink-0 text-admin-warning" />,
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: "border-admin-success/20",
  error: "border-admin-danger/20",
  info: "border-admin-info/20",
  warning: "border-admin-warning/20",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              flex items-start gap-3 rounded-xl border bg-admin-surface px-4 py-3
              shadow-[0_8px_30px_rgba(0,0,0,0.4)]
              ${BORDER_COLORS[t.type]}
              ${t.exiting ? "animate-toast-out" : "animate-toast-in"}
            `}
          >
            {ICONS[t.type]}
            <p className="flex-1 text-sm text-admin-text">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-admin-text-muted transition-colors hover:text-admin-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
