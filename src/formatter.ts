import sharp from "sharp";

export type ImageFormat = "png" | "jpg" | "webp";

const VALID_FORMATS: ReadonlySet<string> = new Set(["png", "jpg", "webp"]);

export function parseFormat(input: string | undefined): ImageFormat {
  if (!input) return "png";
  const f = input.toLowerCase().replace("jpeg", "jpg");
  if (!VALID_FORMATS.has(f)) {
    throw new Error(`Unsupported format "${input}". Use: png, jpg, webp`);
  }
  return f as ImageFormat;
}

export function applyFormat(
  pipeline: sharp.Sharp,
  format: ImageFormat,
): sharp.Sharp {
  switch (format) {
    case "png":
      return pipeline.png();
    case "jpg":
      return pipeline.jpeg({ quality: 90 });
    case "webp":
      return pipeline.webp({ quality: 90 });
  }
}

export function mimeType(format: ImageFormat): string {
  const map: Record<ImageFormat, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
  };
  return map[format];
}

export function fileExtension(format: ImageFormat): string {
  return format === "jpg" ? "jpg" : format;
}
