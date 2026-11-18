"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export { gsap, ScrollTrigger, useGSAP };

/**
 * matchMedia conditions shared by every section.
 * Each section renders its *final* state in markup; JS only sets "from" states
 * inside a non-reduced condition, so reduced motion (or no JS) = complete static page.
 */
export const MQ = {
  desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
  mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
} as const;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia(MQ.reduce).matches;
}

/** Toggle will-change only while a scroll-driven animation is active. */
export function willChangeWhileActive(targets: gsap.TweenTarget, value = "transform, opacity") {
  const els = gsap.utils.toArray<HTMLElement>(targets);
  return {
    onToggle(self: ScrollTrigger) {
      const v = self.isActive ? value : "auto";
      els.forEach((el) => (el.style.willChange = v));
    },
  };
}

/**
 * Runs `start` while `el` is on screen and `stop` while it's off screen.
 * Used to pause every looping animation outside the viewport.
 */
export function whileVisible(el: Element, start: () => void, stop: () => void, rootMargin = "0px") {
  let running = false;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        start();
      } else if (!entry.isIntersecting && running) {
        running = false;
        stop();
      }
    },
    { rootMargin },
  );
  io.observe(el);
  return () => {
    io.disconnect();
    if (running) stop();
  };
}

/** Typewriter that writes into a node's textContent; returns a tween you can kill. */
export function typeInto(el: HTMLElement, text: string, cps = 45) {
  const state = { n: 0 };
  el.textContent = "";
  return gsap.to(state, {
    n: text.length,
    duration: text.length / cps,
    ease: "none",
    onUpdate() {
      const n = Math.round(state.n);
      const next = n < text.length ? text.slice(0, n) + "▍" : text;
      if (el.textContent !== next) el.textContent = next;
    },
  });
}
