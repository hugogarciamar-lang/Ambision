"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, MQ, typeInto, willChangeWhileActive } from "@/lib/motion";
import ScrubWords, { toWords } from "./ScrubWords";

const TODAY = [
  { text: "Ctrl+Alt+N … Insert+F7 … Tab Tab Tab", color: "#BDBDBD" },
  { text: "“Blank. Blank. Cell B7. Blank.”", color: "#BDBDBD" },
  { text: "Shift+Space … Insert+Down … Escape", color: "#BDBDBD" },
  // Design uses #7A7A7A (4.49:1 on #0E0E0E); nudged to #7D7D7D to clear WCAG AA 4.5:1.
  { text: "— 14 keystrokes, no confirmation the data landed", color: "#7D7D7D" },
];

const VOX = [
  { text: "You → “Open Excel, new sheet, enter sales data for Barcelona shops.”", color: "#E6F5E8" },
  { text: "♪ success · “New sheet open. Column A: shop names.”", color: "var(--color-signal)" },
  { text: "♪ success · “A2, Gràcia. B2, 12,400. Next row?”", color: "var(--color-signal)" },
  { text: "— one sentence, every cell spoken back", color: "#8FB89A" },
];

const HEADING = [{ text: "Accessibility", color: "#FFFFFF" }, ...toWords("has no shortcuts.", "var(--color-fog)")];

export default function Problem() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const words = q(".sw-word");
      const finals = q(".sw-final");
      const dims = q(".sw-dim");
      const [today, vox] = q("[data-panel]") as HTMLElement[];
      const ghosts = q("[data-ghost]") as HTMLElement[];
      const typed = q("[data-typed]") as HTMLElement[];
      const mm = gsap.matchMedia();

      // Lines type in one after another once the panels have separated.
      const makeTyper = () => {
        let tl: gsap.core.Timeline | null = null;
        gsap.set(ghosts, { opacity: 0 }); // stays in the accessibility tree
        typed.forEach((el) => (el.textContent = ""));
        return {
          play() {
            if (tl) return;
            tl = gsap.timeline();
            VOX.forEach((line, i) => {
              tl!.add(typeInto(typed[i], line.text, 55)).to({}, { duration: 0.22 });
            });
          },
          kill() {
            tl?.kill();
            typed.forEach((el) => (el.textContent = ""));
          },
        };
      };

      const wordTweens = (tl: gsap.core.Timeline) =>
        tl
          .fromTo(words, { xPercent: 30 }, { xPercent: 0, stagger: 0.08, duration: 0.3, ease: "power2.out" }, 0)
          .fromTo(dims, { opacity: 1 }, { opacity: 0, stagger: 0.08, duration: 0.3, ease: "none" }, 0)
          .fromTo(finals, { opacity: 0 }, { opacity: 1, stagger: 0.08, duration: 0.3, ease: "none" }, 0);

      mm.add(MQ.desktop, () => {
        const typer = makeTyper();
        const shift = () => (today.offsetWidth + 24) / 2;
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "+=120%",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            ...willChangeWhileActive([...words, ...finals, ...dims, today, vox]),
          },
        });
        wordTweens(tl);
        // Stacked in 3D → pulled apart sideways.
        tl.fromTo(
          today,
          { x: () => shift() * 0.9, y: -18, z: -120, rotateX: 18, opacity: 0.7 },
          { x: 0, y: 0, z: 0, rotateX: 0, opacity: 1, duration: 0.55, ease: "power2.inOut" },
          0.22,
        )
          .fromTo(
            vox,
            { x: () => -shift() * 0.9, y: 18, z: 0, rotateX: 18 },
            { x: 0, y: 0, z: 0, rotateX: 0, duration: 0.55, ease: "power2.inOut" },
            0.22,
          )
          .call(() => typer.play(), undefined, 0.8)
          .to({}, { duration: 0.2 });
        return () => typer.kill();
      });

      mm.add(MQ.mobile, () => {
        const typer = makeTyper();
        wordTweens(
          gsap.timeline({
            scrollTrigger: { trigger: q("h2")[0], start: "top 85%", end: "top 35%", scrub: 0.6 },
          }),
        );
        gsap.from([today, vox], {
          y: 40,
          opacity: 0,
          stagger: 0.1,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: today, start: "top 88%", once: true },
        });
        const st = ScrollTrigger.create({ trigger: vox, start: "top 70%", once: true, onEnter: () => typer.play() });
        return () => {
          st.kill();
          typer.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="problem"
      aria-labelledby="problem-title"
      className="relative z-[2] flex w-full flex-col items-center gap-12 overflow-x-clip bg-ink px-4 py-24 md:min-h-screen md:justify-center md:gap-[72px] md:px-10 md:pt-[160px] md:pb-[140px]"
    >
      <div className="flex w-full max-w-[820px] flex-col items-center gap-5 text-center">
        <p className="font-mono text-[12px] leading-4 tracking-[0.12em] text-fog">THE PROBLEM</p>
        <h2 id="problem-title" className="text-[38px] leading-[42px] tracking-[-0.03em] md:text-[56px] md:leading-[60px]">
          <ScrubWords words={HEADING} dim="#575757" />
        </h2>
        <p className="text-[16px] leading-[26px] text-fog md:text-[18px] md:leading-[28px]">
          Screen readers make computers possible, not natural. Users memorise hundreds of shortcuts, get partial
          feedback, and still struggle with spreadsheets, forms and multi-app work.
        </p>
      </div>

      <div className="flex w-full max-w-[1120px] flex-col gap-6 md:flex-row" style={{ perspective: "1200px" }}>
        <div
          data-panel="today"
          className="flex flex-1 basis-0 flex-col gap-5 rounded-[16px] border border-[#2A2A2A] bg-[#0E0E0E] p-6 md:p-8"
        >
          <h3 className="font-mono text-[12px] leading-4 tracking-[0.1em] text-fog">TODAY · SCREEN READER</h3>
          <ul className="flex flex-col gap-2.5">
            {TODAY.map((l) => (
              <li key={l.text} className="font-mono text-[14px] leading-[22px]" style={{ color: l.color }}>
                {l.text}
              </li>
            ))}
          </ul>
        </div>

        <div
          data-panel="vox"
          className="flex flex-1 basis-0 flex-col gap-5 rounded-[16px] border border-[#3B6E4A] bg-[#0F1A13] p-6 md:p-8"
        >
          <h3 className="font-mono text-[12px] leading-4 tracking-[0.1em] text-signal">WITH VOXLAYER</h3>
          <ul className="flex flex-col gap-2.5">
            {VOX.map((l) => (
              <li key={l.text} className="relative font-mono text-[14px] leading-[22px]" style={{ color: l.color }}>
                <span data-ghost>{l.text}</span>
                <span data-typed aria-hidden="true" className="absolute inset-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
