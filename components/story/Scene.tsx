"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { PerformanceMonitor } from "@react-three/drei";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { screenTarget, type StoryStore } from "./store";
import { createScreenTexture } from "./screenTexture";

/* ───────────────────────── helpers ───────────────────────── */

const DEG = Math.PI / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);

/** Piecewise interpolation across the three chapter states (c ∈ [0, 2]). */
function pw(v: readonly number[], c: number) {
  const i = Math.min(1, Math.max(0, Math.floor(c)));
  return lerp(v[i], v[i + 1], smooth(clamp01(c - i)));
}
function pwVec(v: readonly (readonly [number, number, number])[], c: number, out: THREE.Vector3) {
  return out.set(pw([v[0][0], v[1][0], v[2][0]], c), pw([v[0][1], v[1][1], v[2][1]], c), pw([v[0][2], v[1][2], v[2][2]], c));
}

function roundedRect(w: number, h: number, r: number, seg = 6) {
  const pts: THREE.Vector3[] = [];
  const corners = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, 90],
    [-w / 2 + r, -h / 2 + r, 180],
    [w / 2 - r, -h / 2 + r, 270],
  ] as const;
  corners.forEach(([cx, cy, a0]) => {
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + (90 * i) / seg) * DEG;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  });
  return pts;
}
/** Closed loop(s) → LineSegments geometry. */
function loopsGeometry(loops: THREE.Vector3[][]) {
  const arr: number[] = [];
  loops.forEach((pts) =>
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      arr.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }),
  );
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  return g;
}
function pointsGeometry(pts: THREE.Vector3[]) {
  return new THREE.BufferGeometry().setFromPoints(pts);
}
function shapeFromRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  roundedRect(w, h, r).forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/* ───────────────────────── chapter states ───────────────────────── */

// Emphasis per part across chapters 1 → 3 (1 = lit, ~0.25 = dimmed).
const EMPH = {
  voice: [1, 0.25, 0.3],
  screen: [0.3, 1, 0.55],
  base: [0.25, 0.45, 0.6],
  sound: [0.05, 0.07, 1],
} as const;
const GAP = [0.35, 0.6, 0.3] as const;
const RETRACT = [0, 0.55, 0.42] as const;
const EXPLODE = [0.4, 0.5, 0.32] as const;

type V3 = readonly [number, number, number];
/**
 * Camera per chapter: what to look at, the viewing direction, and the extent (world units) that
 * must fit inside the free area above the text. The distance is solved per viewport so nothing
 * is cut by the edges on any screen shape.
 */
type Shot = { look: V3; dir: V3; w: number; h: number };
const SHOTS: { desktop: Shot[]; mobile: Shot[] } = {
  desktop: [
    { look: [-2.2, -0.4, 0.6], dir: [-0.5, 0.95, 9.8], w: 9.0, h: 3.5 },
    { look: [0.05, -0.45, 0], dir: [1.45, 1.05, 10.8], w: 4.9, h: 3.8 },
    { look: [0, -0.6, 0], dir: [0, 2.55, 15.5], w: 9.8, h: 6.0 },
  ],
  mobile: [
    { look: [-0.9, -0.4, 0.6], dir: [-0.5, 0.95, 9.8], w: 5.4, h: 3.5 },
    { look: [0.05, -0.45, 0], dir: [1.45, 1.05, 10.8], w: 4.9, h: 3.8 },
    { look: [0, -0.6, 0], dir: [0, 2.55, 15.5], w: 7.2, h: 5.0 },
  ],
};
const TAN_HALF_FOV = Math.tan((32 / 2) * DEG);

/** Free band for the object: below the nav, above the text block. */
function band(height: number, mobile: boolean) {
  const top = 96;
  const bottom = height * (mobile ? 0.5 : 0.54);
  return { frac: Math.max(0.2, (bottom - top) / height), center: (top + bottom) / 2 };
}

