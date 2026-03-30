import http from "node:http";
import { URL } from "node:url";
import { generate, defaults, parseDimensions } from "./generator";
import { generateAvatar, avatarDefaults } from "./avatar";
import { parseFormat, mimeType, ImageFormat } from "./formatter";

const DEFAULT_PORT = 3460;

function normalizeColor(raw: string | null): string | undefined {
  if (!raw) return undefined;
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function extractFormatFromPath(path: string): { clean: string; format?: ImageFormat } {
  const match = path.match(/^(.+)\.(png|jpg|jpeg|webp)$/);
  if (match) {
    const fmt = match[2].replace("jpeg", "jpg") as ImageFormat;
    return { clean: match[1], format: fmt };
  }
  return { clean: path };
}

function homePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Placeholder Image API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #333; }
    h1 { margin-bottom: 0.5rem; }
    p.sub { color: #666; margin-bottom: 2rem; }
    h2 { margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.25rem; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 0.5rem 0; }
    .examples img { margin: 0.5rem 0.5rem 0.5rem 0; border: 1px solid #ddd; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Placeholder Image API</h1>
  <p class="sub">Generate placeholder images on the fly.</p>

  <h2>Basic Usage</h2>
  <pre>GET /400x300          — 400x300 PNG
GET /400x300.webp     — WebP format
GET /400x300?text=Hi  — Custom text</pre>

  <h2>Query Parameters</h2>
  <pre>text   — Custom text overlay
bg     — Background color (hex without #)
color  — Text color (hex without #)
format — Output format: png, jpg, webp</pre>

  <h2>Avatars</h2>
  <pre>GET /avatar/128               — 128x128 circle avatar
GET /avatar/128?initials=ZK   — With initials
GET /avatar/128?bg=e74c3c     — Custom background</pre>

  <h2>Live Examples</h2>
  <div class="examples">
    <img src="/300x100?text=300x100" alt="300x100">
    <img src="/avatar/64?initials=PH" alt="avatar">
    <img src="/200x80?bg=3498db&color=fff&text=Blue" alt="blue">
  </div>
</body>
</html>`;
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Homepage
  if (pathname === "/" || pathname === "/favicon.ico") {
    if (pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(homePage());
    return;
  }

  try {
    const params = url.searchParams;
    const formatParam = params.get("format") ?? undefined;

    // Avatar endpoint: /avatar/128
    const avatarMatch = pathname.match(/^\/avatar\/(\d+)/);
    if (avatarMatch) {
      const size = parseInt(avatarMatch[1], 10);
      if (size < 1 || size > 2048) throw new Error("Avatar size must be 1-2048");

      const { format: extFormat } = extractFormatFromPath(pathname);
      const format = parseFormat(formatParam ?? extFormat);

      const buf = await generateAvatar(
        avatarDefaults({
          size,
          initials: params.get("initials") ?? undefined,
          bg: normalizeColor(params.get("bg")) ?? "#3498db",
          color: normalizeColor(params.get("color")) ?? "#ffffff",
          format,
        }),
      );

      res.writeHead(200, {
        "Content-Type": mimeType(format),
        "Cache-Control": "public, max-age=86400",
      });
      res.end(buf);
      return;
    }

    // Placeholder endpoint: /400x300 or /400x300.webp
    const { clean, format: extFormat } = extractFormatFromPath(pathname);
    const dimStr = clean.replace(/^\//, "");
    const { width, height } = parseDimensions(dimStr);
    const format = parseFormat(formatParam ?? extFormat);

    const buf = await generate(
      defaults({
        width,
        height,
        text: params.get("text") ?? undefined,
        bg: normalizeColor(params.get("bg")) ?? "#cccccc",
        color: normalizeColor(params.get("color")) ?? "#555555",
        format,
      }),
    );

    res.writeHead(200, {
      "Content-Type": mimeType(format),
      "Cache-Control": "public, max-age=86400",
    });
    res.end(buf);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
}

export function startServer(port: number = DEFAULT_PORT): void {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error("Unhandled error:", err);
      res.writeHead(500);
      res.end("Internal Server Error");
    });
  });

  server.listen(port, () => {
    console.log(`Placeholder API running on http://localhost:${port}`);
    console.log("Endpoints:");
    console.log("  GET /{width}x{height}      — Placeholder image");
    console.log("  GET /avatar/{size}          — Avatar image");
    console.log("  GET /                       — Documentation");
  });
}
