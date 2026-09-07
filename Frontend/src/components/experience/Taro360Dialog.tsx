"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TaroRoomScene from "./TaroRoomScene";

export default function Taro360Dialog({ open, onClose, view, finishColor, fabricColor }: {
  open: boolean;
  onClose: () => void;
  view: number;
  finishColor: string | null;
  fabricColor: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const restoreTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus();
    };
  }, [open, mounted]);

  if (!mounted || !open) return null;

  return createPortal(<dialog
    ref={dialogRef}
    aria-labelledby="taro-360-title"
    aria-describedby="taro-360-instructions taro-360-disclaimer"
    className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-[rgba(6,4,3,0.92)] backdrop:backdrop-blur-[6px]"
    onCancel={(event) => { event.preventDefault(); onCloseRef.current(); }}
  >
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-4 sm:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
      <div className="relative w-full max-w-[1100px]">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p id="taro-360-title" className="uppercase" style={{ color: "#fff", fontFamily: '"Red Hat Display", var(--font-redhat)', fontSize: "15px", fontWeight: 600, letterSpacing: "1.5px" }}>Taro</p>
            <p id="taro-360-instructions" className="mt-1 uppercase" style={{ color: "rgba(255,255,255,0.6)", fontFamily: '"Red Hat Display", var(--font-redhat)', fontSize: "10px", letterSpacing: "1px" }}>Drag to rotate · Scroll or pinch to zoom</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close 360 degree view" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DFA35C] focus-visible:outline-offset-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="relative h-[min(64dvh,620px)] min-h-[260px] w-full cursor-grab touch-none select-none overflow-hidden rounded-lg bg-[#111c23] active:cursor-grabbing">
          <TaroRoomScene view={view} finishColor={finishColor} fabricColor={fabricColor} expanded />
        </div>
        <p id="taro-360-disclaimer" className="mt-4 font-sans text-xs text-white/60">Illustrative model · measurements and materials pending</p>
      </div>
    </div>
  </dialog>, document.body);
}
