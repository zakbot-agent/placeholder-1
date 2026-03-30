#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import { generate, defaults, parseDimensions } from "./generator";
import { generateAvatar, avatarDefaults } from "./avatar";
import { parseFormat, fileExtension } from "./formatter";
import { startServer } from "./server";

// ── Arg parsing helpers ──────────────────────────────────────────────

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function normalizeColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.startsWith("#") ? raw : `#${raw}`;
}

// ── Commands ─────────────────────────────────────────────────────────

async function cmdPlaceholder(args: string[]): Promise<void> {
  const dimStr = args[0];
  if (!dimStr) {
    printUsage();
    process.exit(1);
  }

  const { width, height } = parseDimensions(dimStr);
  const format = parseFormat(getFlag(args, "--format"));
  const ext = fileExtension(format);
  const output =
    getFlag(args, "-o") ??
    getFlag(args, "--output") ??
    `./placeholder-${width}x${height}.${ext}`;

  const buf = await generate(
    defaults({
      width,
      height,
      text: getFlag(args, "--text"),
      bg: normalizeColor(getFlag(args, "--bg")) ?? "#cccccc",
      color: normalizeColor(getFlag(args, "--color")) ?? "#555555",
      format,
    }),
  );

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, buf);
  console.log(`Created ${output} (${width}x${height}, ${format})`);
}

async function cmdAvatar(args: string[]): Promise<void> {
  const sizeStr = args[0];
  if (!sizeStr) {
    console.error("Usage: placeholder avatar <size> [--initials XY] [--bg #hex] [-o path]");
    process.exit(1);
  }

  const size = parseInt(sizeStr, 10);
  if (isNaN(size) || size < 1 || size > 2048) {
    console.error("Avatar size must be between 1 and 2048");
    process.exit(1);
  }

  const format = parseFormat(getFlag(args, "--format"));
  const ext = fileExtension(format);
  const output =
    getFlag(args, "-o") ??
    getFlag(args, "--output") ??
    `./avatar-${size}.${ext}`;

  const buf = await generateAvatar(
    avatarDefaults({
      size,
      initials: getFlag(args, "--initials"),
      bg: normalizeColor(getFlag(args, "--bg")) ?? "#3498db",
      color: normalizeColor(getFlag(args, "--color")) ?? "#ffffff",
      format,
    }),
  );

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, buf);
  console.log(`Created ${output} (avatar ${size}x${size}, ${format})`);
}

async function cmdBanner(args: string[]): Promise<void> {
  const dimStr = args[0];
  if (!dimStr) {
    console.error("Usage: placeholder banner <WxH> [--text 'Title'] [--bg #hex] [-o path]");
    process.exit(1);
  }

  const { width, height } = parseDimensions(dimStr);
  const format = parseFormat(getFlag(args, "--format"));
  const ext = fileExtension(format);
  const output =
    getFlag(args, "-o") ??
    getFlag(args, "--output") ??
    `./banner-${width}x${height}.${ext}`;

  const buf = await generate(
    defaults({
      width,
      height,
      text: getFlag(args, "--text") ?? "Banner",
      bg: normalizeColor(getFlag(args, "--bg")) ?? "#2c3e50",
      color: normalizeColor(getFlag(args, "--color")) ?? "#ecf0f1",
      format,
    }),
  );

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, buf);
  console.log(`Created ${output} (banner ${width}x${height}, ${format})`);
}

async function cmdBatch(args: string[]): Promise<void> {
  const outputDir = getFlag(args, "--output") ?? getFlag(args, "-o") ?? "./placeholders";
  const format = parseFormat(getFlag(args, "--format"));
  const ext = fileExtension(format);
  const bg = normalizeColor(getFlag(args, "--bg"));
  const color = normalizeColor(getFlag(args, "--color"));

  // Collect dimension args (everything that looks like WxH)
  const dims: string[] = [];
  for (const a of args) {
    if (a.match(/^\d+x\d+$/)) dims.push(a);
  }

  if (dims.length === 0) {
    console.error("Usage: placeholder batch 100x100 200x200 ... [--output ./dir]");
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  for (const dimStr of dims) {
    const { width, height } = parseDimensions(dimStr);
    const outPath = path.join(outputDir, `placeholder-${width}x${height}.${ext}`);
    const buf = await generate(
      defaults({
        width,
        height,
        bg: bg ?? "#cccccc",
        color: color ?? "#555555",
        format,
      }),
    );
    fs.writeFileSync(outPath, buf);
    console.log(`Created ${outPath} (${width}x${height})`);
  }

  console.log(`Batch complete: ${dims.length} images in ${outputDir}`);
}

// ── Help ─────────────────────────────────────────────────────────────

function printUsage(): void {
  console.log(`
placeholder - Local placeholder image generator

USAGE:
  placeholder <WxH> [options]           Generate placeholder image
  placeholder avatar <size> [options]   Generate circular avatar
  placeholder banner <WxH> [options]    Generate banner image
  placeholder batch <WxH>... [options]  Generate multiple sizes
  placeholder --serve [--port N]        Start API server (default: 3460)

OPTIONS:
  --text "..."     Custom text overlay
  --bg "#hex"      Background color (default: #cccccc)
  --color "#hex"   Text color (default: #555555)
  --format fmt     Output format: png, jpg, webp (default: png)
  -o, --output     Output path (or directory for batch)
  --serve          Start HTTP API server
  --port N         Server port (default: 3460)

EXAMPLES:
  placeholder 400x300
  placeholder 400x300 --text "Hero" --bg "#3498db" --color "#fff"
  placeholder avatar 128 --initials "ZK"
  placeholder banner 1200x400 --text "Welcome"
  placeholder batch 100x100 200x200 400x300 --output ./placeholders/
  placeholder --serve --port 3460
`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printUsage();
    return;
  }

  // Server mode
  if (hasFlag(args, "--serve")) {
    const portStr = getFlag(args, "--port");
    const port = portStr ? parseInt(portStr, 10) : 3460;
    startServer(port);
    return;
  }

  const command = args[0];

  switch (command) {
    case "avatar":
      await cmdAvatar(args.slice(1));
      break;
    case "banner":
      await cmdBanner(args.slice(1));
      break;
    case "batch":
      await cmdBatch(args.slice(1));
      break;
    default:
      // Treat as dimension string
      await cmdPlaceholder(args);
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
