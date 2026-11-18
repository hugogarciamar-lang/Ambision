"use client";

import { useRef } from "react";
import { gsap, useGSAP, MQ, willChangeWhileActive } from "@/lib/motion";
import { LogoMark } from "./Logo";

const COLS = [
  { title: "Product", links: ["Voice layer", "Sound profiles", "Braille & haptics", "Data-entry mode"] },
  { title: "Organizations", links: ["Education", "Enterprise", "Public sector", "OEM partners"] },
  { title: "Compliance", links: ["European Accessibility Act", "Ley 11/2023", "Usability reports"] },
  { title: "Company", links: ["About", "Impact", "Contact", "Privacy"] },
];

const GIANT = ["A computer for everyone", "who can’t see or touch one."];

export default function Footer() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const lines = gsap.utils.toArray<HTMLElement>("[data-giant-line]", root.current);
        gsap.fromTo(
          lines,
          { yPercent: 105 },
          {
            yPercent: 0,
            ease: "power2.out",
            stagger: 0.3,
            scrollTrigger: {
              trigger: "[data-giant]",
              start: "top 95%",
              end: "bottom 80%",
              scrub: 0.6,
              ...willChangeWhileActive(lines, "transform"),
            },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <footer
      ref={root}
      className="flex w-full flex-col gap-16 bg-ink px-4 pt-16 pb-8 md:gap-24 md:px-10 md:pt-[72px]"
    >
      <div className="grid grid-cols-2 gap-10 md:flex md:gap-0">
        <div className="col-span-2 md:w-[260px] md:shrink-0">
          <LogoMark color="#FFFFFF" />
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-1 basis-0 flex-col gap-2.5">
            <p className="font-mono text-[11px] leading-[14px] tracking-[0.1em] text-fog uppercase">{c.title}</p>
            <ul className="flex flex-col gap-2.5">
              {c.links.map((l) => (
                <li key={l}>
                  <a href="#top" className="text-[14px] leading-[18px] text-[#D6D6D6] hover:text-white">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <p
        data-giant
        className="text-[48px] leading-[48px] tracking-[-0.04em] text-[#8A8A8A] md:text-[80px] md:leading-[80px] xl:text-[112px] xl:leading-[108px]"
      >
        {GIANT.map((l) => (
          <span key={l} className="reveal-mask">
            <span data-giant-line className="block">
              {l}
            </span>
          </span>
        ))}
      </p>

      <div className="flex flex-col gap-3 border-t border-[#222222] pt-5 md:flex-row md:justify-between">
        <p className="font-mono text-[11px] leading-[14px] tracking-[0.08em] text-fog">© 2026 VOXLAYER · BARCELONA</p>
        <p className="font-mono text-[11px] leading-[14px] tracking-[0.08em] text-fog">
          <a href="#top" className="hover:text-white">TERMS</a> · <a href="#top" className="hover:text-white">PRIVACY</a> ·{" "}
          <a href="#top" className="hover:text-white">ACCESSIBILITY STATEMENT</a>
        </p>
      </div>
      <p className="-mt-12 text-[12px] leading-[18px] text-fog md:-mt-20">
        All product names and logos are trademarks of their respective owners. Use does not imply endorsement.
      </p>
    </footer>
  );
}
