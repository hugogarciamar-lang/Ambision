"use client";

import { useEffect, useRef } from "react";
import { MQ, whileVisible } from "@/lib/motion";

const W = 480;
const H = 430;
const N = 44;
const X0 = 36;
const X1 = W - 36;
const MID = 250;
const PEAKS = [7, 15, 24, 33, 39];
const FRAME = { from: 21, to: 28 }; // bars wrapped by the "SOUND · success" target

const xs = Array.from({ length: N }, (_, i) => X0 + ((X1 - X0) * i) / (N - 1));
// Envelope: a few soft bumps, like a spoken phrase.
const env = xs.map((_, i) =>
  [
    [8, 4.5, 0.55],
    [16, 3.5, 0.7],
    [25, 4, 1],
    [34, 3.2, 0.62],
  ].reduce((s, [c, w, a]) => s + a * Math.exp(-((i - c) ** 2) / (2 * w * w)), 0.08),
);

function heights(t: number) {
  return env.map(
    (e, i) => 150 * e * (0.62 + 0.24 * Math.sin(i * 0.7 + t * 1.5) + 0.14 * Math.sin(i * 1.9 - t * 2.2)),
  );
}

const tri = (x: number, y: number) => `translate(${x} ${y})`;

/**
 * Decorative "annotated media" card beside the stat panel: the VoxLayer waveform in thin lines,
 * triangle markers riding its peaks, and one target chip, in the hero's visual language.
 * Pass `background` (an <img>/<video> with object-cover) to put real footage underneath.
 */
export default function WaveCard({ background }: { background?: React.ReactNode }) {
  const bars = useRef<(SVGLineElement | null)[]>([]);
  const marks = useRef<(SVGPathElement | null)[]>([]);
  const contour = useRef<SVGPolylineElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const h0 = heights(0);

  useEffect(() => {
    if (window.matchMedia(MQ.reduce).matches) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const h = heights((now - t0) / 1000);
      const pts: string[] = [];
      for (let i = 0; i < N; i++) {
        const b = bars.current[i];
        const top = MID - h[i] / 2;
        b?.setAttribute("y1", top.toFixed(1));
        b?.setAttribute("y2", (MID + h[i] / 2).toFixed(1));
        pts.push(`${xs[i].toFixed(1)},${top.toFixed(1)}`);
      }
      contour.current?.setAttribute("points", pts.join(" "));
      PEAKS.forEach((p, k) => marks.current[k]?.setAttribute("transform", tri(xs[p], MID - h[p] / 2 - 8)));
      raf = requestAnimationFrame(frame);
    };
    return whileVisible(
      root.current!,
      () => (raf = requestAnimationFrame(frame)),
      () => cancelAnimationFrame(raf),
    );
  }, []);

  const fx0 = xs[FRAME.from] - 10;
  const fx1 = xs[FRAME.to] + 10;
  const fh = 190;
  const fy0 = MID - fh / 2;
  const corner = 9;

  return (
    <div ref={root} aria-hidden="true" className="relative h-full w-full overflow-hidden bg-[#0F1A13]">
      {background ? <div className="absolute inset-0 [&>*]:h-full [&>*]:w-full [&>*]:object-cover">{background}</div> : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        focusable="false"
      >
        <line x1={X0} x2={X1} y1={MID} y2={MID} stroke="#FFFFFF" strokeOpacity="0.18" strokeDasharray="1 5" />
        {xs.map((x, i) => (
          <line
            key={i}
            ref={(el) => void (bars.current[i] = el)}
            x1={x}
            x2={x}
            y1={MID - h0[i] / 2}
            y2={MID + h0[i] / 2}
            stroke="#FFFFFF"
            strokeOpacity={0.35 + 0.5 * env[i]}
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        ))}
        <polyline
          ref={contour}
          points={xs.map((x, i) => `${x},${MID - h0[i] / 2}`).join(" ")}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.55"
          strokeWidth="0.8"
        />
        {PEAKS.map((p, k) => (
          <path
            key={p}
            ref={(el) => void (marks.current[k] = el)}
            d="M-5 -8 L5 -8 L0 0 Z"
            fill="#FFFFFF"
            transform={tri(xs[p], MID - h0[p] / 2 - 8)}
          />
        ))}

        {/* Target frame + chip, as on the hero */}
        <rect x={fx0} y={fy0} width={fx1 - fx0} height={fh} fill="#E8A23A" fillOpacity="0.08" stroke="#E8A23A" strokeWidth="1.25" />
        {[
          [fx0, fy0, 1, 1],
          [fx1, fy0, -1, 1],
          [fx0, fy0 + fh, 1, -1],
          [fx1, fy0 + fh, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <path
            key={i}
            d={`M${x - 3 * sx} ${y + corner * sy} V${y - 3 * sy} H${x + corner * sx}`}
            fill="none"
            stroke="#E8A23A"
            strokeWidth="2"
          />
        ))}
        <g transform={`translate(${fx0 - 0.6} ${fy0 - 22})`}>
          <rect width="122" height="22" fill="#E8A23A" />
          <text x="8" y="15" fill="#0F1A13" fontSize="11" letterSpacing="0.5" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
            SOUND · success
          </text>
        </g>
      </svg>
    </div>
  );
}
