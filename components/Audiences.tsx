"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, MQ, whileVisible } from "@/lib/motion";

const ic = { fill: "none", stroke: "#000", strokeWidth: 1.5 };

const CARDS = [
  {
    title: "Full independence for study, work and daily digital life.",
    who: "Blind, low-vision & motor-impaired users",
    icon: (<><circle cx="12" cy="8" r="4" {...ic} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...ic} /></>),
  },
  {
    title: "Accessible computers for every student, ready on day one of term.",
    who: "Schools & universities",
    icon: (<><path d="M2 9l10-5 10 5-10 5z" {...ic} /><path d="M6 11v5c2 2 10 2 12 0v-5" {...ic} /></>),
  },
  {
    title: "Hire disabled talent and meet accessibility law with real, measurable usability.",
    who: "Employers & governments",
    icon: (<><rect x="3" y="7" width="18" height="13" rx="2" {...ic} /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" {...ic} /></>),
  },
  {
    title: "Ship machines that meet the European Accessibility Act out of the box.",
    who: "Hardware makers & integrators",
    icon: (<><rect x="3" y="4" width="18" height="12" rx="2" {...ic} /><path d="M8 20h8M12 16v4" {...ic} /></>),
  },
];

const SPEED = 30; // px/s

export default function Audiences() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const api = useRef<{ step: (dir: 1 | -1) => void; setUserPaused: (p: boolean) => void } | null>(null);
  const [userPaused, setUserPaused] = useState(false);

  useGSAP(
    () => {
      const el = track.current!;
      const section = root.current!;
      const firstSet = Array.from(el.children).slice(0, CARDS.length) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add({ motion: MQ.motion, reduce: MQ.reduce }, (ctx) => {
        const motion = !!ctx.conditions!.motion;
        const s = { pos: 0 };
        let hover = false, focus = false, user = false, stepping = 0;
        let setW = 0, cardStep = 0;

        const measure = () => {
          const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
          cardStep = firstSet[0].offsetWidth + gap;
          setW = cardStep * CARDS.length;
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);

        const render = () => {
          const x = setW ? -(((s.pos % setW) + setW) % setW) : 0;
          el.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
        };
        const tick = (_: number, dt: number) => {
          if (motion && !hover && !focus && !user && !stepping) s.pos += (SPEED * Math.min(dt, 50)) / 1000;
          render();
        };

        api.current = {
          step(dir) {
            if (!motion) {
              s.pos += dir * cardStep;
              render();
              return;
            }
            stepping++;
            // Snap to card boundaries so repeated clicks stay aligned.
            const target = Math.round((s.pos + dir * cardStep) / cardStep) * cardStep;
            gsap.to(s, { pos: target, duration: 0.6, ease: "power2.inOut", overwrite: true, onUpdate: render, onComplete: () => void stepping--, onInterrupt: () => void stepping-- });
          },
          setUserPaused(p) {
            user = p;
          },
        };

        const onEnter = () => (hover = true);
        const onLeave = () => (hover = false);
        const onFocusIn = () => (focus = true);
        const onFocusOut = (e: FocusEvent) => {
          if (!section.contains(e.relatedTarget as Node)) focus = false;
        };
        el.addEventListener("pointerenter", onEnter);
        el.addEventListener("pointerleave", onLeave);
        section.addEventListener("focusin", onFocusIn);
        section.addEventListener("focusout", onFocusOut);

        const stop = motion
          ? whileVisible(
              section,
              () => {
                el.style.willChange = "transform";
                gsap.ticker.add(tick);
              },
              () => {
                gsap.ticker.remove(tick);
                el.style.willChange = "auto";
              },
            )
          : () => {};

        return () => {
          stop();
          ro.disconnect();
          el.removeEventListener("pointerenter", onEnter);
          el.removeEventListener("pointerleave", onLeave);
          section.removeEventListener("focusin", onFocusIn);
          section.removeEventListener("focusout", onFocusOut);
          el.style.transform = "";
          api.current = null;
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  const togglePause = () => {
    const next = !userPaused;
    setUserPaused(next);
    api.current?.setUserPaused(next);
  };

  const btn =
    "flex size-11 shrink-0 items-center justify-center rounded-sm border border-[#CFCFCF] bg-paper transition-colors hover:bg-mist";

  return (
    <section
      ref={root}
      id="audiences"
      aria-labelledby="audiences-title"
      className="flex w-full flex-col gap-10 overflow-x-clip bg-paper px-4 py-24 md:px-10 md:py-[120px]"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h2
          id="audiences-title"
          className="max-w-[640px] text-[32px] leading-[36px] tracking-[-0.03em] text-ink md:text-[44px] md:leading-[48px]"
        >
          Built for the people who need it — and the organizations that must provide it.
        </h2>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={togglePause} aria-pressed={userPaused} aria-label="Pause card carousel">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              {userPaused ? (
                <path d="M5 3l8 5-8 5z" fill="#000" />
              ) : (
                <path d="M5 3v10M11 3v10" stroke="#000" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <button type="button" className={btn} onClick={() => api.current?.step(-1)} aria-label="Previous card">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M10 3L5 8l5 5" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className={btn} onClick={() => api.current?.step(1)} aria-label="Next card">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M6 3l5 5-5 5" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="w-full">
        <div ref={track} className="flex w-max gap-4">
          {[0, 1].map((copy) =>
            CARDS.map((c) => (
              <div
                key={`${copy}-${c.who}`}
                aria-hidden={copy === 1 ? true : undefined}
                className="flex h-[300px] w-[280px] shrink-0 flex-col justify-between gap-[72px] rounded-[12px] bg-mist p-7 md:w-[calc((min(100vw,1440px)-80px-48px)/4)] md:min-w-[300px]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-white">
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    {c.icon}
                  </svg>
                </div>
                <div className="flex flex-col gap-5">
                  <h3 className="text-[20px] leading-[28px] tracking-[-0.01em] text-ink">{c.title}</h3>
                  <p className="text-[13px] leading-4 text-muted">{c.who}</p>
                </div>
              </div>
            )),
          )}
        </div>
      </div>
    </section>
  );
}
