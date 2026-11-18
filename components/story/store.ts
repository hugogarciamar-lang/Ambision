/**
 * Mutable state shared between the DOM scroll logic and the 3D scene.
 * Written by ScrollTrigger callbacks, read inside useFrame — never triggers React renders.
 */
export type StoryStore = {
  /** Continuous chapter position from scroll: 0 = Voice, 1 = Screen layers, 2 = Sound field. */
  chapter: number;
  /** Intro (fade in from depth) progress, 0..1. */
  intro: number;
  /** Exit (sink back) progress, 0..1. */
  exit: number;
  /** Desktop: being covered by the stat panel, 0..1 (scale 1 → 0.9, opacity → 0.2). */
  sink: number;
  /** Pointer in -1..1, used for parallax tilt. */
  pointer: { x: number; y: number };
  /** Static mode: no smoothing, no idle motion (used for reduced-motion still renders). */
  still: boolean;
  /** Clock override for still renders. */
  time?: number;
};

/**
 * Where the 3D computer's screen lands on the viewport in chapter 1 (CSS px), published by the
 * scene so the hero card can shrink into exactly that spot and cross-fade into it.
 * `rx`/`ry` are CSS rotations (deg) that approximate the screen's perspective tilt.
 */
export type ScreenRect = { cx: number; cy: number; w: number; h: number; rx: number; ry: number };
export const screenTarget: { rect: ScreenRect | null } = { rect: null };

/**
 * Desktop hand-off into the green stat panel, in viewport heights. The story pin is extended by
 * rise + fill and the stat layer pins for the same range, so both unpin on the same frame.
 */
export const HANDOFF = { rise: 1, fill: 0.6 } as const;
export const HANDOFF_VH = HANDOFF.rise + HANDOFF.fill;

export function createStore(init: Partial<StoryStore> = {}): StoryStore {
  return { chapter: 0, intro: 0, exit: 0, sink: 0, pointer: { x: 0, y: 0 }, still: false, ...init };
}
