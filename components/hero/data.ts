/** Waveform bars exactly as drawn in Paper (1408×790 viewBox): [x, y, height, fill alpha hex]. */
export const BARS: [number, number, number, string][] = [
  [0, 375, 40, "1A"], [22, 362, 66, "1A"], [44, 370, 51, "1A"], [67, 360, 71, "1A"],
  [89, 362, 65, "1A"], [111, 356, 78, "1C"], [133, 354, 82, "1C"], [156, 351, 87, "1C"],
  [178, 344, 101, "1C"], [200, 346, 99, "1F"], [222, 334, 121, "1F"], [244, 340, 110, "21"],
  [267, 326, 138, "21"], [289, 333, 123, "24"], [311, 321, 148, "26"], [333, 328, 135, "29"],
  [356, 323, 145, "2B"], [378, 329, 132, "2E"], [400, 333, 124, "30"], [422, 340, 110, "33"],
  [444, 353, 83, "36"], [467, 361, 67, "3B"], [489, 363, 64, "3D"], [511, 338, 114, "40"],
  [533, 331, 128, "45"], [556, 301, 189, "47"], [578, 291, 209, "4A"], [600, 263, 263, "4D"],
  [622, 252, 286, "4F"], [644, 233, 325, "4F"], [667, 222, 346, "52"], [689, 213, 364, "52"],
  [711, 205, 379, "52"], [733, 209, 373, "52"], [756, 205, 381, "4F"], [778, 220, 351, "4F"],
  [800, 219, 352, "4D"], [822, 243, 305, "4A"], [844, 246, 298, "47"], [867, 270, 250, "45"],
  [889, 280, 229, "40"], [911, 302, 186, "3D"], [933, 316, 157, "3B"], [956, 332, 125, "36"],
  [978, 349, 92, "33"], [1000, 358, 74, "30"], [1022, 371, 49, "2E"], [1044, 354, 82, "2B"],
  [1067, 358, 73, "29"], [1089, 343, 104, "26"], [1111, 350, 90, "24"], [1133, 339, 111, "21"],
  [1156, 346, 98, "21"], [1178, 342, 106, "1F"], [1200, 346, 98, "1F"], [1222, 348, 94, "1C"],
  [1244, 349, 92, "1C"], [1267, 356, 79, "1C"], [1289, 353, 85, "1C"], [1311, 363, 63, "1A"],
  [1333, 356, 77, "1A"], [1356, 370, 50, "1A"], [1378, 360, 70, "1A"], [1400, 370, 50, "1A"],
];

export const VB_W = 1408;
export const VB_H = 790;
export const BAR_W = 8;
export const BAR_PITCH = 22.3;

export type TargetDef = {
  id: "intent" | "sound" | "cell";
  color: string;
  fill: string;
  /** How many bars the frame spans around the chosen peak. */
  span: number;
  minW: number;
  minH: number;
  labels: string[];
  chip: { bg: string; fg: string; border?: string; inside: boolean };
  quote?: string;
  /** Scroll parallax speed relative to the page. */
  speed: number;
  /** Horizontal drift direction when the hero scrolls out. */
  drift: number;
  /** Bar the target starts on (before its first move). */
  startBar: number;
  firstMove: number;
};

export const TARGETS: TargetDef[] = [
  {
    id: "intent",
    color: "#5B8CFF",
    fill: "#5B8CFF3D", // 24% — rendered at 0.5 opacity = 12% at rest, flashes to 24% on lock
    span: 4,
    minW: 260,
    minH: 112,
    labels: ['INTENT · open_app("excel")', "INTENT · new_sheet()", "INTENT · fill(col A)"],
    chip: { bg: "#5B8CFF", fg: "#FFFFFF", inside: true },
    quote: "“Open Excel, new sheet…”",
    speed: 0.6,
    drift: -1,
    startBar: 6,
    firstMove: 0.6,
  },
  {
    id: "sound",
    color: "#E8A23A",
    fill: "#E8A23A33",
    span: 2,
    minW: 56,
    minH: 64,
    labels: ["SOUND · success", "SOUND · navigation", "SOUND · confirm"],
    chip: { bg: "#E8A23A", fg: "#000000", inside: false },
    speed: 0.85,
    drift: 1,
    startBar: 52,
    firstMove: 1.6,
  },
  {
    id: "cell",
    color: "#72CE7B",
    fill: "#72CE7B33",
    span: 3,
    minW: 80,
    minH: 72,
    labels: ["A2 ← “Gràcia, 12,400”", "A3 ← “Eixample, 9,850”"],
    chip: { bg: "#0B0B0BE6", fg: "#A9D9AF", border: "#72CE7B", inside: false },
    speed: 1.1,
    drift: 0.45,
    startBar: 29,
    firstMove: 2.6,
  },
];
