"use client";

import { useEffect, useRef, type ReactNode } from "react";

const MAX_ZOOM = 1.65;

/** Keep the photographic plate and rendered chair in the same zoomed frame. */
export default function PhotoRoomViewport({ expanded, children }: {
  expanded: boolean;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const frame = frameRef.current;
    if (!viewport || !frame) return;

    let zoom = 1;
    const pointers = new Map<number, { x: number; y: number }>();
    const captures = new Map<number, Element>();
    let pinch: { distance: number; zoom: number } | null = null;
    const setZoom = (next: number) => {
      zoom = Math.min(MAX_ZOOM, Math.max(1, next));
      frame.style.transform = `scale(${zoom})`;
      viewport.dataset.photoZoom = zoom.toFixed(3);
    };
    const distance = () => {
      const [first, second] = [...pointers.values()];
      return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
    };
    const beginPinch = () => {
      const separation = distance();
      pinch = separation > 0 ? { distance: separation, zoom } : null;
    };
    const releaseCapture = (pointerId: number) => {
      const target = captures.get(pointerId);
      if (target?.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      captures.delete(pointerId);
    };
    const clearPointers = () => {
      for (const pointerId of captures.keys()) releaseCapture(pointerId);
      pointers.clear();
      pinch = null;
    };

    setZoom(1);
    let width = 0;
    let height = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      clearPointers();
      setZoom(1);
    });
    // Observe the unscaled outer frame, so zoom cannot trigger a resize loop.
    observer.observe(viewport);

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? viewport.clientHeight : 1;
      setZoom(zoom * Math.exp(-event.deltaY * unit * 0.0015));
      // A trackpad wheel event can arrive during a pointer gesture.
      if (pointers.size >= 2) beginPinch();
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      // Keep capture on the original canvas; moving it onto this wrapper
      // would prevent the chair's turntable from receiving subsequent events.
      const target = event.target;
      if (target instanceof Element && !target.hasPointerCapture(event.pointerId)) {
        target.setPointerCapture(event.pointerId);
        captures.set(event.pointerId, target);
      }
      if (pointers.size === 2) beginPinch();
    };
    const pointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size < 2 || !pinch) return;
      event.preventDefault();
      setZoom(pinch.zoom * distance() / pinch.distance);
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      releaseCapture(event.pointerId);
      if (pointers.size >= 2) beginPinch();
      else pinch = null;
    };
    const pointerCancel = () => { clearPointers(); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const focused = document.activeElement;
      if (!(focused instanceof HTMLCanvasElement) || !viewport.contains(focused)) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom(zoom + 0.1);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom(zoom - 0.1);
      } else if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    };

    // The embedded scene deliberately has no gesture/wheel listeners: normal
    // page scrolling remains available while the chair handles its own drag.
    if (expanded) {
      viewport.addEventListener("wheel", wheel, { passive: false });
      viewport.addEventListener("pointerdown", pointerDown);
      viewport.addEventListener("pointermove", pointerMove, { passive: false });
      viewport.addEventListener("pointerup", pointerUp);
      viewport.addEventListener("pointercancel", pointerCancel);
      viewport.addEventListener("keydown", keyDown);
    }

    return () => {
      observer.disconnect();
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("pointerdown", pointerDown);
      viewport.removeEventListener("pointermove", pointerMove);
      viewport.removeEventListener("pointerup", pointerUp);
      viewport.removeEventListener("pointercancel", pointerCancel);
      viewport.removeEventListener("keydown", keyDown);
      clearPointers();
      setZoom(1);
    };
  }, [expanded]);

  return <div
    ref={viewportRef}
    data-photo-room-viewport={expanded ? "expanded" : "embedded"}
    data-room-mode="photo"
    data-photo-zoom="1.000"
    style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
  >
    <div ref={frameRef} style={{
      width: "100%",
      height: "100%",
      position: "relative",
      backgroundImage: "url(/media/customizer/bg-interior.webp)",
      backgroundSize: "cover",
      backgroundPosition: "center bottom",
      transform: "scale(1)",
      transformOrigin: "50% 65%",
    }}>
      {children}
    </div>
  </div>;
}
