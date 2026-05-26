#!/usr/bin/env node
// Extracts the inline base64-gzip data blob from src/nadlan/nadlan_unified.html
// into public/nadlan/data.v1.json.gz. Run once after rebuilding the source HTML.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const src = resolve(repo, "src/nadlan/nadlan_unified.html");
const out = resolve(repo, "public/nadlan/data.v1.json.gz");

const html = readFileSync(src, "utf8");

const match = html.match(/const\s+B64\s*=\s*"([A-Za-z0-9+/=]+)"\s*;/);
if (!match) {
  console.error(`Could not find const B64 = "..." in ${src}`);
  process.exit(1);
}

const b64 = match[1];
const bytes = Buffer.from(b64, "base64");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, bytes);

console.log(`Wrote ${out} (${bytes.byteLength.toLocaleString()} bytes gzip)`);
