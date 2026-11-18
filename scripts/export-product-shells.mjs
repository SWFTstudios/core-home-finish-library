#!/usr/bin/env node
/**
 * Capture transparent front/back product shells from /render-qa.html?shells=1
 * and write them to public/assets/<material>/{front,back}.png.
 *
 * Requires a local static server (default http://127.0.0.1:8788) and Chrome.
 * Usage: node scripts/export-product-shells.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] || "http://127.0.0.1:8788";
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const USER_DATA = path.join(ROOT, "node_modules", ".cache", "shell-export-chrome");
const MATERIALS = ["ceramic", "glass", "stainless_steel", "plastic"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForReady(pageUrl, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(pageUrl);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`Server not ready: ${pageUrl}`);
}

/** Use Chrome remote debugging to evaluate window.__shells. */
async function captureShells() {
  fs.rmSync(USER_DATA, { recursive: true, force: true });
  fs.mkdirSync(USER_DATA, { recursive: true });
  const port = 9229;
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--user-data-dir=${USER_DATA}`,
      `--remote-debugging-port=${port}`,
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--window-size=800,1000",
      `${BASE}/render-qa.html?shells=1`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  try {
    await sleep(2000);
    let version;
    for (let i = 0; i < 30; i++) {
      try {
        version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
        break;
      } catch {
        await sleep(500);
      }
    }
    if (!version) throw new Error("Chrome DevTools not available");

    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === "page" && t.url.includes("shells=1")) ?? targets[0];
    if (!page?.webSocketDebuggerUrl) throw new Error("No DevTools page target");

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const msgId = ++id;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send("Runtime.enable");
    const deadline = Date.now() + 180000;
    let shells = null;
    while (Date.now() < deadline) {
      const result = await send("Runtime.evaluate", {
        expression: `document.documentElement.dataset.shellsReady === "1" ? JSON.stringify(window.__shells || {}) : null`,
        returnByValue: true,
      });
      if (result.result?.value) {
        shells = JSON.parse(result.result.value);
        break;
      }
      await sleep(1000);
    }
    ws.close();
    if (!shells || !Object.keys(shells).length) throw new Error("Timed out waiting for shells");
    return shells;
  } finally {
    chrome.kill("SIGKILL");
  }
}

await waitForReady(`${BASE}/render-qa.html`);
const shells = await captureShells();
for (const material of MATERIALS) {
  const entry = shells[material];
  if (!entry?.front || !entry?.back) throw new Error(`Missing shells for ${material}`);
  const dir = path.join(ROOT, "public", "assets", material);
  fs.mkdirSync(dir, { recursive: true });
  for (const side of ["front", "back"]) {
    const b64 = entry[side].replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(path.join(dir, `${side}.png`), Buffer.from(b64, "base64"));
  }
  console.log(`Wrote public/assets/${material}/{front,back}.png`);
}
