"use client";

import { useEffect, useRef } from "react";
import { LogoMark } from "./Logo";
import { registerNav } from "@/lib/navState";

const links = [
  { label: "Product", href: "#story" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Organizations", href: "#audiences" },
  { label: "Compliance", href: "#plans" },
];

/**
 * Sticky nav. Its colours come from CSS variables (see `.site-nav` in globals.css): the hero exit
 * tweens them from the light to the dark palette, and the coverage section's exit tweens
 * `--nav-light` back to the light one, so both switches are cross-fades, not snaps.
 * It slides out of view during the 3D story (lib/navState.ts).
 */
export default function Nav() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => registerNav(ref.current!), []);

  return (
    <header
      ref={ref}
      className="site-nav sticky top-0 z-50 flex w-full items-center justify-between bg-[var(--n-bg)] px-4 py-5 text-[var(--n-fg)] md:px-10"
    >
      <div className="flex items-center gap-14">
        <a href="#top" className="flex items-center gap-2.5" aria-label="VoxLayer home">
          <LogoMark color="var(--n-fg)" />
          <span className="text-[24px] leading-[30px] font-medium tracking-[-0.03em]">voxlayer</span>
        </a>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex gap-8">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-[15px] leading-[18px] transition-opacity hover:opacity-65">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex items-center gap-2.5">
        <a
          href="#login"
          className="hidden rounded-sm border border-[var(--n-line)] px-[18px] py-2.5 text-[14px] leading-[18px] transition-opacity hover:opacity-70 sm:block"
        >
          Log in
        </a>
        <a
          href="#demo"
          className="rounded-sm bg-[var(--n-btn-bg)] px-[18px] py-[11px] text-[14px] leading-[18px] font-medium text-[var(--n-btn-fg)] transition-opacity hover:opacity-85"
        >
          Book a demo
        </a>
      </div>
    </header>
  );
}
