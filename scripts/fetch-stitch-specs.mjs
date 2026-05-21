#!/usr/bin/env node
/**
 * Fetch Stitch MCP specs for Core Home Finish Library (local dev helper).
 * Reads API key from .cursor/mcp.json — never commit that file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mcpPath = path.join(root, ".cursor", "mcp.json");
const outDir = path.join(root, "reference", "stitch-mcp-specs");

const PROJECT = "projects/13547050496274311906";

function loadKey() {
  const raw = fs.readFileSync(mcpPath, "utf8");
  const key = JSON.parse(raw).mcpServers?.stitch?.headers?.["X-Goog-Api-Key"];
  if (!key) throw new Error("Missing stitch X-Goog-Api-Key in .cursor/mcp.json");
  return key;
}

async function mcpCall(key, method, params = {}) {
  const body =
    method === "tools/list"
      ? { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }
      : {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: method, arguments: params },
        };

  const res = await fetch("https://stitch.googleapis.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  if (method === "tools/list") return json.result?.tools ?? [];
  const text = json.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : json.result;
}

async function main() {
  const key = loadKey();
  fs.mkdirSync(outDir, { recursive: true });

  const tools = await mcpCall(key, "tools/list");
  fs.writeFileSync(path.join(outDir, "tools.json"), JSON.stringify(tools.map((t) => t.name), null, 2));

  const screens = await mcpCall(key, "list_screens", { projectId: PROJECT });
  fs.writeFileSync(path.join(outDir, "screens.json"), JSON.stringify(screens, null, 2));

  const screenList = screens?.screens ?? screens ?? [];
  for (const screen of screenList.slice(0, 6)) {
    const id = screen.name?.split("/").pop() || screen.screenId || screen.id;
    if (!id) continue;
    try {
      const detail = await mcpCall(key, "get_screen", {
        projectId: PROJECT,
        screenId: id,
      });
      const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
      fs.writeFileSync(path.join(outDir, `screen-${safe}.json`), JSON.stringify(detail, null, 2));
    } catch (e) {
      console.warn("get_screen failed", id, e.message);
    }
  }

  try {
    const theme = await mcpCall(key, "get_design_theme", { projectId: PROJECT });
    fs.writeFileSync(path.join(outDir, "design-theme.json"), JSON.stringify(theme, null, 2));
  } catch (e) {
    console.warn("get_design_theme:", e.message);
  }

  try {
    const exported = await mcpCall(key, "export_frontend", {
      projectId: PROJECT,
      screenId: screenList[0]?.name?.split("/").pop(),
    });
    if (exported) {
      fs.writeFileSync(path.join(outDir, "export-frontend-sample.json"), JSON.stringify(exported, null, 2));
    }
  } catch (e) {
    console.warn("export_frontend:", e.message);
  }

  console.log("Wrote specs to", outDir);
  console.log("Screens:", screenList.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
