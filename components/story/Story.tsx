"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gsap, ScrollTrigger, useGSAP, MQ } from "@/lib/motion";
import { lenisRef } from "@/lib/lenisStore";
import { CHAPTERS, type Chapter } from "./chapters";
import { createStore, HANDOFF, HANDOFF_VH } from "./store";
import { setNavFlag } from "@/lib/navState";

const Placeholder = () => <div className="absolute inset-0 bg-[#0B0B0B]" />;
const Scene = dynamic(() => import("./Scene"), { ssr: false, loading: Placeholder });
const StillRenders = dynamic(() => import("./Scene").then((m) => m.StillRenders), { ssr: false });

const MOBILE = "(max-width: 767px)";

function useMedia(query: string, serverValue: boolean) {
  return useSyncExternalStore(
    useCallback(
      (cb: () => void) => {
        const mq = window.matchMedia(query);
        mq.addEventListener("change", cb);
        return () => mq.removeEventListener("change", cb);
      },
      [query],
    ),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/* ───────────────────────── small pieces ───────────────────────── */

function TriangleIcon() {
  return (
    <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden="true" focusable="false" className="shrink-0">
      <path d="M4.5 0 9 8H0z" fill="currentColor" />
    </svg>
  );
}
function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="shrink-0">
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChapterText({ ch, i, split }: { ch: Chapter; i: number; split: boolean }) {
  const words = ch.headline.split(" ");
  return (
    <>
      <p className="flex items-center gap-2 font-mono text-[12px] leading-4 tracking-[0.1em] text-fog">
        <TriangleIcon />
        {ch.eyebrow}
      </p>
      <h2
        id={`story-h-${i}`}
        className="text-[30px] leading-[34px] tracking-[-0.03em] text-white md:text-[40px] md:leading-[44px]"
      >
        {split ? (
          <>
            <span className="sr-only">{ch.headline}</span>
            <span aria-hidden="true">
              {words.map((w, k) => (
                <span key={k}>
                  <span data-word className="inline-block">
                    {w}
                  </span>
                  {k < words.length - 1 ? " " : null}
                </span>
              ))}
            </span>
          </>
        ) : (
          ch.headline
        )}
      </h2>
      <p className="max-w-[560px] text-[15px] leading-[1.5] text-pretty text-[#C8C8C8] md:text-[17px]">{ch.body}</p>
      <a
        href={ch.cta.href}
        className="mt-1 inline-flex items-center gap-2 rounded-[8px] bg-forest px-4 py-2.5 text-[15px] leading-5 font-medium text-white transition-colors hover:bg-[#21492F]"
      >
        {ch.cta.label}
        <Chevron />
      </a>
    </>
  );
}

/* ───────────────────────── section ───────────────────────── */

export default function Story() {
  const reduce = useMedia(MQ.reduce, true); // server renders the static, stacked version
  const mobile = useMedia(MOBILE, false);
  const hydrated = useHydrated();
  // Stable wrapper: GSAP pins wrap sibling sections in pin-spacers, so React must never
  // insert relative to siblings when this swaps from the SSR (static) to the pinned layout.
  return (
    <div className="contents">
      {reduce ? <StoryStatic hydrated={hydrated} /> : <StoryPinned mobile={mobile} />}
    </div>
  );
}

/** Reduced motion / no JS: the three chapters stacked, each with a still of its focus state. */
function StoryStatic({ hydrated }: { hydrated: boolean }) {
  const [stills, setStills] = useState<string[] | null>(null);
  const store = useMemo(() => createStore({ still: true, intro: 1 }), []);

  return (
    <section id="story" aria-label="What VoxLayer does" className="relative w-full bg-[#0B0B0B] px-4 py-24 md:px-10 md:py-[140px]">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-24 md:gap-[140px]">
        {CHAPTERS.map((ch, i) => (
          <article key={ch.id} aria-labelledby={`story-h-${i}`} className="flex flex-col items-center gap-10">
            <div aria-hidden="true" className="relative aspect-[1200/760] w-full overflow-hidden rounded-[16px] bg-[#0B0B0B]">
              {stills ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stills[i]} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-col items-center gap-5 text-center">
              <ChapterText ch={ch} i={i} split={false} />
            </div>
          </article>
        ))}
      </div>

      {hydrated && !stills ? (
        <div aria-hidden="true" className="pointer-events-none fixed top-0 -left-[10000px] h-[760px] w-[1200px]">
          <StillRenders store={store} onDone={setStills} />
        </div>
      ) : null}
    </section>
  );
}

function StoryPinned({ mobile }: { mobile: boolean }) {
  const section = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const textWrap = useRef<HTMLDivElement>(null);
  const textInner = useRef<HTMLDivElement>(null);
  const pinRef = useRef<ScrollTrigger | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const store = useMemo(() => createStore(), []);
  const [active, setActive] = useState(false);

  useGSAP(
    () => {
      const sec = section.current!;
      const lay = layer.current!;
      const wrap = textWrap.current!;
      const articles = gsap.utils.toArray<HTMLElement>("[data-chapter]", sec);
      const vh = () => window.innerHeight;
      const pinVh = mobile ? 3 : 4;
      let current = 0;

      // Inactive chapters stay in the accessibility tree (opacity only, never display/visibility).
      gsap.set(articles, { opacity: (i: number) => (i === 0 ? 1 : 0), y: 0 });
      articles.forEach((a, i) => (a.style.pointerEvents = i === 0 ? "auto" : "none"));

      const applyFade = () => {
        lay.style.opacity = String(store.intro * (1 - 0.8 * store.sink) * (1 - store.exit));
      };
      // Desktop: the pin is extended while the green stat panel rises over this section.
      const extraVh = mobile ? 0 : HANDOFF_VH;

      const show = (idx: number) => {
        if (idx === current) return;
        current = idx;
        articles.forEach((a, i) => {
          a.style.pointerEvents = i === idx ? "auto" : "none";
          if (i !== idx) gsap.to(a, { y: -24, opacity: 0, duration: 0.35, ease: "power2.in", overwrite: true });
        });
        const next = articles[idx];
        gsap.fromTo(next, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, delay: 0.1, ease: "power3.out", overwrite: true });
        gsap.fromTo(
          next.querySelectorAll("[data-word]"),
          { xPercent: 30, opacity: 0 },
          { xPercent: 0, opacity: 1, duration: 0.5, delay: 0.1, stagger: 0.04, ease: "power3.out", overwrite: true },
        );
      };

      // PART 2 — pinned chapters with snapping. The scene reads `store.chapter` continuously.
      // ScrollTrigger decides *when* and *where* to snap (directional: one gesture = next chapter);
      // the glide itself is handed to Lenis, because a GSAP snap tween and Lenis' own smoothing
      // would otherwise fight over the scroll position and bounce back.
      const POINTS = [0, 0.5, 1];
      // Where the current scroll gesture began (the resting position before it). A gesture that
      // starts above the chapters (from the hero) lands on chapter 1, one that starts below them
      // (back up from the stat panel) lands on chapter 3; inside, one gesture = one chapter.
      let gestureStartY = window.scrollY;
      let lastY = window.scrollY;
      let lastT = 0;
      const onScroll = () => {
        const now = performance.now();
        if (now - lastT > 220) gestureStartY = lastY;
        lastT = now;
        lastY = window.scrollY;
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      const snapTo = (_: number, st?: ScrollTrigger) => {
        const self = st!;
        const p = self.progress;
        // ScrollTrigger checks the range only after calling this, so guard here: never glide
        // into the chapters from outside them (e.g. the check that runs right after a refresh).
        const sy = window.scrollY;
        if (sy < self.start - 1 || sy > self.end + 1) return p;
        const dir = self.direction;
        const target =
          gestureStartY < self.start - 2
            ? 0
            : gestureStartY > self.end + 2
              ? 1
              : dir > 0
                ? (POINTS.find((x) => x >= p - 0.002) ?? 1)
                : ([...POINTS].reverse().find((x) => x <= p + 0.002) ?? 0);
        const lenis = lenisRef.current;
        if (!lenis) return target; // no smoothing: let ScrollTrigger tween it
        const y = self.start + target * (self.end - self.start);
        const dist = Math.abs(y - window.scrollY) / ((self.end - self.start) / 2);
        if (dist > 0.002) {
          lenis.scrollTo(y, {
            duration: gsap.utils.clamp(0.6, 0.9, 0.9 * dist),
            easing: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), // power2.inOut
          });
        }
        return p; // nothing for ScrollTrigger to tween
      };
      const pin = ScrollTrigger.create({
        trigger: sec,
        start: "top top",
        end: () => `+=${vh() * (pinVh + extraVh)}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        // Its pin spacing moves everything below (the stat layer pins against it): measure it first.
        refreshPriority: 1,
      });
      pinRef.current = pin;
      // Nav boundary 1: hide the nav the moment chapter 1 reaches the top of the viewport;
      // scrolling back above it shows it again. (Boundary 2, the reveal, lives in Stat.)
      // `top+=1`: chapter 1's snap point is exactly "top top", and ScrollTrigger counts
      // scroll === start as *before* the trigger, so the nav would reappear on every snap.
      ScrollTrigger.create({
        trigger: sec,
        start: "top top+=1",
        end: "max",
        onEnter: () => setNavFlag("story", true),
        onLeaveBack: () => setNavFlag("story", false),
        onRefresh: (self) => setNavFlag("story", self.scroll() >= self.start),
      });
      // Chapters (and snapping) cover only the first part of the pin.
      const chapters = ScrollTrigger.create({
        trigger: sec,
        start: "top top",
        end: () => `+=${vh() * pinVh}`,
        invalidateOnRefresh: true,
        snap: { snapTo, delay: 0.05, inertia: false },
        onUpdate(self) {
          store.chapter = self.progress * 2;
          show(Math.round(self.progress * 2));
        },
      });

      // Desktop hand-off: while the panel rises, the chapter text dims and lifts, and the
      // computer sinks back (scale 1 → 0.9, opacity → 0.2).
      if (extraVh) {
        const rise = {
          start: () => chapters.end,
          end: () => chapters.end + vh() * HANDOFF.rise,
          scrub: true,
          invalidateOnRefresh: true,
        };
        gsap.fromTo(textInner.current, { opacity: 1, y: 0 }, { opacity: 0.35, y: -40, ease: "none", scrollTrigger: rise });
        gsap.fromTo(store, { sink: 0 }, { sink: 1, ease: "none", onUpdate: applyFade, scrollTrigger: rise });
      }

      // PART 1 (end) — the computer fades in from depth as the hero exit completes.
      gsap.fromTo(
        store,
        { intro: 0 },
        { intro: 1, ease: "none", onUpdate: applyFade, scrollTrigger: { trigger: sec, start: "top 40%", end: "top top", scrub: true } },
      );
      gsap.fromTo(
        wrap,
        { opacity: 0 },
        { opacity: 1, ease: "none", scrollTrigger: { trigger: sec, start: "top 20%", end: "top top", scrub: true } },
      );

      // PART 3 — after unpinning the computer sinks back while the next section scrolls over it.
      gsap.fromTo(
        store,
        { exit: 0 },
        {
          exit: 1,
          ease: "none",
          onUpdate: applyFade,
          scrollTrigger: { start: () => pin.end, end: () => pin.end + vh(), scrub: true, invalidateOnRefresh: true },
        },
      );

      // Render loop only runs while the scene can be seen.
      ScrollTrigger.create({
        trigger: sec,
        start: "top 50%",
        end: () => pin.end + vh(),
        invalidateOnRefresh: true,
        onToggle(self) {
          lay.style.visibility = self.isActive ? "visible" : "hidden";
          setActive(self.isActive);
        },
      });

      // Keyboard: focusing anything inside a chapter glides to that chapter (Tab never lands on invisible text).
      const scrollToY = (y: number) => {
        const lenis = lenisRef.current;
        if (lenis) lenis.scrollTo(y, { duration: 0.9 });
        else window.scrollTo({ top: y });
      };
      const onFocus = (e: FocusEvent) => {
        const art = (e.target as HTMLElement).closest<HTMLElement>("[data-chapter]");
        if (!art) return;
        const i = articles.indexOf(art);
        const y = chapters.start + ((chapters.end - chapters.start) * i) / 2;
        if (Math.abs(window.scrollY - y) > 2) scrollToY(y);
      };
      sec.addEventListener("focusin", onFocus);

      const onMove = (e: PointerEvent) => {
        store.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        store.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      if (!mobile) window.addEventListener("pointermove", onMove, { passive: true });

      // This section may mount after later sections created their triggers: re-order and re-measure.
      // Deferred to the next frame on purpose: a refresh *inside* this context re-runs other
      // sections' function-based tweens while this context is active, so GSAP files them under it,
      // and reverting this section (Strict Mode, crossing 768px) would then kill the hero's animation.
      const refreshId = requestAnimationFrame(() => {
        ScrollTrigger.sort();
        ScrollTrigger.refresh();
      });

      return () => {
        setNavFlag("story", false);
        cancelAnimationFrame(refreshId);
        sec.removeEventListener("focusin", onFocus);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointermove", onMove);
      };
    },
    { scope: section, dependencies: [mobile], revertOnUpdate: true },
  );

  const skip = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = end.current!;
    // Land where the pin releases (the stat panel in place), not below it.
    const y = pinRef.current ? pinRef.current.end : el.getBoundingClientRect().top + window.scrollY;
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y });
    el.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="relative z-[60] h-0">
        <a
          href="#story-end"
          onClick={skip}
          className="sr-only rounded-[8px] bg-white px-[18px] py-3 text-[14px] text-ink focus:not-sr-only focus:absolute focus:top-24 focus:left-4"
        >
          Skip animation
        </a>
      </div>

      {/* Decorative 3D layer: fixed behind the pinned text, hidden from assistive tech. */}
      <div
        ref={layer}
        aria-hidden="true"
        className="pointer-events-none invisible fixed inset-0 z-0 bg-[#0B0B0B] opacity-0"
      >
        <Scene store={store} mobile={mobile} active={active} />
        {/* Scrim under the text block: keeps body copy well above 4.5:1 whatever the scene draws. */}
        <div className="absolute inset-x-0 bottom-0 h-[52%] bg-[linear-gradient(to_bottom,rgba(11,11,11,0)_0%,rgba(11,11,11,0.82)_22%,rgba(11,11,11,0.92)_100%)]" />
      </div>

      <section ref={section} id="story" aria-label="What VoxLayer does" className="relative z-[1] h-svh w-full">
        <div
          ref={textWrap}
          className="absolute inset-x-0 top-[52%] bottom-[4%] flex items-center justify-center px-6 md:top-[56%] md:bottom-[6%] md:px-10"
        >
          <div ref={textInner} className="grid w-full max-w-[640px] place-items-center">
            {CHAPTERS.map((ch, i) => (
              <article
                key={ch.id}
                data-chapter={i}
                aria-labelledby={`story-h-${i}`}
                className="flex flex-col items-center gap-3 text-center [grid-area:1/1] md:gap-4"
              >
                <ChapterText ch={ch} i={i} split />
              </article>
            ))}
          </div>
        </div>
      </section>
      <div id="story-end" ref={end} tabIndex={-1} className="outline-none" />
    </>
  );
}
