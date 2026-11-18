"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, MQ, willChangeWhileActive } from "@/lib/motion";
import { HANDOFF, HANDOFF_VH } from "@/components/story/store";
import { setNavFlag } from "@/lib/navState";
import ScrubWords, { toWords } from "./ScrubWords";
import WaveCard from "./WaveCard";

const STAT = toWords(
  "87–90 million people in the EU live with a disability. Their computers still expect eyes and hands.",
  "var(--color-signal)",
);
const DIM = "rgba(114,206,123,0.25)";

const FACTS = [
  { prefix: "", value: 30, suffix: "M+", text: "blind or partially sighted people in geographical Europe." },
  { prefix: "", value: 24, suffix: " pts", text: "employment gap between people with and without disabilities in the EU." },
  { prefix: "", value: 70, suffix: "%+", text: "unemployment often cited among blind and partially sighted people." },
  { prefix: "€", value: 1, suffix: "M", text: "maximum fines under the European Accessibility Act, in force since 28 June 2025." },
];

/**
 * The green stat panel. Markup = final layout (what reduced motion and no-JS get).
 *
 * Desktop: this section is pulled up over the end of the 3D story's (extended) pin, and its layer
 * pins for the same range. The panel rises from the bottom over chapter 3, the companion card
 * follows at 0.7× (parallax), then the stat fills in word by word. Both pins release together.
 */
