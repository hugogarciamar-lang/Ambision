"use client";

import { useRef } from "react";
import { gsap, useGSAP, MQ, whileVisible } from "@/lib/motion";

const RINGS = [
  { d: "M290 180a80 80 0 010 120", c: "#1E1A15" },
  { d: "M325 145a130 130 0 010 190", c: "#1E1A15" },
  { d: "M360 110a180 180 0 010 260", c: "#1E1A15B3" },
  { d: "M395 75a230 230 0 010 330", c: "#1E1A1580" },
  { d: "M430 40a280 280 0 010 400", c: "#1E1A154D" },
  { d: "M465 5a330 330 0 010 470", c: "#1E1A1526" },
];

export default function CTA() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const rings = gsap.utils.toArray<SVGPathElement>("[data-ring]", root.current);
        // Each ring swells outward and brightens in turn — a 2.4s sound pulse.
        const tl = gsap.timeline({ repeat: -1, paused: true });
        rings.forEach((r, i) => {
          tl.fromTo(
            r,
            { scale: 0.97, opacity: 0.35 },
            { scale: 1.05, opacity: 1, duration: 0.6, ease: "sine.out", yoyo: true, repeat: 1, immediateRender: false },
            i * 0.2,
          );
        });
        tl.to({}, { duration: 2.4 - tl.duration() }, tl.duration());
        gsap.set(rings, { opacity: 0.35, scale: 0.97, svgOrigin: "200 240" });

        const stop = whileVisible(
          root.current!,
          () => {
            rings.forEach((r) => (r.style.willChange = "transform, opacity"));
            tl.play();
          },
          () => {
            tl.pause();
            rings.forEach((r) => (r.style.willChange = "auto"));
          },
        );
        return () => {
          stop();
          tl.kill();
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="demo" aria-labelledby="cta-title" className="flex w-full bg-paper px-4 pb-4">
      <div className="relative flex min-h-[560px] w-full min-w-0 flex-col justify-end gap-7 overflow-clip rounded-lg bg-sand p-7 md:p-16">
        <svg
          aria-hidden="true"
          focusable="false"
          width="560"
          height="480"
          viewBox="0 0 560 480"
          className="pointer-events-none absolute top-6 -right-48 opacity-50 md:top-10 md:right-7 md:opacity-100"
        >
          <path d="M140 160h40l60-50v260l-60-50h-40z" fill="none" stroke="#1E1A15" strokeWidth="1.5" />
          {RINGS.map((r) => (
            <path key={r.d} data-ring d={r.d} fill="none" stroke={r.c} strokeWidth="1.2" />
          ))}
        </svg>
        <h2
          id="cta-title"
          className="relative max-w-[640px] text-[40px] leading-[44px] tracking-[-0.035em] text-ink md:text-[64px] md:leading-[66px]"
        >
          Their independence.
          <br />
          Your compliance.
        </h2>
        <p className="relative max-w-[460px] text-[17px] leading-[26px] text-[#1E1A15] md:text-[18px] md:leading-[27px]">
          Book a demo and hear a real work task done with no keyboard and no screen.
        </p>
        <div className="relative flex">
          <a
            href="mailto:hello@voxlayer.example?subject=VoxLayer%20demo"
            className="rounded-sm bg-ink px-[22px] py-3.5 text-[15px] leading-[18px] font-medium text-white hover:bg-[#222]"
          >
            Book a demo
          </a>
        </div>
      </div>
    </section>
  );
}
