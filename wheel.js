/**
 * wheel.js — Branded Spin Wheel GIF Generator
 * Updated: Phase 4 Design (Header Logo, Ordered Palette, Cream BG)
 */

const { createCanvas, loadImage } = require("canvas");
const GIFEncoder = require("gif-encoder-2");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ─── Phase 4 Palette ──────────────────────────────────────────────────────────
const C_PINK = "#FF356F";
const C_GOLD = "#FFBE1A";
const C_BLUE = "#19A7FF";
const C_NEON = "#00EA9C"; // Outer Border & Hub Ring
const C_BG = "#FBFAF8"; // Cream Background
const C_WHITE = "#FFFFFF";
const C_BLACK = "#000000";

// ─── Layout ───────────────────────────────────────────────────────────────────
const SIZE_W = 400;
const SIZE_H = 480; // Increased height for header
const CX = SIZE_W / 2;
const CY = 280; // Wheel center shifted down
const RADIUS = 155;
const HUB_R = 30;

// ─── Animation ────────────────────────────────────────────────────────────────
const SPIN_FRAMES = 45;
const RESULT_FRAMES = 35;
const FRAME_DELAY = 50; // ms (~20fps)

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function elasticOut(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function makeParticles() {
  const colors = [C_PINK, C_GOLD, C_BLUE, C_NEON];
  return Array.from({ length: 30 }, () => ({
    x: CX + (Math.random() - 0.5) * 40,
    y: CY - RADIUS,
    vx: (Math.random() - 0.5) * 10,
    vy: -(Math.random() * 6 + 2),
    color: colors[Math.floor(Math.random() * colors.length)],
    w: Math.random() * 6 + 3,
    h: Math.random() * 3 + 2,
    ang: Math.random() * Math.PI * 2,
    va: (Math.random() - 0.5) * 0.4,
  }));
}

function stepParticles(pts) {
  for (const p of pts) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.35;
  }
}

function drawConfetti(ctx, pts) {
  for (const p of pts) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

function drawToyPointer(ctx, tickRot) {
  const py = CY - RADIUS - 12;
  ctx.save();
  ctx.translate(CX, py);
  ctx.rotate(tickRot);

  // Midnight Blue Pointer - Pointing DOWN
  ctx.shadowBlur = 8;
  ctx.shadowColor = "rgba(1, 17, 36, 0.3)";
  ctx.beginPath();
  ctx.moveTo(0, 35); // Tip at the bottom
  ctx.bezierCurveTo(15, 35, 15, 10, 15, 5);
  ctx.arc(0, 5, 15, 0, Math.PI, true);
  ctx.bezierCurveTo(-15, 10, -15, 35, 0, 35);
  ctx.fillStyle = "#011124";
  ctx.fill();

  // White highlight dot
  ctx.beginPath();
  ctx.arc(0, 10, 5, 0, Math.PI * 2);
  ctx.fillStyle = C_WHITE;
  ctx.fill();

  ctx.restore();
}

function drawWheel(ctx, rot, targetIdx, showResult, logo, dares) {
  const n = dares.length;
  const segAng = (2 * Math.PI) / n;

  // Ordered sequence: Pink -> Gold -> Blue
  const colors = [C_PINK, C_GOLD, C_BLUE];

  ctx.save();
  ctx.translate(CX, CY);

  // 1. Neon Green Outer Border (Thicker for brand feel)
  ctx.beginPath();
  ctx.arc(0, 0, RADIUS + 22, 0, Math.PI * 2);
  ctx.fillStyle = C_NEON;
  ctx.fill();

  // 2. Main Wheel Rim (White inner)
  ctx.beginPath();
  ctx.arc(0, 0, RADIUS + 2, 0, Math.PI * 2);
  ctx.fillStyle = C_WHITE;
  ctx.fill();

  // 3. Rotating Segments
  ctx.save();
  ctx.rotate(rot);
  for (let i = 0; i < n; i++) {
    const sa = -Math.PI / 2 + i * segAng;
    const ea = sa + segAng;
    const colorIdx = i % colors.length;
    const isWinner = showResult && i === targetIdx;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, RADIUS, sa, ea);
    ctx.fillStyle = colors[colorIdx];

    if (isWinner) {
      // Winner flash logic
      ctx.fillStyle =
        Math.floor(Date.now() / 100) % 2 === 0 ? C_WHITE : colors[colorIdx];
    }
    ctx.fill();

    // Numbers
    ctx.save();
    ctx.rotate(sa + segAng / 2);
    ctx.fillStyle = C_WHITE;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), RADIUS * 0.75, 0);
    ctx.restore();
  }
  ctx.restore();

  // 4. Center Hub: Neon Circle + Logo
  ctx.beginPath();
  ctx.arc(0, 0, HUB_R, 0, Math.PI * 2);
  ctx.fillStyle = C_NEON;
  ctx.fill();

  if (logo) {
    const ls = HUB_R * 1.3;
    ctx.drawImage(logo, -ls / 2, -ls / 2, ls, ls);
  }

  ctx.restore();
}

