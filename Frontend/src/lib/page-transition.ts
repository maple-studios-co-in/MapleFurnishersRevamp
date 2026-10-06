/**
 * Shared state between the route-change curtain (PageTransition) and the
 * pages it reveals. A module singleton survives client-side navigation, so
 * the incoming page can tell it arrived behind the curtain and hand back a
 * promise for when it is ready to be shown.
 */
export type TransitionPhase = "idle" | "covering" | "covered" | "revealing";

export const transitionState: {
  phase: TransitionPhase;
  /** Set by an incoming page; the curtain lifts once it settles. */
  ready: Promise<void> | null;
} = { phase: "idle", ready: null };

/** Fired on window as the curtain starts to lift off the new page. */
export const PAGE_ENTER_EVENT = "maple:page-enter";
