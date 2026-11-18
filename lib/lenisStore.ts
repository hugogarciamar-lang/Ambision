import type Lenis from "lenis";

/** The active Lenis instance (null when smoothing is off, e.g. reduced motion). */
export const lenisRef: { current: Lenis | null } = { current: null };