export default function Stat() {
  const root = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const finals = q(".sw-final");
      const dims = q(".sw-dim");
      const mm = gsap.matchMedia();

      mm.add(MQ.desktop, () => {
        const sec = root.current!;
        const vh = () => window.innerHeight;
        // Start where chapter 3 rests: overlap the story's pinned section (100vh) + its extension.
        sec.style.marginTop = `-${100 * (1 + HANDOFF_VH)}vh`;
        sec.style.background = "transparent";

        const tl = gsap.timeline({
          defaults: { ease: "none" }, // the scroll is the ease; Lenis smooths it
          scrollTrigger: {
            trigger: layer.current,
            start: "top top",
            end: () => `+=${vh() * HANDOFF_VH}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
            ...willChangeWhileActive([panel.current, card.current], "transform"),
          },
        });
        // 1. Panel: translateY(100vh) → 96px (its resting top).
        tl.fromTo(panel.current, { y: () => vh() - 96 }, { y: 0, duration: HANDOFF.rise }, 0)
          // 3. Card: 70% of its travel by the time the panel lands, the rest over the next 30vh.
          .fromTo(card.current, { y: () => vh() * 0.48 }, { y: () => vh() * 0.48 * 0.3, duration: HANDOFF.rise }, 0)
          .to(card.current, { y: 0, duration: 0.3 }, HANDOFF.rise);
        // 4. Word fill over the remaining range, starting as the panel lands.
        const d = 0.12;
        const s = (HANDOFF.fill - d) / Math.max(1, finals.length - 1);
        tl.fromTo(dims, { opacity: 1 }, { opacity: 0, duration: d, stagger: s }, HANDOFF.rise).fromTo(
          finals,
          { opacity: 0 },
          { opacity: 1, duration: d, stagger: s },
          HANDOFF.rise,
        );

        // Nav boundary 2: show the nav as the green panel starts rising into view.
        // The panel sits translateY(100vh − 96px) below its 96px resting top until the layer pins,
        // so its top edge crosses the bottom of the viewport exactly when the layer reaches "top top"
        // (the layer itself is transparent; its own "top bottom" would fire mid-chapter 2).
        const navShow = ScrollTrigger.create({
          trigger: layer.current,
          start: "top top",
          onEnter: () => setNavFlag("stat", true),
          onLeaveBack: () => setNavFlag("stat", false),
          onRefresh: (self) => setNavFlag("stat", self.scroll() >= self.start),
        });

        return () => {
          navShow.kill();
          setNavFlag("stat", false);
          sec.style.marginTop = "";
          sec.style.background = "";
        };
      });

      mm.add(MQ.mobile, () => {
        // Nav boundary 2 (mobile): the panel is in flow here, so the layer's top edge entering is the moment.
        ScrollTrigger.create({
          trigger: layer.current,
          start: "top bottom",
          onEnter: () => setNavFlag("stat", true),
          onLeaveBack: () => setNavFlag("stat", false),
          onRefresh: (self) => setNavFlag("stat", self.scroll() >= self.start),
        });
        gsap.fromTo(
          panel.current,
          { y: 80, opacity: 0 },
          { y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: panel.current, start: "top bottom", end: "top 60%", scrub: true } },
        );
        const tl = gsap.timeline({
          scrollTrigger: { trigger: panel.current, start: "top 70%", end: "bottom 70%", scrub: true },
        });
        tl.fromTo(dims, { opacity: 1 }, { opacity: 0, stagger: 0.1, duration: 0.25, ease: "none" }, 0).fromTo(
          finals,
          { opacity: 0 },
          { opacity: 1, stagger: 0.1, duration: 0.25, ease: "none" },
          0,
        );
        return () => setNavFlag("stat", false);
      });

      mm.add(MQ.motion, () => {
        // Fact numbers count up once.
        const counters = q("[data-count]") as HTMLElement[];
        counters.forEach((el) => (el.textContent = "0"));
        gsap.to(
          counters.map(() => ({ v: 0 })),
          {
            v: (i: number) => FACTS[i].value,
            duration: 1.6,
            ease: "power2.out",
            stagger: 0.08,
            scrollTrigger: { trigger: q("[data-facts]")[0], start: "top 85%", once: true },
            onUpdate(this: gsap.core.Tween) {
              (this.targets() as { v: number }[]).forEach((o, i) => {
                const txt = String(Math.round(o.v));
                if (counters[i].textContent !== txt) counters[i].textContent = txt;
              });
            },
          },
        );
        return () => counters.forEach((el, i) => (el.textContent = String(FACTS[i].value)));
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} data-coverage-prev aria-label="Why it matters" className="relative z-[2] w-full overflow-x-clip bg-ink">
      <div ref={layer} className="pointer-events-none relative w-full pt-16 md:h-screen md:pt-0">
        {/* Companion card: bottom-left, tucked 16px under the panel's left edge. Decorative. */}
        <div
          ref={card}
          aria-hidden="true"
          className="pointer-events-auto absolute top-[52vh] -left-6 hidden h-[48vh] w-[calc(31vw+40px)] overflow-hidden rounded-[24px] md:block"
        >
          <WaveCard />
        </div>

        <div
          ref={panel}
          data-stat-panel
          className="pointer-events-auto relative z-[1] mx-4 flex flex-col justify-between gap-10 rounded-[16px] bg-forest p-7 md:absolute md:top-[96px] md:right-10 md:left-[31vw] md:mx-0 md:h-[calc(100vh-96px)] md:gap-20 md:rounded-[24px] md:p-14"
        >
          <p className="text-[34px] leading-[38px] tracking-[-0.03em] md:text-[60px] md:leading-[64px]">
            <ScrubWords words={STAT} dim={DIM} />
          </p>
          <p className="font-mono text-[12px] leading-4 tracking-[0.08em] text-[#A9D9AF]">
            23.9% OF THE EU POPULATION OVER 16 · 2024
          </p>
        </div>
      </div>

      <ul
        data-facts
        className="relative grid w-full grid-cols-2 gap-y-10 bg-ink px-4 pt-16 pb-24 md:flex md:px-10 md:pt-[120px] md:pb-[140px]"
      >
        {FACTS.map((f) => (
          <li key={f.text} className="flex flex-1 basis-0 flex-col gap-3 border-t border-[#2A2A2A] pt-7 pr-4 md:pr-8">
            <p className="text-[34px] leading-[42px] tracking-[-0.03em] text-white tabular-nums md:text-[44px] md:leading-[54px]">
              <span className="sr-only">
                {f.prefix}
                {f.value}
                {f.suffix}
              </span>
              <span aria-hidden="true">
                {f.prefix}
                <span data-count>{f.value}</span>
                {f.suffix}
              </span>
            </p>
            <p className="text-[15px] leading-[22px] text-fog md:text-[16px] md:leading-[24px]">{f.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
