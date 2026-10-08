"use client";

import { useSyncExternalStore } from "react";
import type { StepState } from "./director";
import { STEPS } from "./script";
import styles from "./mobile.module.css";

/**
 * The Previous / Next bar — one of the two ways the phone home is read;
 * the other is scrolling, which steers the same story, so the bar always
 * names the beats either side of it. A full-width bar on the foot of the
 * screen, split by a hairline into two halves a thumb can't miss, each in
 * the site's own
 * Previous / Next dress (Spaces, the customizer): a small uppercase label
 * with the thin line arrow, and under it the name of the beat it plays to.
 *
 * On the first beat there is nowhere to go back to, so Next has the whole
 * bar, centred; from the second the bar splits. Its top edge is the
 * story's progress line, drawn by the director as the films play, and the
 * director flips its tone (data-tone) between cream over the films and
 * timber over the craft plate. On the last beat Next becomes Replay.
 */
export default function Dock({ store, onStep }: { store: StepStore; onStep: (dir: 1 | -1) => void }) {
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const { at, target, between, ready } = state;
  const lastStep = STEPS.length - 1;
  // Scrolled part-way: Previous goes back to the beat behind, Next on.
  const first = !between && target === 0;
  const end = !between && target === lastStep;
  const prev = STEPS[between ? at : target - 1];
  const next = STEPS[between ? at + 1 : target + 1];
  const nextName = end ? "From The Top" : next?.title ?? "";

  return (
    <nav className={styles.dock} data-m-dock data-ready={ready} data-first={first} aria-label="Story">
      <span className={styles.dockTrack} aria-hidden>
        <span className={styles.dockFill} data-m-progress />
      </span>

      <button
        type="button"
        className={`${styles.dockButton} ${styles.dockPrev}`}
        onClick={() => onStep(-1)}
        disabled={first || !ready}
        aria-label={prev ? `Previous: ${prev.title}` : "Previous"}
      >
        <span className={styles.dockInner}>
          <span className={styles.dockLabel}>
            <LineArrow />
            Previous
          </span>
          <span key={prev?.id ?? "none"} className={styles.dockName}>
            {prev?.title}
          </span>
        </span>
      </button>

      <span className={styles.dockRule} aria-hidden />

      <button
        type="button"
        className={`${styles.dockButton} ${styles.dockNext}`}
        onClick={() => onStep(1)}
        disabled={!ready}
        aria-label={end ? "Replay from the top" : `Next: ${nextName}`}
      >
        {/* Keyed on the layout, so moving from centred to split re-sets
            the label instead of jumping it across. */}
        <span key={first ? "solo" : "split"} className={styles.dockInner}>
          <span className={styles.dockLabel}>
            {end ? "Replay" : "Next"}
            {end ? <LoopArrow /> : <LineArrow forward />}
          </span>
          <span key={end ? "replay" : next?.id} className={styles.dockName}>
            {nextName}
          </span>
        </span>
      </button>

      <p className={styles.srOnly} aria-live="polite">
        {ready ? STEPS[state.at]?.title : ""}
      </p>
    </nav>
  );
}

/**
 * Where the story stands, for the bar alone: the director writes it as
 * beats pass under a swipe, and only the bar re-renders — never the page.
 */
export interface StepStore {
  get(): StepState;
  set(state: StepState): void;
  subscribe(listener: () => void): () => void;
}

export function createStepStore(initial: StepState): StepStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The site's thin line arrow (Spaces "Line 32"), drawn in currentColor. */
function LineArrow({ forward = false }: { forward?: boolean }) {
  return (
    <svg className={styles.dockArrow} viewBox="0 0 19 8" aria-hidden>
      <path
        d="M18.5 4H.8M4 .7.7 4 4 7.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={forward ? "matrix(-1 0 0 1 19 0)" : undefined}
      />
    </svg>
  );
}

/** Replay: a thin open loop with the same arrowhead. */
function LoopArrow() {
  return (
    <svg className={`${styles.dockArrow} ${styles.dockLoop}`} viewBox="0 0 16 16" aria-hidden>
      <path
        d="M13.4 9.2A5.6 5.6 0 1 1 11.6 3.6M12 .8l.1 3.1-3.1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
