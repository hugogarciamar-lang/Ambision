"use client";

import { useRef } from "react";
import { gsap, useGSAP, MQ, whileVisible, willChangeWhileActive } from "@/lib/motion";
import { BARS, TARGETS, VB_H, VB_W, BAR_W } from "./data";
import { createHeroEngine } from "./engine";
import { screenTarget } from "@/components/story/store";

const CORNERS = [
  { k: "tl", style: { borderTopWidth: 2, borderLeftWidth: 2 } },
  { k: "tr", style: { borderTopWidth: 2, borderRightWidth: 2 } },
  { k: "bl", style: { borderBottomWidth: 2, borderLeftWidth: 2 } },
  { k: "br", style: { borderBottomWidth: 2, borderRightWidth: 2 } },
] as const;

export default function Hero() {
  const wrap = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const bars = Array.from(svg.current!.querySelectorAll<SVGRectElement>(".wave-bar"));
      const layers = gsap.utils.toArray<HTMLElement>("[data-depth]", layer.current!);
      const mm = gsap.matchMedia();

      // `reduce` guarantees the handler also runs (statically) under reduced motion.
      mm.add({ motion: MQ.motion, reduce: MQ.reduce, mobile: "(max-width: 767px)" }, (ctx) => {
        const { motion, mobile } = ctx.conditions as { motion: boolean; mobile: boolean };
        // Mobile shows two targets; the CELL tag is dropped.
        const defs = TARGETS.slice(0, mobile ? 2 : 3);
        if (mobile) gsap.set(layers[2], { display: "none" });
        gsap.set(layer.current, { autoAlpha: 1 });

        const engine = createHeroEngine({ card: card.current!, bars, layers, defs, animated: motion });
        if (!motion) return () => engine.destroy(); // reduced motion: static, framed, fully typed

        const stopVisible = whileVisible(card.current!, engine.start, engine.stop);

        // Scrubbed exit: the card is held in place and sinks into depth while the page turns
        // white → black and the story section (next) slides up over it.
        const w = wrap.current!;
        const range = () => w.offsetTop + w.offsetHeight; // ≈ 100vh: nav + hero
        const root = document.documentElement;
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: w,
            start: 0,
            end: range,
            scrub: true,
            pin: true,
            pinSpacing: false,
            invalidateOnRefresh: true,
            ...willChangeWhileActive([card.current, svg.current, headline.current, ...layers]),
          },
        });
        // The card flies back into the 3D computer: it shrinks onto the screen's exact on-screen
        // rect (published live by the scene), takes on its tilt, then cross-fades into it.
        const c = card.current!;
        const morph = { p: 0 };
        const applyMorph = () => {
          const p = morph.p;
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const W = c.offsetWidth;
          const H = c.offsetHeight;
          const r = screenTarget.rect ?? { cx: vw / 2, cy: vh * 0.32, w: vw * 0.3, h: vw * 0.3 * 0.62, rx: 6, ry: -10 };
          const box = w.getBoundingClientRect(); // pinned section: stable while the card moves
          const dx = r.cx - (box.left + c.offsetLeft + W / 2);
          const dy = r.cy - (box.top + c.offsetTop + H / 2);
          const sx = 1 + (r.w / W - 1) * p;
          const sy = 1 + (r.h / H - 1) * p;
          const radius = 24 + (10 - 24) * p; // visual corner radius, compensated for the scale
          c.style.transform = `translate(${dx * p}px, ${dy * p}px) rotateX(${r.rx * p}deg) rotateY(${r.ry * p}deg) scale(${sx}, ${sy})`;
          c.style.borderRadius = `${radius / sx}px / ${radius / sy}px`;
        };
        tl.to(morph, { p: 1, duration: 0.78, ease: "power2.inOut", onUpdate: applyMorph }, 0)
          .to(c, { opacity: 0, duration: 0.26 }, 0.74)
          .to(headline.current, { opacity: 0, y: -24, duration: 0.5 }, 0)
          // Waveform spreads out and sinks; targets fly apart from it.
          .to(svg.current, { scaleX: 1.3, scaleY: 0.6, y: () => window.innerHeight * 0.06, opacity: 0, duration: 0.65 }, 0)
          .fromTo(root, { "--page-bg": "#FFFFFF" }, { "--page-bg": "#0B0B0B", duration: 1 }, 0)
          // Nav colours cross-fade around the midpoint of the background change.
          .fromTo(
            root,
            { "--nav-fg": "#000000", "--nav-line": "#EAEAEA", "--nav-btn-bg": "#000000", "--nav-btn-fg": "#FFFFFF" },
            { "--nav-fg": "#FFFFFF", "--nav-line": "#2A2A2A", "--nav-btn-bg": "#FFFFFF", "--nav-btn-fg": "#000000", duration: 0.4 },
            0.3,
          );
        defs.forEach((def, i) => {
          tl.to(
            layers[i],
            {
              x: () => def.drift * Math.min(240, w.offsetWidth * 0.18),
              y: () => (def.speed - 1) * window.innerHeight * 0.5,
              duration: 1,
            },
            0,
          ).to(layers[i], { opacity: 0, duration: 0.45 }, 0.25);
        });

        return () => {
          stopVisible();
          engine.destroy();
          c.style.transform = "";
          c.style.borderRadius = "";
        };
      });

      return () => mm.revert();
    },
    { scope: wrap },
  );

  return (
    <section
      ref={wrap}
      id="top"
      aria-labelledby="hero-title"
      className="flex w-full px-4 pb-4"
      style={{ perspective: "1400px" }}
    >
      <div
        ref={card}
        className="relative h-[calc(100svh-96px)] min-h-[480px] w-full min-w-0 overflow-clip rounded-lg bg-[#0B0B0B]"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <svg
            ref={svg}
            aria-hidden="true"
            focusable="false"
            className="absolute inset-0 h-full w-full opacity-50"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid slice"
          >
            {BARS.map(([x, y, h, a], i) => (
              <rect key={i} className="wave-bar" x={x} y={y} width={BAR_W} height={h} rx={4} fill={`#FFFFFF${a}`} />
            ))}
          </svg>

          {/* Annotation targets — decorative, hidden until the engine positions them. */}
          <div ref={layer} aria-hidden="true" className="pointer-events-none invisible absolute inset-0 opacity-0">
            {TARGETS.map((d) => (
              <div key={d.id} data-depth={d.id} className="absolute inset-0">
                <div data-p="fill" className="t-piece h-[100px] w-[100px]" style={{ background: d.fill, opacity: 0.5 }} />
                <div data-p="top" className="t-piece h-[1.5px] w-[100px]" style={{ background: d.color }} />
                <div data-p="bottom" className="t-piece h-[1.5px] w-[100px]" style={{ background: d.color }} />
                <div data-p="left" className="t-piece h-[100px] w-[1.5px]" style={{ background: d.color }} />
                <div data-p="right" className="t-piece h-[100px] w-[1.5px]" style={{ background: d.color }} />
                {CORNERS.map((c) => (
                  <div
                    key={c.k}
                    data-p={c.k}
                    className="t-piece size-[10px] border-solid"
                    style={{ borderColor: d.color, borderWidth: 0, ...c.style }}
                  />
                ))}
                <div
                  data-p="chip"
                  data-text={d.labels[0]}
                  className="t-piece t-chip ps-text px-2 py-1 font-mono text-[12px] leading-4 tracking-[0.04em]"
                  style={{
                    background: d.chip.bg,
                    color: d.chip.fg,
                    border: d.chip.border ? `1.5px solid ${d.chip.border}` : undefined,
                    paddingBlock: d.chip.border ? 2.5 : undefined,
                  }}
                />
                {d.quote && (
                  <div
                    data-p="quote"
                    data-text={d.quote}
                    className="t-piece ps-text font-mono text-[14px] leading-[22px] whitespace-nowrap text-[#FFFFFFD9]"
                  />
                )}
              </div>
            ))}
          </div>

          <div ref={headline} className="relative z-10 flex w-full max-w-[980px] flex-col items-center gap-7 px-6 text-center">
            <h1
              id="hero-title"
              className="text-[44px] leading-[48px] tracking-[-0.035em] text-white md:text-[64px] md:leading-[68px] lg:text-[80px] lg:leading-[84px]"
            >
              A computer you can use with no screen and no keyboard.
            </h1>
            <p className="max-w-[620px] text-[17px] leading-[26px] text-[#FFFFFFB8] md:text-[19px] md:leading-[28px]">
              VoxLayer turns any Windows, macOS or Linux machine into a voice-and-sound system — so people who
              can’t see or touch it can work completely on their own.
            </p>
          </div>

          <a
            href="#how-it-works"
            className="group absolute right-5 bottom-5 z-10 flex items-center gap-3.5 text-[14px] leading-[18px] text-white md:right-8 md:bottom-8"
          >
            Listen to the demo
            <span className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-[#FFFFFF99] transition-colors group-hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M8 2v12M3 9l5 5 5-5" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
