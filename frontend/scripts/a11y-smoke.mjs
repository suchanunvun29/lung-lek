#!/usr/bin/env node
/**
 * a11y smoke — T-UX-010
 *
 * Runs axe-core (WCAG-leaning default ruleset) against the app's main pages
 * in a real browser and fails when NEW violations appear compared to the
 * recorded baseline (`scripts/a11y-baseline.json`).
 *
 * Dev-only tooling: no test runner / CI integration is assumed. It drives the
 * system Chrome or Edge via `puppeteer-core` (no bundled browser download) and
 * loads `axe-core` straight from node_modules.
 *
 * Usage:
 *   1. Start the app:        npm run dev        (or npm run build && npm start)
 *   2. Record first baseline npm run a11y:update-baseline
 *   3. Any time later:       npm run a11y
 *
 * Options:
 *   --base=<url>             App base URL (default http://localhost:3000)
 *   --out=<file>             Baseline/output file (default scripts/a11y-baseline.json)
 *   --update-baseline        Overwrite the baseline with the current scan
 *
 * Protected pages are scanned with a fake MANAGER session seeded into
 * localStorage (the same zustand-persist key the app uses), so the shell and
 * page chrome render; data requests fail without a backend and pages fall
 * back to their error/empty states — which are part of the surface under test.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import puppeteer from "puppeteer-core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const updateBaseline = args.includes("--update-baseline");

const BASE = opt("base", "http://localhost:3000");
const OUT = opt("out", path.join(scriptDir, "a11y-baseline.json"));
const AXE_SOURCE = readFileSync(
  path.join(repoRoot, "node_modules", "axe-core", "axe.min.js"),
  "utf8"
);

// ≥5 pages per T-UX-010 AC: login, dashboard, targets, import, users.
const PAGES = [
  { path: "/login", auth: false },
  { path: "/dashboard", auth: true },
  { path: "/targets", auth: true },
  { path: "/import", auth: true },
  { path: "/users", auth: true },
  { path: "/import-batches", auth: true },
  { path: "/territories", auth: true },
];

// Matches useAuthStore's zustand persist key + partialized shape.
const AUTH_STORAGE = JSON.stringify({
  state: {
    token: "a11y-smoke-placeholder-token",
    user: {
      id: 1,
      email: "a11y-smoke@example.test",
      displayName: "A11y Smoke",
      role: "MANAGER",
      mustChangePassword: false,
    },
  },
  version: 0,
});

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  console.error(
    "No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser executable."
  );
  process.exit(1);
}

function summarizeViolations(violations) {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? "unknown",
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
  }));
}

function flatten(scan) {
  const map = new Map();
  for (const page of Object.keys(scan)) {
    for (const v of scan[page]) {
      map.set(`${page}::${v.id}`, { page, id: v.id, impact: v.impact, help: v.help });
    }
  }
  return map;
}

async function scanPage(browser, page) {
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await p.setViewport({ width: 1280, height: 800 });

  await p.evaluateOnNewDocument((auth) => {
    window.localStorage.setItem("auth-storage", auth);
  }, AUTH_STORAGE);

  const url = `${BASE}${page.path}`;
  try {
    await p.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  } catch {
    // Network-idle can time out on pages with polling; the DOM is still there.
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));

  await p.evaluate(AXE_SOURCE);
  const results = await p.evaluate(() =>
    axe.run(document, {
      resultTypes: ["violations"],
    })
  );
  await context.close();
  return summarizeViolations(results.violations);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: findChromeExecutable(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const scan = {};
  try {
    for (const page of PAGES) {
      process.stdout.write(`Scanning ${page.path} … `);
      scan[page.path] = await scanPage(browser, page);
      console.log(`${scan[page.path].length} violation rule(s)`);
    }
  } finally {
    await browser.close();
  }

  if (updateBaseline || !existsSync(OUT)) {
    writeFileSync(OUT, JSON.stringify(scan, null, 2) + "\n");
    console.log(
      updateBaseline
        ? `Baseline updated: ${OUT}`
        : `No baseline found — wrote a fresh one: ${OUT} (review it, then commit)`
    );
  }

  if (!updateBaseline) {
    const baseline = JSON.parse(readFileSync(OUT, "utf8"));
    const baseMap = flatten(baseline);
    const nowMap = flatten(scan);
    const newViolations = [...nowMap.entries()].filter(([key]) => !baseMap.has(key));

    console.log("\n=== a11y smoke report ===");
    for (const [pagePath, violations] of Object.entries(scan)) {
      console.log(`${pagePath}: ${violations.length} rule(s)`);
      for (const v of violations) {
        console.log(`   [${v.impact}] ${v.id} — ${v.help}`);
      }
    }

    if (newViolations.length > 0) {
      console.error(`\n✖ ${newViolations.length} NEW violation(s) vs baseline ${OUT}:`);
      for (const [, v] of newViolations) {
        console.error(`   ${v.page} [${v.impact}] ${v.id} — ${v.help}`);
      }
      process.exit(1);
    }
    console.log(`\n✔ No new violations vs baseline (${OUT}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
