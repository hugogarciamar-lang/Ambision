"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, MQ, whileVisible } from "@/lib/motion";
import { lenisRef } from "@/lib/lenisStore";
import { navHeight } from "@/lib/navState";
import { APPS, MOBILE_COUNT, RING_APPS, WORDS } from "./apps";

const TAU = Math.PI * 2;
const SQRT2 = Math.SQRT2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* Ring geometry. Everything is sized from the card's real inner box, never the viewport. */
const PAD = 24; // min gap between any tile and the card edge
const WOB = 5; // vertical wobble amplitude (px), reserved inside the padding
const MAX_SCALE = 1.35; // nearest tile (bottom-left) = baseDiameter × 1.35
const MIN_SCALE = 0.4; // farthest tile (top-right)
const MIN_RX = 0.3; // the ring never collapses below these fractions of the card;
const MIN_RY = 0.28; // baseDiameter shrinks instead
const CLEAR = 32; // clear zone around the headline + button
const CLEAR_FADE = 40; // soft edge of the clear-zone dimming

/* Scroll choreography (desktop), in viewport heights. */
const PIN_VH = 1.5; // card pinned for 150vh…
const EXIT_VH = 0.4; // …the last 40vh of which expand it into the white section
const DRIFT = 40; // previous content drifts up this far while being covered