/** Positions `camera` for chapter position `c` (frustum shifted so the object sits in the band). */
function placeCamera(
  camera: THREE.PerspectiveCamera,
  c: number,
  w: number,
  h: number,
  mobile: boolean,
  centered: boolean,
  tmp: { a: THREE.Vector3; b: THREE.Vector3 },
) {
  const shots = mobile ? SHOTS.mobile : SHOTS.desktop;
  const aspect = w / h;
  const { frac, center } = centered ? { frac: 0.8, center: h / 2 } : band(h, mobile);
  const dist = shots.map((s) =>
    Math.max(s.h / (2 * TAN_HALF_FOV * frac), s.w / (2 * TAN_HALF_FOV * aspect * 0.92)),
  );
  const look = pwVec(shots.map((s) => s.look), c, tmp.b);
  const dir = pwVec(shots.map((s) => s.dir), c, tmp.a).normalize();
  camera.position.copy(look).addScaledVector(dir, pw(dist, c));
  camera.lookAt(look);
  if (centered) camera.clearViewOffset();
  else camera.setViewOffset(w, h, 0, h / 2 - center, w, h);
  camera.updateMatrixWorld();
}

// Screen content plane corners (layer 2, chapter-1 gap), used to place the hero card.
const SCREEN_CORNERS = [
  [-1.45, 0.895],
  [1.45, 0.895],
  [1.45, -0.895],
  [-1.45, -0.895],
] as const;
const CARD_PERSPECTIVE = 1400;
const SPOT = {
  pos: [[-3.2, 4.2, 5.2], [1.4, 3.6, 6.2], [0, 9, 2.5]] as V3[],
  target: [[-2.6, 0, 1.2], [0, 0, -0.2], [0, -0.4, 0]] as V3[],
  angle: [0.34, 0.3, 0.85] as const,
};

/** Derived per-frame values, computed once by the controller and read by every part. */
type Derived = {
  t: number;
  c: number;
  voice: number;
  screen: number;
  base: number;
  sound: number;
  gap: number;
  retract: number;
  draw: number;
  explode: number;
};

/* ───────────────────────── materials ───────────────────────── */

type PartMats = { line: THREE.LineBasicMaterial; mark: THREE.MeshBasicMaterial; dots: THREE.PointsMaterial };

function makePartMats(): PartMats {
  const common = { color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false } as const;
  return {
    line: new THREE.LineBasicMaterial(common),
    mark: new THREE.MeshBasicMaterial({ ...common, side: THREE.DoubleSide }),
    dots: new THREE.PointsMaterial({ ...common, size: 2, sizeAttenuation: false }),
  };
}
/** Lit parts are brighter than 1.0 (so Bloom picks them up); dimmed parts drop to ~0.25 opacity. */
function applyEmphasis(m: PartMats, e: number) {
  const k = 1 + 0.35 * smooth(clamp01((e - 0.5) / 0.5));
  const o = 0.9 * e;
  m.line.opacity = o;
  m.line.color.setScalar(k);
  m.mark.opacity = Math.min(1, o * 1.05);
  m.mark.color.setScalar(k);
  m.dots.opacity = o * 0.85;
  m.dots.color.setScalar(k);
}

const TRI = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.065, 0, -0.055, -0.04, 0, 0.055, -0.04, 0], 3));
  return g;
})();

/* ───────────────────────── A. VOICE ───────────────────────── */