function drawHeader(ctx, logoH) {
  if (!logoH) return;
  // Scaled logo drawing
  const aspect = logoH.width / logoH.height; // 107 / 24 = 4.45
  const dh = 30; // height
  const dw = dh * aspect;

  ctx.save();
  ctx.drawImage(logoH, CX - dw / 2, 35, dw, dh);
  ctx.restore();
}

// ─── Main Logic ───────────────────────────────────────────────────────────────

function drawFrame(ctx, rot, targetIdx, showResult, dares, logo, logoH) {
  // ── Background ──
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, SIZE_W, SIZE_H);

  // ── Header ──
  drawHeader(ctx, logoH);

  // ── Wheel Ticking ──
  const n = 10;
  const segAng = (2 * Math.PI) / n;
  const relRot = ((rot % segAng) + segAng) % segAng;
  let tickRot = 0;
  if (relRot < 0.15) tickRot = (relRot / 0.15) * 0.15;
  else if (relRot > segAng - 0.15) tickRot = -((segAng - relRot) / 0.15) * 0.15;

  // ── Wheel and Pointer ──
  drawWheel(ctx, rot, targetIdx, showResult, logo, dares);
  drawToyPointer(ctx, tickRot);
}

async function generateSpinGif(targetIndex, dares) {
  const n = dares.length;
  const segAng = (2 * Math.PI) / n;

  // Correctly target the CENTER of the segment
  let wheelFinal = -targetIndex * segAng - segAng / 2;
  wheelFinal = ((wheelFinal % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const wheelTotal = 4 * 2 * Math.PI + wheelFinal;

  // Asset Loading
  let logo = null;
  let logoH = null;
  try {
    logo = await loadImage(path.join(__dirname, "logo.svg"));
    logoH = await loadImage(path.join(__dirname, "logo-horizontal.svg"));
  } catch (e) {
    console.warn("Logo loading failed:", e.message);
  }

  const encoder = new GIFEncoder(SIZE_W, SIZE_H);
  encoder.setDelay(FRAME_DELAY);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(SIZE_W, SIZE_H);
  const ctx = canvas.getContext("2d");
  const particles = makeParticles();

  for (let f = 0; f < SPIN_FRAMES; f++) {
    const progress = f / (SPIN_FRAMES - 1);
    const isSettling = f > SPIN_FRAMES * 0.85;
    let e;
    if (isSettling) {
      const subT = (progress - 0.85) / 0.15;
      e = easeOutQuint(0.85) + (1 - easeOutQuint(0.85)) * elasticOut(subT);
    } else {
      e = easeOutQuint(progress);
    }
    drawFrame(ctx, e * wheelTotal, targetIndex, false, dares, logo, logoH);
    encoder.addFrame(ctx);
  }

  for (let f = 0; f < RESULT_FRAMES; f++) {
    drawFrame(ctx, wheelTotal, targetIndex, true, dares, logo, logoH);
    if (f > 0) {
      stepParticles(particles);
      drawConfetti(ctx, particles);
    }
    encoder.addFrame(ctx);
  }

  encoder.finish();
  const out = `${os.tmpdir()}/brand_dare_${targetIndex}_${Date.now()}.gif`;
  fs.writeFileSync(out, encoder.out.getData());
  return out;
}

module.exports = { generateSpinGif };
