"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* onClose is an inline arrow in every caller, so it is a new function on
     each parent render. Holding it in a ref keeps the effect below out of
     the dependency list — otherwise every parent re-render tore down and
     re-applied the scroll lock. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /**
   * Failsafe: guarantee the panel becomes visible.
   *
   * The entrance animation is the only thing making this panel opaque, and
   * a full-screen overlay is mounted underneath it with body scroll locked.
   * So ANY reason the animation fails to finish — a stalled document
   * timeline, a compositor hiccup, a dropped stylesheet, software rendering
   * falling behind — leaves an invisible sheet over the whole page that
   * swallows every click. That is indistinguishable from a frozen tab.
   *
   * Rather than enumerate the causes, assert the outcome: shortly after the
   * animation should have ended, if the panel is still not opaque, drop the
   * animation so the element falls back to its normal visible style.
   * Animations outrank inline styles in the cascade, so it has to be
   * removed rather than overridden.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      const el = panelRef.current;
      if (el && Number(getComputedStyle(el).opacity) < 1) {
        el.style.animation = "none";
      }
    }, 450); // animation is 300ms; this only fires if it did not land
    return () => window.clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      // Restore what was there rather than blanking it, so closing one
      // modal cannot unlock scrolling another still wants held.
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop. The click handler lives HERE, not on the overlay: this
          element covers the overlay completely, so it is what the pointer
          actually hits — testing `e.target === overlay` never matched and
          click-outside-to-close silently did nothing. */}
      {/* No backdrop-blur: a blur over the full viewport re-filters
          everything behind it every frame, and on a machine doing software
          rendering that is seconds per frame over a table of thumbnails —
          a plausible second cause of the page appearing to lock up. A
          slightly deeper scrim reads the same and costs nothing. */}
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          relative ${maxWidth} w-full animate-scale-in
          rounded-2xl border border-admin-border bg-admin-surface
          shadow-[0_25px_60px_rgba(0,0,0,0.5)]
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-admin-border px-6 py-4">
          <h2
            className="text-lg text-admin-text"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-admin-text-muted transition-colors hover:bg-admin-surface-hover hover:text-admin-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