function Voice({ D, mats, mobile }: { D: Derived; mats: PartMats; mobile: boolean }) {
  const N = mobile ? 48 : 80;
  const M = mobile ? 3 : 5;
  const bars = useRef<THREE.InstancedMesh>(null);
  const marks = useRef<THREE.InstancedMesh>(null);

  const { pts, top, bottom, barGeo, barMat } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.4, -0.55, 2.1),
      new THREE.Vector3(-4.8, 0.35, 1.7),
      new THREE.Vector3(-3.2, -0.3, 1.35),
      new THREE.Vector3(-1.8, 0.22, 1.05),
      new THREE.Vector3(-0.6, 0.0, 0.7),
    ]);
    const pts = Array.from({ length: N }, (_, i) => curve.getPointAt(i / (N - 1)));
    const mk = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      return g;
    };
    const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false });
    return { pts, top: mk(), bottom: mk(), barGeo: new THREE.BoxGeometry(0.03, 1, 0.03), barMat };
  }, [N]);

  // The ribbon's upper and lower edges.
  const edges = useMemo(() => {
    const mk = (g: THREE.BufferGeometry) => {
      const l = new THREE.Line(g, mats.line);
      l.frustumCulled = false;
      return l;
    };
    return { top: mk(top), bottom: mk(bottom) };
  }, [top, bottom, mats.line]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const ps = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const { t, retract } = D;
    barMat.opacity = mats.line.opacity * 0.85;
    barMat.color.copy(mats.line.color);
    const ta = top.attributes.position as THREE.BufferAttribute;
    const ba = bottom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const p = pts[i];
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.7);
      const wave =
        0.5 +
        0.28 * Math.sin(u * 17 - t * 3.1) +
        0.16 * Math.sin(u * 41 + t * 4.7) +
        0.08 * Math.sin(u * 7 - t * 1.3);
      const vis = smooth(clamp01((u - retract) / 0.08));
      const h = Math.max(0.001, (0.08 + 0.7 * env * wave) * vis);
      const dy = Math.sin(u * 6 - t * 1.4) * 0.12 * vis;
      ps.set(p.x, p.y + dy, p.z);
      sc.set(1, h, 1);
      m4.compose(ps, q, sc);
      bars.current!.setMatrixAt(i, m4);
      ta.setXYZ(i, p.x, p.y + dy + h / 2, p.z);
      ba.setXYZ(i, p.x, p.y + dy - h / 2, p.z);
    }
    bars.current!.instanceMatrix.needsUpdate = true;
    ta.needsUpdate = true;
    ba.needsUpdate = true;

    // Triangle markers ride the top edge of the ribbon toward the screen.
    for (let k = 0; k < M; k++) {
      const u = (t * 0.07 + k / M) % 1;
      const fi = u * (N - 1);
      const i0 = Math.floor(fi);
      const i1 = Math.min(N - 1, i0 + 1);
      const f = fi - i0;
      const vis = smooth(clamp01((u - retract) / 0.08)) * smooth(clamp01((1 - u) / 0.1));
      ps.set(
        lerp(ta.getX(i0), ta.getX(i1), f),
        lerp(ta.getY(i0), ta.getY(i1), f) + 0.09,
        lerp(ta.getZ(i0), ta.getZ(i1), f),
      );
      sc.setScalar(Math.max(0.001, vis));
      m4.compose(ps, q.set(0, 0, 1, 0).normalize(), sc); // pointing down at the ribbon
      marks.current!.setMatrixAt(k, m4);
      q.identity();
    }
    marks.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bars} args={[barGeo, barMat, N]} frustumCulled={false} />
      <primitive object={edges.top} />
      <primitive object={edges.bottom} />
      <instancedMesh ref={marks} args={[TRI, mats.mark, M]} frustumCulled={false} />
    </group>
  );
}

/* ───────────────────────── B. SCREEN STACK ───────────────────────── */

const SW = 3.2;
const SH = 2.0;

const PATHS: [number, number][][] = [
  [[-1.62, 0.12], [-0.95, 0.52], [-0.25, 0.32], [0.36, 0.42]],
  [[-1.62, 0.0], [-0.75, -0.36], [0.05, -0.08], [0.58, -0.42]],
  [[0.58, -0.42], [0.95, -0.68], [1.25, -0.2], [0.72, 0.06]],
  [[-1.62, -0.12], [-1.0, 0.74], [0.42, 0.8], [1.16, 0.58]],
];

