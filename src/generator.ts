import sharp from "sharp";
import { ImageFormat, applyFormat } from "./formatter";

export interface GeneratorOptions {
  width: number;
  height: number;
  bg: string;
  color: string;
  text?: string;
  format: ImageFormat;
}

const DEFAULT_BG = "#cccccc";
const DEFAULT_COLOR = "#555555";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function computeFontSize(
  text: string,
  width: number,
  height: number,
): number {
  const maxByWidth = Math.floor(width / (text.length * 0.6));
  const maxByHeight = Math.floor(height * 0.3);
  return Math.max(12, Math.min(maxByWidth, maxByHeight, 120));
}

function buildSvgOverlay(
  text: string,
  width: number,
  height: number,
  color: string,
): Buffer {
  const fontSize = computeFontSize(text, width, height);
  const svg = `<svg width="${width}" height="${height}">
  <text
    x="50%" y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="sans-serif"
    font-size="${fontSize}"
    font-weight="600"
    fill="${color}"
  >${escapeXml(text)}</text>
</svg>`;
  return Buffer.from(svg);
}

export function defaults(
  partial: Partial<GeneratorOptions> & { width: number; height: number },
): GeneratorOptions {
  return {
    bg: DEFAULT_BG,
    color: DEFAULT_COLOR,
    format: "png",
    ...partial,
  };
}

export async function generate(opts: GeneratorOptions): Promise<Buffer> {
  const { width, height, bg, color, format } = opts;
  const text = opts.text ?? `${width}x${height}`;

  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bg,
    },
  });

  const overlay = buildSvgOverlay(text, width, height, color);
  pipeline = pipeline.composite([{ input: overlay, top: 0, left: 0 }]);
  pipeline = applyFormat(pipeline, format);

  return pipeline.toBuffer();
}

export function parseDimensions(input: string): { width: number; height: number } {
  const match = input.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid dimensions "${input}". Expected format: WIDTHxHEIGHT (e.g. 400x300)`,
    );
  }
  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  if (width < 1 || height < 1 || width > 8192 || height > 8192) {
    throw new Error("Dimensions must be between 1 and 8192");
  }
  return { width, height };
}
