const $ = (id) => document.getElementById(id);

const state = {
  apiBase:
    localStorage.getItem("kuro.apiBase") ||
    "https://kuro-production-281c.up.railway.app",
  apiKey: localStorage.getItem("kuro.executorKey") || "",
  swapAction: "quote",
};

const els = {
  apiBase: $("api-base"),
  apiKey: $("api-key"),
  keyForm: $("key-form"),
  toggleKey: $("toggle-key"),
  railwayState: $("railway-state"),
  statusDot: document.querySelector(".status-dot"),
  refreshStatus: $("refresh-status"),
  statusError: $("status-error"),
  wallet: $("wallet"),
  balance: $("balance"),
  maxTrade: $("max-trade"),
  dailyCap: $("daily-cap"),
  phoenixLive: $("phoenix-live"),
  drawdown: $("drawdown"),
  intentForm: $("intent-form"),
  intent: $("intent"),
  swapForm: $("swap-form"),
  swapOutput: $("swap-output"),
  phoenixForm: $("phoenix-form"),
  phoenixOutput: $("phoenix-output"),
  canvas: $("market-canvas"),
};

els.apiBase.value = state.apiBase;
els.apiKey.value = state.apiKey;

function apiUrl(path) {
  const base = state.apiBase.trim().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeaders(json = false) {
  const headers = {};
  if (json) headers["content-type"] = "application/json";
  if (state.apiKey) headers.authorization = `Bearer ${state.apiKey}`;
  return headers;
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function setBusy(button, busy, text) {
  button.disabled = busy;
  button.setAttribute("aria-busy", busy ? "true" : "false");
  if (text) button.textContent = text;
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      response.status === 401
        ? "Unauthorized. Add the executor key from Railway variables."
        : typeof body === "string"
          ? body
          : pretty(body);
    throw new Error(message);
  }
  return body;
}

async function checkHealth() {
  try {
    await request("/healthz");
    els.railwayState.textContent = "Executor online";
    els.statusDot.classList.add("ok");
  } catch (error) {
    els.railwayState.textContent = "Executor offline";
    els.statusDot.classList.remove("ok");
  }
}

function showStatusError(message) {
  els.statusError.textContent = message;
  els.statusError.classList.toggle("hidden", !message);
}

async function loadStatus() {
  setBusy(els.refreshStatus, true, "Loading");
  showStatusError("");
  try {
    const status = await request("/status", { headers: authHeaders() });
    els.wallet.textContent = status.wallet || "--";
    els.balance.textContent = `${status.balance_sol ?? 0} SOL`;
    els.maxTrade.textContent = `${status.max_trade_sol ?? "--"} SOL`;
    els.dailyCap.textContent = `${status.daily_cap_sol ?? "--"} SOL`;
    els.phoenixLive.textContent = status.phoenix_live_enabled ? "Enabled" : "Disabled";
    els.drawdown.textContent = status.drawdown_locked ? "Locked" : "Open";
  } catch (error) {
    showStatusError(error.message);
  } finally {
    setBusy(els.refreshStatus, false, "Refresh");
  }
}

els.keyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.apiBase = els.apiBase.value.trim();
  state.apiKey = els.apiKey.value.trim();
  localStorage.setItem("kuro.apiBase", state.apiBase);
  localStorage.setItem("kuro.executorKey", state.apiKey);
  await checkHealth();
  await loadStatus();
});

els.toggleKey.addEventListener("click", () => {
  const showing = els.apiKey.type === "text";
  els.apiKey.type = showing ? "password" : "text";
  els.toggleKey.textContent = showing ? "Show" : "Hide";
  els.toggleKey.setAttribute("aria-label", showing ? "Show executor key" : "Hide executor key");
});

els.refreshStatus.addEventListener("click", loadStatus);

els.intentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.intent.value.trim();
  if (!text) return;
  els.swapOutput.textContent = pretty({
    staged_intent: text,
    next_step: "Use quote or dry-run form below. Live trades require active Trading Scope.",
  });
});

document.querySelectorAll("#swap-form button[type='submit']").forEach((button) => {
  button.addEventListener("click", () => {
    state.swapAction = button.dataset.action || "quote";
  });
});

els.swapForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  setBusy(submitter, true, state.swapAction === "quote" ? "Quoting" : "Simulating");
  const req = {
    input_mint: $("input-mint").value.trim(),
    output_mint: $("output-mint").value.trim(),
    in_amount_lamports: Number($("amount-lamports").value.trim()),
  };
  try {
    if (state.swapAction === "quote") {
      const quote = await request("/quote", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          ...req,
          slippage_bps: Number($("slippage-bps").value.trim()),
        }),
      });
      els.swapOutput.textContent = pretty(quote);
    } else {
      const result = await request("/swap", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          ...req,
          max_slippage_bps: Number($("slippage-bps").value.trim()),
          use_jito: false,
          dry_run: true,
        }),
      });
      els.swapOutput.textContent = pretty(result);
    }
  } catch (error) {
    els.swapOutput.textContent = error.message;
  } finally {
    setBusy(submitter, false, state.swapAction === "quote" ? "Get quote" : "Dry-run swap");
  }
});

els.phoenixForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  setBusy(submitter, true, "Simulating");
  try {
    const result = await request("/phoenix/isolated_market_order", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        symbol: $("phoenix-symbol").value.trim(),
        side: $("phoenix-side").value,
        quantity: Number($("phoenix-quantity").value.trim()),
        transfer_amount_usdc: Number($("phoenix-collateral").value.trim()),
        pda_index: 0,
        dry_run: true,
      }),
    });
    els.phoenixOutput.textContent = pretty(result);
  } catch (error) {
    els.phoenixOutput.textContent = error.message;
  } finally {
    setBusy(submitter, false, "Simulate Phoenix order");
  }
});

function drawMarket(t = 0) {
  const ctx = els.canvas.getContext("2d");
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  els.canvas.width = Math.floor(rect.width * dpr);
  els.canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(238,243,240,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const points = 72;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * width;
    const y =
      height * 0.52 +
      Math.sin(i * 0.24 + t * 0.0012) * 26 +
      Math.sin(i * 0.07 + t * 0.0007) * 38;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#5ee0a7";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  const tape = [
    ["SOL-PERP", "+0.07%", "#5ee0a7"],
    ["JUP/USDC", "dry-run", "#70b7ff"],
    ["PHX", "live off", "#f7c66b"],
  ];
  tape.forEach((row, i) => {
    const y = 26 + i * 30;
    ctx.fillStyle = "rgba(238,243,240,0.08)";
    ctx.fillRect(16, y - 17, 150, 24);
    ctx.fillStyle = "rgba(238,243,240,0.78)";
    ctx.fillText(row[0], 26, y);
    ctx.fillStyle = row[2];
    ctx.fillText(row[1], 104, y);
  });

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    requestAnimationFrame(drawMarket);
  }
}

checkHealth();
if (state.apiKey) loadStatus();
drawMarket();