function ScreenStack({ D, mats, glass, mobile }: { D: Derived; mats: PartMats; glass: THREE.Material; mobile: boolean }) {
  const layers = useRef<(THREE.Group | null)[]>([]);
  const traces = useRef<THREE.Group>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const size = useThree((s) => s.size);

  const geo = useMemo(() => {
    const outer = roundedRect(SW, SH, 0.14);
    const inner = roundedRect(SW - 0.24, SH - 0.22, 0.08);
    const corners: THREE.Vector3[] = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
      for (let i = 0; i <= 28; i++) corners.push(new THREE.Vector3((sx * SW) / 2, (sy * SH) / 2, 1.5 - (3 * i) / 28));
    });
    const dotted = roundedRect(SW - 0.1, SH - 0.1, 0.1, 4);
    const dottedPts: THREE.Vector3[] = [];
    dotted.forEach((p, i) => {
      const q = dotted[(i + 1) % dotted.length];
      const n = Math.max(1, Math.round(p.distanceTo(q) / 0.06));
      for (let k = 0; k < n; k++) dottedPts.push(p.clone().lerp(q, k / n));
    });
    return {
      bezel: loopsGeometry([outer, inner]),
      outline: loopsGeometry([inner]),
      back: loopsGeometry([outer]),
      panel: shapeFromRect(SW - 0.04, SH - 0.04, 0.13),
      content: new THREE.PlaneGeometry(2.9, 1.79),
      corners: pointsGeometry(corners),
      dotted: pointsGeometry(dottedPts),
    };
  }, []);

  const screen = useMemo(() => {
    const map = createScreenTexture(2048);
    const sat = { value: 1 };
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSat = sat;
      sh.fragmentShader = "uniform float uSat;\n" + sh.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\nfloat lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));\ndiffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat);",
      );
    };
    return { map, mat, sat };
  }, []);
  useEffect(() => () => screen.map.dispose(), [screen]);

  const paths = useMemo(
    () =>
      PATHS.map((p) => {
        const curve = new THREE.CatmullRomCurve3(p.map(([x, y]) => new THREE.Vector3(x, y, 0)));
        const pts = curve.getPoints(90);
        const g = new LineGeometry().setPositions(pts.flatMap((v) => [v.x, v.y, v.z]));
        let L = 0;
        for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]);
        const m = new LineMaterial({
          color: 0xffffff,
          linewidth: mobile ? 1.2 : 1.6,
          transparent: true,
          depthWrite: false,
          dashed: true,
          dashSize: L,
          gapSize: L,
          dashOffset: L,
        });
        m.toneMapped = false;
        const line = new Line2(g, m);
        line.computeLineDistances();
        line.renderOrder = 10; // drawn over the content plane in front of it, like light through glass
        return { curve, line, m, L };
      }),
    [mobile],
  );

  useLayoutEffect(() => {
    paths.forEach((p) => p.m.resolution.set(size.width, size.height));
  }, [paths, size]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const ps = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const { gap, screen: e, draw } = D;
    [1.5, 0.5, -0.5, -1.5].forEach((z, i) => layers.current[i]?.position.set(0, 0, z * gap));
    traces.current!.scale.z = gap;

    screen.mat.opacity = 0.18 + 0.6 * e;
    screen.sat.value = clamp01((e - 0.3) / 0.7);

    paths.forEach((p, k) => {
      const d = smooth(clamp01(draw * 1.35 - k * 0.12));
      p.m.dashOffset = p.L * (1 - d);
      p.m.opacity = 0.25 + 0.75 * e;
      p.m.color.setScalar(1 + 0.4 * e);
      const head = p.curve.getPointAt(Math.max(0.0001, Math.min(1, d)));
      sc.setScalar(d > 0.01 ? 1 : 0.0001);
      m4.compose(ps.copy(head), q, sc);
      heads.current!.setMatrixAt(k, m4);
      // fixed start markers where commands enter
      const start = p.curve.getPointAt(0);
      sc.setScalar(0.8 * (d > 0.01 ? 1 : 0.0001));
      m4.compose(ps.copy(start), q, sc);
      heads.current!.setMatrixAt(k + paths.length, m4);
    });
    heads.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* 1. outer bezel — wireframe only */}
      <group ref={(g) => void (layers.current[0] = g)}>
        <lineSegments geometry={geo.bezel} material={mats.line} />
      </group>
      {/* 2. screen content */}
      <group ref={(g) => void (layers.current[1] = g)}>
        <mesh geometry={geo.content} material={screen.mat} renderOrder={2} />
        <lineSegments geometry={geo.outline} material={mats.line} />
      </group>
      {/* 3. interaction layer — user commands & corrections */}
      <group ref={(g) => void (layers.current[2] = g)}>
        <mesh geometry={geo.panel} material={glass} renderOrder={1} />
        <points geometry={geo.dotted} material={mats.dots} />
        {paths.map((p, i) => (
          <primitive key={i} object={p.line} />
        ))}
        <instancedMesh ref={heads} args={[TRI, mats.mark, PATHS.length * 2]} frustumCulled={false} renderOrder={11} />
      </group>
      {/* 4. back plate — glass */}
      <group ref={(g) => void (layers.current[3] = g)}>
        <mesh geometry={geo.panel} material={glass} renderOrder={0} />
        <lineSegments geometry={geo.back} material={mats.line} />
      </group>
      {/* dotted traces joining the layer corners */}
      <group ref={traces}>
        <points geometry={geo.corners} material={mats.dots} />
      </group>
    </group>
  );
}

