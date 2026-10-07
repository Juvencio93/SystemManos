import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const kitFiles = [
  "public/mikrotik/MANOS-PREFLIGHT.rsc",
  "public/mikrotik/MANOS-POSTFLIGHT.rsc",
  "public/mikrotik/MANOS-ISOLATION-UPDATE.rsc",
  "public/mikrotik/MANOS-HOTSPOT-FIREWALL-UPDATE.rsc",
  "public/mikrotik/MANOS-WAN-FIREWALL-UPDATE.rsc",
  "public/mikrotik/MANOS-SECURITY-AUDIT.rsc",
  "public/mikrotik/MANOS-MANAGEMENT-HARDENING.rsc",
  "public/mikrotik/MANOS-BACKUP-EXPORT.rsc",
  "public/mikrotik/MANOS-HOTSPOT-BASE.rsc",
  "public/mikrotik/MANOS-INSTALL-HOTSPOT-PAGES.rsc",
  "public/mikrotik/login.html",
  "public/mikrotik/alogin.html",
];
const manualFiles = ["public/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf"];

function latestCommitDate(files) {
  const timestamps = files.map((file) => {
    try {
      return Date.parse(execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { cwd: root, encoding: "utf8" }).trim());
    } catch {
      return 0;
    }
  }).filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

const output = resolve(root, "public/mikrotik/kit-manifest.json");
let previousManifest = {};
try {
  previousManifest = JSON.parse(readFileSync(output, "utf8"));
} catch {
  // The first release has no manifest to preserve.
}
const manifest = {
  kitUpdatedAt: latestCommitDate(kitFiles) ?? previousManifest.kitUpdatedAt ?? null,
  manualUpdatedAt: latestCommitDate(manualFiles) ?? previousManifest.manualUpdatedAt ?? null,
};
mkdirSync(resolve(root, "public/mikrotik"), { recursive: true });
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
