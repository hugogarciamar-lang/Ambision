import { gsap } from "@/lib/motion";
import { BARS, BAR_PITCH, BAR_W, TARGETS, VB_H, VB_W, type TargetDef } from "./data";

/*
 * One loop drives the whole hero: 64 breathing bars plus the tracking targets.
 * Every DOM write is a transform or opacity change (and the chip label's text when it types).
 * Target frames use fixed-size layers: a 100×100 fill and 1.5px edges, sized with scale(),
 * so a frame can grow or shrink without triggering layout.
 */

const TAU = Math.PI * 2;
const MOVE = 0.9; // s — frame travel to a new peak
const LOCK = 0.25; // s — corner brackets snap in
const PULSE = 0.45; // s — single border pulse
const TYPE = 0.032; // s per character
const CORNER = 10; // px — bracket offset while hunting
const CHIP_H = 26;

type Frame = { x: number; y: number; w: number; h: number };

type TargetState = {
  def: TargetDef;
  els: Record<"fill" | "top" | "bottom" | "left" | "right" | "tl" | "tr" | "bl" | "br" | "chip", HTMLElement> & {
    quote: HTMLElement | null;
  };
  bar: number;
  frame: Frame;
  from: Frame;
  moving: boolean;
  moveStart: number;
  lockAt: number;
  nextAt: number;
  label: number;
  typeStart: number;
  text: string;
  cornerAlpha: number;
  quoteAlpha: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const f = (n: number) => n.toFixed(2);

export function createHeroEngine(opts: {
  card: HTMLElement;
  bars: SVGRectElement[];
  layers: HTMLElement[];
  defs: TargetDef[];
  animated: boolean;
}) {
  const { card, bars, layers, defs, animated } = opts;
  const n = BARS.length;
  const base = BARS.map((b) => b[2]);
  const centerY = BARS.map((b) => b[1] + b[2] / 2);
  // Deterministic per-bar phase so the waveform never looks like a rigid sine.
  const phase = BARS.map((_, i) => (Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * TAU);
  const heights = base.slice();
  const scales = new Float32Array(n).fill(1);

  const ease = gsap.parseEase("power3.inOut");
  const snap = gsap.parseEase("power4.out");

  let W = 0, H = 0, s = 1, ox = 0, oy = 0;
  let t = 0;
  let running = false;

  const measure = () => {
    W = card.clientWidth;
    H = card.clientHeight;
    s = Math.max(W / VB_W, H / VB_H); // matches preserveAspectRatio="xMidYMid slice"
    ox = (W - VB_W * s) / 2;
    oy = (H - VB_H * s) / 2;
  };
  measure();

  const barCx = (i: number) => ox + (BARS[i][0] + BAR_W / 2) * s;
  const barVisible = (i: number) => {
    const cx = barCx(i);
    return cx > 40 && cx < W - 40;
  };

  const targets: TargetState[] = defs.map((def) => {
    const root = layers[TARGETS.indexOf(def)];
    const q = (k: string) => root.querySelector<HTMLElement>(`[data-p="${k}"]`)!;
    return {
      def,
      els: {
        fill: q("fill"), top: q("top"), bottom: q("bottom"), left: q("left"), right: q("right"),
        tl: q("tl"), tr: q("tr"), bl: q("bl"), br: q("br"), chip: q("chip"),
        quote: root.querySelector<HTMLElement>('[data-p="quote"]'),
      },
      bar: def.startBar,
      frame: { x: 0, y: 0, w: 0, h: 0 },
      from: { x: 0, y: 0, w: 0, h: 0 },
      moving: false,
      moveStart: -10,
      lockAt: -10,
      nextAt: def.firstMove,
      label: 0,
      typeStart: -100,
      text: "",
      cornerAlpha: -1,
      quoteAlpha: -1,
    };
  });

  function pickPeak(tg: TargetState) {
    const others = targets.filter((o) => o !== tg);
    const k = W < 640 ? 0.65 : 1;
    // Keep frames apart in pixels (not just bars) so chips never collide on narrow screens.
    const free = (i: number) =>
      barVisible(i) &&
      others.every(
        (o) =>
          Math.abs(o.bar - i) > 6 &&
          Math.abs(barCx(o.bar) - barCx(i)) > ((tg.def.minW + o.def.minW) / 2) * k + 28,
      );
    const cands: number[] = [];
    for (let i = 2; i < n - 2; i++) {
      const h = heights[i];
      if (h >= heights[i - 1] && h >= heights[i + 1] && h >= heights[i - 2] && h >= heights[i + 2] && free(i) && Math.abs(i - tg.bar) > 3) {
        cands.push(i);
      }
    }
    if (!cands.length) {
      for (let i = 0; i < n; i++) if (free(i) && i !== tg.bar) cands.push(i);
    }
    if (!cands.length) return tg.bar;
    cands.sort((a, b) => heights[b] - heights[a]);
    return cands[Math.floor(Math.random() * Math.min(4, cands.length))];
  }

  function liveFrame(tg: TargetState): Frame {
    const d = tg.def;
    const k = W < 640 ? 0.65 : 1;
    const i = tg.bar;
    const bh = heights[i] * s;
    const w = Math.max(d.minW * k, d.span * BAR_PITCH * s + 20);
    const h = Math.max(d.minH * k, bh + 28);
    const top = d.chip.inside ? 12 : 12 + CHIP_H + 4;
    return {
      x: clamp(barCx(i) - w / 2, 12, W - w - 12),
      y: clamp(oy + centerY[i] * s - h / 2, top, H - h - 12),
      w,
      h,
    };
  }

  function updateBars() {
    for (let i = 0; i < n; i++) {
      const env = Math.exp(-(((i - 33) / 15) ** 2)); // stronger in the centre
      const wave =
        0.5 * Math.sin((t * TAU) / 3.1 + i * 0.33) +
        0.3 * Math.sin((t * TAU) / 2.3 - i * 0.21 + 1.3) +
        0.2 * Math.sin((t * TAU) / 3.7 + i * 0.71 + phase[i]);
      const noise = 0.06 * Math.sin(t * 5.3 + phase[i] * 3) * Math.sin(t * 1.7 + i);
      const sc = Math.max(0.3, 1 + (0.18 + 0.34 * env) * wave + noise);
      heights[i] = base[i] * sc;
      if (Math.abs(sc - scales[i]) > 0.002) {
        scales[i] = sc;
        bars[i].style.transform = `scaleY(${sc.toFixed(3)})`;
      }
    }
  }

  function render(tg: TargetState) {
    const { x, y, w, h } = tg.frame;
    const e = tg.els;
    const lockP = clamp01((t - tg.lockAt) / LOCK);
    const o = tg.moving ? CORNER : CORNER * (1 - snap(lockP));
    const pp = (t - tg.lockAt - 0.12) / PULSE;
    const pulse = pp > 0 && pp < 1 ? Math.sin(pp * Math.PI) : 0;
    const th = 1 + pulse * 1.2;
    const sx = w / 100, sy = h / 100;

    e.fill.style.transform = `translate(${f(x)}px,${f(y)}px) scale(${f(sx)},${f(sy)})`;
    e.fill.style.opacity = f(0.5 + 0.5 * pulse);
    e.top.style.transform = `translate(${f(x)}px,${f(y)}px) scale(${f(sx)},${f(th)})`;
    e.bottom.style.transform = `translate(${f(x)}px,${f(y + h - 1.5 * th)}px) scale(${f(sx)},${f(th)})`;
    e.left.style.transform = `translate(${f(x)}px,${f(y)}px) scale(${f(th)},${f(sy)})`;
    e.right.style.transform = `translate(${f(x + w - 1.5 * th)}px,${f(y)}px) scale(${f(th)},${f(sy)})`;
    e.tl.style.transform = `translate(${f(x - 3 - o)}px,${f(y - 3 - o)}px)`;
    e.tr.style.transform = `translate(${f(x + w - 7 + o)}px,${f(y - 3 - o)}px)`;
    e.bl.style.transform = `translate(${f(x - 3 - o)}px,${f(y + h - 7 + o)}px)`;
    e.br.style.transform = `translate(${f(x + w - 7 + o)}px,${f(y + h - 7 + o)}px)`;

    const ca = tg.moving ? 0.45 : 1;
    if (ca !== tg.cornerAlpha) {
      tg.cornerAlpha = ca;
      for (const c of [e.tl, e.tr, e.bl, e.br]) c.style.opacity = String(ca);
    }

    e.chip.style.transform = tg.def.chip.inside
      ? `translate(${f(x)}px,${f(y)}px)`
      : `translate(${f(x)}px,${f(y - CHIP_H - 4)}px)`;

    if (e.quote) {
      e.quote.style.transform = `translate(${f(x + 14)}px,${f(y + 38)}px)`;
      const qa = h >= 96 && w >= 230 ? 1 : 0;
      if (qa !== tg.quoteAlpha) {
        tg.quoteAlpha = qa;
        e.quote.style.opacity = String(qa);
      }
    }

    // Typewriter: label rewrites itself after each lock-on.
    const label = tg.def.labels[tg.label];
    const chars = Math.floor((t - tg.typeStart) / TYPE);
    const text = chars >= label.length ? label : chars <= 0 ? "▍" : label.slice(0, chars) + "▍";
    if (text !== tg.text) {
      tg.text = text;
      e.chip.dataset.text = text;
    }
  }

  function placeInitial() {
    for (const tg of targets) {
      if (!barVisible(tg.bar) || W < 640) tg.bar = pickPeak(tg);
      tg.frame = liveFrame(tg);
      render(tg);
    }
  }

  function tick(_time: number, deltaMs: number) {
    t += Math.min(deltaMs, 50) / 1000;
    updateBars();
    for (const tg of targets) {
      if (!tg.moving && t >= tg.nextAt) {
        // Stagger: never start within 0.7s of another target's move.
        const clash = targets.some((o) => o !== tg && Math.abs(o.moveStart - t) < 0.7);
        if (clash) {
          tg.nextAt = t + 0.7;
        } else {
          tg.from = { ...tg.frame };
          tg.bar = pickPeak(tg);
          tg.moving = true;
          tg.moveStart = t;
          tg.nextAt = t + gsap.utils.random(2.2, 3.2);
        }
      }
      const live = liveFrame(tg);
      if (tg.moving) {
        const p = clamp01((t - tg.moveStart) / MOVE);
        const k = ease(p);
        tg.frame = {
          x: tg.from.x + (live.x - tg.from.x) * k,
          y: tg.from.y + (live.y - tg.from.y) * k,
          w: tg.from.w + (live.w - tg.from.w) * k,
          h: tg.from.h + (live.h - tg.from.h) * k,
        };
        if (p >= 1) {
          tg.moving = false;
          tg.lockAt = t;
          tg.label = (tg.label + 1) % tg.def.labels.length;
          tg.typeStart = t + 0.08;
        }
      } else {
        tg.frame = live; // keep tracking the peak as it breathes
      }
      render(tg);
    }
  }

  const pieces = targets.flatMap((tg) => Object.values(tg.els).filter(Boolean) as HTMLElement[]);

  function start() {
    if (running || !animated) return;
    running = true;
    pieces.forEach((p) => (p.style.willChange = "transform"));
    gsap.ticker.add(tick);
  }
  function stop() {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
    pieces.forEach((p) => (p.style.willChange = "auto"));
  }

  const ro = new ResizeObserver(() => {
    measure();
    if (!running) placeInitial();
  });
  ro.observe(card);
  placeInitial();

  return {
    start,
    stop,
    destroy() {
      stop();
      ro.disconnect();
      bars.forEach((b) => (b.style.transform = ""));
    },
  };
}