/* ───────────────────────── C. BASE ───────────────────────── */

function Base({ D, mats }: { D: Derived; mats: PartMats }) {
  const ref = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const slab = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 0.07, 2.1));
    // key grid on the top face
    const arr: number[] = [];
    const cols = 13;
    const rows = 4;
    const kw = 0.2;
    const kd = 0.2;
    const x0 = -((cols - 1) * 0.23) / 2;
    const z0 = -0.55;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * 0.23;
        const z = z0 + r * 0.23;
        const y = 0.036;
        const a = [x - kw / 2, z - kd / 2];
        const b = [x + kw / 2, z + kd / 2];
        arr.push(a[0], y, a[1], b[0], y, a[1], b[0], y, a[1], b[0], y, b[1], b[0], y, b[1], a[0], y, b[1], a[0], y, b[1], a[0], y, a[1]);
      }
    // trackpad
    const tp = roundedRect(1.0, 0.5, 0.05).map((p) => new THREE.Vector3(p.x, 0.036, p.y + 0.62));
    tp.forEach((p, i) => {
      const n = tp[(i + 1) % tp.length];
      arr.push(p.x, p.y, p.z, n.x, n.y, n.z);
    });
    const keys = new THREE.BufferGeometry();
    keys.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    const hingePts: THREE.Vector3[] = [];
    [-1, 1].forEach((sx) => {
      for (let i = 0; i <= 10; i++) hingePts.push(new THREE.Vector3((sx * SW) / 2 - sx * 0.2, -i / 10, 0));
    });
    return { slab, keys, hinge: pointsGeometry(hingePts) };
  }, []);

  useFrame(() => {
    const y = -SH / 2 - 0.1 - D.explode;
    ref.current!.position.set(0, y, 0.95);
    // dotted hinge spans the exploded gap
    hinge.current!.position.set(0, -SH / 2, 0);
    hinge.current!.scale.y = 0.1 + D.explode;
  });

  return (
    <group>
      <group ref={ref}>
        <lineSegments geometry={geo.slab} material={mats.line} />
        <lineSegments geometry={geo.keys} material={mats.line} />
      </group>
      <group ref={hinge}>
        <points geometry={geo.hinge} material={mats.dots} />
      </group>
    </group>
  );
}

/* ───────────────────────── D. SOUND FIELD ───────────────────────── */

const RING_TILTS: V3[] = [
  [1.35, 0, 0],
  [1.18, 0.45, 0.05],
  [1.52, -0.38, 0.2],
  [0.95, 0.2, 0.42],
  [1.68, 0.7, -0.28],
  [1.1, -0.75, 0.05],
  [1.42, 0.15, -0.55],
];

