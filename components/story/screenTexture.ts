import * as THREE from "three";

// Last row is mid-entry: the sales cell is being typed.
const ROWS: string[][] = [
  ["Gràcia", "Carrer de Verdi 12", "12,400", "+8.2%"],
  ["Eixample", "Passeig de Gràcia 41", "18,950", "+4.1%"],
  ["El Born", "Carrer del Rec 27", "9,870", "+11.6%"],
  ["Poblenou", "Rambla del Poblenou 88", "7,310", "+2.9%"],
  ["Sants", "Carrer de Sants 154", "6,045", "−1.3%"],
  ["Sarrià", "Carrer Major de Sarrià 9", "8,720", "+5.4%"],
  ["Poble-sec", "Carrer de Blai 33", "5,"],
];

/**
 * Renders the "Barcelona shops" spreadsheet being filled to an offscreen canvas.
 * 2048×1264 (the screen's aspect), white-on-black to sit in the wireframe style.
 */
export function createScreenTexture(width = 2048) {
  const W = width;
  const H = Math.round(width * (1.85 / 3));
  const s = W / 2048;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;

  g.fillStyle = "#070707";
  g.fillRect(0, 0, W, H);

  const font = (px: number, weight = 400, mono = false) =>
    `${weight} ${px * s}px ${mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "ui-sans-serif, system-ui, sans-serif"}`;

  // Title bar
  g.fillStyle = "#121212";
  g.fillRect(0, 0, W, 110 * s);
  ["#3a3a3a", "#3a3a3a", "#3a3a3a"].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc((60 + i * 44) * s, 55 * s, 13 * s, 0, Math.PI * 2);
    g.fill();
  });
  g.fillStyle = "#E8E8E8";
  g.font = font(40, 500);
  g.fillText("Barcelona shops — Q3 sales", 240 * s, 70 * s);
  g.fillStyle = "#72CE7B";
  g.font = font(28, 400, true);
  g.textAlign = "right";
  g.fillText("● LISTENING", W - 60 * s, 66 * s);
  g.textAlign = "left";

  // Grid
  const top = 170 * s;
  const rowH = 118 * s;
  const cols = [0, 110, 520, 1180, 1610, 2048].map((x) => x * s);
  const headers = ["", "Shop", "Address", "Sales (€)", "vs Q2"];

  g.fillStyle = "#0F0F0F";
  g.fillRect(0, top, W, rowH);
  g.font = font(32, 500, true);
  g.fillStyle = "#9A9A9A";
  headers.forEach((h, i) => g.fillText(h.toUpperCase(), cols[i] + 36 * s, top + rowH / 2 + 11 * s));

  ROWS.forEach((r, ri) => {
    const y = top + rowH * (ri + 1);
    g.fillStyle = "#6A6A6A";
    g.font = font(30, 400, true);
    g.fillText(String(ri + 2), cols[0] + 40 * s, y + rowH / 2 + 10 * s);
    g.font = font(38);
    r.forEach((v, ci) => {
      g.fillStyle = ci === 3 && v.startsWith("−") ? "#F08A8A" : ci === 3 ? "#72CE7B" : "#EDEDED";
      g.fillText(v, cols[ci + 1] + 36 * s, y + rowH / 2 + 13 * s);
    });
  });

  // Lines
  g.strokeStyle = "#2A2A2A";
  g.lineWidth = 2 * s;
  for (let i = 0; i <= ROWS.length + 1; i++) {
    const y = top + rowH * i;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  cols.slice(1, -1).forEach((x) => {
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x, top + rowH * (ROWS.length + 1));
    g.stroke();
  });

  // Active cell being typed (row "Poble-sec", sales column) with caret.
  const ay = top + rowH * ROWS.length;
  g.strokeStyle = "#72CE7B";
  g.lineWidth = 6 * s;
  g.strokeRect(cols[3] + 3 * s, ay + 3 * s, cols[4] - cols[3] - 6 * s, rowH - 6 * s);
  g.fillStyle = "#72CE7B";
  g.fillRect(cols[3] + 150 * s, ay + 34 * s, 5 * s, 52 * s);

  // Spoken readout strip
  const by = H - 120 * s;
  g.fillStyle = "#0E1A12";
  g.fillRect(0, by, W, 120 * s);
  g.fillStyle = "#A9D9AF";
  g.font = font(32, 400, true);
  g.fillText("♪ success · “B8, Poble-sec. Sales: five thousand…”", 40 * s, by + 72 * s);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
