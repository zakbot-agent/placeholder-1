import sharp from "sharp";
import { ImageFormat, applyFormat } from "./formatter";

export interface AvatarOptions {
  size: number;
  initials?: string;
  bg: string;
  color: string;
  format: ImageFormat;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildCircleSvg(
  size: number,
  bg: string,
  color: string,
  text: string,
): Buffer {
  const fontSize = Math.floor(size * 0.4);
  const r = size / 2;
  const svg = `<svg width="${size}" height="${size}">
  <circle cx="${r}" cy="${r}" r="${r}" fill="${bg}" />
  <text
    x="50%" y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="${color}"
  >${escapeXml(text)}</text>
</svg>`;
  return Buffer.from(svg);
}

export function avatarDefaults(
  partial: Partial<AvatarOptions> & { size: number },
): AvatarOptions {
  return {
    bg: "#3498db",
    color: "#ffffff",
    format: "png",
    ...partial,
  };
}

export async function generateAvatar(opts: AvatarOptions): Promise<Buffer> {
  const { size, bg, color, format } = opts;
  const text = opts.initials ?? "?";

  const circleSvg = buildCircleSvg(size, bg, color, text);

  // Create transparent base, composite the SVG circle on top
  let pipeline = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: circleSvg, top: 0, left: 0 }]);

  pipeline = applyFormat(pipeline, format);
  return pipeline.toBuffer();
}