function SoundField({ D, mats, mobile }: { D: Derived; mats: PartMats; mobile: boolean }) {
  const count = mobile ? 4 : 6;
  const glyphCount = mobile ? 5 : 9;
  const rings = useRef<(THREE.LineLoop | null)[]>([]);
  const glyphs = useRef<THREE.InstancedMesh>(null);

  const { circle, ringMats, orbits } = useMemo(() => {
    const pts = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0);
    });
    const circle = pointsGeometry(pts.slice(0, 128));
    const ringMats = Array.from(
      { length: count },
      () => new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false }),
    );
    const orbits = [
      { r: 3.05, tilt: [1.3, 0.25, 0] as V3, speed: 0.22 },
      { r: 3.45, tilt: [1.55, -0.4, 0.15] as V3, speed: -0.16 },
      { r: 3.85, tilt: [1.1, 0.6, -0.2] as V3, speed: 0.12 },
    ].map((o) => {
      const dots = Array.from({ length: 140 }, (_, i) => {
        const a = (i / 140) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
      });
      const euler = new THREE.Euler(...o.tilt);
      return { ...o, geo: pointsGeometry(dots), euler };
    });
    return { circle, ringMats, orbits };
  }, [count]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const ps = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const { t, sound: e } = D;
    const PERIOD = 2.4;
    const k = 1 + 0.5 * smooth(clamp01((e - 0.5) / 0.5));
    for (let i = 0; i < count; i++) {
      const f = (((t + i * 0.4) / PERIOD) % 1 + 1) % 1;
      const ring = rings.current[i];
      if (!ring) continue;
      ring.scale.setScalar(1 + 0.6 * f);
      ringMats[i].opacity = 0.8 * (1 - f) * e;
      ringMats[i].color.setScalar(k);
    }
    for (let g = 0; g < glyphCount; g++) {
      const o = orbits[g % orbits.length];
      const a = t * o.speed * 2 + (g / glyphCount) * Math.PI * 2 * 1.37;
      ps.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0).applyEuler(o.euler);
      sc.setScalar(g % 3 === 2 ? 0.6 : 1);
      m4.compose(ps, q, sc);
      glyphs.current!.setMatrixAt(g, m4);
    }
    glyphs.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {ringMats.map((m, i) => (
        <group key={i} rotation={RING_TILTS[i]}>
          <lineLoop ref={(r) => void (rings.current[i] = r)} geometry={circle} material={m} />
        </group>
      ))}
      {orbits.map((o, i) => (
        <points key={i} geometry={o.geo} material={mats.dots} rotation={o.euler} />
      ))}
      <instancedMesh ref={glyphs} args={[TRI, mats.mark, glyphCount]} frustumCulled={false} />
    </group>
  );
}

/* ───────────────────────── controller + rig ───────────────────────── */