export default function Coverage() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current!;
      const q = gsap.utils.selector(section);
      const card = q("[data-card]")[0] as HTMLElement;
      const textBox = q("[data-text]")[0] as HTMLElement;
      const bg = q("[data-bg]")[0] as HTMLElement;
      const allTiles = q("[data-tile]") as HTMLElement[];
      const discs = q("[data-disc]") as HTMLElement[];
      const flashes = q("[data-flash]") as HTMLElement[];
      const label = q("[data-label]")[0] as HTMLElement;
      const labelText = q("[data-label-text]")[0] as HTMLElement;
      const ring = q("[data-ring]")[0] as HTMLElement;
      const line = q("[data-rotate-line]")[0] as HTMLElement;
      const words = q("[data-rotate-word]") as HTMLElement[];
      const sizer = q("[data-rotate-sizer]")[0] as HTMLElement;
      const html = document.documentElement;

      // Shared between the ring (renders every frame) and the scroll choreography (drives it).
      const fx = {
        appear: allTiles.map(() => ({ v: 1 })), // per-tile entrance, 0..1
        depth: new Float32Array(allTiles.length), // last rendered depth (1 = nearest, bottom-left)
        topInset: 0, // top of the card hidden under the nav (desktop: the card fills the screen)
      };

      const mm = gsap.matchMedia();

      /* ───────────── ring (all modes; static under reduced motion) ───────────── */
      mm.add({ motion: MQ.motion, reduce: MQ.reduce, mobile: "(max-width: 767px)" }, (ctx) => {
        const { motion, mobile } = ctx.conditions as { motion: boolean; mobile: boolean };
        const n = mobile ? Math.min(MOBILE_COUNT, allTiles.length) : allTiles.length;
        const tiles = allTiles.slice(0, n);
        allTiles.slice(n).forEach((t) => (t.style.display = "none"));

        const D0 = mobile ? 72 : 140;
        const base = TAU / (mobile ? 50 : 70); // rad/s, clockwise (y points down)
        const useBlur = !mobile; // quantised below, so each tile re-rasters only a few times per lap
        // Per-tile wobble: 4–6 s period, distinct phase.
        const wobPeriod = tiles.map((_, i) => 4 + ((i * 0.618) % 1) * 2);
        const wobPhase = tiles.map((_, i) => (i * 2.399) % TAU);
        const zCache = new Int16Array(n).fill(-1);
        const blurCache = new Float32Array(n).fill(-1);
        const pos = tiles.map(() => ({ x: 0, y: 0, s: 1 }));

        let W = 0, H = 0, T = 0, Rx = 0, Ry = 0, D = D0, sizedD = -1;
        let zl = 0, zt = 0, zr = 0, zb = 0; // clear zone, card coordinates
        const measure = () => {
          W = card.clientWidth;
          T = fx.topInset; // the ring lives below the nav: [T, cardHeight]
          H = card.clientHeight - T;
          // Shrink the base diameter globally until the largest tile fits with the ring still
          // keeping a usable radius; then size the ellipse so no tile can cross the padding.
          const fitX = ((W / 2 - PAD - W * MIN_RX) * 2) / MAX_SCALE;
          const fitY = ((H / 2 - PAD - WOB - H * MIN_RY) * 2) / MAX_SCALE;
          D = Math.max(28, Math.min(D0, fitX, fitY));
          const maxTile = D * MAX_SCALE;
          Rx = Math.max(0, W / 2 - maxTile / 2 - PAD);
          Ry = Math.max(0, H / 2 - maxTile / 2 - PAD - WOB);
          if (D !== sizedD) {
            sizedD = D;
            const px = `${D.toFixed(2)}px`;
            tiles.forEach((t) => {
              t.style.width = px;
              t.style.height = px;
            });
          }
          // Layout box (offset*), so the text's own fade-up transform doesn't move the zone.
          zl = textBox.offsetLeft - CLEAR;
          zt = textBox.offsetTop - T - CLEAR;
          zr = textBox.offsetLeft + textBox.offsetWidth + CLEAR;
          zb = textBox.offsetTop - T + textBox.offsetHeight + CLEAR;
          buildArcTable();
        };

        // Tiles are spaced by equal arc length (not equal angle), so the gap between
        // neighbours stays even on the flatter sides of the ellipse.
        const SAMPLES = 720;
        const arcToAngle = new Float32Array(SAMPLES + 1);
        function buildArcTable() {
          const N = 2048;
          const cum = new Float32Array(N + 1);
          let px = Rx, py = 0;
          for (let k = 1; k <= N; k++) {
            const a = (k / N) * TAU;
            const x = Rx * Math.cos(a), y = Ry * Math.sin(a);
            cum[k] = cum[k - 1] + Math.hypot(x - px, y - py);
            px = x; py = y;
          }
          const P = cum[N] || 1;
          let k = 0;
          for (let j = 0; j <= SAMPLES; j++) {
            const target = (j / SAMPLES) * P;
            while (k < N && cum[k + 1] < target) k++;
            const seg = cum[k + 1] - cum[k] || 1;
            arcToAngle[j] = ((k + (target - cum[k]) / seg) / N) * TAU;
          }
        }
        const angleAt = (u: number) => {
          const f = u * SAMPLES, j = Math.floor(f);
          return arcToAngle[j] + (arcToAngle[j + 1] - arcToAngle[j]) * (f - j);
        };
        measure();

        // `phase` is the ring position as a fraction of one lap (0–1).
        let phase = 0, speed = motion ? base : 0, time = 0;
        let hovered = -1;

        const render = () => {
          const cx = W / 2, cy = H / 2;
          for (let i = 0; i < n; i++) {
            const a = angleAt((phase + i / n) % 1);
            const c = Math.cos(a), s = Math.sin(a);
            const t = (1 - (c - s) / SQRT2) / 2; // 0 = top-right (far), 1 = bottom-left (near)
            const e = Math.pow(t, 1.4);
            fx.depth[i] = e;
            const wob = motion ? WOB * Math.sin((TAU * time) / wobPeriod[i] + wobPhase[i]) : 0;
            let x = cx + Rx * c, y = cy + Ry * s + wob;
            let sc = lerp(MIN_SCALE, MAX_SCALE, e);
            let op = lerp(0.35, 1, e);

            // Clear zone: full effect once the tile's edge reaches the text box (+32px), soft 40px ramp.
            const dx = Math.max(zl - x, 0, x - zr), dy = Math.max(zt - y, 0, y - zb);
            const k = clamp01((D * sc * 0.5 + CLEAR_FADE - Math.hypot(dx, dy)) / CLEAR_FADE);
            const ap = fx.appear[i].v;
            sc *= (1 - 0.15 * k) * ap;
            op *= (1 - 0.5 * k) * ap;

            // Hard guarantee: the final on-screen box stays inside the card's inner area.
            const h = (D * sc) / 2;
            x = Math.min(Math.max(x, PAD + h), W - PAD - h);
            y = Math.min(Math.max(y, PAD + h), H - PAD - h);

            pos[i].x = x; pos[i].y = y; pos[i].s = sc;
            const el = tiles[i];
            el.style.transform = `translate3d(${(x - D / 2).toFixed(2)}px,${(y + T - D / 2).toFixed(2)}px,0) scale(${sc.toFixed(4)})`;
            el.style.opacity = op.toFixed(3);
            const z = Math.round(e * 100);
            if (z !== zCache[i]) { zCache[i] = z; el.style.zIndex = String(z); }
            if (useBlur) {
              const b = Math.round(lerp(2, 0, e) * 4) / 4; // quantised: only repaint on 0.25px steps
              if (b !== blurCache[i]) { blurCache[i] = b; discs[i].style.filter = b ? `blur(${b}px)` : ""; }
            }
          }
          if (hovered >= 0) {
            const p = pos[hovered];
            label.style.transform = `translate3d(${p.x.toFixed(1)}px,${(p.y + T + (D * p.s) / 2 + 10).toFixed(1)}px,0) translateX(-50%)`;
          }
        };

        const tick = (_: number, dtMs: number) => {
          const dt = Math.min(dtMs, 50) / 1000;
          time += dt;
          const vel = lenisRef.current?.velocity ?? 0;
          const boost = gsap.utils.clamp(-base * 4, base * 4, vel * 0.008);
          const paused = hovered >= 0; // only a hovered tile eases the ring to a stop
          const target = paused ? 0 : base + boost;
          const tau = paused ? 0.13 : 0.3; // ~0.4 s to stop, ~1 s back to base
          speed += (target - speed) * (1 - Math.exp(-dt / tau));
          phase = (((phase + (speed * dt) / TAU) % 1) + 1) % 1; // one lap per 70 s (50 s mobile)
          render();
        };

        // Hover / focus pause + name label.
        const enter = (i: number) => () => {
          hovered = i;
          labelText.textContent = RING_APPS[i].name;
          gsap.to(label, { opacity: 1, duration: 0.2, overwrite: true });
        };
        const leave = (i: number) => () => {
          if (hovered !== i) return;
          hovered = -1;
          gsap.to(label, { opacity: 0, duration: 0.2, overwrite: true });
        };
        const handlers = tiles.map((t, i) => {
          const en = enter(i), lv = leave(i);
          t.addEventListener("pointerenter", en);
          t.addEventListener("pointerleave", lv);
          return () => {
            t.removeEventListener("pointerenter", en);
            t.removeEventListener("pointerleave", lv);
          };
        });
        // The card's box changes on resize and while it expands to full bleed.
        const ro = new ResizeObserver(() => {
          measure();
          render();
        });
        ro.observe(card);
        ro.observe(textBox);
        render();
        gsap.set(ring, { autoAlpha: 1 });

        const restoreTiles = () =>
          allTiles.forEach((t) => {
            t.style.display = "";
            t.style.width = "";
            t.style.height = "";
          });

        if (!motion) {
          // Reduced motion: static ring at phase 0 with depth scaling; word stays "spreadsheets".
          return () => {
            ro.disconnect();
            handlers.forEach((h) => h());
            restoreTiles();
          };
        }

        // Rotating word: slide up out / in through a mask; the line re-centres via translateX.
        const offset = (i: number) => (sizer.offsetWidth - words[i].offsetWidth) / 2;
        const flash = (word: string) =>
          RING_APPS.forEach((app, i) => {
            if (i < n && app.word === word)
              gsap.fromTo(flashes[i], { scale: 1, opacity: 1 }, { scale: 1.12, opacity: 0, duration: 0.6, ease: "power2.out" });
          });
        gsap.set(words, { yPercent: (i: number) => (i === 0 ? 0 : 110), opacity: 1 });
        gsap.set(line, { x: offset(0) });
        const wordTl = gsap.timeline({ repeat: -1, paused: true });
        WORDS.forEach((_, i) => {
          const next = (i + 1) % WORDS.length;
          const at = (i + 1) * 2.2 - 0.5;
          wordTl
            .fromTo(words[i], { yPercent: 0 }, { yPercent: -110, duration: 0.5, ease: "power2.inOut", immediateRender: false }, at)
            .fromTo(words[next], { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: "power2.inOut", immediateRender: false }, at)
            .to(line, { x: () => offset(next), duration: 0.5, ease: "power2.inOut" }, at)
            .call(flash, [WORDS[next]], at);
        });
        document.fonts?.ready.then(() => gsap.set(line, { x: offset(0) }));

        let visible = false;
        const syncWords = () => (visible ? wordTl.play() : wordTl.pause());

        const stopVisible = whileVisible(
          card,
          () => {
            visible = true;
            tiles.forEach((t) => (t.style.willChange = "transform, opacity"));
            gsap.ticker.add(tick);
            syncWords();
          },
          () => {
            visible = false;
            gsap.ticker.remove(tick);
            tiles.forEach((t) => (t.style.willChange = "auto"));
            syncWords();
          },
        );

        return () => {
          stopVisible();
          wordTl.kill();
          ro.disconnect();
          handlers.forEach((h) => h());
          restoreTiles();
        };
      });

      /* ───────────── desktop: rise over the stat section, pin, expand into white ───────────── */
      mm.add(MQ.desktop, () => {
        const vh = () => window.innerHeight;
        const inset = () => (window.innerWidth >= 1024 ? 48 : 24);
        const prev = document.querySelector<HTMLElement>("[data-coverage-prev]");

        // Pinned, the card fills the whole screen (no black around it). It still rises as the inset,
        // rounded card; over the last 30% of the rise it expands to full bleed. The nav sits on top
        // of it in the card's colour, and the ring + text are laid out in the area below the nav.
        const navH = navHeight();
        fx.topInset = navH;
        gsap.set(section, { paddingTop: 0, paddingBottom: 0 });
        gsap.set(card, { height: "100vh", paddingTop: navH });

        // 1. RISE — the card scrolls up from 100vh below while the previous content (end of the stat
        //    panel + facts row) is held in place by an exact counter-translation (it dims to 0.4 and
        //    drifts up 40px). A transform instead of a pin, because the stat section already contains
        //    a pinned layer and pins must not nest. It's written in the same ScrollTrigger update as
        //    the scroll (Lenis drives both), so it never lags a frame.
        fx.appear.forEach((a) => (a.v = 0));
        const clearPrev = () => {
          if (!prev) return;
          prev.style.transform = "";
          prev.style.opacity = "";
        };
        const setRise = (p: number) => {
          if (!prev) return;
          if (p <= 0) return clearPrev(); // never leave a transform on it: its inner layer pins (position: fixed)
          prev.style.transform = `translate3d(0,${(p * (vh() - DRIFT)).toFixed(2)}px,0)`;
          prev.style.opacity = (1 - 0.6 * p).toFixed(3);
        };
        const riseTl = gsap.timeline({
          defaults: { ease: "none", duration: 0.3 },
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top top",
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => setRise(self.progress),
            onRefresh: (self) => setRise(self.progress),
            onToggle: (self) => prev && (prev.style.willChange = self.isActive ? "transform, opacity" : "auto"),
          },
        });
        riseTl
          .to({}, { duration: 1 }, 0)
          .fromTo(card, { marginLeft: inset, marginRight: inset }, { marginLeft: 0, marginRight: 0 }, 0.7) // not the section's padding: the pin restores it
          .fromTo(card, { borderRadius: 32 }, { borderRadius: 0 }, 0.7)
          .fromTo(html, { "--nav-light": 0 }, { "--nav-light": 1 }, 0.7);
        // Measure every trigger inside the stat section without our transform on it.
        ScrollTrigger.addEventListener("refreshInit", clearPrev);

        // 2. Tiles pop in (time-based, 0.04 s stagger), nearest-first: bottom-left → top-right.
        //    The ring is already rotating, so they appear in motion.
        let appearTween: gsap.core.Tween | null = null;
        let appeared = false;
        const showTiles = (instant = false) => {
          appeared = true;
          appearTween?.kill();
          const order = fx.appear.map((_, i) => i).sort((a, b) => fx.depth[b] - fx.depth[a]);
          const rank: number[] = [];
          order.forEach((i, r) => (rank[i] = r));
          appearTween = gsap.to(fx.appear, {
            v: 1,
            duration: instant ? 0 : 0.6,
            ease: "power3.out",
            delay: (i: number) => (instant ? 0 : rank[i] * 0.04),
          });
        };
        const hideTiles = () => {
          appeared = false;
          appearTween?.kill();
          appearTween = gsap.to(fx.appear, { v: 0, duration: 0.3, ease: "power2.in" });
        };
        ScrollTrigger.create({
          trigger: section,
          start: "top 60%",
          onEnter: () => showTiles(),
          onLeaveBack: hideTiles,
          onRefresh: (self) => {
            if (self.scroll() >= self.start && !appeared) showTiles(true);
          },
        });

        // 3. Headline + button fade up once the card is ~70% of the way in.
        gsap.fromTo(
          textBox,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: section, start: "top 30%", toggleActions: "play none none reverse" },
          },
        );

        // 4. PIN for 150vh; in the last 40vh the card (and the nav on it) turns white.
        // The ring keeps rotating at full visibility until the section scrolls away.
        const hold = PIN_VH - EXIT_VH;
        const tl = gsap.timeline({
          defaults: { ease: "none", duration: EXIT_VH },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${vh() * PIN_VH}`,
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        tl.to({}, { duration: hold }, 0)
          .fromTo(card, { backgroundColor: "#EAEAEA" }, { backgroundColor: "#FFFFFF" }, hold)
          .fromTo(bg, { backgroundColor: "#000000" }, { backgroundColor: "#FFFFFF" }, hold)
          .fromTo(html, { "--nav-surface": "#EAEAEA" }, { "--nav-surface": "#FFFFFF" }, hold);

        return () => {
          ScrollTrigger.removeEventListener("refreshInit", clearPrev);
          clearPrev();
          if (prev) prev.style.willChange = "";
          appearTween?.kill();
          fx.appear.forEach((a) => (a.v = 1));
          fx.topInset = 0;
          html.style.removeProperty("--nav-light");
          html.style.removeProperty("--nav-surface");
        };
      });

      /* ───────────── mobile: no pin or rise; the nav still turns light at the white section ───────────── */
      mm.add(MQ.mobile, () => {
        let tw: gsap.core.Tween | null = null;
        const to = (v: number, duration = 0.3) => {
          tw?.kill();
          tw = gsap.to(html, { "--nav-light": v, duration, ease: "power2.inOut" });
        };
        ScrollTrigger.create({
          trigger: section,
          start: () => `bottom ${navHeight()}px`,
          invalidateOnRefresh: true,
          onEnter: () => to(1),
          onLeaveBack: () => to(0),
          onRefresh: (self) => to(self.scroll() >= self.start ? 1 : 0, 0),
        });
        return () => {
          tw?.kill();
          html.style.removeProperty("--nav-light");
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="coverage-title"
      className="relative z-[3] w-full px-4 py-4 md:h-screen md:px-0 md:pt-[calc(var(--nav-h)+16px)] md:pb-4"
    >
      {/* Black surround, continuing from the facts row (seen beside the card while it rises). */}
      <div data-bg aria-hidden="true" className="absolute inset-0 bg-ink" />

      <div
        data-card
        className="relative flex h-[calc(100svh-var(--nav-h)-32px)] min-h-[560px] flex-col items-center justify-center overflow-hidden rounded-[24px] bg-line px-4 md:h-[calc(100vh-var(--nav-h)-32px)] md:mx-6 md:min-h-0 md:rounded-[32px] lg:mx-12"
      >
        {/* Decorative ring — hidden from assistive tech; the list below carries the content. */}
        <div data-ring aria-hidden="true" className="invisible absolute inset-0 opacity-0">
          {RING_APPS.map((app) => (
            <div
              key={app.name}
              data-tile
              className="absolute top-0 left-0 size-[72px] md:size-[140px]"
              style={{ transformOrigin: "50% 50%" }}
            >
              <div
                data-disc
                className="flex size-full items-center justify-center rounded-full border border-black/[0.06] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={app.logo} alt="" width={73} height={73} loading="lazy" decoding="async" className="size-[52%] object-contain" draggable={false} />
              </div>
              <div data-flash className="pointer-events-none absolute -inset-1 rounded-full border-2 border-signal opacity-0" />
            </div>
          ))}
          <div
            data-label
            className="pointer-events-none absolute top-0 left-0 z-[200] rounded-[6px] bg-white px-2 py-1 whitespace-nowrap opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
          >
            <span data-label-text className="font-mono text-[11px] leading-[14px] tracking-[0.04em] text-ink" />
          </div>
        </div>

        <div className="sr-only">
          <p>VoxLayer works with:</p>
          <ul>
            {APPS.map((a) => (
              <li key={a.name}>{a.name}</li>
            ))}
          </ul>
        </div>

        {/* Text sits above every tile; its layout box (+32px) is the ring's clear zone. */}
        <div data-text className="pointer-events-none relative z-[300] flex flex-col items-center gap-8">
          <h2
            id="coverage-title"
            className="text-center text-[min(48px,11.4vw)] leading-[1.06] tracking-[-0.035em] text-ink md:text-[clamp(56px,min(7.5vw,12vh),96px)] md:leading-[1.04]"
          >
            <span className="sr-only">Your voice. Real work in your everyday apps.</span>
            <span aria-hidden="true" className="block">
              Your voice
              <br />
              <span data-rotate-line aria-live="off" className="inline-block whitespace-nowrap">
                Real{" "}
                <span className="relative -mb-[0.14em] inline-block overflow-hidden pb-[0.14em] text-left align-bottom text-[#7E6650]">
                  <span data-rotate-sizer className="invisible">
                    spreadsheets
                  </span>
                  {WORDS.map((w, i) => (
                    <span key={w} data-rotate-word className={`absolute top-0 left-0 ${i === 0 ? "" : "opacity-0"}`}>
                      {w}
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </h2>

          <a
            href="#demo"
            className="pointer-events-auto rounded-sm bg-white px-5 py-3 text-[14px] leading-[18px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-mist"
          >
            Try VoxLayer free
          </a>
        </div>
      </div>
    </section>
  );
}
