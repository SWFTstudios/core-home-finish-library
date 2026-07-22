#!/usr/bin/env node
/**
 * Deploy public/ to Cloudflare Pages.
 *
 * Branch alias:
 *   - CF_PAGES_BRANCH / PAGES_BRANCH env if set
 *   - else current git branch
 *
 * Note: `wrangler pages deploy` does NOT support `--config`. Pass the
 * output directory + project/branch flags only. Wrangler may warn that
 * Worker wrangler.jsonc lacks pages_build_output_dir and then ignore it.
 *
 * Preview example after a feature-branch deploy:
 *   https://<short-hash>.core-home-finish-library.pages.dev/
 *   https://<branch-slug>.core-home-finish-library.pages.dev/
 */
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "core-home-finish-library";

function gitBranch() {
  try {
    return execSync("git branch --show-current", {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "main";
  }
}

function slugBranch(name) {
  return (
    String(name || "main")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 58) || "preview"
  );
}

const branch = slugBranch(
  process.env.CF_PAGES_BRANCH || process.env.PAGES_BRANCH || gitBranch(),
);

function run() {
  // Pages rejects `--config <path>`. Deploy the static directory with flags only.
  const args = [
    "pages",
    "deploy",
    path.join(ROOT, "public"),
    "--project-name",
    PROJECT,
    "--branch",
    branch,
    "--commit-dirty=true",
  ];

  console.log(
    `Deploying public/ → Pages project ${PROJECT} (branch alias: ${branch})`,
  );

  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  process.exit(result.status ?? 1);
}

run();
