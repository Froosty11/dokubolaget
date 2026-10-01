// Reads the type and pixel size from a PNG or WebP header. Anything else
// (SVG included, which can carry scripts) returns null.
export type ImageInfo = { type: "image/png" | "image/webp"; width: number; height: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function imageInfo(input: Uint8Array): ImageInfo | null {
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (buf.length >= 24 && PNG_SIGNATURE.every((b, i) => buf[i] === b) && buf.toString("ascii", 12, 16) === "IHDR") {
    return { type: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const format = buf.toString("ascii", 12, 16);
    if (format === "VP8 ") {
      return { type: "image/webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (format === "VP8L" && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      return { type: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (format === "VP8X") {
      return { type: "image/webp", width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    }
  }
  return null;
}
