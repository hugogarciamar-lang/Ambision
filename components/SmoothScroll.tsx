"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, MQ } from "@/lib/motion";
import { lenisRef } from "@/lib/lenisStore";

/**
 * Lenis smooth scrolling wired into ScrollTrigger.
 * Disabled entirely under prefers-reduced-motion (native scrolling, no smoothing).
 */
export default function SmoothScroll() {
  useEffect(() => {
    const mq = window.matchMedia(MQ.reduce);
    let lenis: Lenis | null = null;
    let raf: ((time: number) => void) | null = null;

    const start = () => {
      // When `lerp` is set Lenis uses it for wheel smoothing; `duration` drives programmatic scrollTo.
      lenis = new Lenis({ duration: 1.2, lerp: 0.1, anchors: true, autoRaf: false });
      lenisRef.current = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      raf = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    };
    const stop = () => {
      if (raf) gsap.ticker.remove(raf);
      lenis?.destroy();
      lenis = null;
      lenisRef.current = null;
      raf = null;
    };
    const sync = () => (mq.matches ? stop() : lenis ? undefined : start());

    sync();
    mq.addEventListener("change", sync);

    // Re-measure triggers once webfonts settle line lengths.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      mq.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return null;
}
