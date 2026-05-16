const canvas = document.getElementById("market-scene");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let width = 0;
let height = 0;
let points = [];

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  points = Array.from({ length: 88 }, (_, i) => ({
    x: (i / 87) * width,
    base: height * (0.46 + Math.sin(i * 0.19) * 0.06),
    amp: 24 + Math.sin(i * 0.37) * 16,
  }));
}

function drawGrid() {
  ctx.strokeStyle = "rgba(244,246,239,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 56) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawTicker(t) {
  const labels = ["SOL", "BTC", "ETH", "JUP", "PUMP", "PHX"];
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  labels.forEach((label, i) => {
    const x = width * 0.58 + (i % 2) * 170;
    const y = 120 + Math.floor(i / 2) * 62;
    const up = Math.sin(t * 0.001 + i) > -0.15;
    ctx.fillStyle = "rgba(244,246,239,0.16)";
    ctx.fillRect(x, y, 128, 36);
    ctx.fillStyle = "rgba(244,246,239,0.78)";
    ctx.fillText(label, x + 12, y + 23);
    ctx.fillStyle = up ? "#52d273" : "#ff6b5d";
    ctx.fillText(up ? "+2.4%" : "-1.1%", x + 72, y + 23);
  });
}

function drawChart(t) {
  ctx.beginPath();
  points.forEach((point, i) => {
    const wave = Math.sin(t * 0.0012 + i * 0.31) * point.amp;
    const y = point.base + wave;
    if (i === 0) ctx.moveTo(point.x, y);
    else ctx.lineTo(point.x, y);
  });
  ctx.strokeStyle = "#52d273";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, height * 0.28, 0, height);
  fill.addColorStop(0, "rgba(82,210,115,0.22)");
  fill.addColorStop(1, "rgba(82,210,115,0)");
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawTerminal(t) {
  const x = width * 0.58;
  const y = height * 0.56;
  const w = Math.min(520, width * 0.36);
  const rows = [
    ["watcher", "new_pool", "#47c7c2"],
    ["policy", "dry_run_passed", "#52d273"],
    ["executor", "risk_caps_ok", "#f0b84e"],
    ["phoenix", "simulation_ready", "#52d273"],
  ];

  ctx.fillStyle = "rgba(16,18,15,0.78)";
  ctx.strokeStyle = "rgba(244,246,239,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 184, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
  rows.forEach((row, i) => {
    const pulse = Math.max(0.35, Math.sin(t * 0.002 + i) * 0.5 + 0.5);
    ctx.fillStyle = `rgba(244,246,239,${0.42 + pulse * 0.38})`;
    ctx.fillText(`[${row[0]}]`, x + 18, y + 38 + i * 34);
    ctx.fillStyle = row[2];
    ctx.fillText(row[1], x + 128, y + 38 + i * 34);
  });
}

function frame(t) {
  ctx.clearRect(0, 0, width, height);
  drawGrid();
  drawChart(t);
  drawTicker(t);
  drawTerminal(t);
  if (!prefersReducedMotion.matches) requestAnimationFrame(frame);
}

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(frame);
