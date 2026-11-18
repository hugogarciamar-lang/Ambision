"use client";

import { useRef } from "react";
import { gsap, useGSAP, MQ } from "@/lib/motion";

/**
 * Fades up every [data-reveal] descendant with a stagger the first time the group
 * enters the viewport. Renders its children in their final state for reduced motion.
 */
export default function Reveal({
  children,
  className,
  as: Tag = "div",
  ...rest
}: { children: React.ReactNode; className?: string; as?: "div" | "section" } & React.HTMLAttributes<HTMLElement>) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", root.current);
        gsap.set(items, { y: 40, opacity: 0 });
        gsap.to(items, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
          clearProps: "transform,opacity,willChange",
          onStart: () => items.forEach((el) => (el.style.willChange = "transform, opacity")),
          scrollTrigger: { trigger: root.current, start: "top 80%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Tag ref={root as never} className={className} {...rest}>
      {children}
    </Tag>
  );
}