function Computer({
  store,
  mobile,
  centered,
  transmission = true,
}: {
  store: StoryStore;
  mobile: boolean;
  centered: boolean;
  transmission?: boolean;
}) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const spot = useRef<THREE.SpotLight>(null);

  const D = useMemo<Derived>(
    () => ({ t: 0, c: store.chapter, voice: 1, screen: 0.3, base: 0.25, sound: 0, gap: 0.35, retract: 0, draw: 0, explode: 0.4 }),
    [store],
  );
  const mats = useMemo(() => ({ voice: makePartMats(), screen: makePartMats(), base: makePartMats(), sound: makePartMats() }), []);
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: mobile ? 0 : 0.6,
        roughness: 0.2,
        thickness: 0.05,
        ior: 1.3,
        metalness: 0,
        transparent: true,
        opacity: mobile ? 0.06 : 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
        specularIntensity: 0.6,
      }),
    [mobile],
  );
  // Transmission costs an extra scene pass; the adaptive quality tier can switch it off.
  useEffect(() => {
    const t = !mobile && transmission ? 0.6 : 0;
    if (glass.transmission === t) return;
    glass.transmission = t;
    glass.opacity = t ? 0.35 : 0.08;
    glass.needsUpdate = true;
  }, [glass, mobile, transmission]);
  const spotTarget = useMemo(() => new THREE.Object3D(), []);
  const P = useRef({ x: 0, y: 0 });
  const idle = useRef(0);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);

  // Publish where the screen sits in chapter 1 (at rest), so the hero card can land on it.
  useLayoutEffect(() => {
    if (centered) return;
    const probe = new THREE.PerspectiveCamera(32, size.width / size.height, 0.1, 60);
    placeCamera(probe, 0, size.width, size.height, mobile, false, { a: new THREE.Vector3(), b: new THREE.Vector3() });
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(8 * DEG, -18 * DEG, 0));
    const z = 0.5 * GAP[0];
    const px = SCREEN_CORNERS.map(([x, y]) => {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(m).project(probe);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    });
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const wT = d(px[0], px[1]);
    const wB = d(px[3], px[2]);
    const hL = d(px[0], px[3]);
    const hR = d(px[1], px[2]);
    const w = (wT + wB) / 2;
    const h = (hL + hR) / 2;
    // Edge-length ratios → the CSS rotations that give the same foreshortening at perspective 1400px.
    const tilt = (ratio: number, len: number) =>
      Math.asin(Math.max(-0.5, Math.min(0.5, (2 * CARD_PERSPECTIVE * (ratio - 1)) / (len * (ratio + 1))))) / DEG;
    screenTarget.rect = {
      cx: px.reduce((s, p) => s + p.x, 0) / 4,
      cy: px.reduce((s, p) => s + p.y, 0) / 4,
      w,
      h,
      ry: -tilt(hR / hL, w),
      rx: tilt(wB / wT, h),
    };
  }, [size.width, size.height, mobile, centered]);

  useEffect(() => {
    Object.values(mats).forEach((m) => (m.dots.size = (mobile ? 1.8 : 2.2) * dpr));
  }, [mats, dpr, mobile]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const t = store.time ?? state.clock.elapsedTime;
    const target = Math.min(2, Math.max(0, store.chapter));
    D.c = store.still ? target : D.c + (target - D.c) * damp(dt, 7);
    const c = D.c;
    D.t = t;
    D.voice = pw(EMPH.voice, c);
    D.screen = pw(EMPH.screen, c);
    D.base = pw(EMPH.base, c);
    D.sound = pw(EMPH.sound, c);
    D.gap = pw(GAP, c);
    D.retract = pw(RETRACT, c);
    D.explode = pw(EXPLODE, c);
    const drawTarget = smooth(clamp01(c * 1.1 - 0.1));
    D.draw = store.still ? drawTarget : D.draw + (drawTarget - D.draw) * damp(dt, 2.4);

    applyEmphasis(mats.voice, D.voice);
    applyEmphasis(mats.screen, D.screen);
    applyEmphasis(mats.base, D.base);
    applyEmphasis(mats.sound, D.sound);

    // Camera: framed so the whole object fits the band above the text, on any viewport.
    placeCamera(camera, c, size.width, size.height, mobile, centered, tmp);

    // Light focus
    const s = spot.current!;
    s.position.copy(pwVec(SPOT.pos, c, tmp.a));
    spotTarget.position.copy(pwVec(SPOT.target, c, tmp.b));
    spotTarget.updateMatrixWorld();
    s.angle = pw(SPOT.angle, c);
    s.intensity = pw([5, 6, 3.2], c);

    // Idle float + pointer parallax
    // Held still while the hero card hands over to the screen, then eased in.
    const still = store.still;
    idle.current = still ? 0 : idle.current + ((store.intro >= 0.999 ? 1 : 0) - idle.current) * damp(dt, 1.2);
    const k = idle.current;
    P.current.x += (store.pointer.x - P.current.x) * damp(dt, 3);
    P.current.y += (store.pointer.y - P.current.y) * damp(dt, 3);
    const fy = k * 0.04 * Math.sin((t / 7) * Math.PI * 2);
    const fry = k * 1.5 * DEG * Math.sin((t / 8) * Math.PI * 2);
    const frx = k * 1.0 * DEG * Math.sin((t / 6.5) * Math.PI * 2 + 1);
    root.current!.position.set(0, fy, -4 * clamp01(store.exit));
    root.current!.scale.setScalar(1 - 0.1 * clamp01(store.sink));
    tilt.current!.rotation.set(
      8 * DEG + frx - k * P.current.y * 3 * DEG,
      -18 * DEG + fry + k * P.current.x * 3 * DEG,
      0,
    );
  }, -1);

  return (
    <>
      <ambientLight intensity={0.08} />
      <primitive object={spotTarget} />
      <spotLight ref={spot} target={spotTarget} penumbra={0.9} decay={0} distance={0} color="#ffffff" />
      <directionalLight position={[-4, 2.5, -6]} intensity={1.1} color="#dfe8ff" />
      <group ref={root}>
        <group ref={tilt}>
          <Voice D={D} mats={mats.voice} mobile={mobile} />
          <ScreenStack D={D} mats={mats.screen} glass={glass} mobile={mobile} />
          <Base D={D} mats={mats.base} />
          <SoundField D={D} mats={mats.sound} mobile={mobile} />
        </group>
      </group>
    </>
  );
}

