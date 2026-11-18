"use client";

import { gsap } from "gsap";
import { MQ } from "./motion";

/**
 * Nav visibility during the 3D story.
 *
 * Two independent boundary triggers report a flag each (no scroll-direction heuristics):
 *  - `story`: chapter 1 has reached the top of the viewport (set by Story).
 *  - `stat`:  the green stat panel has started rising into view (set by Stat).
 * The nav is hidden while `story && !stat`. Each trigger's onLeaveBack clears its own flag,
 * so both scroll directions reverse correctly.
 *
 * Accessibility: the nav is only moved with transform/opacity (never display/visibility/aria-hidden),
 * so it stays keyboard-reachable; any focus inside it brings it straight back. Under reduced
 * motion it never hides.
 */
type Flag = "story" | "stat";
const flags: Record<Flag, boolean> = { story: false, stat: false };
let el: HTMLElement | null = null;
let shownState: boolean | null = null;

function apply(immediate = false) {
  if (!el) return;
  const reduce = window.matchMedia(MQ.reduce).matches;
  const focused = el.matches(":focus-within");
  const hidden = !reduce && !focused && flags.story && !flags.stat;
  const show = !hidden;
  if (show === shownState && !immediate) return;
  shownState = show;
  el.style.pointerEvents = hidden ? "none" : "";
  if (focused) {
    // Focus moved inside the hidden nav: snap it back into place, then fade it in.
    gsap.killTweensOf(el);
    gsap.set(el, { yPercent: 0 });
    gsap.to(el, { opacity: 1, duration: 0.2, ease: "power2.out" });
    return;
  }
  gsap.to(el, {
    yPercent: hidden ? -100 : 0,
    opacity: hidden ? 0 : 1,
    duration: immediate ? 0 : 0.45,
    ease: "power2.inOut",
    overwrite: true,
  });
}

export function setNavFlag(flag: Flag, value: boolean) {
  if (flags[flag] === value) return;
  flags[flag] = value;
  apply();
}

/** Called by the Nav on mount; returns a cleanup. */
export function registerNav(node: HTMLElement) {
  el = node;
  shownState = null;
  // Chrome scrolls a transformed-off focus target into view *before* focusin fires, which would
  // throw the reader out of the 3D story. Scroll events are async, so `lastY` still holds the
  // position from before that jump: restore it in the same task (no frame is painted in between).
  let lastY = window.scrollY;
  const onScroll = () => (lastY = window.scrollY);
  const onFocusIn = () => {
    const wasHidden = shownState === false;
    apply();
    // Native scrollTo, not lenis.scrollTo: Lenis hasn't seen the jump yet, so its target still equals
    // lastY and it would early-return. Restoring natively puts the page back where Lenis thinks it is.
    if (wasHidden && Math.abs(window.scrollY - lastY) > 1) window.scrollTo(0, lastY);
  };
  // focusout fires before focus lands elsewhere; re-check once it has settled.
  const onFocusOut = () => requestAnimationFrame(() => apply());
  const mq = window.matchMedia(MQ.reduce);
  const onMq = () => apply();
  window.addEventListener("scroll", onScroll, { passive: true });
  node.addEventListener("focusin", onFocusIn);
  node.addEventListener("focusout", onFocusOut);
  mq.addEventListener("change", onMq);
  apply(true);

  // Publish the nav height so sections can lay out below it (coverage card offset).
  const publish = () => document.documentElement.style.setProperty("--nav-h", `${node.offsetHeight}px`);
  publish();
  const ro = new ResizeObserver(publish);
  ro.observe(node);

  return () => {
    window.removeEventListener("scroll", onScroll);
    node.removeEventListener("focusin", onFocusIn);
    node.removeEventListener("focusout", onFocusOut);
    mq.removeEventListener("change", onMq);
    ro.disconnect();
    gsap.killTweensOf(node);
    node.style.transform = "";
    node.style.opacity = "";
    node.style.pointerEvents = "";
    if (el === node) el = null;
  };
}

/** Current nav height in px (falls back to the design value before the nav has mounted). */
export function navHeight() {
  return el?.offsetHeight ?? 80;
}