/* ───────────────────────── exports ───────────────────────── */

/**
 * Quality tiers, stepped down only when the measured frame rate drops:
 * 2 = full spec (glass transmission, MSAA ×4, dpr ≤ 1.75) · 1 = no transmission · 0 = also no MSAA, dpr 1.
 */
export default function Scene({ store, mobile, active }: { store: StoryStore; mobile: boolean; active: boolean }) {
  const [tier, setTier] = useState(2);
  return (
    <Canvas
      aria-hidden="true"
      tabIndex={-1}
      dpr={tier === 0 ? 1 : [1, 1.75]}
      frameloop={active ? "always" : "demand"}
      camera={{ fov: 32, near: 0.1, far: 60, position: [0, 0, 8] }}
      gl={{ antialias: mobile, alpha: false, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => gl.setClearColor("#0B0B0B")}
      style={{ position: "absolute", inset: 0 }}
    >
      <PerformanceMonitor
        flipflops={2}
        onDecline={() => setTier((t) => Math.max(0, t - 1))}
        onFallback={() => setTier(0)}
      />
      <Computer store={store} mobile={mobile} centered={false} transmission={tier === 2} />
      {mobile ? null : (
        <EffectComposer multisampling={tier === 0 ? 0 : 4}>
          <Bloom intensity={0.6} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur resolutionScale={0.5} />
          <Vignette offset={0.45} darkness={0.35} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

/** Renders the three chapter focus states once (no animation) and hands back PNG data URLs. */
export function StillRenders({ store, onDone }: { store: StoryStore; onDone: (urls: string[]) => void }) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={1}
      frameloop="never"
      camera={{ fov: 32, near: 0.1, far: 60, position: [0, 0, 8] }}
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => gl.setClearColor("#0B0B0B")}
      style={{ position: "absolute", inset: 0 }}
    >
      <Computer store={store} mobile={false} centered />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.6} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur resolutionScale={0.5} />
        <Vignette offset={0.45} darkness={0.35} />
      </EffectComposer>
      <Capture store={store} onDone={onDone} />
    </Canvas>
  );
}

function Capture({ store, onDone }: { store: StoryStore; onDone: (urls: string[]) => void }) {
  const gl = useThree((s) => s.gl);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    // Wait a tick so the composer and all parts have mounted.
    const id = requestAnimationFrame(() => {
      const urls: string[] = [];
      for (let i = 0; i < 3; i++) {
        store.chapter = i;
        store.time = 1.3;
        advance(performance.now());
        advance(performance.now());
        urls.push(gl.domElement.toDataURL("image/png"));
      }
      done.current = true;
      onDone(urls);
    });
    return () => cancelAnimationFrame(id);
  }, [gl, store, onDone]);
  return null;
}
